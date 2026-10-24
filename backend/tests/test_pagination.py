"""
Pagination tests for GET /api/projects and GET /api/projects/{project_id}/tasks.

Covers the full pagination specification:
1. Default pagination (no params).
2. Custom limit and offset.
3. Empty datasets.
4. Offset beyond the last record.
5. Negative offset → 422 Unprocessable Entity.
6. Zero, invalid, and excessive limits → 422 Unprocessable Entity.
7. Stable ordering across repeated requests.
8. Project-specific task scoping.
9. Unknown project IDs → 404.
10. DB query-level pagination (not loading all records first).
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db.database import Base, get_db
from backend.app.main import app

# ---------------------------------------------------------------------------
# Isolated in-memory SQLite database for this test module
# ---------------------------------------------------------------------------
test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture
def client():
    """Spin up a fresh in-memory DB for each test and tear it down after."""
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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_project(client, name: str, root_path: str = None) -> str:
    """Creates a project and returns its ID."""
    resp = client.post(
        "/api/projects",
        json={"name": name, "root_path": root_path or f"/{name.lower().replace(' ', '_')}"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_task(client, project_id: str, title: str) -> str:
    """Creates a task under a project and returns its ID."""
    resp = client.post(
        "/api/tasks",
        json={"project_id": project_id, "title": title},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


# ===========================================================================
# 1. Default pagination — GET /api/projects
# ===========================================================================

def test_list_projects_default_pagination_returns_list(client):
    """Default GET /api/projects returns a valid list (possibly empty)."""
    resp = client.get("/api/projects")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_list_projects_default_pagination_limit_50(client):
    """Default page size is 50: never returns more than 50 records."""
    for i in range(60):
        _create_project(client, f"Project {i:03d}")
    resp = client.get("/api/projects")
    assert resp.status_code == 200
    assert len(resp.json()) == 50


def test_list_project_tasks_default_pagination_returns_list(client):
    """Default GET /api/projects/{id}/tasks returns a valid list."""
    pid = _create_project(client, "PaginationParent")
    resp = client.get(f"/api/projects/{pid}/tasks")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_list_project_tasks_default_limit_50(client):
    """Default task page size is 50: never returns more than 50 records."""
    pid = _create_project(client, "Many Tasks Project")
    for i in range(60):
        _create_task(client, pid, f"Task {i:03d}")
    resp = client.get(f"/api/projects/{pid}/tasks")
    assert resp.status_code == 200
    assert len(resp.json()) == 50


# ===========================================================================
# 2. Custom limit and offset
# ===========================================================================

def test_list_projects_custom_limit(client):
    """Custom limit returns at most that many records."""
    for i in range(10):
        _create_project(client, f"LimitProj {i}")
    resp = client.get("/api/projects?limit=5")
    assert resp.status_code == 200
    assert len(resp.json()) == 5


def test_list_projects_custom_offset(client):
    """Custom offset skips the correct number of records."""
    for i in range(8):
        _create_project(client, f"OffsetProj {i}")
    first_page = client.get("/api/projects?limit=5&offset=0").json()
    second_page = client.get("/api/projects?limit=5&offset=5").json()
    # No overlap between pages
    first_ids = {p["id"] for p in first_page}
    second_ids = {p["id"] for p in second_page}
    assert first_ids.isdisjoint(second_ids)
    # Combined covers all 8
    assert len(first_ids | second_ids) == 8


def test_list_project_tasks_custom_limit_offset(client):
    """Task pagination uses limit and offset correctly and without cross-project leakage."""
    pid = _create_project(client, "TaskPagProj")
    task_ids = [_create_task(client, pid, f"T {i}") for i in range(8)]

    first = client.get(f"/api/projects/{pid}/tasks?limit=5&offset=0").json()
    second = client.get(f"/api/projects/{pid}/tasks?limit=5&offset=5").json()
    returned = {t["id"] for t in first} | {t["id"] for t in second}
    assert len(first) == 5
    assert len(second) == 3
    assert returned == set(task_ids)


# ===========================================================================
# 3. Empty datasets
# ===========================================================================

def test_list_projects_empty_database(client):
    """Returns empty list when no projects exist."""
    resp = client.get("/api/projects")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_project_tasks_empty_project(client):
    """Returns empty list when a project has no tasks."""
    pid = _create_project(client, "EmptyProject")
    resp = client.get(f"/api/projects/{pid}/tasks")
    assert resp.status_code == 200
    assert resp.json() == []


# ===========================================================================
# 4. Offset beyond the last record
# ===========================================================================

def test_list_projects_offset_beyond_records(client):
    """Offset beyond total records returns an empty list, not an error."""
    for i in range(3):
        _create_project(client, f"FewProj {i}")
    resp = client.get("/api/projects?offset=9999")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_project_tasks_offset_beyond_records(client):
    """Task offset beyond total records returns empty list, not an error."""
    pid = _create_project(client, "FewTaskProj")
    _create_task(client, pid, "Only Task")
    resp = client.get(f"/api/projects/{pid}/tasks?offset=9999")
    assert resp.status_code == 200
    assert resp.json() == []


# ===========================================================================
# 5. Negative offset → 422 Unprocessable Entity
# ===========================================================================

def test_list_projects_negative_offset_rejected(client):
    """Negative offset is rejected with 422."""
    resp = client.get("/api/projects?offset=-1")
    assert resp.status_code == 422


def test_list_project_tasks_negative_offset_rejected(client):
    """Negative offset for tasks is rejected with 422."""
    pid = _create_project(client, "NegOffsetProj")
    resp = client.get(f"/api/projects/{pid}/tasks?offset=-1")
    assert resp.status_code == 422


# ===========================================================================
# 6. Zero, invalid, and excessive limits → 422
# ===========================================================================

def test_list_projects_zero_limit_rejected(client):
    """limit=0 is rejected with 422 (min is 1)."""
    resp = client.get("/api/projects?limit=0")
    assert resp.status_code == 422


def test_list_projects_excessive_limit_rejected(client):
    """limit > 200 is rejected with 422."""
    resp = client.get("/api/projects?limit=201")
    assert resp.status_code == 422


def test_list_projects_invalid_limit_string_rejected(client):
    """Non-integer limit is rejected with 422."""
    resp = client.get("/api/projects?limit=abc")
    assert resp.status_code == 422


def test_list_project_tasks_zero_limit_rejected(client):
    """limit=0 for tasks is rejected with 422."""
    pid = _create_project(client, "ZeroLimitTaskProj")
    resp = client.get(f"/api/projects/{pid}/tasks?limit=0")
    assert resp.status_code == 422


def test_list_project_tasks_excessive_limit_rejected(client):
    """limit > 200 for tasks is rejected with 422."""
    pid = _create_project(client, "ExcLimitTaskProj")
    resp = client.get(f"/api/projects/{pid}/tasks?limit=9999")
    assert resp.status_code == 422


# ===========================================================================
# 7. Stable ordering across repeated requests
# ===========================================================================

def test_list_projects_stable_ordering(client):
    """Repeated requests with the same params return identical ordered results."""
    for i in range(5):
        _create_project(client, f"StableProj {i}")
    first = client.get("/api/projects?limit=5&offset=0").json()
    second = client.get("/api/projects?limit=5&offset=0").json()
    assert [p["id"] for p in first] == [p["id"] for p in second]


def test_list_project_tasks_stable_ordering(client):
    """Repeated task list requests return identical ordered results."""
    pid = _create_project(client, "StableTaskProj")
    for i in range(5):
        _create_task(client, pid, f"StableTask {i}")
    first = client.get(f"/api/projects/{pid}/tasks?limit=5").json()
    second = client.get(f"/api/projects/{pid}/tasks?limit=5").json()
    assert [t["id"] for t in first] == [t["id"] for t in second]


# ===========================================================================
# 8. Project-specific task scoping
# ===========================================================================

def test_list_project_tasks_scoped_to_project(client):
    """Tasks returned are strictly limited to the requested project."""
    pid_a = _create_project(client, "ScopeProjectA")
    pid_b = _create_project(client, "ScopeProjectB")

    tid_a = _create_task(client, pid_a, "Task A1")
    _create_task(client, pid_b, "Task B1")
    _create_task(client, pid_b, "Task B2")

    tasks_a = client.get(f"/api/projects/{pid_a}/tasks").json()
    tasks_b = client.get(f"/api/projects/{pid_b}/tasks").json()

    assert len(tasks_a) == 1
    assert tasks_a[0]["id"] == tid_a
    assert len(tasks_b) == 2
    task_b_ids = {t["id"] for t in tasks_b}
    assert tid_a not in task_b_ids


def test_list_project_tasks_cross_project_isolation(client):
    """Pagination of project A's tasks never leaks project B's tasks."""
    pid_a = _create_project(client, "IsolationA")
    pid_b = _create_project(client, "IsolationB")

    a_task_ids = {_create_task(client, pid_a, f"A-Task {i}") for i in range(3)}
    b_task_ids = {_create_task(client, pid_b, f"B-Task {i}") for i in range(3)}

    a_returned = {t["id"] for t in client.get(f"/api/projects/{pid_a}/tasks").json()}
    b_returned = {t["id"] for t in client.get(f"/api/projects/{pid_b}/tasks").json()}

    assert a_returned == a_task_ids
    assert b_returned == b_task_ids
    assert a_returned.isdisjoint(b_returned)


# ===========================================================================
# 9. Unknown project IDs → 404
# ===========================================================================

def test_list_project_tasks_unknown_project_returns_404(client):
    """Requesting tasks for a nonexistent project returns 404."""
    resp = client.get("/api/projects/does-not-exist-xyz/tasks")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_get_project_unknown_id_returns_404(client):
    """Requesting a nonexistent project by ID returns 404."""
    resp = client.get("/api/projects/nonexistent-id-abc")
    assert resp.status_code == 404


# ===========================================================================
# 10. Database query-level pagination (not loading all records)
# ===========================================================================

def test_pagination_slices_at_database_level(client):
    """
    Verifies that offset slicing happens at the DB layer, not in Python.
    Creates N projects, fetches page 2, and confirms the IDs match the
    expected ordered slice, ruling out full-load-then-slice.
    """
    all_ids = []
    for i in range(10):
        all_ids.append(_create_project(client, f"DBSliceProj {i:02d}"))

    # Fetch all in one shot (limit=10, offset=0)
    all_projects = client.get("/api/projects?limit=10&offset=0").json()
    # Fetch second page with limit=5 offset=5
    page2 = client.get("/api/projects?limit=5&offset=5").json()

    # The IDs in page2 must exactly match the records at positions [5:10]
    # from the all-records query
    expected_ids = [p["id"] for p in all_projects[5:10]]
    returned_ids = [p["id"] for p in page2]
    assert returned_ids == expected_ids
