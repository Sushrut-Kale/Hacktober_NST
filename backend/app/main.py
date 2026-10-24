from contextlib import asynccontextmanager
from typing import Dict, Any, AsyncGenerator, Optional, Union, List
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.db.database import get_db
from backend.app.db.init_db import init_db
from backend.app.schemas.core import (
    Task,
    TaskState,
    ExecutionClaim,
    VerificationResult,
    TaskPlan,
    PlanRequest,
    FailureDiagnosis,
    FailureDiagnosisRequest,
    TaskCreateRequest,
    TaskApproveRequest,
    TaskExecuteRequest,
    ExecutionRun,
    ExecutionEvent,
    RunReport,
    TaskDetail,
)
from backend.app.services.verification_engine import DeterministicVerificationEngine
from backend.app.services.gemma_service import GemmaService
from backend.app.services.antigravity_adapter import AntigravityAdapter
from backend.app.services.safe_runner import SafeExecutionRunner
from backend.app.services.workflow_service import WorkflowService, InvalidStateTransitionError
from backend.app.db.repository import DatabaseRepository
from backend.app.api.projects import router as projects_router
from backend.app.api.evidence import router as evidence_router


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize database tables and lifecycle resources."""
    try:
        init_db()
    except Exception:
        pass
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Deterministic AI Coding Verification Platform",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core singletons
db_repo = DatabaseRepository()
verification_engine = DeterministicVerificationEngine()
gemma_service = GemmaService()
antigravity_adapter = AntigravityAdapter()
safe_runner = SafeExecutionRunner()
workflow_service = WorkflowService(
    repository=db_repo,
    gemma_service=gemma_service,
    verification_engine=verification_engine,
    safe_runner=safe_runner,
)

# -------------------------------------------------------------
# Health & Capability Diagnostics
# -------------------------------------------------------------


@app.get("/health")
async def health_check() -> Dict[str, Any]:
    """Root health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
    }


