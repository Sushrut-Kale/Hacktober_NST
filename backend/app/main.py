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
    EvidenceItem,
    EvidenceType,
    RunReport,
    TaskDetail,
    ClaimVsRealityReport,
    AntigravityCapability,
    HandoffPrompt,
    HandoffSubmissionRequest,
)
from backend.app.services.verification_engine import DeterministicVerificationEngine
from backend.app.services.gemma_service import GemmaService
from backend.app.services.antigravity_adapter import AntigravityAdapter
from backend.app.services.safe_runner import SafeExecutionRunner
from backend.app.services.workflow_service import WorkflowService, InvalidStateTransitionError
from backend.app.db.repository import DatabaseRepository
from backend.app.schemas.task import TaskStatusUpdate
from backend.app.api.projects import router as projects_router
from backend.app.api.evidence import router as evidence_router
from backend.app.models.task import TaskRecord
from backend.app.models.project import Project
import threading

_active_executions: set[str] = set()
_execution_lock = threading.Lock()


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
    allow_origins=settings.allowed_origins,
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
            import json
            crit_json = json.dumps([c.model_dump() for c in task.acceptance_criteria])
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
                acceptance_criteria=crit_json,
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
async def list_tasks(
    project_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Task]:
    """
    Lists all persisted tasks ordered by creation time with pagination.
    """
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
    return db_repo.list_tasks(project_id=project_id, limit=limit, offset=offset)

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "PLANNED": {"PENDING_APPROVAL", "APPROVED", "CANCELLED"},
    "PENDING_APPROVAL": {"APPROVED", "IN_PROGRESS", "PLANNED", "CANCELLED"},
    "APPROVED": {"IN_PROGRESS", "PLANNED", "CANCELLED"},
    "IN_PROGRESS": {"COMPLETED", "FAILED", "CANCELLED"},
    "COMPLETED": set(),
    "FAILED": {"PLANNED", "CANCELLED"},
    "CANCELLED": set(),
}

@app.get("/api/tasks/{task_id}", response_model=TaskDetail)
async def get_task_detail(task_id: str, db: Session = Depends(get_db)) -> TaskDetail:
    """
    Returns task state along with associated plan, latest run, verification, and diagnosis.
    Also satisfies shallow task queries with flat attributes.
    """
    from backend.app.models.task import TaskRecord
    rec = db.query(TaskRecord).filter(TaskRecord.id == task_id).first()
    try:
        detail = workflow_service.get_task_detail(task_id)
        if rec and rec.status:
            detail.status = rec.status
            detail.task.status = rec.status
        return detail
    except KeyError:
        if rec:
            task = Task(
                id=rec.id,
                project_id=rec.project_id,
                title=rec.title,
                description=rec.description or "",
                acceptance_criteria=[],
                status=rec.status,
                state=TaskState(rec.status) if rec.status in TaskState.__members__ else TaskState.CREATED,
            )
            return TaskDetail(
                task=task,
                id=rec.id,
                title=rec.title,
                description=rec.description,
                status=rec.status,
                project_id=rec.project_id,
                state=task.state,
            )
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")


class TaskPlanRequestWrapper(BaseModel):
    repo_context: Optional[str] = None


@app.post("/api/tasks/{task_id}/plan", response_model=TaskPlan)
async def generate_task_plan_route(
    task_id: str,
    payload: Optional[TaskPlanRequestWrapper] = None,
    repo_context: Optional[str] = None,
    db: Session = Depends(get_db),
) -> TaskPlan:
    """
    Generates and persists a structured task plan via Gemma 4, advancing task to PLANNED.
    Supports repo_context via optional JSON request body or query parameter.
    """
    context = (payload.repo_context if payload else None) or repo_context
    try:
        plan = await workflow_service.generate_and_save_plan(task_id, repo_context=context)
        from backend.app.models.task import TaskRecord
        rec = db.query(TaskRecord).filter(TaskRecord.id == task_id).first()
        if rec:
            rec.status = "PLANNED"
            db.commit()
            db.refresh(rec)
        return plan
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    except InvalidStateTransitionError as e:
        raise HTTPException(status_code=409, detail=str(e))


