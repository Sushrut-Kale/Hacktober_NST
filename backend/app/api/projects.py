"""API endpoints for project management and project intelligence."""

from datetime import datetime, timezone
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.models.project import Project
from backend.app.models.task import TaskRecord
from backend.app.models.verification import VerificationRecord
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
    FileTreeNode,
    FileContentResponse,
    RepoHealthAuditResponse,
    CleanupProposalRequest,
    CleanupProposalResponse,
    AIChatRequest,
    AIChatResponse,
    ImageDiagnosisRequest,
    ImageDiagnosisResponse,
    ReplayHistoryResponse,
    ReplayEventItem,
    ProjectExportResponse,
)
from backend.app.schemas.task import TaskResponse
from backend.app.services.project_analyzer import ProjectAnalyzerService
from backend.app.services.gemma_service import GemmaService

logger = logging.getLogger("vikasa.api.projects")

# Pagination constants
_DEFAULT_LIMIT: int = 50
_MAX_LIMIT: int = 100

router = APIRouter()
analyzer_service = ProjectAnalyzerService(gemma_service=GemmaService())


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


# -------------------------------------------------------------
# Archive Upload & Safe Ingestion
# -------------------------------------------------------------

@router.post(
    "/upload",
    response_model=ProjectDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload project archive (ZIP/TAR) or source folder",
)
async def upload_project_archive(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db),
) -> ProjectDetailResponse:
    """
    Safely ingest a project archive (.zip / .tar.gz).
    Extracts into a dedicated workspace directory with Zip-Slip path traversal defense,
    performs static intelligence analysis, and records project in relational DB.
    """
    import uuid
    from pathlib import Path

    proj_id = f"proj-{uuid.uuid4().hex[:8]}"
    proj_name = name.strip() if name and name.strip() else Path(file.filename or "uploaded_project").stem

    # Sandbox extraction target
    extract_target = Path("scratch/workspaces") / proj_id
    extract_target.mkdir(parents=True, exist_ok=True)

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Archive exceeds max permitted upload limit of 50 MB.",
        )

    is_ok, msg, count = ProjectAnalyzerService.safe_extract_archive(
        archive_bytes=content,
        filename=file.filename or "archive.zip",
        target_dir=str(extract_target),
    )
    if not is_ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Archive extraction failed: {msg}",
        )

    # Run repository intelligence analysis on extracted folder
    analysis = analyzer_service.analyze_repository(
        repo_path=str(extract_target),
        project_name=proj_name,
        target_branch="upload",
    )

    now = datetime.now(timezone.utc)
    project = Project(
        id=proj_id,
        name=proj_name,
        root_path=str(extract_target),
        source_type="FOLDER",
        description=description or f"Ingested from uploaded archive '{file.filename}' ({count} files extracted).",
        target_branch="upload",
        analysis_status="COMPLETED",
        tech_stack=json.dumps(analysis.get("tech_stack", [])),
        architecture=json.dumps(analysis.get("architecture", {})),
        claimed_features=json.dumps(analysis.get("claimed_features", [])),
        documentation=json.dumps(analysis.get("documentation", {})),
        scan_history=json.dumps([analysis.get("scan_record", {})]),
        created_at=now,
        updated_at=now,
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    return _build_project_detail_response(project, db)


# -------------------------------------------------------------
# Repository Explorer & File Viewer
# -------------------------------------------------------------

@router.get(
    "/{project_id}/files",
    response_model=FileTreeNode,
    summary="Retrieve repository directory file tree",
)
def get_project_file_tree(
    project_id: str,
    max_depth: int = Query(default=4, ge=1, le=8),
    db: Session = Depends(get_db),
) -> FileTreeNode:
    """Returns a bounded directory tree hierarchy for the repository explorer."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' was not found.",
        )

    repo_path = project.root_path or "."
    return ProjectAnalyzerService.build_file_tree(repo_path, max_depth=max_depth)


@router.get(
    "/{project_id}/file-content",
    response_model=FileContentResponse,
    summary="Safely view file content from project repository",
)
def get_project_file_content(
    project_id: str,
    path: str = Query(..., description="Relative file path within repository"),
    db: Session = Depends(get_db),
) -> FileContentResponse:
    """Safely reads contained file content, ensuring no path traversal escapes repository root."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' was not found.",
        )

    repo_path = project.root_path or "."
    is_ok, file_resp, err = ProjectAnalyzerService.read_contained_file(repo_path, path)
    if not is_ok or not file_resp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err,
        )

    return file_resp


