"""
Evidence Collection Service for VIKASA.

Responsible for:
- Deterministic extraction of Git status and diffs
- Safe, sandboxed execution of test and verification commands
- Capturing stdout, stderr, exit codes, and durations
- Security guardrails preventing arbitrary command execution
"""

import os
import shutil
import subprocess
from typing import List, Optional, Dict, Any

from backend.app.schemas.core import (
    EvidenceItem,
    EvidenceType,
    ExecutionClaim,
    Task,
    ClaimVsRealityReport,
)
from backend.app.services.verification_engine import DeterministicVerificationEngine

# Allowed executables for verification runs to prevent arbitrary command injection
ALLOWED_COMMAND_BINARIES = {
    "pytest",
    "python",
    "python3",
    "py",
    "git",
    "npm",
    "uv",
    "cargo",
    "go",
}


class EvidenceCollector:
    """
    Safely captures empirical evidence from local repositories and test runs.
    """

    def __init__(self, verification_engine: Optional[DeterministicVerificationEngine] = None):
        self.engine = verification_engine or DeterministicVerificationEngine()

    @staticmethod
    def validate_repo_path(repo_path: str) -> str:
        """
        Validates that a repository directory exists and is a valid directory,
        rejecting null bytes, network UNC shares, and DOS device names.
        """
        if not repo_path or not isinstance(repo_path, str):
            raise ValueError("Repository path must be a non-empty string.")
        if "\0" in repo_path:
            raise ValueError("Repository path contains invalid null bytes.")

        raw_path = repo_path.strip()
        if raw_path.startswith(("\\\\", "//")):
            raise ValueError("Network UNC paths are not permitted for repository paths.")

        base_name = os.path.basename(raw_path).split(".")[0].upper()
        reserved_devices = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}
        if base_name in reserved_devices:
            raise ValueError(f"Reserved device name '{base_name}' is not a valid repository path.")

        abs_path = os.path.realpath(os.path.abspath(raw_path))
        if not os.path.exists(abs_path):
            raise ValueError(f"Repository path does not exist: {abs_path}")
        if not os.path.isdir(abs_path):
            raise ValueError(f"Repository path is not a directory: {abs_path}")

        return abs_path

    def collect_git_evidence(
        self, repo_path: str, criterion_id: Optional[str] = None, timeout_seconds: float = 15.0
    ) -> List[EvidenceItem]:
        """
        Collects real git status and git diff information without mutating repository files.
        """
        try:
            valid_path = self.validate_repo_path(repo_path)
        except ValueError as err:
            return [
                EvidenceItem(
                    criterion_id=criterion_id,
                    evidence_type=EvidenceType.LOG_OUTPUT,
                    content=f"Git evidence unavailable: {str(err)}",
                    exit_code=1,
                    passed=False,
                )
            ]

        # Check if git is available in environment
        git_bin = shutil.which("git")
        if not git_bin:
            return [
                EvidenceItem(
                    criterion_id=criterion_id,
                    evidence_type=EvidenceType.LOG_OUTPUT,
                    content="Git evidence unavailable: git executable not found in PATH.",
                    exit_code=1,
                    passed=None,
                )
            ]

        items: List[EvidenceItem] = []

        # 1. Capture git status --porcelain
        try:
            status_proc = subprocess.run(
                [git_bin, "status", "--porcelain"],
                cwd=valid_path,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
                shell=False,
            )
            if status_proc.returncode == 0:
                items.append(
                    EvidenceItem(
                        criterion_id=criterion_id,
                        evidence_type=EvidenceType.FILE_CONTENT,
                        content=status_proc.stdout.strip() or "Clean working directory (no untracked or modified files)",
                        exit_code=0,
                        passed=True,
                    )
                )
            else:
                items.append(
                    EvidenceItem(
                        criterion_id=criterion_id,
                        evidence_type=EvidenceType.LOG_OUTPUT,
                        content=f"git status exited with code {status_proc.returncode}: {status_proc.stderr.strip()}",
                        exit_code=status_proc.returncode,
                        passed=False,
                    )
                )
        except subprocess.TimeoutExpired:
            items.append(
                EvidenceItem(
                    criterion_id=criterion_id,
                    evidence_type=EvidenceType.LOG_OUTPUT,
                    content=f"git status timed out after {timeout_seconds} seconds.",
                    exit_code=-1,
                    passed=False,
                )
            )
        except Exception as exc:
            items.append(
                EvidenceItem(
                    criterion_id=criterion_id,
                    evidence_type=EvidenceType.LOG_OUTPUT,
                    content=f"Error executing git status: {str(exc)}",
                    exit_code=-1,
                    passed=False,
                )
            )

        # 2. Capture git diff
        try:
            diff_proc = subprocess.run(
                [git_bin, "diff", "HEAD"],
                cwd=valid_path,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
                shell=False,
            )
            # If git diff HEAD fails (e.g. initial repository with no commits yet), fallback to plain git diff
            if diff_proc.returncode != 0:
                diff_proc = subprocess.run(
                    [git_bin, "diff"],
                    cwd=valid_path,
                    capture_output=True,
                    text=True,
                    timeout=timeout_seconds,
                    shell=False,
                )

            diff_text = diff_proc.stdout.strip()
            items.append(
                EvidenceItem(
                    criterion_id=criterion_id,
                    evidence_type=EvidenceType.GIT_DIFF,
                    content=diff_text or "No diff recorded (HEAD matches working directory).",
                    exit_code=diff_proc.returncode,
                    passed=True if diff_text else None,
                )
            )
        except subprocess.TimeoutExpired:
            items.append(
                EvidenceItem(
                    criterion_id=criterion_id,
                    evidence_type=EvidenceType.LOG_OUTPUT,
                    content=f"git diff timed out after {timeout_seconds} seconds.",
                    exit_code=-1,
                    passed=False,
                )
            )
        except Exception as exc:
            items.append(
                EvidenceItem(
                    criterion_id=criterion_id,
                    evidence_type=EvidenceType.LOG_OUTPUT,
                    content=f"Error executing git diff: {str(exc)}",
                    exit_code=-1,
                    passed=False,
                )
            )

        return items

    def execute_test_command(
        self,
        command: List[str],
        cwd: str,
        criterion_id: Optional[str] = None,
        timeout_seconds: float = 30.0,
    ) -> EvidenceItem:
        """
        Safely executes a whitelisted test command inside the given directory and captures results.
        Enforces security guardrails: no shell execution, strict executable whitelist, timeouts.
        """
        if not command or not isinstance(command, list):
            return EvidenceItem(
                criterion_id=criterion_id,
                evidence_type=EvidenceType.LOG_OUTPUT,
                content="Execution blocked: Command must be a non-empty list of arguments.",
                exit_code=-1,
                passed=False,
            )

        binary_name = os.path.basename(command[0]).lower()
        if binary_name.endswith(".exe"):
            binary_name = binary_name[:-4]

        if binary_name not in ALLOWED_COMMAND_BINARIES:
            return EvidenceItem(
                criterion_id=criterion_id,
                evidence_type=EvidenceType.LOG_OUTPUT,
                content=f"Execution blocked: Executable '{binary_name}' is not in the allowed verification whitelist {sorted(ALLOWED_COMMAND_BINARIES)}.",
                exit_code=-1,
                passed=False,
            )

        try:
            valid_cwd = self.validate_repo_path(cwd)
        except ValueError as err:
            return EvidenceItem(
                criterion_id=criterion_id,
                evidence_type=EvidenceType.LOG_OUTPUT,
                content=f"Execution blocked: {str(err)}",
                exit_code=-1,
                passed=False,
            )

        proc = None
        try:
            import re
            sensitive_substrings = (
                "KEY", "SECRET", "TOKEN", "PASSWORD", "PASSWD", "AUTH",
                "CREDENTIAL", "PRIVATE", "DATABASE_URL", "MONGO_URI",
                "REDIS_URL", "POSTGRES_URL", "SENTRY_DSN", "CONN_STR",
                "API_URL", "PAT", "BEARER", "SIGNATURE", "CERT"
            )
            sanitized_env = {
                k: v for k, v in os.environ.items()
                if not any(sens in k.upper() for sens in sensitive_substrings)
            }

            proc = subprocess.Popen(
                command,
                cwd=valid_cwd,
                env=sanitized_env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            raw_stdout, raw_stderr = proc.communicate(timeout=timeout_seconds)
            raw_output = (raw_stdout or "") + ("\n" + raw_stderr if raw_stderr else "")
            max_bytes = 512 * 1024
            encoded = raw_output.encode("utf-8", errors="replace")
            if len(encoded) > max_bytes:
                output = encoded[:max_bytes].decode("utf-8", errors="replace") + "\n\n[TRUNCATED: Output exceeded 512 KB limit]"
            else:
                output = raw_output

            # Redact secrets from output
            output = re.sub(r'(https?://)[^:\s/@]+:[^@\s/]+@', r'\1[REDACTED_AUTH]@', output)
            output = re.sub(r'ghp_[A-Za-z0-9_]{30,}', '[REDACTED_GH_TOKEN]', output)
            output = re.sub(r'(?i)(bearer\s+)[A-Za-z0-9._~+/-]{20,}', r'\1[REDACTED_BEARER]', output)
            output = re.sub(r'(?i)(--api[-_]?key\s*=\s*)[^\s]+', r'\1[REDACTED_KEY]', output)
            output = re.sub(r'(?i)(--password\s*=\s*)[^\s]+', r'\1[REDACTED_PASSWORD]', output)

            return EvidenceItem(
                criterion_id=criterion_id,
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content=output.strip() or f"Command exited with code {proc.returncode}",
                exit_code=proc.returncode,
                passed=(proc.returncode == 0),
            )
        except subprocess.TimeoutExpired:
            if proc:
                try:
                    if os.name == "nt":
                        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
                    else:
                        proc.kill()
                except Exception:
                    pass
            return EvidenceItem(
                criterion_id=criterion_id,
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content=f"Command timed out after {timeout_seconds} seconds.",
                exit_code=-1,
                passed=False,
            )
        except Exception as exc:
            if proc:
                try:
                    if os.name == "nt":
                        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
                    else:
                        proc.kill()
                except Exception:
                    pass
            return EvidenceItem(
                criterion_id=criterion_id,
                evidence_type=EvidenceType.LOG_OUTPUT,
                content=f"Execution failed with error: {str(exc)}",
                exit_code=-1,
                passed=False,
            )

    def collect_and_verify(
        self,
        task: Task,
        claim: ExecutionClaim,
        repo_path: Optional[str] = None,
        test_command: Optional[List[str]] = None,
        timeout_seconds: float = 30.0,
    ) -> ClaimVsRealityReport:
        """
        Collects real git and execution evidence when available, attaches it to the claim,
        runs deterministic verification, and produces a Claim vs Reality report.
        """
        collected_evidence: List[EvidenceItem] = list(claim.evidence_list)

        # 1. Collect real git status and diff
        if repo_path:
            git_items = self.collect_git_evidence(repo_path=repo_path, timeout_seconds=timeout_seconds)
            collected_evidence.extend(git_items)

            # Auto-populate git_diff on claim if missing
            for item in git_items:
                if item.evidence_type == EvidenceType.GIT_DIFF and not claim.git_diff:
                    claim.git_diff = item.content

        # 2. Run real test command if requested
        if test_command and repo_path:
            cmd_item = self.execute_test_command(
                command=test_command,
                cwd=repo_path,
                criterion_id=task.acceptance_criteria[0].id if task.acceptance_criteria else None,
                timeout_seconds=timeout_seconds,
            )
            collected_evidence.append(cmd_item)

        # Update claim's evidence list with verified collected evidence
        claim.evidence_list = collected_evidence

        # 3. Evaluate deterministic verification
        verification_result = self.engine.evaluate(task, claim)

        # 4. Generate structured Claim vs Reality report
        return self.engine.generate_claim_vs_reality_report(task, claim, verification_result)
