import tempfile
import pytest
from unittest.mock import AsyncMock, patch
import json

from backend.app.schemas.core import (
    TaskState,
    AcceptanceCriterion,
    VerificationVerdict,
    GeneratorStatus,
)
from backend.app.db.repository import DatabaseRepository
from backend.app.services.gemma_service import GemmaService
from backend.app.services.verification_engine import DeterministicVerificationEngine
from backend.app.services.safe_runner import SafeExecutionRunner
from backend.app.services.workflow_service import WorkflowService, InvalidStateTransitionError

@pytest.fixture
def workflow():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    repo = DatabaseRepository(db_path=db_path)
    gemma = GemmaService()
    verifier = DeterministicVerificationEngine()
    runner = SafeExecutionRunner()
    yield WorkflowService(repository=repo, gemma_service=gemma, verification_engine=verifier, safe_runner=runner)

@pytest.mark.asyncio
async def test_full_workflow_lifecycle(workflow):
    # 1. Create task
    task = workflow.create_task(
        title="Implement user auth",
        description="Verify token on login",
        acceptance_criteria=[
            AcceptanceCriterion(id="AC-1", description="Token validated", required=True)
        ],
    )
    assert task.state == TaskState.CREATED

    # 2. Cannot execute before approval
    with pytest.raises(InvalidStateTransitionError, match="Explicit user approval is required"):
        workflow.execute_task(task.id, command="python -c \"print('test')\"")

    # 3. Plan task
    mock_plan = {
        "task_summary": "Plan for user auth",
        "steps": [
            {"step_number": 1, "action": "Write token test", "expected_outcome": "Passed", "associated_criterion_id": "AC-1"}
        ],
        "acceptance_criteria": [],
        "files_to_inspect": ["auth.py"],
        "tests_to_run": ["pytest test_auth.py"],
        "risks": [],
        "verification_strategy": "Test token"
    }
    with patch.object(workflow.gemma, "_query_ollama", new=AsyncMock(return_value=json.dumps(mock_plan))):
        plan = await workflow.generate_and_save_plan(task.id)

    assert plan.task_summary == "Plan for user auth"
    reloaded_task = workflow.repo.get_task(task.id)
    assert reloaded_task.state == TaskState.PLANNED

    # 4. Approve task
    approved_task = workflow.approve_plan(task.id, approved_by="LEAD_ENGINEER")
    assert approved_task.state == TaskState.APPROVED
    assert approved_task.approved_at is not None

    # 5. Execute task
    run = workflow.execute_task(
        task.id,
        command="python -c \"print('TOKEN_VALID')\"",
        criterion_id="AC-1",
    )
    assert run.status == "COMPLETED"
    reloaded_task = workflow.repo.get_task(task.id)
    assert reloaded_task.state == TaskState.VERIFYING

    # 6. Verify task
    verif = await workflow.verify_task(task.id, run_id=run.run_id)
    assert verif.verdict in [VerificationVerdict.VERIFIED, VerificationVerdict.REVIEW_REQUIRED, VerificationVerdict.FAILED]

    # Check event history
    events = workflow.repo.list_events(task.id)
    event_types = [e.event_type for e in events]
    assert "TASK_CREATED" in event_types
    assert "PLAN_GENERATED" in event_types
    assert "PLAN_APPROVED" in event_types
    assert "EXECUTION_STARTED" in event_types
    assert "EXECUTION_COMPLETED" in event_types
    assert "VERIFICATION_COMPLETED" in event_types

def test_invalid_state_transition_rejected(workflow):
    task = workflow.create_task(
        title="Invalid transition test",
        description="Verify state enforcement",
        acceptance_criteria=[],
    )
    # Cannot jump directly from CREATED to RUNNING
    with pytest.raises(InvalidStateTransitionError):
        workflow.transition_task_state(task, TaskState.RUNNING)
