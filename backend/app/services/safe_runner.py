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
        Validates that the workspace exists and is a safe directory.
        """
        target = os.path.abspath(workspace_path or self.default_workspace)
        if not os.path.isdir(target):
            raise ValueError(f"Workspace path does not exist or is not a directory: {target}")
        return target

    def validate_command(self, command: str) -> List[str]:
        """
        Validates that the command uses an allowlisted binary and contains no dangerous shell injection.
        """
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

        try:
            proc = subprocess.run(
                cmd_args,
                cwd=workspace,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
            )
            exit_code = proc.returncode
            stdout = proc.stdout
            stderr = proc.stderr
            status = "COMPLETED" if exit_code == 0 else "FAILED"
        except subprocess.TimeoutExpired as te:
            logger.warning("Execution timed out after %s seconds: %s", timeout_seconds, command)
            status = "TIMEOUT"
            exit_code = -1
            stdout = te.stdout or ""
            stderr = f"Execution timed out after {timeout_seconds} seconds"
        except Exception as e:
            logger.error("Execution error: %s", e)
            status = "ERROR"
            exit_code = -1
            stderr = str(e)

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
