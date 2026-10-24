import pytest
from backend.app.schemas.core import Task, AcceptanceCriterion, TaskPlan
from backend.app.services.gemma_service import GemmaService

@pytest.fixture
def sample_task():
    return Task(
        id="task-test-01",
        title="Add health check endpoint",
        description="Provide a FastAPI health check route returning JSON status.",
        acceptance_criteria=[
            AcceptanceCriterion(id="AC-1", description="GET /health returns 200 OK"),
            AcceptanceCriterion(id="AC-2", description="Response body contains status: healthy"),
        ]
    )

@pytest.mark.asyncio
async def test_ollama_readiness_check():
    service = GemmaService()
    status = await service.check_readiness()
    assert "available" in status
    assert "model_ready" in status

@pytest.mark.asyncio
async def test_generate_plan_fallback_structure(sample_task):
    # Using an invalid port to explicitly test the deterministic fallback path
    service = GemmaService(base_url="http://127.0.0.1:9999")
    plan = await service.generate_task_plan(sample_task)
    assert isinstance(plan, TaskPlan)
    assert plan.task_id == sample_task.id
    assert len(plan.steps) == 2
    assert plan.steps[0].associated_criterion_id == "AC-1"
    assert plan.steps[1].associated_criterion_id == "AC-2"
