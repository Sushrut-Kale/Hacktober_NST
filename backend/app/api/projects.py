"""API endpoints for project management and project intelligence."""

from datetime import datetime, timezone
import json
import logging
import os
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.models.project import Project
from backend.app.models.task import TaskRecord
from backend.app.schemas.project import (
    AnalysisStatus,
    ClarificationAnswerRequest,
    ClarificationQuestion,
    FeatureFinding,
    FeatureStatus,
    ProjectCreate,
    ProjectDetailResponse,
    ProjectResponse,
    SkipQuestionsRequest,
    SourceType,
)
from backend.app.schemas.task import TaskResponse
from backend.app.services.project_analyzer import ProjectAnalyzerService

logger = logging.getLogger("vikasa.api.projects")

# Pagination constants
_DEFAULT_LIMIT: int = 50
_MAX_LIMIT: int = 100

router = APIRouter()
analyzer_service = ProjectAnalyzerService()


class BuildFeatureRequest(BaseModel):
    feature_id: str


def _build_project_detail_response(project: Project, db: Session) -> ProjectDetailResponse:
    """Helper to deserialize stored JSON attributes into typed ProjectDetailResponse."""
    tech_stack = None
    if project.tech_stack:
        try:
            tech_stack = json.loads(project.tech_stack)
        except Exception:
            pass

    architecture = None
    if project.architecture:
        try:
            architecture = json.loads(project.architecture)
        except Exception:
            pass

    claimed_features: List[FeatureFinding] = []
    if project.claimed_features:
        try:
            raw_features = json.loads(project.claimed_features)
            claimed_features = [FeatureFinding(**f) for f in raw_features]
        except Exception as e:
            logger.warning("Error parsing claimed_features for project %s: %s", project.id, e)

    clarification_questions: List[ClarificationQuestion] = []
    if project.clarification_questions:
        try:
            raw_q = json.loads(project.clarification_questions)
            clarification_questions = [ClarificationQuestion(**q) for q in raw_q]
        except Exception as e:
            logger.warning("Error parsing clarification_questions: %s", e)

    documentation = None
    if project.documentation:
        try:
            documentation = json.loads(project.documentation)
        except Exception:
            pass

    scan_history: List[Dict[str, Any]] = []
    if project.scan_history:
        try:
            scan_history = json.loads(project.scan_history)
        except Exception:
            pass

    # Compute status counts
    feature_counts = {
        "PRESENT": sum(1 for f in claimed_features if f.status == FeatureStatus.PRESENT),
        "MISSING": sum(1 for f in claimed_features if f.status == FeatureStatus.MISSING),
        "PARTIAL": sum(1 for f in claimed_features if f.status == FeatureStatus.PARTIAL),
        "UNVERIFIED": sum(1 for f in claimed_features if f.status == FeatureStatus.UNVERIFIED),
        "FAILED": sum(1 for f in claimed_features if f.status == FeatureStatus.FAILED),
        "TOTAL": len(claimed_features),
    }

    linked_tasks_count = db.query(TaskRecord).filter(TaskRecord.project_id == project.id).count()

    return ProjectDetailResponse(
        id=project.id,
        name=project.name,
        root_path=project.root_path,
        repository_url=project.repository_url,
        source_type=SourceType(project.source_type) if project.source_type else SourceType.GIT,
        description=project.description,
        idea_prompt=project.idea_prompt,
        target_branch=project.target_branch or "main",
        analysis_status=AnalysisStatus(project.analysis_status) if project.analysis_status else AnalysisStatus.PENDING,
        created_at=project.created_at,
        updated_at=project.updated_at,
        tech_stack=tech_stack if isinstance(tech_stack, dict) else {"items": tech_stack or []},
        architecture=architecture,
        claimed_features=claimed_features,
        clarification_questions=clarification_questions,
        documentation=documentation,
        scan_history=scan_history,
        feature_counts=feature_counts,
        linked_task_count=linked_tasks_count,
    )


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register and analyze a new project",
)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
) -> Project:
    """
    Creates a project entry in VIKASA and immediately initiates intelligence analysis.
    Supports Path 1 (GitHub Repository) and Path 2 (Idea Intake).
    """
    source_type_val = project_in.source_type.value if hasattr(project_in.source_type, "value") else str(project_in.source_type)

    # 1. URL & Security Validation
    if source_type_val == SourceType.GIT.value and project_in.repository_url:
        is_valid, reason = analyzer_service.validate_repository_url(project_in.repository_url)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Security validation failed for repository URL: {reason}",
            )

    try:
        project = Project(
            name=project_in.name,
            root_path=project_in.root_path or ".",
            repository_url=project_in.repository_url,
            source_type=source_type_val,
            description=project_in.description,
            idea_prompt=project_in.idea_prompt,
            target_branch=project_in.target_branch or "main",
            analysis_status=AnalysisStatus.PENDING.value,
        )

        # 2. Path 1: Repository Analysis (if local dir exists or path specified)
        if source_type_val == SourceType.GIT.value:
            inspect_dir = project.root_path
            if inspect_dir and os.path.isdir(inspect_dir):
                analysis = analyzer_service.analyze_repository(
                    repo_path=inspect_dir,
                    project_name=project.name,
                    target_branch=project.target_branch,
                )
                project.tech_stack = json.dumps(analysis["tech_stack"])
                project.claimed_features = json.dumps(analysis["claimed_features"])
                project.architecture = json.dumps(analysis["architecture"])
                project.documentation = json.dumps(analysis["documentation"])
                project.scan_history = json.dumps([analysis["scan_record"]])
                project.analysis_status = AnalysisStatus.COMPLETED.value
            else:
                project.analysis_status = AnalysisStatus.PENDING.value

        # 3. Path 2: Idea Intake (generates initial specification and clarification questions)
        elif source_type_val == SourceType.IDEA.value:
            prompt = project.idea_prompt or project.description or project.name
            spec = analyzer_service.build_idea_specification(
                project_name=project.name,
                idea_prompt=prompt,
                is_skipped=False,
            )
            project.tech_stack = json.dumps(spec["tech_stack"])
            project.claimed_features = json.dumps(spec["claimed_features"])
            project.clarification_questions = json.dumps(spec["clarification_questions"])
            project.architecture = json.dumps(spec["architecture"])
            project.documentation = json.dumps(spec["documentation"])
            project.scan_history = json.dumps([spec["scan_record"]])
            project.analysis_status = AnalysisStatus.COMPLETED.value

        db.add(project)
        db.commit()
        db.refresh(project)
        return project

    except SQLAlchemyError as exc:
        db.rollback()
        logger.error("Failed to persist project: %s", exc)
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
    limit: int = Query(default=_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> List[Project]:
    """Retrieve paginated projects ordered by creation time descending."""
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
    """Retrieve basic project record by ID."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with identifier '{project_id}' was not found.",
        )
    return project


@router.get(
    "/{project_id}/detail",
    response_model=ProjectDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get complete project intelligence detail",
)
def get_project_detail(
    project_id: str,
    db: Session = Depends(get_db),
) -> ProjectDetailResponse:
    """Returns complete intelligence dataset including Claim vs Reality, Architecture, and Tech Stack."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with identifier '{project_id}' was not found.",
        )
    return _build_project_detail_response(project, db)


