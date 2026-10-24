"""API endpoints for task management."""

import logging
import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.models.project import Project
from backend.app.models.task import TaskRecord
from backend.app.schemas.task import (
    TaskCreate,
    TaskResponse,
    TaskStatus,
    TaskStatusUpdate,
    TaskExecuteRequest,
    TaskExecuteResponse,
)
from backend.app.services.antigravity_adapter import AntigravityAdapter
from backend.app.services.evidence_collector import EvidenceCollector

logger = logging.getLogger("vikasa.api.tasks")

# Valid task state transitions enforced server-side.
# Format: {current_state: {allowed_next_states}}
# PENDING_APPROVAL is the gate before execution begins.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "PLANNED": {"PENDING_APPROVAL", "CANCELLED"},
    "PENDING_APPROVAL": {"IN_PROGRESS", "PLANNED", "CANCELLED"},
    "IN_PROGRESS": {"COMPLETED", "FAILED", "CANCELLED"},
    "COMPLETED": set(),          # Terminal — no further transitions
    "FAILED": {"PLANNED", "CANCELLED"},
    "CANCELLED": set(),          # Terminal — no further transitions
}

router = APIRouter()
collector = EvidenceCollector()


@router.post(
    "",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new task",
)
def create_task(
    task_in: TaskCreate,
    db: Session = Depends(get_db),
) -> TaskRecord:
    """Create a task associated with an existing project."""
    project = db.query(Project).filter(Project.id == task_in.project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with identifier '{task_in.project_id}' was not found.",
        )

    try:
        task = TaskRecord(
            project_id=task_in.project_id,
            title=task_in.title,
            description=task_in.description,
            acceptance_criteria=task_in.acceptance_criteria,
            status=task_in.status.value if task_in.status else "PLANNED",
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error("Failed to create task: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist task record.",
        ) from exc


@router.get(
    "/{task_id}",
    response_model=TaskResponse,
    status_code=status.HTTP_200_OK,
    summary="Get task by ID",
)
def get_task(
    task_id: str,
    db: Session = Depends(get_db),
) -> TaskRecord:
    """Retrieve a single task by its unique ID."""
    task = db.query(TaskRecord).filter(TaskRecord.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with identifier '{task_id}' was not found.",
        )
    return task


@router.patch(
    "/{task_id}/status",
    response_model=TaskResponse,
    status_code=status.HTTP_200_OK,
    summary="Transition task to a new lifecycle status",
    description=(
        "Updates a task's status according to allowed lifecycle transitions. "
        "Tasks must pass through PENDING_APPROVAL before IN_PROGRESS (execution gate). "
        "Invalid transitions are rejected with 409 Conflict."
    ),
)
def update_task_status(
    task_id: str,
    body: TaskStatusUpdate,
    db: Session = Depends(get_db),
) -> TaskRecord:
    """Transition a task to a new lifecycle state, enforcing valid state machine rules."""
    task = db.query(TaskRecord).filter(TaskRecord.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with identifier '{task_id}' was not found.",
        )

    current_status = task.status
    new_status = body.status.value if hasattr(body.status, "value") else str(body.status)

    if current_status == new_status:
        # Idempotent — return without error
        return task

    allowed_next = ALLOWED_TRANSITIONS.get(current_status, set())
    if new_status not in allowed_next:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Invalid status transition for task '{task_id}': "
                f"'{current_status}' → '{new_status}' is not permitted. "
                f"Allowed transitions from '{current_status}': {sorted(allowed_next) or ['none (terminal state)']}"
            ),
        )

    try:
        task.status = new_status
        db.commit()
        db.refresh(task)
        logger.info("Task '%s' transitioned: %s → %s", task_id, current_status, new_status)
        return task
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error("Failed to update task status: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist task status update.",
        ) from exc


@router.post(
    "/{task_id}/execute",
    response_model=TaskExecuteResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute a task run with human approval enforcement and safe runner sandboxing",
    description=(
        "Executes a task run under strict verification rules. "
        "An unapproved task in 'PLANNED' status is rejected with 409 Conflict. "
        "Only allowlisted binaries (pytest, python, git, npm, uv) are executed. Shell execution is blocked."
    ),
)
def execute_task(
    task_id: str,
    body: TaskExecuteRequest = TaskExecuteRequest(),
    db: Session = Depends(get_db),
) -> TaskExecuteResponse:
    """Execute a task, strictly enforcing the human approval gate and safe sandbox execution."""
    task = db.query(TaskRecord).filter(TaskRecord.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with identifier '{task_id}' was not found.",
        )

    # 1. Enforce Human Approval Gate
    if task.status == "PLANNED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Task '{task_id}' cannot execute while in 'PLANNED' status. "
                "Human approval is required: review the task plan and transition to 'PENDING_APPROVAL' before execution."
            ),
        )
    if task.status in ("COMPLETED", "CANCELLED"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Task '{task_id}' is in terminal status '{task.status}' and cannot execute.",
        )

    # 2. Transition to IN_PROGRESS if approved
    if task.status == "PENDING_APPROVAL":
        task.status = "IN_PROGRESS"
        db.commit()
        db.refresh(task)

    # 3. Detect Execution Mode (distinguish Antigravity agent vs local safe runner)
    capabilities = AntigravityAdapter.inspect_capabilities()
    if capabilities.get("sdk_installed") or capabilities.get("cli_installed"):
        execution_mode = "ANTIGRAVITY_AGENT"
    else:
        execution_mode = "LOCAL_SAFE_RUNNER"

    # 4. Determine Working Directory safely
    if body.repo_path:
        target_dir = body.repo_path
    else:
        project = db.query(Project).filter(Project.id == task.project_id).first()
        target_dir = project.root_path if project else os.getcwd()

    evidence_items = []
    exit_code = None
    output_text = None

    # 5. Execute Command if provided (enforcing allowlist, no shell, timeout)
    if body.test_command:
        cmd_item = collector.execute_test_command(
            command=body.test_command,
            cwd=target_dir,
            timeout_seconds=body.timeout_seconds or 30.0,
        )
        evidence_items.append(cmd_item)
        exit_code = cmd_item.exit_code
        output_text = cmd_item.content

        # Update lifecycle status if execution failed
        if exit_code is not None and exit_code != 0:
            task.status = "FAILED"
            db.commit()
            db.refresh(task)

    return TaskExecuteResponse(
        task_id=task.id,
        status=task.status,
        execution_mode=execution_mode,
        command=body.test_command,
        exit_code=exit_code,
        stdout=output_text,
        evidence=evidence_items,
        message=(
            f"Task execution completed in {execution_mode} mode."
            if body.test_command
            else f"Task entered '{task.status}' execution state in {execution_mode} mode."
        ),
    )

