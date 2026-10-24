"""API endpoints for task management."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.models.project import Project
from backend.app.models.task import TaskRecord
from backend.app.schemas.task import TaskCreate, TaskResponse, TaskStatus, TaskStatusUpdate

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