@app.get("/api/health")
def api_health_check(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Structured health check including database verification."""
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "disconnected"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": settings.app_name,
        "version": settings.app_version,
        "database": db_status,
    }


@app.get("/api/health/ollama")
async def ollama_health() -> Dict[str, Any]:
    return await gemma_service.check_readiness()


@app.get("/api/health/antigravity")
async def antigravity_health() -> Dict[str, Any]:
    return antigravity_adapter.inspect_capabilities()


# -------------------------------------------------------------
# Task Workflow Endpoints (Persistent Lifecycle)
# -------------------------------------------------------------

@app.post("/api/tasks", response_model=Task, status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreateRequest, db: Session = Depends(get_db)) -> Task:
    """
    Creates a new task in CREATED state with explicit acceptance criteria.
    Supports linking to registered projects.
    """
    if payload.project_id and payload.project_id != "default":
        from backend.app.models.project import Project
        project = db.query(Project).filter(Project.id == payload.project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with identifier '{payload.project_id}' was not found.",
            )

    try:
        task = workflow_service.create_task(
            title=payload.title,
            description=payload.description or "",
            acceptance_criteria=payload.acceptance_criteria,
            task_id=payload.id,
            workspace_path=payload.workspace_path,
        )
        task.project_id = payload.project_id or "default"
        db_repo.save_task(task)

        # Also mirror in SQLAlchemy TaskRecord for relational queries under projects
        try:
            from backend.app.models.task import TaskRecord
            crit_str = "; ".join(c.description for c in task.acceptance_criteria)
            status_val = getattr(payload, "status", None)
            if hasattr(status_val, "value"):
                status_val = status_val.value
            if not status_val or status_val == "CREATED":
                status_val = "PLANNED"
            task.status = status_val
            db_repo.save_task(task)

            task_rec = TaskRecord(
                id=task.id,
                project_id=task.project_id,
                title=task.title,
                description=task.description,
                acceptance_criteria=crit_str,
                status=status_val,
            )
            db.merge(task_rec)
            db.commit()
        except Exception:
            db.rollback()


        return task
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/tasks", response_model=List[Task])
async def list_tasks(project_id: Optional[str] = None) -> List[Task]:
    """
    Lists all persisted tasks ordered by creation time.
    """
    return db_repo.list_tasks(project_id=project_id)

@app.get("/api/tasks/{task_id}", response_model=TaskDetail)
async def get_task_detail(task_id: str, db: Session = Depends(get_db)) -> TaskDetail:
    """
    Returns task state along with associated plan, latest run, verification, and diagnosis.
    Also satisfies shallow task queries with flat attributes.
    """
    try:
        return workflow_service.get_task_detail(task_id)
    except KeyError:
        try:
            from backend.app.models.task import TaskRecord
            rec = db.query(TaskRecord).filter(TaskRecord.id == task_id).first()
            if rec:
                task = Task(
                    id=rec.id,
                    project_id=rec.project_id,
                    title=rec.title,
                    description=rec.description or "",
                    acceptance_criteria=[],
                    state=TaskState(rec.status) if rec.status in TaskState.__members__ else TaskState.CREATED,
                )
                return TaskDetail(task=task)
        except Exception:
            pass
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")


@app.post("/api/tasks/{task_id}/plan", response_model=TaskPlan)
async def generate_task_plan_route(task_id: str, repo_context: Optional[str] = None) -> TaskPlan:
    """
    Generates and persists a structured task plan via Gemma 4, advancing task to PLANNED.
    """
    try:
        return await workflow_service.generate_and_save_plan(task_id, repo_context=repo_context)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    except InvalidStateTransitionError as e:
        raise HTTPException(status_code=409, detail=str(e))

@app.post("/api/tasks/{task_id}/approve", response_model=Task)
async def approve_task_plan(task_id: str, payload: Optional[TaskApproveRequest] = None) -> Task:
    """
    Explicitly approves the generated plan. Execution cannot proceed without approval.
    """
    approved_by = payload.approved_by if payload else "USER"
    notes = payload.notes if payload else None
    try:
        return workflow_service.approve_plan(task_id, approved_by=approved_by, notes=notes)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    except (InvalidStateTransitionError, ValueError) as e:
        raise HTTPException(status_code=409, detail=str(e))

@app.post("/api/tasks/{task_id}/execute", response_model=ExecutionRun)
async def execute_task_route(task_id: str, payload: TaskExecuteRequest) -> ExecutionRun:
    """
    Executes an allowlisted test command in the task's approved workspace.
    Enforces that the task must be in APPROVED state.
    """
    try:
        return workflow_service.execute_task(
            task_id=task_id,
            command=payload.command,
            criterion_id=payload.criterion_id,
            timeout_seconds=payload.timeout_seconds or 30.0,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    except InvalidStateTransitionError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/tasks/{task_id}/events", response_model=List[ExecutionEvent])
async def get_task_events(task_id: str) -> List[ExecutionEvent]:
    """
    Retrieves the chronological audit log of execution events for a task.
    """
    task = db_repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    return db_repo.list_events(task_id)

@app.post("/api/tasks/{task_id}/verify", response_model=VerificationResult)
async def verify_persisted_task(task_id: str, run_id: Optional[str] = None) -> VerificationResult:
    """
    Deterministically evaluates all recorded execution evidence for the task.
    If checks fail, automatically generates and persists a Gemma failure diagnosis.
    """
    try:
        return await workflow_service.verify_task(task_id, run_id=run_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    except InvalidStateTransitionError as e:
        raise HTTPException(status_code=409, detail=str(e))

@app.get("/api/tasks/{task_id}/verification", response_model=VerificationResult)
async def get_latest_task_verification(task_id: str) -> VerificationResult:
    """
    Retrieves the most recent deterministic verification record for the task.
    """
    task = db_repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    res = db_repo.get_latest_verification(task_id)
    if not res:
        raise HTTPException(status_code=404, detail=f"No verification record exists for task '{task_id}'.")
    return res

@app.get("/api/runs/{run_id}", response_model=ExecutionRun)
async def get_run_detail(run_id: str) -> ExecutionRun:
    """
    Inspects a specific execution run.
    """
    run = db_repo.get_execution_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Execution run '{run_id}' not found.")
    return run

@app.get("/api/runs/{run_id}/report", response_model=RunReport)
async def get_run_report(run_id: str) -> RunReport:
    """
    Returns an evidence-backed run report with execution output, diff, events, and verification verdict.
    """
    try:
        return workflow_service.get_run_report(run_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Execution run '{run_id}' not found.")

# -------------------------------------------------------------
# Stateless Helper Endpoints (Preserving Phase 0 & 1 Contracts)
# -------------------------------------------------------------

class VerifyRequest(BaseModel):
    task: Task
    claim: ExecutionClaim


@app.post("/api/verify", response_model=VerificationResult)
async def verify_task(payload: VerifyRequest) -> VerificationResult:
    return verification_engine.evaluate(payload.task, payload.claim)


@app.post("/api/plan", response_model=TaskPlan)
async def create_plan(payload: Union[PlanRequest, Task]) -> TaskPlan:
    if isinstance(payload, PlanRequest):
        return await gemma_service.generate_plan(task=payload.task, repo_context=payload.repo_context)
    return await gemma_service.generate_plan(task=payload)

@app.post("/api/diagnosis", response_model=FailureDiagnosis)
@app.post("/api/explain-failure", response_model=FailureDiagnosis)
async def diagnose_failure(payload: FailureDiagnosisRequest) -> FailureDiagnosis:
    return await gemma_service.explain_failure(
        task=payload.task,
        verification_result=payload.verification_result,
        repo_diff=payload.repo_diff,
        evidence_list=payload.evidence_list,
    )

# Include integrated project and evidence routers
app.include_router(projects_router, prefix="/api/projects", tags=["projects"])
app.include_router(evidence_router, prefix="/api/verify", tags=["verification"])
