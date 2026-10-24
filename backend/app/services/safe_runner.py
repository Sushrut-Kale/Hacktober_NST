"""
Safe Execution Runner for VIKASA.

Enforces workspace boundary checks, command allowlisting, timeouts,
and structured evidence collection.
"""

import os
import shlex
import subprocess
import logging
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from backend.app.schemas.core import (
    ExecutionRun,
    EvidenceItem,
    EvidenceType,
)

logger = logging.getLogger(__name__)

ALLOWLISTED_BINARIES = {
    "pytest",
    "python",
    "python3",
    "py",
    "git",
}

class SafeExecutionRunner:
    def __init__(self, default_workspace: Optional[str] = None):
        self.default_workspace = os.path.abspath(default_workspace or os.getcwd())

    def validate_workspace(self, workspace_path: Optional[str]) -> str:
        """
        Validates that the workspace exists and is a safe directory without null bytes,
        UNC network shares, or DOS device paths. Resolves symlinks safely.
        """
        if workspace_path and "\0" in workspace_path:
            raise ValueError("Workspace path contains invalid null bytes.")

        raw_path = (workspace_path or self.default_workspace).strip()
        # Reject UNC paths (e.g. \\evil-share\share or //evil-share) to prevent SMB relay attacks
        if raw_path.startswith(("\\\\", "//")):
            raise ValueError("Network UNC paths are not permitted for workspaces.")

        # Reject Windows reserved device names (CON, PRN, AUX, NUL, COM1..9, LPT1..9)
        base_name = os.path.basename(raw_path).split(".")[0].upper()
        reserved_devices = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}
        if base_name in reserved_devices:
            raise ValueError(f"Reserved device name '{base_name}' is not a valid workspace directory.")

        target = os.path.realpath(os.path.abspath(raw_path))
        if not os.path.isdir(target):
            raise ValueError(f"Workspace path does not exist or is not a directory: {target}")
        return target

    def validate_command(self, command: str) -> List[str]:
        """
        Validates that the command uses an allowlisted binary and contains no dangerous shell injection.
        """
        if command and "\0" in command:
            raise ValueError("Command contains invalid null bytes.")

        stripped = command.strip()
        if not stripped:
            raise ValueError("Empty command cannot be executed.")

        # Disallow dangerous shell metacharacters
        forbidden_operators = ["&&", "||", "|", ">", "<", "`", "$("]
        for op in forbidden_operators:
            if op in stripped:
                raise ValueError(f"Forbidden shell metacharacter '{op}' in command: '{command}'")

        try:
            # Parse tokens using shlex
            parts = shlex.split(stripped, posix=False)
        except Exception as e:
            raise ValueError(f"Failed to parse command line safely: {e}")

        if not parts:
            raise ValueError("No executable command found.")

        # Check for unquoted shell separators like ';' outside argument strings
        if ";" in parts:
            raise ValueError(f"Forbidden shell separator ';' detected in command: '{command}'")

        cleaned_parts = []
        for p in parts:
            # Strip matching outer quotes added by non-posix shlex on Windows
            if (p.startswith('"') and p.endswith('"')) or (p.startswith("'") and p.endswith("'")):
                cleaned_parts.append(p[1:-1])
            else:
                cleaned_parts.append(p)

        binary = os.path.basename(cleaned_parts[0]).lower()
        if binary.endswith(".exe"):
            binary = binary[:-4]

        # Check binary allowlist
        if binary not in ALLOWLISTED_BINARIES:
            raise ValueError(
                f"Binary '{binary}' is not permitted. Only allowlisted tools ({', '.join(sorted(ALLOWLISTED_BINARIES))}) may be run."
            )

        return cleaned_parts

    def _capture_git_diff(self, workspace: str) -> Optional[str]:
        """
        Safely captures git diff within the workspace if it is a git repository.
        """
        try:
            git_check = subprocess.run(
                ["git", "rev-parse", "--is-inside-work-tree"],
                cwd=workspace,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if git_check.returncode == 0:
                diff_res = subprocess.run(
                    ["git", "diff", "HEAD"],
                    cwd=workspace,
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                if diff_res.returncode == 0:
                    return diff_res.stdout.strip() or None
        except Exception as e:
            logger.debug("Could not capture git diff in %s: %s", workspace, e)
        return None

    MAX_OUTPUT_BYTES: int = 512 * 1024  # 512 KB

    @staticmethod
    def _cap_output(text: Optional[str], max_bytes: int = 512 * 1024) -> str:
        if not text:
            return ""
        encoded = text.encode("utf-8", errors="replace")
        if len(encoded) <= max_bytes:
            return text
        return encoded[:max_bytes].decode("utf-8", errors="replace") + "\n\n[TRUNCATED: Output exceeded 512 KB limit]"

    @staticmethod
    def _redact_secrets(text: Optional[str]) -> str:
        """
        Redacts sensitive tokens, credentials, and password URLs from logs and evidence.
        """
        if not text:
            return ""
        import re
        # Redact URL credentials: http(s)://user:pass@host
        redacted = re.sub(r'(https?://)[^:\s/@]+:[^@\s/]+@', r'\1[REDACTED_AUTH]@', text)
        # Redact common token patterns: ghp_..., eyJ... (JWTs), Bearer tokens
        redacted = re.sub(r'ghp_[A-Za-z0-9_]{30,}', '[REDACTED_GH_TOKEN]', redacted)
        redacted = re.sub(r'(?i)(bearer\s+)[A-Za-z0-9._~+/-]{20,}', r'\1[REDACTED_BEARER]', redacted)
        redacted = re.sub(r'(?i)(--api[-_]?key\s*=\s*)[^\s]+', r'\1[REDACTED_KEY]', redacted)
        redacted = re.sub(r'(?i)(--password\s*=\s*)[^\s]+', r'\1[REDACTED_PASSWORD]', redacted)
        return redacted

    @staticmethod
    def _terminate_process_tree(pid: int):
        """
        Terminates a process and any child processes it spawned to prevent orphaned processes on Windows.
        """
        if os.name == "nt":
            try:
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=5,
                )
            except Exception:
                pass
        else:
            try:
                import signal
                os.kill(pid, signal.SIGKILL)
            except Exception:
                pass

    @staticmethod
    def _get_sanitized_environment() -> dict:
        """
        Sanitizes environment variables to prevent leaking credentials or secrets into subprocess runs.
        """
        sensitive_substrings = (
            "KEY", "SECRET", "TOKEN", "PASSWORD", "PASSWD", "AUTH",
            "CREDENTIAL", "PRIVATE", "DATABASE_URL", "MONGO_URI",
            "REDIS_URL", "POSTGRES_URL", "SENTRY_DSN", "CONN_STR",
            "API_URL", "PAT", "BEARER", "SIGNATURE", "CERT"
        )
        sanitized = {}
        for k, v in os.environ.items():
            k_upper = k.upper()
            if any(sens in k_upper for sens in sensitive_substrings):
                continue
            sanitized[k] = v
        return sanitized

    def execute_command(
        self,
        task_id: str,
        command: str,
        criterion_id: Optional[str] = None,
        workspace_path: Optional[str] = None,
        timeout_seconds: float = 30.0,
    ) -> ExecutionRun:
        """
        Executes a validated command in the approved workspace with timeout and evidence capture.
        """
        workspace = self.validate_workspace(workspace_path)
        cmd_args = self.validate_command(command)

        run_id = f"run-{uuid.uuid4().hex[:8]}"
        started_at = datetime.now(timezone.utc)
        stdout = ""
        stderr = ""
        exit_code = None
        status = "COMPLETED"

        proc = None
        try:
            proc = subprocess.Popen(
                cmd_args,
                cwd=workspace,
                env=self._get_sanitized_environment(),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            raw_stdout, raw_stderr = proc.communicate(timeout=timeout_seconds)
            exit_code = proc.returncode
            stdout = self._redact_secrets(self._cap_output(raw_stdout))
            stderr = self._redact_secrets(self._cap_output(raw_stderr))
            status = "COMPLETED" if exit_code == 0 else "FAILED"
        except subprocess.TimeoutExpired as te:
            logger.warning("Execution timed out after %s seconds: %s", timeout_seconds, command)
            if proc:
                self._terminate_process_tree(proc.pid)
                try:
                    proc.kill()
                except Exception:
                    pass
            status = "TIMEOUT"
            exit_code = -1
            stdout = self._redact_secrets(self._cap_output(te.stdout or ""))
            stderr = f"Execution timed out after {timeout_seconds} seconds"
        except Exception as e:
            logger.error("Execution error: %s", e)
            if proc:
                self._terminate_process_tree(proc.pid)
            status = "ERROR"
            exit_code = -1
            stderr = self._redact_secrets(str(e))

        completed_at = datetime.now(timezone.utc)
        git_diff = self._capture_git_diff(workspace)

        # Build evidence items
        evidence_items: List[EvidenceItem] = []

        # 1. Command exit code evidence
        evidence_items.append(
            EvidenceItem(
                criterion_id=criterion_id,
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content=f"Executed '{command}' in {workspace}. Exit status: {exit_code}",
                exit_code=exit_code,
                passed=(exit_code == 0),
            )
        )

        # 2. Output evidence (stdout/stderr)
        combined_output = stdout.strip()
        if stderr.strip():
            combined_output += f"\n[stderr]\n{stderr.strip()}"
        if combined_output:
            evidence_items.append(
                EvidenceItem(
                    criterion_id=criterion_id,
                    evidence_type=EvidenceType.TEST_OUTPUT,
                    content=combined_output,
                    exit_code=exit_code,
                    passed=(exit_code == 0),
                )
            )

        # 3. Git diff evidence if available
        if git_diff:
            evidence_items.append(
                EvidenceItem(
                    criterion_id=criterion_id,
                    evidence_type=EvidenceType.GIT_DIFF,
                    content=git_diff,
                    passed=True,
                )
            )

        return ExecutionRun(
            run_id=run_id,
            task_id=task_id,
            started_at=started_at,
            completed_at=completed_at,
            status=status,
            command=command,
            exit_code=exit_code,
            stdout=stdout,
            stderr=stderr,
            source="LOCAL_EXECUTION_RUNNER",
            git_diff=git_diff,
            evidence_items=evidence_items,
        )
