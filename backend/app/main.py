from contextlib import asynccontextmanager
from typing import Dict, Any, AsyncGenerator
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
    ExecutionClaim,
    VerificationResult,
    TaskPlan,
)
from backend.app.services.verification_engine import DeterministicVerificationEngine
from backend.app.services.gemma_service import GemmaService
from backend.app.services.antigravity_adapter import AntigravityAdapter
from backend.app.api.projects import router as projects_router
from backend.app.api.tasks import router as tasks_router
from backend.app.api.evidence import router as evidence_router


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize database tables and lifecycle resources."""
    try:
        init_db()
    except Exception as exc:
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
    allow_origins=settings.cors_origins if isinstance(settings.cors_origins, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

verification_engine = DeterministicVerificationEngine()
gemma_service = GemmaService()
antigravity_adapter = AntigravityAdapter()


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


class VerifyRequest(BaseModel):
    task: Task
    claim: ExecutionClaim


@app.post("/api/verify", response_model=VerificationResult)
async def verify_task(payload: VerifyRequest) -> VerificationResult:
    """
    Deterministically evaluates claims against task acceptance criteria and recorded evidence.
    AI completion claims never supersede this verification check.
    """
    return verification_engine.evaluate(payload.task, payload.claim)


@app.post("/api/plan", response_model=TaskPlan)
async def generate_plan(task: Task) -> TaskPlan:
    """
    Uses Gemma to generate a structured verification-first task plan.
    """
    return await gemma_service.generate_task_plan(task)


# Include integrated project, task, and evidence routers
app.include_router(projects_router, prefix="/api/projects", tags=["projects"])
app.include_router(tasks_router, prefix="/api/tasks", tags=["tasks"])
app.include_router(evidence_router, prefix="/api/verify", tags=["verification"])
