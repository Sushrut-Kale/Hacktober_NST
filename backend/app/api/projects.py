"""API endpoints for project management."""

import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.models.project import Project
from backend.app.models.task import TaskRecord
from backend.app.schemas.project import ProjectCreate, ProjectResponse
from backend.app.schemas.task import TaskResponse

logger = logging.getLogger("vikasa.api.projects")

router = APIRouter()


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new project",
)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
) -> Project:
    """Create a project entry in VIKASA."""
    try:
        project = Project(
            name=project_in.name,
            root_path=project_in.root_path,
            repository_url=project_in.repository_url,
            analysis_status="PENDING",
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        return project
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error("Failed to create project: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist project record.",
        ) from exc


@router.get(
    "",
    response_model=List[ProjectResponse],
    status_code=status.HTTP_200_OK,
    summary="List all registered projects",
)
def list_projects(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
) -> List[Project]:
    """Retrieve all projects ordered by creation time descending with pagination."""
    if limit < 1 or limit > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit must be between 1 and 100.",
        )
    if offset < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Offset must be greater than or equal to 0.",
        )
    return (
        db.query(Project)
        .order_by(Project.created_at.desc(), Project.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    status_code=status.HTTP_200_OK,
    summary="Get project by ID",
)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
) -> Project:
    """Retrieve a project by its unique ID."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with identifier '{project_id}' was not found.",
        )
    return project


@router.get(
    "/{project_id}/tasks",
    response_model=List[TaskResponse],
    status_code=status.HTTP_200_OK,
    summary="List tasks for a project",
)
def list_project_tasks(
    project_id: str,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
) -> List[TaskRecord]:
    """List all tasks belonging to the specified project with pagination."""
    if limit < 1 or limit > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit must be between 1 and 100.",
        )
    if offset < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Offset must be greater than or equal to 0.",
        )
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with identifier '{project_id}' was not found.",
        )

    return (
        db.query(TaskRecord)
        .filter(TaskRecord.project_id == project_id)
        .order_by(TaskRecord.created_at.desc(), TaskRecord.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