@router.post(
    "/{project_id}/rescan",
    response_model=ProjectDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Rescan repository and update feature findings",
)
def rescan_project(
    project_id: str,
    db: Session = Depends(get_db),
) -> ProjectDetailResponse:
    """Performs fresh bounded static analysis, records historical scan record, and preserves existing tasks."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with identifier '{project_id}' was not found.",
        )

    scan_dir = project.root_path if (project.root_path and os.path.isdir(project.root_path)) else "."
    analysis = analyzer_service.analyze_repository(
        repo_path=scan_dir,
        project_name=project.name,
        target_branch=project.target_branch or "main",
    )

    # Append to existing history
    existing_history = []
    if project.scan_history:
        try:
            existing_history = json.loads(project.scan_history)
        except Exception:
            pass
    existing_history.append(analysis["scan_record"])

    project.tech_stack = json.dumps(analysis["tech_stack"])
    project.claimed_features = json.dumps(analysis["claimed_features"])
    project.architecture = json.dumps(analysis["architecture"])
    project.documentation = json.dumps(analysis["documentation"])
    project.scan_history = json.dumps(existing_history)
    project.analysis_status = AnalysisStatus.COMPLETED.value
    project.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(project)
    return _build_project_detail_response(project, db)


@router.post(
    "/{project_id}/clarify",
    response_model=ProjectDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit answers to clarification questions",
)
def clarify_project(
    project_id: str,
    payload: ClarificationAnswerRequest,
    db: Session = Depends(get_db),
) -> ProjectDetailResponse:
    """Updates idea project with user-supplied answers to clarification questions."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with identifier '{project_id}' was not found.",
        )

    prompt = project.idea_prompt or project.description or project.name
    spec = analyzer_service.build_idea_specification(
        project_name=project.name,
        idea_prompt=prompt,
        answers=payload.answers,
        is_skipped=False,
    )

    project.tech_stack = json.dumps(spec["tech_stack"])
    project.claimed_features = json.dumps(spec["claimed_features"])
    project.clarification_questions = json.dumps(spec["clarification_questions"])
    project.architecture = json.dumps(spec["architecture"])
    project.documentation = json.dumps(spec["documentation"])
    project.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(project)
    return _build_project_detail_response(project, db)


