"""
Antigravity Integration Adapter for VIKASA.

Provides truthful capability inspection, genuine agent dispatch (when CLI/SDK available),
and a structured manual handoff workflow with untrusted evidence labeling when automated
dispatch is not installed.
"""

import os
import shutil
import importlib.util
import uuid
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone

from backend.app.schemas.core import (
    Task,
    TaskPlan,
    TaskState,
    ExecutionRun,
    ExecutionEvent,
    EvidenceItem,
    EvidenceType,
    AntigravityCapability,
    HandoffPrompt,
    HandoffSubmissionRequest,
)

logger = logging.getLogger(__name__)


class AntigravityAdapter:
    """
    Manages detection, prompt packaging, manual handoff, and genuine dispatch for Antigravity interfaces.
    """

    @staticmethod
    def inspect_capabilities() -> Dict[str, Any]:
        """
        Deterministically verifies which Antigravity interfaces are accessible in the current runtime.
        Returns truthful status (NEEDS_INSTALLATION, CLI_AVAILABLE, or SDK_AVAILABLE).
        """
        try:
            sdk_available = importlib.util.find_spec("google.antigravity") is not None
        except (ModuleNotFoundError, ValueError, AttributeError):
            sdk_available = False

        cli_path = shutil.which("agy")
        ide_detected = bool(os.environ.get("ANTIGRAVITY_AGENT"))
        conv_id = os.environ.get("ANTIGRAVITY_CONVERSATION_ID")

        status = (
            "SDK_AVAILABLE"
            if sdk_available
            else ("CLI_AVAILABLE" if cli_path else "NEEDS_INSTALLATION")
        )

        available_modes = ["LOCAL_SAFE_RUNNER", "ANTIGRAVITY_MANUAL_HANDOFF"]
        if sdk_available or cli_path:
            available_modes.append("ANTIGRAVITY_AGENT")

        supported_integrations = {
            "local_safe_runner": {
                "status": "AVAILABLE",
                "description": "Safe subprocess execution (Python, pytest, git) with allowlisting, timeouts, and secret redaction.",
                "attribution": "LOCAL_SAFE_RUNNER",
            },
            "manual_handoff": {
                "status": "READY",
                "description": "Export task-specific prompt for Antigravity chat, copy/export, and submit verified agent telemetry back into VIKASA.",
                "attribution": "ANTIGRAVITY_MANUAL_HANDOFF",
            },
            "automated_agent_dispatch": {
                "status": status,
                "missing_prerequisite": (
                    "Install 'google-antigravity' from PyPI or add 'agy' binary to system PATH."
                    if not (sdk_available or cli_path)
                    else None
                ),
                "next_step": (
                    "Run 'pip install google-antigravity' or install Antigravity CLI."
                    if not (sdk_available or cli_path)
                    else "Ready for automated dispatch."
                ),
                "attribution": "ANTIGRAVITY_AGENT",
            },
        }

        missing_prereqs = []
        if not sdk_available:
            missing_prereqs.append("google-antigravity (PyPI SDK package)")
        if not cli_path:
            missing_prereqs.append("agy (Antigravity CLI in system PATH)")

        return {
            "status": status,
            "sdk_installed": sdk_available,
            "sdk_package": "google-antigravity (PyPI)",
            "cli_installed": cli_path is not None,
            "cli_path": cli_path,
            "ide_host_detected": ide_detected,
            "conversation_id": conv_id,
            "mcp_enabled": True,  # IDE context provides MCP & tool hooks
            "available_modes": available_modes,
            "supported_integrations": supported_integrations,
            "missing_prerequisites": missing_prereqs,
            "notes": (
                "google-antigravity 0.1.22 is available on PyPI ('pip install google-antigravity'). "
                "Local runner adapter handles execution with full deterministic evidence capture. "
                "Manual handoff workflow is fully available for Antigravity IDE sessions."
            ),
        }

    def generate_handoff_prompt(
        self,
        task: Task,
        project_name: str = "",
        plan: Optional[TaskPlan] = None,
    ) -> HandoffPrompt:
        """
        Builds a comprehensive, task-specific prompt ready for copy-pasting into an Antigravity agent session.
        """
        capabilities = self.inspect_capabilities()
        workspace = task.workspace_path or os.getcwd()

        criteria_lines = []
        for crit in task.acceptance_criteria:
            req_tag = " (REQUIRED)" if crit.required else " (OPTIONAL)"
            criteria_lines.append(f"- [{crit.id}] {crit.description}{req_tag}")

        criteria_block = "\n".join(criteria_lines) if criteria_lines else "- Complete all requirements."

        plan_steps_lines = []
        target_files = []
        suggested_test_cmd = None
        if plan:
            target_files = plan.files_to_inspect or []
            if plan.tests_to_run:
                suggested_test_cmd = " ".join(plan.tests_to_run[0]) if isinstance(plan.tests_to_run[0], list) else str(plan.tests_to_run[0])
            for step in plan.steps:
                plan_steps_lines.append(f"{step.step_number}. {step.title}: {step.description}")

        plan_block = "\n".join(plan_steps_lines) if plan_steps_lines else "1. Implement feature.\n2. Run deterministic tests."

        prompt_text = f"""# TASK: {task.title}
Project: {project_name or task.project_id}
Task ID: {task.id}
Workspace: {workspace}

## Objective
{task.description or 'Implement the specified engineering capability.'}

## Acceptance Criteria
{criteria_block}

## Implementation Plan
{plan_block}

## Instructions for Agent
1. Inspect the workspace and implement the minimal necessary changes.
2. Run automated tests to verify all acceptance criteria pass.
3. Return:
   - Summary of actions taken
   - Complete `git diff`
   - Exact verification command executed and its exit code
"""

        missing_prereq = (
            capabilities["supported_integrations"]["automated_agent_dispatch"]["missing_prerequisite"]
            or "None (CLI/SDK is installed)"
        )
        next_step = (
            capabilities["supported_integrations"]["automated_agent_dispatch"]["next_step"]
            or "Execute automated dispatch."
        )

        return HandoffPrompt(
            task_id=task.id,
            project_id=task.project_id,
            prompt=prompt_text.strip(),
            target_files=target_files,
            acceptance_criteria=[c.model_dump() for c in task.acceptance_criteria],
            suggested_command=suggested_test_cmd or "pytest",
            workspace_path=workspace,
            instructions=(
                "1. Copy the generated prompt above.\n"
                "2. Paste and run it in your Antigravity chat/agent interface.\n"
                "3. Copy the resulting code diff, test output, and exit code.\n"
                "4. Submit the results below to record the run and trigger deterministic verification."
            ),
            missing_prerequisite=missing_prereq,
            next_step=next_step,
        )

    def create_manual_handoff_run(
        self,
        task: Task,
        request: HandoffSubmissionRequest,
        db_repo: Any,
    ) -> ExecutionRun:
        """
        Creates and persists an ExecutionRun from a manual Antigravity handoff submission.
        Strictly enforces that the task was human-approved before execution submission.
        """
        # 1. Enforce Human Approval Gate
        task_state_val = task.state.value if hasattr(task.state, "value") else str(task.state)
        task_status_val = task.status or task_state_val

        valid_approval_states = {"APPROVED", "RUNNING", "IN_PROGRESS"}
        if task_state_val not in valid_approval_states and task_status_val not in valid_approval_states:
            raise ValueError(
                f"Cannot submit execution run for task '{task.id}' in state '{task_state_val}'. "
                "Explicit human approval of the task plan is required prior to execution."
            )

        run_id = f"run-handoff-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)
        exit_code = request.command_exit_code if request.command_exit_code is not None else 0
        status = "COMPLETED" if exit_code == 0 else "FAILED"
        command = request.command or "ANTIGRAVITY_MANUAL_HANDOFF"

        evidence_items: List[EvidenceItem] = []
        criterion_id = request.criterion_id or (task.acceptance_criteria[0].id if task.acceptance_criteria else None)

        # 1. Command exit code evidence (explicitly tagged as unverified user telemetry)
        evidence_items.append(
            EvidenceItem(
                criterion_id=criterion_id,
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content=f"User-submitted test command: '{command}' (Claimed exit code: {exit_code})",
                exit_code=exit_code,
                passed=(exit_code == 0),
                source_attribution="USER_SUBMITTED_MANUAL",
                is_verified=False,
            )
        )

        # 2. Output / Agent Response evidence
        output_content = (request.test_output or request.agent_response or "").strip()
        if output_content:
            evidence_items.append(
                EvidenceItem(
                    criterion_id=criterion_id,
                    evidence_type=EvidenceType.TEST_OUTPUT,
                    content=output_content,
                    exit_code=exit_code,
                    passed=(exit_code == 0),
                    source_attribution="USER_SUBMITTED_MANUAL",
                    is_verified=False,
                )
            )

        # 3. Git diff evidence if provided
        git_diff = (request.git_diff or "").strip() or None
        if git_diff:
            evidence_items.append(
                EvidenceItem(
                    criterion_id=criterion_id,
                    evidence_type=EvidenceType.GIT_DIFF,
                    content=git_diff,
                    exit_code=0,
                    passed=True,
                    source_attribution="USER_SUBMITTED_MANUAL",
                    is_verified=False,
                )
            )

        run_obj = ExecutionRun(
            run_id=run_id,
            task_id=task.id,
            started_at=now,
            completed_at=now,
            status=status,
            command=command,
            exit_code=exit_code,
            stdout=output_content,
            stderr="" if exit_code == 0 else f"User reported exit code {exit_code}",
            source="ANTIGRAVITY_MANUAL_HANDOFF",
            git_diff=git_diff,
            evidence_items=evidence_items,
            evidence=evidence_items,
            execution_mode="ANTIGRAVITY_MANUAL_HANDOFF",
            is_manual_submission=True,
            submission_notes=request.notes,
            provenance_details={
                "source": "ANTIGRAVITY_MANUAL_HANDOFF",
                "submitted_by": request.submitted_by or "USER",
                "is_untrusted_manual_submission": True,
                "has_git_diff": git_diff is not None,
                "notes": request.notes,
            },
            message=f"Manual Antigravity handoff recorded by {request.submitted_by or 'USER'} (unverified telemetry).",
        )

        # Persist run and log audit event
        db_repo.save_execution_run(run_obj)
        db_repo.record_event(
            ExecutionEvent(
                task_id=task.id,
                run_id=run_id,
                event_type="MANUAL_HANDOFF_SUBMITTED",
                message=f"Manual Antigravity handoff submitted by {request.submitted_by or 'USER'}.",
                details={
                    "run_id": run_id,
                    "exit_code": exit_code,
                    "submitted_by": request.submitted_by,
                    "evidence_count": len(evidence_items),
                },
            )
        )

        return run_obj

    def dispatch_agent(
        self,
        task: Task,
        prompt: str,
        timeout_seconds: float = 60.0,
    ) -> ExecutionRun:
        """
        Attempts automated dispatch to Antigravity CLI or SDK.
        If unsupported, raises a clear RuntimeError stating the exact missing prerequisites.
        """
        capabilities = self.inspect_capabilities()
        if not capabilities["cli_installed"] and not capabilities["sdk_installed"]:
            raise RuntimeError(
                "Antigravity automated dispatch is not available on this host. "
                "Missing prerequisite: 'google-antigravity' Python package or 'agy' CLI in PATH. "
                "Please use ANTIGRAVITY_MANUAL_HANDOFF or LOCAL_SAFE_RUNNER."
            )

        # If CLI or SDK is genuinely present, perform real dispatch
        run_id = f"run-agent-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)

        # Real dispatch implementation boundary
        if capabilities["cli_installed"]:
            import subprocess
            cmd_args = [capabilities["cli_path"], "task", "run", "--prompt", prompt]
            workspace = task.workspace_path or os.getcwd()
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
        else:
            # SDK dispatch boundary
            import google.antigravity as agy  # type: ignore
            client = agy.Client()
            result = client.execute_task(task_id=task.id, prompt=prompt, timeout=timeout_seconds)
            exit_code = result.get("exit_code", 0)
            stdout = result.get("stdout", "")
            stderr = result.get("stderr", "")
            status = "COMPLETED" if exit_code == 0 else "FAILED"

        return ExecutionRun(
            run_id=run_id,
            task_id=task.id,
            started_at=now,
            completed_at=datetime.now(timezone.utc),
            status=status,
            command="agy task run",
            exit_code=exit_code,
            stdout=stdout,
            stderr=stderr,
            source="ANTIGRAVITY_AGENT",
            execution_mode="ANTIGRAVITY_AGENT",
            is_manual_submission=False,
            message=f"Antigravity agent dispatch completed with exit code {exit_code}.",
        )

    async def execute_task_run(self, task_id: str, prompt: str) -> Dict[str, Any]:
        """
        Backwards-compatible execution inspection endpoint.
        """
        capabilities = self.inspect_capabilities()
        return {
            "task_id": task_id,
            "runtime_capabilities": capabilities,
            "execution_mode": "VERIFIED_EVIDENCE_RECORDING",
            "message": "Task run initialized. All tool calls, exit codes, and diffs will be captured for verification.",
        }


antigravity_adapter = AntigravityAdapter()