@app.patch("/api/tasks/{task_id}/status")
async def update_task_status_route(
    task_id: str,
    body: TaskStatusUpdate,
    db: Session = Depends(get_db),
):
    """
    Transitions task lifecycle status, enforcing valid transitions and terminal state protection.
    Synchronizes both SQLAlchemy and local repository.
    """
    from backend.app.models.task import TaskRecord
    rec = db.query(TaskRecord).filter(TaskRecord.id == task_id).first()
    repo_task = db_repo.get_task(task_id)

    if not rec and not repo_task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")

    current_status = rec.status if rec else (repo_task.status or repo_task.state.value)
    new_status = body.status.value if hasattr(body.status, "value") else str(body.status)

    if current_status == new_status:
        if rec:
            return rec
        return repo_task

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

    if rec:
        rec.status = new_status
        db.commit()
        db.refresh(rec)

    if repo_task:
        repo_task.status = new_status
        if new_status in TaskState.__members__:
            repo_task.state = TaskState[new_status]
        db_repo.save_task(repo_task)

    return rec or repo_task


@app.post("/api/tasks/{task_id}/approve", response_model=Task)
async def approve_task_plan(
    task_id: str,
    payload: Optional[TaskApproveRequest] = None,
    db: Session = Depends(get_db),
) -> Task:
    """
    Explicitly approves the generated plan. Execution cannot proceed without approval.
    """
    approved_by = payload.approved_by if payload else "USER"
    notes = payload.notes if payload else None
    try:
        from backend.app.models.task import TaskRecord
        task = workflow_service.approve_plan(task_id, approved_by=approved_by, notes=notes)
        rec = db.query(TaskRecord).filter(TaskRecord.id == task_id).first()
        if rec:
            rec.status = "APPROVED"
            db.commit()
            db.refresh(rec)
        return task
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    except (InvalidStateTransitionError, ValueError) as e:
        raise HTTPException(status_code=409, detail=str(e))