# -------------------------------------------------------------
# Repository Health & Garbage Code Analysis
# -------------------------------------------------------------

@router.get(
    "/{project_id}/health-audit",
    response_model=RepoHealthAuditResponse,
    summary="Run dead code, debug statements, and TODO audit",
)
def get_project_health_audit(
    project_id: str,
    db: Session = Depends(get_db),
) -> RepoHealthAuditResponse:
    """Audits repository for dead code, unused dependencies, debug leftovers, and TODOs."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' was not found.",
        )

    repo_path = project.root_path or "."
    return analyzer_service.run_health_audit(repo_path, project.id)


@router.post(
    "/{project_id}/cleanup-proposal",
    response_model=CleanupProposalResponse,
    summary="Generate human-reviewable cleanup diff proposal",
)
def generate_cleanup_proposal(
    project_id: str,
    request: CleanupProposalRequest,
    db: Session = Depends(get_db),
) -> CleanupProposalResponse:
    """Generates a proposed diff for removing debug markers. Requires human approval."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' was not found.",
        )

    repo_path = project.root_path or "."
    return analyzer_service.generate_cleanup_proposal(repo_path, request)


# -------------------------------------------------------------
# Grounded AI Chat Assistant
# -------------------------------------------------------------

@router.post(
    "/{project_id}/chat",
    response_model=AIChatResponse,
    summary="Project-grounded AI development assistant",
)
async def project_ai_chat(
    project_id: str,
    request: AIChatRequest,
    db: Session = Depends(get_db),
) -> AIChatResponse:
    """
    Answers questions grounded in the project's repository context (tech stack, architecture, claims).
    Uses Ollama (gemma4:e4b) when ready; provides robust deterministic fallback when offline.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' was not found.",
        )

    detail = _build_project_detail_response(project, db)
    return await analyzer_service.answer_project_chat(detail.model_dump(), request)


# -------------------------------------------------------------
# Image-Based Issue Diagnosis
# -------------------------------------------------------------

@router.post(
    "/{project_id}/diagnose-image",
    response_model=ImageDiagnosisResponse,
    summary="Diagnose terminal errors, screenshots, or stack traces",
)
def diagnose_image_issue(
    project_id: str,
    request: ImageDiagnosisRequest,
    db: Session = Depends(get_db),
) -> ImageDiagnosisResponse:
    """Analyzes runtime error text or screenshot notes, searches repository files, and hypothesizes fix."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' was not found.",
        )

    repo_path = project.root_path or "."
    return analyzer_service.diagnose_error_image(repo_path, request)


# -------------------------------------------------------------
# Replay Mode & Event Timeline
# -------------------------------------------------------------

