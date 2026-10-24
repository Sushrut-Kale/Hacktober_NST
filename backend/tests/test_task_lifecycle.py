"""
Task lifecycle and human approval enforcement tests.

Covers:
- Valid state transitions.
- Invalid state transitions → 409 Conflict.
- Missing task IDs → 404.
- Approval requirements (PLANNED → PENDING_APPROVAL → IN_PROGRESS).
- Execution before approval is blocked by the state machine.
- Repeated idempotent transitions (same status → no error).
- Terminal states (COMPLETED, CANCELLED) cannot transition further.
- Task state consistency verified after transitions.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db.database import Base, get_db
from backend.app.main import app

# ---------------------------------------------------------------------------
# Isolated in-memory database
# ---------------------------------------------------------------------------
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
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _setup_project_and_task(client) -> tuple[str, str]:
    """Creates a project and task, returns (project_id, task_id)."""
    proj = client.post("/api/projects", json={"name": "LifecycleProj", "root_path": "/lc"})
    assert proj.status_code == 201
    pid = proj.json()["id"]

    task = client.post(
        "/api/tasks",
        json={"project_id": pid, "title": "Lifecycle Task", "description": "Test lifecycle"},
    )
    assert task.status_code == 201
    return pid, task.json()["id"]


def _transition(client, task_id: str, new_status: str):
    """PATCH task status, returns Response."""
    return client.patch(f"/api/tasks/{task_id}/status", json={"status": new_status})


# ===========================================================================
# Valid state transitions
# ===========================================================================

def test_planned_to_pending_approval(client):
    """PLANNED → PENDING_APPROVAL is a valid transition (approval gate)."""
    _, tid = _setup_project_and_task(client)
    resp = _transition(client, tid, "PENDING_APPROVAL")
    assert resp.status_code == 200
    assert resp.json()["status"] == "PENDING_APPROVAL"


def test_pending_approval_to_in_progress(client):
    """PENDING_APPROVAL → IN_PROGRESS is a valid transition (execution starts)."""
    _, tid = _setup_project_and_task(client)
    _transition(client, tid, "PENDING_APPROVAL")
    resp = _transition(client, tid, "IN_PROGRESS")
    assert resp.status_code == 200
    assert resp.json()["status"] == "IN_PROGRESS"


def test_in_progress_to_completed(client):
    """IN_PROGRESS → COMPLETED is a valid terminal transition."""
    _, tid = _setup_project_and_task(client)
    _transition(client, tid, "PENDING_APPROVAL")
    _transition(client, tid, "IN_PROGRESS")
    resp = _transition(client, tid, "COMPLETED")
    assert resp.status_code == 200
    assert resp.json()["status"] == "COMPLETED"


def test_in_progress_to_failed(client):
    """IN_PROGRESS → FAILED is valid (execution failed)."""
    _, tid = _setup_project_and_task(client)
    _transition(client, tid, "PENDING_APPROVAL")
    _transition(client, tid, "IN_PROGRESS")
    resp = _transition(client, tid, "FAILED")
    assert resp.status_code == 200
    assert resp.json()["status"] == "FAILED"


def test_failed_to_planned_retry(client):
    """FAILED → PLANNED is valid (retry path)."""
    _, tid = _setup_project_and_task(client)
    _transition(client, tid, "PENDING_APPROVAL")
    _transition(client, tid, "IN_PROGRESS")
    _transition(client, tid, "FAILED")
    resp = _transition(client, tid, "PLANNED")
    assert resp.status_code == 200
    assert resp.json()["status"] == "PLANNED"


def test_planned_to_cancelled(client):
    """PLANNED → CANCELLED is valid (early cancellation)."""
    _, tid = _setup_project_and_task(client)
    resp = _transition(client, tid, "CANCELLED")
    assert resp.status_code == 200
    assert resp.json()["status"] == "CANCELLED"


def test_pending_approval_back_to_planned(client):
    """PENDING_APPROVAL → PLANNED is valid (approval rejected, needs rework)."""
    _, tid = _setup_project_and_task(client)
    _transition(client, tid, "PENDING_APPROVAL")
    resp = _transition(client, tid, "PLANNED")
    assert resp.status_code == 200
    assert resp.json()["status"] == "PLANNED"


# ===========================================================================
# Invalid state transitions → 409
# ===========================================================================

def test_planned_to_in_progress_blocked(client):
    """PLANNED → IN_PROGRESS is BLOCKED (must go through PENDING_APPROVAL first)."""
    _, tid = _setup_project_and_task(client)
    resp = _transition(client, tid, "IN_PROGRESS")
    assert resp.status_code == 409
    assert "PENDING_APPROVAL" in resp.json()["detail"] or "not permitted" in resp.json()["detail"]


def test_planned_to_completed_blocked(client):
    """PLANNED → COMPLETED is BLOCKED (cannot skip all steps)."""
    _, tid = _setup_project_and_task(client)
    resp = _transition(client, tid, "COMPLETED")
    assert resp.status_code == 409


def test_completed_is_terminal(client):
    """COMPLETED → anything is BLOCKED (terminal state)."""
    _, tid = _setup_project_and_task(client)
    _transition(client, tid, "PENDING_APPROVAL")
    _transition(client, tid, "IN_PROGRESS")
    _transition(client, tid, "COMPLETED")

    for target in ("PLANNED", "IN_PROGRESS", "FAILED", "CANCELLED", "PENDING_APPROVAL"):
        resp = _transition(client, tid, target)
        assert resp.status_code == 409, f"Expected 409 from COMPLETED→{target}, got {resp.status_code}"


def test_cancelled_is_terminal(client):
    """CANCELLED → anything is BLOCKED (terminal state)."""
    _, tid = _setup_project_and_task(client)
    _transition(client, tid, "CANCELLED")

    for target in ("PLANNED", "IN_PROGRESS", "COMPLETED", "FAILED", "PENDING_APPROVAL"):
        resp = _transition(client, tid, target)
        assert resp.status_code == 409, f"Expected 409 from CANCELLED→{target}, got {resp.status_code}"


def test_in_progress_to_planned_blocked(client):
    """IN_PROGRESS → PLANNED is BLOCKED (cannot undo execution to planning)."""
    _, tid = _setup_project_and_task(client)
    _transition(client, tid, "PENDING_APPROVAL")
    _transition(client, tid, "IN_PROGRESS")
    resp = _transition(client, tid, "PLANNED")
    assert resp.status_code == 409


# ===========================================================================
# Missing task ID → 404
# ===========================================================================

def test_transition_nonexistent_task_returns_404(client):
    """Transitioning a task that doesn't exist returns 404."""
    resp = _transition(client, "nonexistent-task-id-xyz", "IN_PROGRESS")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