@app.post("/api/tasks/{task_id}/execute", response_model=ExecutionRun)
async def execute_task_route(
    task_id: str,
    payload: Optional[TaskExecuteRequest] = None,
    db: Session = Depends(get_db),
) -> ExecutionRun:
    """
    Executes an allowlisted test command in the task's approved workspace.
    Enforces that the task must be in an approved / in-progress state.
    """
    from backend.app.models.task import TaskRecord
    from backend.app.models.project import Project
    from backend.app.services.evidence_collector import EvidenceCollector

    rec = db.query(TaskRecord).filter(TaskRecord.id == task_id).first()
    repo_task = db_repo.get_task(task_id)

    if not rec and not repo_task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")

    current_status = rec.status if rec else (repo_task.status or repo_task.state.value)

    # 1. Enforce Human Approval Gate
    is_approved = (current_status in ("PENDING_APPROVAL", "APPROVED", "IN_PROGRESS")) or (
        repo_task and repo_task.state in (TaskState.APPROVED, TaskState.IN_PROGRESS)
    )

    req = payload or TaskExecuteRequest()
    if req.command:
        try:
            safe_runner.validate_command(req.command)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    if not is_approved:
        if current_status in ("PLANNED", "CREATED") or (repo_task and repo_task.state in (TaskState.CREATED, TaskState.PLANNED)):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Task '{task_id}' cannot execute while in '{current_status}' status. "
                    "Explicit user approval is required: review the task plan and transition to 'PENDING_APPROVAL' before execution."
                ),
            )
        if current_status in ("COMPLETED", "CANCELLED") or (repo_task and repo_task.state in (TaskState.COMPLETED, TaskState.CANCELLED)):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Task '{task_id}' is in terminal status '{current_status}' and cannot execute.",
            )

    with _execution_lock:
        if task_id in _active_executions:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Task '{task_id}' is already actively executing. Concurrent execution requests are forbidden.",
            )
        _active_executions.add(task_id)

    try:
        # 2. Transition to IN_PROGRESS if approved
        current_status = "IN_PROGRESS"
        if rec:
            rec.status = "IN_PROGRESS"
            db.commit()
            db.refresh(rec)
        if repo_task:
            repo_task.status = "IN_PROGRESS"
            repo_task.state = TaskState.IN_PROGRESS
            db_repo.save_task(repo_task)

        # 3. Detect Execution Mode:
        # Safe local subprocess executions must be honestly labeled LOCAL_SAFE_RUNNER.
        # ANTIGRAVITY_AGENT is strictly reserved for genuine dispatches through Antigravity CLI/SDK.
        execution_mode = "LOCAL_SAFE_RUNNER"

        # 4. Target Directory
        if req.repo_path:
            target_dir = req.repo_path
        elif repo_task and repo_task.workspace_path:
            target_dir = repo_task.workspace_path
        else:
            proj = db.query(Project).filter(Project.id == getattr(rec, "project_id", "default")).first() if rec else None
            target_dir = proj.root_path if proj else os.getcwd()

        cmd = req.test_command
        if not cmd and req.command:
            import shlex
            try:
                cmd = shlex.split(req.command)
            except Exception:
                cmd = req.command.split()

        crit_id = req.criterion_id
        if not crit_id and repo_task and repo_task.acceptance_criteria:
            crit_id = repo_task.acceptance_criteria[0].id
        elif not crit_id and rec and rec.acceptance_criteria:
            try:
                import json
                parsed_c = json.loads(rec.acceptance_criteria) if isinstance(rec.acceptance_criteria, str) else rec.acceptance_criteria
                if isinstance(parsed_c, list) and len(parsed_c) > 0:
                    crit_id = parsed_c[0].get("id")
            except Exception:
                pass

        import uuid
        run_id = f"run-{uuid.uuid4().hex[:8]}"
        evidence_items = []
        exit_code = 0
        output_text = ""

        collector = EvidenceCollector()
        if cmd:
            cmd_item = collector.execute_test_command(
                command=cmd,
                cwd=target_dir,
                criterion_id=crit_id,
                timeout_seconds=req.timeout_seconds or 30.0,
            )
            evidence_items.append(cmd_item)
            exit_code = cmd_item.exit_code
            output_text = cmd_item.content or ""

            if exit_code is not None and exit_code != 0:
                current_status = "FAILED"
                if rec:
                    rec.status = "FAILED"
                    db.commit()
                    db.refresh(rec)
                if repo_task:
                    repo_task.status = "FAILED"
                    repo_task.state = TaskState.FAILED
                    db_repo.save_task(repo_task)

        git_diff_text = None
        try:
            import subprocess
            is_git = subprocess.run(
                ["git", "rev-parse", "--is-inside-work-tree"],
                cwd=target_dir,
                capture_output=True,
                timeout=5,
            ).returncode == 0
            if is_git:
                git_items = collector.collect_git_evidence(target_dir, criterion_id=crit_id)
                for gi in git_items:
                    evidence_items.append(gi)
                    if gi.evidence_type == EvidenceType.GIT_DIFF and gi.content:
                        git_diff_text = gi.content
        except Exception:
            pass

        run_obj = ExecutionRun(
            run_id=run_id,
            task_id=task_id,
            status=current_status,
            command=" ".join(cmd) if cmd else (req.command or ""),
            exit_code=exit_code,
            stdout=output_text,
            stderr="",
            source=execution_mode,
            git_diff=git_diff_text,
            evidence_items=evidence_items,
            evidence=evidence_items,
            execution_mode=execution_mode,
            message=(
                f"Task execution completed in {execution_mode} mode."
                if cmd
                else f"Task entered '{current_status}' execution state in {execution_mode} mode."
            ),
        )

        try:
            db_repo.save_execution_run(run_obj)
            db_repo.record_event(
                ExecutionEvent(
                    task_id=task_id,
                    run_id=run_id,
                    event_type="COMMAND_EXECUTED",
                    message=f"Executed '{run_obj.command}' (exit code: {exit_code})",
                    details={"exit_code": exit_code, "command": run_obj.command},
                )
            )
        except Exception:
            pass

        return run_obj
    finally:
        with _execution_lock:
            _active_executions.discard(task_id)

@app.get("/api/tasks/{task_id}/events", response_model=List[ExecutionEvent])
async def get_task_events(task_id: str) -> List[ExecutionEvent]:
    """
    Retrieves the chronological audit log of execution events for a task.
    """
    task = db_repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    return db_repo.list_events(task_id)


@app.get("/api/tasks/{task_id}/handoff", response_model=HandoffPrompt)
async def get_task_handoff_prompt(task_id: str, db: Session = Depends(get_db)) -> HandoffPrompt:
    """
    Generates a structured, task-specific prompt for Antigravity manual handoff execution.
    """
    task = db_repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    rec = db.query(TaskRecord).filter(TaskRecord.id == task_id).first()
    proj = db.query(Project).filter(Project.id == getattr(rec, "project_id", task.project_id)).first() if rec else None
    plan = db_repo.get_plan(task_id)
    return antigravity_adapter.generate_handoff_prompt(task, project_name=proj.name if proj else "", plan=plan)