@router.get(
    "/{project_id}/replay",
    response_model=ReplayHistoryResponse,
    summary="Replay timeline of project scans, tasks, approvals, and verifications",
)
def get_project_replay_timeline(
    project_id: str,
    db: Session = Depends(get_db),
) -> ReplayHistoryResponse:
    """Assembles chronological timeline of all recorded project events for state replay."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' was not found.",
        )

    events: List[ReplayEventItem] = []

    # 1. Project creation event
    events.append(ReplayEventItem(
        id=f"evt-create-{project.id[:8]}",
        timestamp=project.created_at,
        event_type="PROJECT_CREATED",
        description=f"Project '{project.name}' registered via {project.source_type}.",
        author="System",
        metadata={"source_type": project.source_type, "root_path": project.root_path},
    ))

    # 2. Historical scan events
    if project.scan_history:
        try:
            scans = json.loads(project.scan_history)
            for idx, s in enumerate(scans):
                scanned_at_str = s.get("scanned_at")
                scanned_dt = datetime.fromisoformat(scanned_at_str) if scanned_at_str else project.created_at
                events.append(ReplayEventItem(
                    id=f"evt-scan-{idx}",
                    timestamp=scanned_dt,
                    event_type="REPOSITORY_SCANNED",
                    description=f"Static scan completed: {s.get('total_features', 0)} features discovered.",
                    author="ProjectAnalyzer",
                    metadata=s,
                ))
        except Exception:
            pass

    # 3. Tasks & Approvals events
    tasks = db.query(TaskRecord).filter(TaskRecord.project_id == project.id).all()
    for t in tasks:
        events.append(ReplayEventItem(
            id=f"evt-task-{t.id[:8]}",
            timestamp=t.created_at,
            event_type="TASK_CREATED",
            description=f"Task '{t.title}' created in state '{t.state}'.",
            author="Developer",
            metadata={"task_id": t.id, "state": t.state},
        ))
        approved_time = getattr(t, "approved_at", None)
        is_approved = (t.state == "APPROVED") or (getattr(t, "status", None) == "APPROVED") or (approved_time is not None)
        if is_approved:
            events.append(ReplayEventItem(
                id=f"evt-appr-{t.id[:8]}",
                timestamp=approved_time or t.updated_at,
                event_type="TASK_APPROVED",
                description=f"Human approval granted for task '{t.title}'.",
                author=getattr(t, "approved_by", None) or "Human Operator",
                metadata={"task_id": t.id},
            ))

        for v in getattr(t, "verifications", []):
            events.append(ReplayEventItem(
                id=f"evt-verif-{v.id[:8]}",
                timestamp=v.created_at,
                event_type="VERIFIED" if v.verdict == "PASSED" else "FAILED",
                description=f"Deterministic verification on '{t.title}': {v.verdict} (confidence {int(v.confidence_score * 100)}%).",
                author="VerificationEngine",
                metadata={"task_id": t.id, "verdict": v.verdict, "confidence": v.confidence_score},
            ))

    # Sort events chronologically with offset-safe normalization
    def _normalize_dt(dt):
        if dt is None:
            return datetime.now(timezone.utc)
        if getattr(dt, "tzinfo", None) is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt

    events.sort(key=lambda e: _normalize_dt(e.timestamp))

    first_at = events[0].timestamp if events else None
    last_at = events[-1].timestamp if events else None

    return ReplayHistoryResponse(
        project_id=project.id,
        events=events,
        total_events=len(events),
        first_event_at=first_at,
        last_event_at=last_at,
    )


# -------------------------------------------------------------
# Project Report & Architecture Export Endpoints
# -------------------------------------------------------------

def _generate_mermaid_architecture(architecture: Optional[Dict[str, Any]]) -> str:
    """Generates renderable Mermaid diagram syntax from architecture spec."""
    if not architecture:
        return (
            "graph TD\n"
            "    node_ui[\"Frontend Web Client<br/><small>Next.js 14</small>\"] -->|\"REST API\"| node_api[\"FastAPI Backend Service<br/><small>FastAPI / Python</small>\"]\n"
            "    node_api -->|\"ORM\"| node_db[(\"Relational Database<br/><small>PostgreSQL / SQLite</small>\")]\n"
            "    node_api -->|\"Evaluation\"| node_verif[\"Deterministic Verification Engine<br/><small>Rule Matrix</small>\"]\n"
            "    node_verif -->|\"Sandbox\"| node_runner[\"Safe Execution Runner<br/><small>Subprocess Sandbox</small>\"]\n"
            "    classDef service fill:#0f172a,stroke:#38bdf8,stroke-width:1.5px,color:#f0f9ff;\n"
            "    class node_ui,node_api,node_verif,node_runner service;\n"
            "    classDef db fill:#1e1b4b,stroke:#818cf8,stroke-width:1.5px,color:#e0e7ff;\n"
            "    class node_db db;"
        )

    lines = ["graph TD"]
    components = architecture.get("components", [])
    relationships = architecture.get("relationships", [])

    for c in components:
        cid = re.sub(r"[^a-zA-Z0-9_]", "_", str(c.get("id", "node")))
        cname = str(c.get("name", "Component")).replace('"', "'")
        ctype = str(c.get("type", "Service")).lower()
        tech = str(c.get("technology", "")).replace('"', "'")
        label = f"{cname}<br/><small>{tech}</small>" if tech else cname
        if ctype == "database":
            lines.append(f'    {cid}[("{label}")]')
        elif ctype == "ui":
            lines.append(f'    {cid}["{label}"]')
        else:
            lines.append(f'    {cid}["{label}"]')

    for r in relationships:
        src = re.sub(r"[^a-zA-Z0-9_]", "_", str(r.get("source", "")))
        tgt = re.sub(r"[^a-zA-Z0-9_]", "_", str(r.get("target", "")))
        lbl = str(r.get("label", "")).replace('"', "'")
        proto = str(r.get("protocol", "")).replace('"', "'")
        edge_text = f"{lbl} ({proto})" if proto else lbl
        if src and tgt:
            lines.append(f'    {src} -->|"{edge_text}"| {tgt}')

    lines.append("    classDef verified fill:#064e3b,stroke:#10b981,stroke-width:1.5px,color:#ecfdf5;")
    lines.append("    classDef proposed fill:#451a03,stroke:#f59e0b,stroke-width:1.5px,stroke-dasharray: 4 4,color:#fef3c7;")
    lines.append("    classDef service fill:#0f172a,stroke:#38bdf8,stroke-width:1.5px,color:#f0f9ff;")
    lines.append("    classDef db fill:#1e1b4b,stroke:#818cf8,stroke-width:1.5px,color:#e0e7ff;")
    return "\n".join(lines)


def _generate_markdown_report(project: Project, detail: ProjectDetailResponse, mermaid_code: str) -> str:
    """Generates an audit-ready Markdown documentation dossier for the project."""
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    lines = [
        f"# VIKASA Project Intelligence & Verification Dossier: {project.name}",
        "",
        f"**Project ID:** `{project.id}`  ",
        f"**Audit Timestamp:** {now_str}  ",
        f"**Source Ingestion Type:** `{project.source_type or 'GIT'}`  ",
        f"**Target Branch:** `{project.target_branch or 'main'}`  ",
        f"**Repository Root Path:** `{project.root_path}`  ",
        "",
        "---",
        "",
        "## 1. Executive Summary & Verification Invariants",
        "",
        f"{project.description or 'No explicit description provided.'}",
        "",
        "> **Non-Negotiable Verification Invariant:**  ",
        "> *AI proposes and diagnoses. Humans approve. Deterministic verification decides the verdict.*",
        "",
        "### Invariant Status Summary",
        f"- **Verified Features (PRESENT):** {detail.feature_counts.get('PRESENT', 0)}",
        f"- **Claimed But Missing (MISSING):** {detail.feature_counts.get('MISSING', 0)}",
        f"- **Partially Implemented (PARTIAL):** {detail.feature_counts.get('PARTIAL', 0)}",
        f"- **Unverified / Awaiting Tests (UNVERIFIED):** {detail.feature_counts.get('UNVERIFIED', 0)}",
        f"- **Verification Failed (FAILED):** {detail.feature_counts.get('FAILED', 0)}",
        f"- **Total Features Tracked:** {detail.feature_counts.get('TOTAL', 0)}",
        "",
        "---",
        "",
        "## 2. Deterministic Claim vs Reality Matrix",
        "",
        "| Feature Finding | Category | Claim Source | Empirical Status Verdict | Observed Code Evidence | Dedicated Verification Test |",
        "| :--- | :--- | :--- | :--- | :--- | :--- |",
    ]
    for feat in detail.claimed_features:
        code_p = f"`{feat.file_path}` ({feat.line_range})" if feat.file_path and feat.line_range else (f"`{feat.file_path}`" if feat.file_path else "*No code evidence*")
        test_p = f"`{feat.test_name}` ({feat.test_result or 'PASS'})" if feat.test_name else "*Not run / Missing*"
        lines.append(f"| **{feat.name}** | {feat.category} | {feat.claim_source} | `{feat.status.value}` | {code_p} | {test_p} |")

    lines.extend([
        "",
        "---",
        "",
        "## 3. Technology Stack & Manifest Inventory",
        "",
    ])
    tech_items = detail.tech_stack.get("items", []) if isinstance(detail.tech_stack, dict) else (detail.tech_stack if isinstance(detail.tech_stack, list) else [])
    if tech_items:
        lines.append("| Technology | Category | Detected In Manifest | Version / Notes |")
        lines.append("| :--- | :--- | :--- | :--- |")
        for t in tech_items:
            tname = t.get("name", "Unknown") if isinstance(t, dict) else str(t)
            tcat = t.get("category", "General") if isinstance(t, dict) else "General"
            tdet = t.get("detected_in", "Manifest") if isinstance(t, dict) else "Detected"
            tnotes = (t.get("usage_notes") or t.get("version") or "-") if isinstance(t, dict) else "-"
            lines.append(f"| **{tname}** | {tcat} | `{tdet}` | {tnotes} |")
    else:
        lines.append("No manifests detected.")

    lines.extend([
        "",
        "---",
        "",
        "## 4. Discovered Component Architecture",
        "",
        "```mermaid",
        mermaid_code,
        "```",
        "",
        "---",
        "",
        "## 5. Setup & Verification Instructions",
        "",
        "### Setup Guide",
        f"```bash\n{detail.documentation.setup_guide if detail.documentation and detail.documentation.setup_guide else '1. pip install -r requirements.txt\n2. npm install\n3. python -m uvicorn backend.app.main:app --port 8000'}\n```",
        "",
        "### Deterministic Testing & Verification",
        f"```bash\n{detail.documentation.testing_guide if detail.documentation and detail.documentation.testing_guide else 'python -m pytest backend/tests/ -v'}\n```",
        "",
        "---",
        "",
        "> Generated deterministically by VIKASA AI Development Intelligence Platform.",
    ])
    return "\n".join(lines)


@router.get(
    "/{project_id}/export",
    response_model=ProjectExportResponse,
    summary="Export comprehensive project intelligence dossier (JSON with Markdown & Mermaid)",
)
def export_project_dossier(
    project_id: str,
    db: Session = Depends(get_db),
) -> ProjectExportResponse:
    """Exports full project intelligence report, Mermaid architecture diagram, and Claim vs Reality findings."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' was not found.",
        )

    detail = _build_project_detail_response(project, db)
    mermaid_code = _generate_mermaid_architecture(detail.architecture)
    markdown_report = _generate_markdown_report(project, detail, mermaid_code)

    return ProjectExportResponse(
        project_id=project.id,
        project_name=project.name,
        generated_at=datetime.now(timezone.utc),
        markdown_report=markdown_report,
        mermaid_architecture=mermaid_code,
        features_count=len(detail.claimed_features),
    )


@router.get(
    "/{project_id}/export/markdown",
    response_class=PlainTextResponse,
    summary="Export raw Markdown dossier file",
)
def export_project_markdown(
    project_id: str,
    db: Session = Depends(get_db),
) -> PlainTextResponse:
    """Returns downloadable raw Markdown project documentation dossier."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' was not found.",
        )

    detail = _build_project_detail_response(project, db)
    mermaid_code = _generate_mermaid_architecture(detail.architecture)
    markdown_report = _generate_markdown_report(project, detail, mermaid_code)

    return PlainTextResponse(
        content=markdown_report,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="vikasa-{project.id}-report.md"'},
    )


@router.get(
    "/{project_id}/export/architecture",
    response_class=PlainTextResponse,
    summary="Export raw Mermaid architecture diagram",
)
def export_project_architecture(
    project_id: str,
    db: Session = Depends(get_db),
) -> PlainTextResponse:
    """Returns downloadable raw Mermaid architecture diagram code."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' was not found.",
        )

    detail = _build_project_detail_response(project, db)
    mermaid_code = _generate_mermaid_architecture(detail.architecture)

    return PlainTextResponse(
        content=mermaid_code,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="vikasa-{project.id}-architecture.mmd"'},
    )


