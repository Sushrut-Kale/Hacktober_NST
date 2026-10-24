from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional, Union

from backend.app.config import settings
from backend.app.schemas.core import (
    Task,
    ExecutionClaim,
    VerificationResult,
    TaskPlan,
    PlanRequest,
    FailureDiagnosis,
    FailureDiagnosisRequest,
)
from backend.app.services.verification_engine import DeterministicVerificationEngine
from backend.app.services.gemma_service import GemmaService
from backend.app.services.antigravity_adapter import AntigravityAdapter

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Deterministic AI Coding Verification Platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

verification_engine = DeterministicVerificationEngine()
gemma_service = GemmaService()
antigravity_adapter = AntigravityAdapter()

@app.get("/health")
async def health_check() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
    }

@app.get("/api/health/ollama")
async def ollama_health() -> Dict[str, Any]:
    """
    Reports live Ollama connection status, model readiness, and active AI generator status.
    """
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
async def create_plan(payload: Union[PlanRequest, Task]) -> TaskPlan:
    """
    Generates a structured verification-first task plan using Gemma 4,
    or falls back cleanly to a deterministic plan if the model is unreachable.
    """
    if isinstance(payload, PlanRequest):
        return await gemma_service.generate_plan(task=payload.task, repo_context=payload.repo_context)
    return await gemma_service.generate_plan(task=payload)

@app.post("/api/diagnosis", response_model=FailureDiagnosis)
@app.post("/api/explain-failure", response_model=FailureDiagnosis)
async def diagnose_failure(payload: FailureDiagnosisRequest) -> FailureDiagnosis:
    """
    Generates an evidence-grounded diagnosis for a verification failure.
    Invariant: Deterministic verification verdict is never overridden by AI explanations.
    """
    return await gemma_service.explain_failure(
        task=payload.task,
        verification_result=payload.verification_result,
        repo_diff=payload.repo_diff,
        evidence_list=payload.evidence_list,
    )
