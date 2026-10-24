"""
Workflow Orchestration Service for VIKASA.
Manages end-to-end task lifecycle:
Plan → Approve → Execute → Record Evidence → Verify → Diagnose → Correct → Re-verify
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid

from backend.app.schemas.core import (
    Task,
    TaskState,
    AcceptanceCriterion,
    TaskPlan,
    ExecutionRun,
    ExecutionEvent,
    ExecutionClaim,
    VerificationResult,
    VerificationVerdict,
    FailureDiagnosis,
    RunReport,
    TaskDetail,
)
from backend.app.db.repository import DatabaseRepository
from backend.app.services.gemma_service import GemmaService
from backend.app.services.verification_engine import DeterministicVerificationEngine
from backend.app.services.safe_runner import SafeExecutionRunner

logger = logging.getLogger(__name__)

VALID_TRANSITIONS: Dict[TaskState, set] = {
    TaskState.CREATED: {TaskState.PLANNED},
    TaskState.PLANNED: {TaskState.APPROVED, TaskState.PLANNED},
    TaskState.APPROVED: {TaskState.RUNNING},
    TaskState.RUNNING: {TaskState.VERIFYING, TaskState.FAILED},
    TaskState.VERIFYING: {
        TaskState.VERIFIED,
        TaskState.FAILED,
        TaskState.REVIEW_REQUIRED,
        TaskState.BLOCKED,
        TaskState.NOT_RUN,
    },
    TaskState.FAILED: {TaskState.PLANNED, TaskState.APPROVED},
    TaskState.REVIEW_REQUIRED: {TaskState.PLANNED, TaskState.APPROVED},
    TaskState.BLOCKED: {TaskState.PLANNED, TaskState.APPROVED},
    TaskState.NOT_RUN: {TaskState.PLANNED, TaskState.APPROVED},
    TaskState.VERIFIED: set(),
}

class InvalidStateTransitionError(ValueError):
    pass

class WorkflowService:
    def __init__(
        self,
        repository: Optional[DatabaseRepository] = None,
        gemma_service: Optional[GemmaService] = None,
        verification_engine: Optional[DeterministicVerificationEngine] = None,
        safe_runner: Optional[SafeExecutionRunner] = None,
    ):
        self.repo = repository or DatabaseRepository()
        self.gemma = gemma_service or GemmaService()
        self.verifier = verification_engine or DeterministicVerificationEngine()
        self.runner = safe_runner or SafeExecutionRunner()

    def transition_task_state(self, task: Task, target_state: TaskState) -> Task:
        """
        Validates and applies a state transition, saving task state and logging an event.
        """
        current_state = task.state
        if target_state not in VALID_TRANSITIONS.get(current_state, set()):
            raise InvalidStateTransitionError(
                f"Invalid task state transition from {current_state.value} to {target_state.value}."
            )
        task.state = target_state
        task.updated_at = datetime.now(timezone.utc)
        self.repo.save_task(task)

        self.repo.record_event(
            ExecutionEvent(
                task_id=task.id,
                event_type="STATE_CHANGED",
                message=f"Task transitioned from {current_state.value} to {target_state.value}",
                details={"from": current_state.value, "to": target_state.value},
            )
        )
        return task

    def create_task(
        self,
        title: str,
        description: str,
        acceptance_criteria: List[AcceptanceCriterion],
        task_id: Optional[str] = None,
        workspace_path: Optional[str] = None,
    ) -> Task:
        """
        Creates and persists a new task in CREATED state.
        """
        tid = task_id or f"task-{uuid.uuid4().hex[:8]}"
        task = Task(
            id=tid,
            title=title,
            description=description,
            acceptance_criteria=acceptance_criteria,
            state=TaskState.CREATED,
            workspace_path=workspace_path,
        )
        self.repo.save_task(task)
        self.repo.record_event(
            ExecutionEvent(
                task_id=task.id,
                event_type="TASK_CREATED",
                message=f"Task '{title}' created with {len(acceptance_criteria)} criteria.",
                details={"title": title, "criteria_count": len(acceptance_criteria)},
            )
        )
        return task

    async def generate_and_save_plan(self, task_id: str, repo_context: Optional[str] = None) -> TaskPlan:
        """
        Generates structured plan via Gemma and transitions task to PLANNED.
        """
        task = self.repo.get_task(task_id)
        if not task:
            raise KeyError(f"Task '{task_id}' not found.")

        # Task can be planned from CREATED, or re-planned from FAILED/REVIEW_REQUIRED/BLOCKED/NOT_RUN/PLANNED
        if task.state not in [
            TaskState.CREATED,
            TaskState.PLANNED,
            TaskState.FAILED,
            TaskState.REVIEW_REQUIRED,
            TaskState.BLOCKED,
            TaskState.NOT_RUN,
        ]:
            raise InvalidStateTransitionError(
                f"Cannot generate plan while task is in '{task.state.value}' state."
            )

        plan = await self.gemma.generate_plan(task, repo_context=repo_context)
        self.repo.save_plan(plan)

        if task.state != TaskState.PLANNED:
            self.transition_task_state(task, TaskState.PLANNED)

        self.repo.record_event(
            ExecutionEvent(
                task_id=task.id,
                event_type="PLAN_GENERATED",
                message=f"Plan generated via {plan.model_name} (Status: {plan.generator_status.value})",
                details={
                    "model": plan.model_name,
                    "generator_status": plan.generator_status.value,
                    "step_count": len(plan.steps),
                },
            )
        )
        return plan

    def approve_plan(self, task_id: str, approved_by: str = "USER", notes: Optional[str] = None) -> Task:
        """
        Explicitly approves a generated plan, transitioning task to APPROVED.
        Execution is forbidden until approval is granted.
        """
        task = self.repo.get_task(task_id)
        if not task:
            raise KeyError(f"Task '{task_id}' not found.")

        plan = self.repo.get_plan(task_id)
        if not plan:
            raise ValueError(f"Task '{task_id}' has no generated plan to approve.")

        if task.state not in [
            TaskState.PLANNED,
            TaskState.FAILED,
            TaskState.REVIEW_REQUIRED,
            TaskState.BLOCKED,
            TaskState.NOT_RUN,
        ]:
            raise InvalidStateTransitionError(
                f"Cannot approve task in state '{task.state.value}'. Must be in PLANNED or recoverable state."
            )

        approved_at = datetime.now(timezone.utc)
        task.approved_at = approved_at
        self.transition_task_state(task, TaskState.APPROVED)

        self.repo.record_event(
            ExecutionEvent(
                task_id=task.id,
                event_type="PLAN_APPROVED",
                message=f"Plan approved by {approved_by}.",
                details={"approved_by": approved_by, "notes": notes},
            )
        )
        return task

    def execute_task(
        self,
        task_id: str,
        command: str,
        criterion_id: Optional[str] = None,
        timeout_seconds: float = 30.0,
    ) -> ExecutionRun:
        """
        Executes a safe allowlisted command within the approved workspace.
        Requires task to be in APPROVED state.
        """
        task = self.repo.get_task(task_id)
        if not task:
            raise KeyError(f"Task '{task_id}' not found.")

        if task.state != TaskState.APPROVED:
            raise InvalidStateTransitionError(
                f"Cannot execute task '{task_id}' in state '{task.state.value}'. Explicit user approval is required."
            )

        # Pre-validate workspace and command BEFORE transitioning task state to RUNNING.
        # This prevents leaving the task stuck in RUNNING if the command is malformed or forbidden.
        workspace = task.workspace_path or self.runner.default_workspace
        self.runner.validate_workspace(workspace)
        self.runner.validate_command(command)

        # Transition to RUNNING
        self.transition_task_state(task, TaskState.RUNNING)

        self.repo.record_event(
            ExecutionEvent(
                task_id=task.id,
                event_type="EXECUTION_STARTED",
                message=f"Executing allowlisted command: '{command}'",
                details={"command": command, "criterion_id": criterion_id},
            )
        )

        # Run command safely
        run = self.runner.execute_command(
            task_id=task.id,
            command=command,
            criterion_id=criterion_id,
            workspace_path=workspace,
            timeout_seconds=timeout_seconds,
        )

        # Persist run and evidence
        self.repo.save_execution_run(run)

        # Transition to VERIFYING
        self.transition_task_state(task, TaskState.VERIFYING)

        self.repo.record_event(
            ExecutionEvent(
                task_id=task.id,
                run_id=run.run_id,
                event_type="EXECUTION_COMPLETED",
                message=f"Execution completed with exit code {run.exit_code} (Status: {run.status}).",
                details={
                    "run_id": run.run_id,
                    "exit_code": run.exit_code,
                    "evidence_count": len(run.evidence_items),
                },
            )
        )
        return run

    async def verify_task(self, task_id: str, run_id: Optional[str] = None) -> VerificationResult:
        """
        Deterministically verifies the task based on recorded evidence.
        If verification fails, triggers Gemma failure diagnosis and preserves both records.
        """
        task = self.repo.get_task(task_id)
        if not task:
            raise KeyError(f"Task '{task_id}' not found.")

        # Gather recorded evidence
        evidence_items = self.repo.list_evidence(task_id, run_id=run_id)
        latest_run = self.repo.get_execution_run(run_id) if run_id else self.repo.get_latest_execution_run(task_id)

        # Build claim representation
        git_diff = latest_run.git_diff if latest_run else None
        claim = ExecutionClaim(
            task_id=task_id,
            agent_name="VIKASA_EXECUTION_RUNNER",
            claimed_success=True,
            statement=f"Execution run completed for task {task_id}",
            git_diff=git_diff,
            evidence_list=evidence_items,
        )

        # Deterministic verification evaluation
        verification = self.verifier.evaluate(task, claim)
        verification.run_id = latest_run.run_id if latest_run else None

        # Save verification result to DB
        self.repo.save_verification(verification, run_id=verification.run_id)

        # Transition task to final verdict state
        verdict_val = verification.verdict.value if hasattr(verification.verdict, "value") else str(verification.verdict)
        if verdict_val in ("PASS", "VERIFIED"):
            target_state = TaskState.VERIFIED
        elif verdict_val in ("FAIL", "FAILED"):
            target_state = TaskState.FAILED
        elif verdict_val in ("UNKNOWN", "REVIEW_REQUIRED"):
            target_state = TaskState.REVIEW_REQUIRED
        elif verdict_val == "BLOCKED":
            target_state = TaskState.BLOCKED
        elif verdict_val == "NOT_RUN":
            target_state = TaskState.NOT_RUN
        else:
            target_state = TaskState.FAILED
        self.transition_task_state(task, target_state)


        self.repo.record_event(
            ExecutionEvent(
                task_id=task.id,
                run_id=verification.run_id,
                event_type="VERIFICATION_COMPLETED",
                message=f"Deterministic verification result: {verification.verdict.value} (Score: {verification.confidence_score})",
                details={
                    "verdict": verification.verdict.value,
                    "confidence": verification.confidence_score,
                    "evidence_evaluated": len(evidence_items),
                },
            )
        )

        # If failed, blocked, or review required, generate and persist Gemma failure diagnosis
        non_passing_verdicts = {
            VerificationVerdict.FAILED,
            VerificationVerdict.FAIL,
            VerificationVerdict.REVIEW_REQUIRED,
            VerificationVerdict.UNKNOWN,
            VerificationVerdict.BLOCKED,
        }
        if verification.verdict in non_passing_verdicts:
            diagnosis = await self.gemma.explain_failure(
                task=task,
                verification_result=verification,
                repo_diff=git_diff,
                evidence_list=evidence_items,
            )
            diagnosis.run_id = verification.run_id
            self.repo.save_diagnosis(diagnosis)

            self.repo.record_event(
                ExecutionEvent(
                    task_id=task.id,
                    run_id=verification.run_id,
                    event_type="DIAGNOSIS_GENERATED",
                    message=f"Failure diagnosis produced: {diagnosis.failure_summary[:80]}...",
                    details={
                        "causes": diagnosis.likely_causes,
                        "recommended_fixes": diagnosis.recommended_fixes,
                    },
                )
            )

        return verification

    def get_task_detail(self, task_id: str) -> TaskDetail:
        """
        Retrieves task with associated plan, latest run, verification, and diagnosis.
        """
        task = self.repo.get_task(task_id)
        if not task:
            raise KeyError(f"Task '{task_id}' not found.")
        return TaskDetail(
            task=task,
            plan=self.repo.get_plan(task_id),
            latest_run=self.repo.get_latest_execution_run(task_id),
            latest_verification=self.repo.get_latest_verification(task_id),
            latest_diagnosis=self.repo.get_latest_diagnosis(task_id),
            events=self.repo.list_events(task_id),
        )

    def get_run_report(self, run_id: str) -> RunReport:
        """
        Builds a comprehensive report for an execution run.
        """
        run = self.repo.get_execution_run(run_id)
        if not run:
            raise KeyError(f"Execution run '{run_id}' not found.")
        task = self.repo.get_task(run.task_id)
        if not task:
            raise KeyError(f"Task '{run.task_id}' associated with run not found.")

        # Fetch latest verification matching this run
        verifications = self.repo.list_verifications(run.task_id)
        matched_verification = next((v for v in reversed(verifications) if v.run_id == run_id), None)
        latest_diagnosis = self.repo.get_latest_diagnosis(run.task_id)
        events = [e for e in self.repo.list_events(run.task_id) if e.run_id == run_id or e.run_id is None]

        return RunReport(
            run=run,
            task=task,
            verification=matched_verification,
            diagnosis=latest_diagnosis if matched_verification and matched_verification.verdict != VerificationVerdict.VERIFIED else None,
            events=events,
        )
