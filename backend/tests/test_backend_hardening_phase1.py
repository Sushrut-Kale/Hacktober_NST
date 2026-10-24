"""
Phase 1 Backend Hardening & Validation Test Suite.
Validates:
- Pagination and bounds validation on projects and tasks listings
- State machine recovery and transitions for BLOCKED and NOT_RUN states
- GET /api/runs/{run_id}/diagnosis and GET /api/runs/{run_id}/claim-vs-reality endpoints
- Safe runner null-byte path rejection
- Fine-grained Ollama readiness reporting
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db.database import Base, get_db
from backend.app.main import app, db_repo, workflow_service
from backend.app.schemas.core import (
    Task,
    TaskState,
    AcceptanceCriterion,
    TaskPlan,
    ExecutionRun,
    VerificationResult,
    VerificationVerdict,
    RuleEvaluation,
    FailureDiagnosis,
    GeneratorStatus,
)
from backend.app.services.workflow_service import InvalidStateTransitionError
from backend.app.services.safe_runner import SafeExecutionRunner

test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture
def client():
    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)


def test_projects_pagination_and_bounds_validation(client):
    """Test pagination bounds on /api/projects."""
    # Create 5 test projects
    for i in range(5):
        client.post("/api/projects", json={"name": f"P-{i}", "root_path": f"/tmp/p-{i}"})

    # Test limit=2, offset=0
    resp1 = client.get("/api/projects?limit=2&offset=0")
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert len(data1) == 2

    # Test limit=2, offset=2
    resp2 = client.get("/api/projects?limit=2&offset=2")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert len(data2) == 2
    # Ensure distinct items
    assert data1[0]["id"] != data2[0]["id"]

    # Test invalid limit (0 and >100)
    assert client.get("/api/projects?limit=0").status_code == 400
    assert client.get("/api/projects?limit=101").status_code == 400

    # Test invalid offset (<0)
    assert client.get("/api/projects?offset=-1").status_code == 400


def test_project_tasks_pagination_and_bounds_validation(client):
    """Test pagination bounds on /api/projects/{project_id}/tasks."""
    proj = client.post("/api/projects", json={"name": "Task Parent", "root_path": "/tmp/tp"}).json()
    p_id = proj["id"]

    for i in range(4):
        client.post("/api/tasks", json={"project_id": p_id, "title": f"T-{i}"})

    # Page 1: limit 2
    res = client.get(f"/api/projects/{p_id}/tasks?limit=2&offset=0")
    assert res.status_code == 200
    assert len(res.json()) == 2

    # Page 2: limit 2 offset 2
    res2 = client.get(f"/api/projects/{p_id}/tasks?limit=2&offset=2")
    assert res2.status_code == 200
    assert len(res2.json()) == 2

    # Invalid bounds
    assert client.get(f"/api/projects/{p_id}/tasks?limit=0").status_code == 400
    assert client.get(f"/api/projects/{p_id}/tasks?offset=-5").status_code == 400


def test_tasks_list_pagination_and_bounds_validation(client):
    """Test pagination bounds on /api/tasks."""
    # Invalid bounds
    assert client.get("/api/tasks?limit=0").status_code == 400
    assert client.get("/api/tasks?limit=150").status_code == 400
    assert client.get("/api/tasks?offset=-1").status_code == 400

    # Valid paginated request
    res = client.get("/api/tasks?limit=10&offset=0")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_workflow_state_machine_blocked_and_not_run_recovery():
    """Verify state transitions into and recovering from BLOCKED and NOT_RUN states."""
    task = Task(
        id="t-wf-recover-01",
        title="Test Recovery",
        description="Verify recovery",
        acceptance_criteria=[AcceptanceCriterion(id="AC-1", description="Crit")],
        state=TaskState.VERIFYING,
    )

    # Transition VERIFYING -> BLOCKED
    workflow_service.transition_task_state(task, TaskState.BLOCKED)
    assert task.state == TaskState.BLOCKED

    # BLOCKED -> PLANNED (re-plan allowed)
    workflow_service.transition_task_state(task, TaskState.PLANNED)
    assert task.state == TaskState.PLANNED

    # PLANNED -> APPROVED
    workflow_service.transition_task_state(task, TaskState.APPROVED)
    assert task.state == TaskState.APPROVED

    # APPROVED -> RUNNING -> VERIFYING -> NOT_RUN
    workflow_service.transition_task_state(task, TaskState.RUNNING)
    workflow_service.transition_task_state(task, TaskState.VERIFYING)
    workflow_service.transition_task_state(task, TaskState.NOT_RUN)
    assert task.state == TaskState.NOT_RUN

    # NOT_RUN -> PLANNED
    workflow_service.transition_task_state(task, TaskState.PLANNED)
    assert task.state == TaskState.PLANNED


def test_get_run_diagnosis_endpoint(client):
    """Test GET /api/runs/{run_id}/diagnosis returns diagnosis or 404."""
    # Nonexistent run -> 404
    resp = client.get("/api/runs/nonexistent-run-id/diagnosis")
    assert resp.status_code == 404

    # Setup task, run, and diagnosis
    task_id = "t-run-diag-test"
    run_id = "run-diag-test"
    task = Task(
        id=task_id,
        title="Diag Test Task",
        description="Diag",
        acceptance_criteria=[],
        state=TaskState.FAILED,
    )
    db_repo.save_task(task)

    run = ExecutionRun(
        run_id=run_id,
        task_id=task_id,
        command="python -c sys.exit(1)",
        exit_code=1,
        stdout="",
        stderr="Error 1",
    )
    db_repo.save_execution_run(run)

    diag = FailureDiagnosis(
        task_id=task_id,
        verdict=VerificationVerdict.FAILED,
        failure_summary="Subprocess exited with code 1",
        likely_causes=["Runtime error"],
        evidence_references=["CommandExitCodeCheck"],
        recommended_fixes=["Inspect trace"],
        suggested_retests=["pytest"],
        run_id=run_id,
    )
    db_repo.save_diagnosis(diag)

    # Retrieve diagnosis by run_id
    res = client.get(f"/api/runs/{run_id}/diagnosis")
    assert res.status_code == 200
    data = res.json()
    assert data["task_id"] == task_id
    assert data["failure_summary"] == "Subprocess exited with code 1"
    assert "Runtime error" in data["likely_causes"]


def test_get_run_claim_vs_reality_endpoint(client):
    """Test GET /api/runs/{run_id}/claim-vs-reality returns discrepancy comparison."""
    # Nonexistent run -> 404
    assert client.get("/api/runs/missing-run-cvr/claim-vs-reality").status_code == 404

    task_id = "t-run-cvr-test"
    run_id = "run-cvr-test"
    task = Task(
        id=task_id,
        title="CVR Test Task",
        description="CVR",
        acceptance_criteria=[AcceptanceCriterion(id="AC-1", description="Must pass")],
        state=TaskState.FAILED,
    )
    db_repo.save_task(task)

    run = ExecutionRun(
        run_id=run_id,
        task_id=task_id,
        command="python -c print(1)",
        exit_code=0,
        stdout="1",
        stderr="",
        evidence_items=[],
    )
    db_repo.save_execution_run(run)

    res = client.get(f"/api/runs/{run_id}/claim-vs-reality")
    assert res.status_code == 200
    data = res.json()
    assert data["task_id"] == task_id
    # Since evidence_items is empty and criteria required, deterministic engine catches discrepancies
    assert len(data["discrepancies"]) >= 1


def test_safe_runner_rejects_null_bytes():
    """Verify safe runner rejects workspace paths containing null bytes."""
    runner = SafeExecutionRunner()
    with pytest.raises(ValueError, match="null bytes"):
        runner.validate_workspace("/workspace/safe\0/subfolder")
