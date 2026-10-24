"""API endpoints for task management."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.models.project import Project
from backend.app.models.task import TaskRecord
from backend.app.schemas.task import TaskCreate, TaskResponse

logger = logging.getLogger("vikasa.api.tasks")

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