@app.post("/api/tasks/{task_id}/handoff", response_model=ExecutionRun)
async def submit_task_handoff(
    task_id: str,
    req: HandoffSubmissionRequest,
    db: Session = Depends(get_db),
) -> ExecutionRun:
    """
    Submits unverified manual agent telemetry and git diff from an external Antigravity session.
    Enforces human approval before execution submission.
    """
    task = db_repo.get_task(task_id)
    rec = db.query(TaskRecord).filter(TaskRecord.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")

    try:
        run = antigravity_adapter.create_manual_handoff_run(task, req, db_repo)
        if rec:
            rec.status = run.status
            db.commit()
            db.refresh(rec)
        task.state = TaskState.RUNNING
        task.status = run.status
        db_repo.save_task(task)
        return run
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@app.post("/api/tasks/{task_id}/dispatch", response_model=ExecutionRun)
async def dispatch_task_agent(
    task_id: str,
    timeout_seconds: float = 60.0,
    db: Session = Depends(get_db),
) -> ExecutionRun:
    """
    Attempts genuine automated dispatch to the Antigravity agent CLI or SDK.
    If neither is available, returns HTTP 501 with truthful missing prerequisite information.
    """
    task = db_repo.get_task(task_id)
    rec = db.query(TaskRecord).filter(TaskRecord.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")

    task_state_val = task.state.value if hasattr(task.state, "value") else str(task.state)
    if task_state_val not in ("APPROVED", "RUNNING", "IN_PROGRESS"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Task '{task_id}' requires explicit approval before dispatch.",
        )

    try:
        prompt_obj = antigravity_adapter.generate_handoff_prompt(task)
        run = antigravity_adapter.dispatch_agent(task, prompt_obj.prompt, timeout_seconds=timeout_seconds)
        if rec:
            rec.status = run.status
            db.commit()
            db.refresh(rec)
        task.state = TaskState.RUNNING
        task.status = run.status
        db_repo.save_task(task)
        return run
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(e),
        )

@app.post("/api/tasks/{task_id}/verify", response_model=VerificationResult)
async def verify_persisted_task(task_id: str, run_id: Optional[str] = None) -> VerificationResult:
    """
    Deterministically evaluates all recorded execution evidence for the task.
    If checks fail, automatically generates and persists a Gemma failure diagnosis.
    """
    try:
        return await workflow_service.verify_task(task_id, run_id=run_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' or run '{run_id}' not found.")
    except (InvalidStateTransitionError, ValueError) as e:
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

@app.get("/api/runs/{run_id}/diagnosis", response_model=FailureDiagnosis)
async def get_run_diagnosis(run_id: str) -> FailureDiagnosis:
    """
    Retrieves the failure diagnosis record associated with an execution run.
    """
    run = db_repo.get_execution_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Execution run '{run_id}' not found.")
    diag = db_repo.get_latest_diagnosis(run.task_id)
    if not diag:
        raise HTTPException(status_code=404, detail=f"No diagnosis record exists for run '{run_id}'.")
    return diag

@app.get("/api/runs/{run_id}/claim-vs-reality", response_model=ClaimVsRealityReport)
async def get_run_claim_vs_reality(run_id: str) -> ClaimVsRealityReport:
    """
    Returns a Claim vs Reality comparison report comparing agent execution against verified evidence.
    """
    run = db_repo.get_execution_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Execution run '{run_id}' not found.")
    task = db_repo.get_task(run.task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{run.task_id}' not found.")

    claim = ExecutionClaim(
        task_id=task.id,
        agent_name="VIKASA Execution Runner",
        claimed_success=(run.exit_code == 0),
        statement=f"Executed '{run.command}'" if run.command else "Executed test command",
        git_diff=run.git_diff or "",
        evidence_list=run.evidence_items,
    )
    verification_res = verification_engine.evaluate(task, claim)
    return verification_engine.generate_claim_vs_reality_report(task, claim, verification_res)

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

# Mount frontend web application static files if present
import os
from fastapi.staticfiles import StaticFiles

frontend_dir = os.path.abspath(
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend")
)
if not os.path.exists(frontend_dir):
    frontend_dir = os.path.abspath("frontend")

if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