@router.post(
    "/{project_id}/skip-questions",
    response_model=ProjectDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Skip questions and generate auto-draft with inferred defaults",
)
def skip_questions_project(
    project_id: str,
    payload: Optional[SkipQuestionsRequest] = None,
    db: Session = Depends(get_db),
) -> ProjectDetailResponse:
    """Generates an initial specification using explicit inferred defaults (tagged INFERRED)."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with identifier '{project_id}' was not found.",
        )

    prompt = project.idea_prompt or project.description or project.name
    spec = analyzer_service.build_idea_specification(
        project_name=project.name,
        idea_prompt=prompt,
        is_skipped=True,
    )

    project.tech_stack = json.dumps(spec["tech_stack"])
    project.claimed_features = json.dumps(spec["claimed_features"])
    project.clarification_questions = json.dumps(spec["clarification_questions"])
    project.architecture = json.dumps(spec["architecture"])
    project.documentation = json.dumps(spec["documentation"])
    project.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(project)
    return _build_project_detail_response(project, db)


@router.post(
    "/{project_id}/build-feature",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate an implementation task from a missing or partial feature finding",
)
def build_feature(
    project_id: str,
    payload: BuildFeatureRequest,
    db: Session = Depends(get_db),
) -> TaskRecord:
    """
    Creates a new TaskRecord linked to this project with explicit acceptance criteria.
    Requires human approval prior to execution.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with identifier '{project_id}' was not found.",
        )

    # Find feature details
    feature_name = payload.feature_id
    feature_reason = "Feature implementation required."
    suggested_action = "Implement code and automated test."

    if project.claimed_features:
        try:
            feats = json.loads(project.claimed_features)
            for f in feats:
                if f.get("id") == payload.feature_id:
                    feature_name = f.get("name", feature_name)
                    feature_reason = f.get("reason", feature_reason)
                    suggested_action = f.get("suggested_action", suggested_action)
                    break
        except Exception:
            pass

    acceptance_criteria = [
        f"Implement {feature_name} following project architecture and conventions.",
        f"Ensure deterministic tests verify {feature_name} functionality.",
        f"Pass all verification checks without regression.",
    ]

    import uuid
    task_id = f"task-{uuid.uuid4().hex[:8]}"

    task = TaskRecord(
        id=task_id,
        project_id=project.id,
        title=f"Build Feature: {feature_name}",
        description=f"Automated implementation task.\nStatus Reason: {feature_reason}\nRecommendation: {suggested_action}",
        status="CREATED",
        state="CREATED",
        acceptance_criteria=json.dumps(acceptance_criteria),
    )

    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get(
    "/{project_id}/tasks",
    response_model=List[TaskResponse],
    status_code=status.HTTP_200_OK,
    summary="List tasks for a project",
)
def list_project_tasks(
    project_id: str,
    limit: int = Query(default=_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> List[TaskRecord]:
    """List paginated tasks belonging to the specified project."""
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
