from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMouter = FastAPI() # placeholder to import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any

from backend.app.config import settings
from backend.app.schemas.core import (
    Task,
    ExecutionClaim,
    VerificationResult,
    TaskPlan,
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
