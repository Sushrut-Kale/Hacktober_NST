import pytest
import httpx
from backend.app.schemas.core import Task, AcceptanceCriterion, TaskPlan, GeneratorStatus
from backend.app.services.gemma_service import GemmaService

@pytest.mark.asyncio
async def test_live_gemma_integration():
    """
    Live integration test against the local Ollama instance running gemma4:e4b.
    Skips if Ollama is unavailable.
    """
    service = GemmaService()
    readiness = await service.check_readiness()
    if not readiness.get("available") or not readiness.get("model_ready"):
        pytest.skip(f"Ollama or gemma4:e4b not ready locally: {readiness}")

    task = Task(
        id="task-live-demo",
        title="Add CORS header to FastAPI app",
        description="Configure FastAPI app with CORSMiddleware to allow frontend origin.",
        acceptance_criteria=[
            AcceptanceCriterion(id="AC-1", description="FastAPI app has CORSMiddleware configured"),
            AcceptanceCriterion(id="AC-2", description="Allow origins includes localhost:3000"),
        ]
    )

    plan = await service.generate_plan(task)
    assert isinstance(plan, TaskPlan)
    assert plan.task_id == task.id
    # Live inference may be AI_ACTIVE
    assert plan.generator_status in [GeneratorStatus.AI_ACTIVE, GeneratorStatus.FALLBACK_ACTIVE]
    assert len(plan.steps) >= 2
    assert plan.task_summary != ""