# ===========================================================================
# Idempotent transitions (same status → no error, returns current state)
# ===========================================================================

def test_idempotent_same_status_transition(client):
    """PATCHing a task to its current status is idempotent (200, no error)."""
    _, tid = _setup_project_and_task(client)
    # Task starts as PLANNED; transitioning to PLANNED should be idempotent
    resp = _transition(client, tid, "PLANNED")
    assert resp.status_code == 200
    assert resp.json()["status"] == "PLANNED"


# ===========================================================================
# Execution before approval is blocked by the state machine
# ===========================================================================

def test_execution_requires_approval_first(client):
    """
    Verifies the approval gate: a PLANNED task cannot jump directly to IN_PROGRESS.
    It must pass through PENDING_APPROVAL first.
    This is the core human approval enforcement.
    """
    _, tid = _setup_project_and_task(client)

    # Attempt to start execution without approval
    resp_skip = _transition(client, tid, "IN_PROGRESS")
    assert resp_skip.status_code == 409, "Must not allow IN_PROGRESS without going through PENDING_APPROVAL"

    # Correct path: approve first
    resp_approve = _transition(client, tid, "PENDING_APPROVAL")
    assert resp_approve.status_code == 200

    # Now execution can start
    resp_execute = _transition(client, tid, "IN_PROGRESS")
    assert resp_execute.status_code == 200


# ===========================================================================
# Task state consistency after transitions
# ===========================================================================

def test_task_state_persisted_after_transition(client):
    """GET /api/tasks/{id} reflects the latest committed status."""
    _, tid = _setup_project_and_task(client)

    _transition(client, tid, "PENDING_APPROVAL")
    _transition(client, tid, "IN_PROGRESS")

    get_resp = client.get(f"/api/tasks/{tid}")
    assert get_resp.status_code == 200
    assert get_resp.json()["status"] == "IN_PROGRESS"


def test_task_status_detail_in_409_error(client):
    """409 error detail mentions the invalid transition clearly."""
    _, tid = _setup_project_and_task(client)
    resp = _transition(client, tid, "COMPLETED")
    assert resp.status_code == 409
    detail = resp.json()["detail"]
    # Should mention current state and why the transition is invalid
    assert "PLANNED" in detail or "not permitted" in detail
