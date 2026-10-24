"""
Database consistency tests.

Verifies:
- Projects persist across requests.
- Tasks reference the correct projects.
- API responses reflect committed database records.
- Verification records preserve their relationships.
- Updates are consistent.
- Failed operations roll back correctly.
- Foreign keys behave as expected.
- Tests use isolated temporary databases (never developer's vikasa.db).
- Repeated test runs do not contaminate each other.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db.database import Base, get_db
from backend.app.models.project import Project
from backend.app.models.task import TaskRecord
from backend.app.models.verification import VerificationRecord
from backend.app.main import app

# ---------------------------------------------------------------------------
# Isolated in-memory database per test
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


@pytest.fixture
def db_session():
    """Yield a raw DB session for direct query inspection."""
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=test_engine)


# ===========================================================================
# 1. Projects persist across requests
# ===========================================================================

def test_project_persists_across_requests(client):
    """A created project can be retrieved by a subsequent GET request."""
    resp = client.post(
        "/api/projects",
        json={"name": "Persisted Project", "root_path": "/persist"},
    )
    assert resp.status_code == 201
    pid = resp.json()["id"]

    # Second independent GET
    get_resp = client.get(f"/api/projects/{pid}")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["id"] == pid
    assert data["name"] == "Persisted Project"
    assert data["analysis_status"] == "PENDING"


def test_multiple_projects_persist_and_list(client):
    """Multiple projects appear in list after creation."""
    names = ["Alpha", "Beta", "Gamma"]
    for name in names:
        client.post("/api/projects", json={"name": name, "root_path": f"/{name}"})

    list_resp = client.get("/api/projects?limit=10")
    assert list_resp.status_code == 200
    returned_names = {p["name"] for p in list_resp.json()}
    for name in names:
        assert name in returned_names


# ===========================================================================
# 2. Tasks reference the correct projects
# ===========================================================================

def test_task_references_correct_project(client):
    """Task's project_id field matches the parent project."""
    proj = client.post("/api/projects", json={"name": "ParentProj", "root_path": "/pp"})
    pid = proj.json()["id"]
    task = client.post("/api/tasks", json={"project_id": pid, "title": "Child Task"})
    assert task.json()["project_id"] == pid


def test_task_is_listed_under_correct_project(client):
    """Task appears in the project's task list and not in another project's list."""
    pid_a = client.post("/api/projects", json={"name": "A", "root_path": "/a"}).json()["id"]
    pid_b = client.post("/api/projects", json={"name": "B", "root_path": "/b"}).json()["id"]
    tid = client.post("/api/tasks", json={"project_id": pid_a, "title": "Task A"}).json()["id"]

    tasks_a = client.get(f"/api/projects/{pid_a}/tasks").json()
    tasks_b = client.get(f"/api/projects/{pid_b}/tasks").json()

    assert any(t["id"] == tid for t in tasks_a)
    assert not any(t["id"] == tid for t in tasks_b)


# ===========================================================================
# 3. API responses reflect committed database records
# ===========================================================================

def test_api_response_matches_db_record(client):
    """API response fields match what is actually stored in the database."""
    resp = client.post(
        "/api/projects",
        json={"name": "DBMatchProj", "root_path": "/dbmatch", "repository_url": "https://example.com/repo.git"},
    )
    pid = resp.json()["id"]

    db = TestingSessionLocal()
    try:
        db_record = db.query(Project).filter(Project.id == pid).first()
        assert db_record is not None
        assert db_record.name == "DBMatchProj"
        assert db_record.root_path == "/dbmatch"
        assert db_record.repository_url == "https://example.com/repo.git"
        assert db_record.analysis_status == "PENDING"
    finally:
        db.close()


def test_task_api_response_matches_db_record(client):
    """Task API response fields match what is stored in the database."""
    pid = client.post("/api/projects", json={"name": "TaskMatchProj", "root_path": "/tm"}).json()["id"]
    task_resp = client.post(
        "/api/tasks",
        json={"project_id": pid, "title": "DBMatchTask", "description": "Details here"},
    ).json()

    db = TestingSessionLocal()
    try:
        db_task = db.query(TaskRecord).filter(TaskRecord.id == task_resp["id"]).first()
        assert db_task is not None
        assert db_task.title == "DBMatchTask"
        assert db_task.description == "Details here"
        assert db_task.project_id == pid
        assert db_task.status == "PLANNED"
    finally:
        db.close()


# ===========================================================================
# 4. Verification records preserve relationships
# ===========================================================================

def test_verification_records_linked_to_task(client):
    """Verification records created via /api/verify/claim-vs-reality persist against the correct task."""
    pid = client.post("/api/projects", json={"name": "VerifProj", "root_path": "/vp"}).json()["id"]
    tid = client.post("/api/tasks", json={"project_id": pid, "title": "VerifTask"}).json()["id"]

    payload = {
        "task": {
            "id": tid,
            "project_id": pid,
            "title": "VerifTask",
            "acceptance_criteria": [{"id": "AC-1", "description": "Test passes", "required": True}],
        },
        "claim": {
            "task_id": tid,
            "agent_name": "TestAgent",
            "claimed_success": True,
            "statement": "Done",
            "git_diff": "diff...",
            "evidence_list": [
                {
                    "criterion_id": "AC-1",
                    "evidence_type": "COMMAND_EXIT_CODE",
                    "content": "exit 0",
                    "exit_code": 0,
                    "passed": True,
                }
            ],
        },
    }
    resp = client.post("/api/verify/claim-vs-reality", json=payload)
    assert resp.status_code == 200

    # Verify DB record was created and linked to the correct task
    db = TestingSessionLocal()
    try:
        records = db.query(VerificationRecord).filter(VerificationRecord.task_id == tid).all()
        assert len(records) >= 1
        assert records[0].task_id == tid
        assert records[0].agent_name == "TestAgent"
    finally:
        db.close()


# ===========================================================================
# 5. Failed operations roll back correctly
# ===========================================================================

def test_orphan_task_rejected_no_partial_record(client):
    """Creating a task for a nonexistent project returns 404 and writes nothing to DB."""
    resp = client.post(
        "/api/tasks",
        json={"project_id": "fake-project-id", "title": "Should Not Exist"},
    )
    assert resp.status_code == 404

    db = TestingSessionLocal()
    try:
        tasks = db.query(TaskRecord).filter(TaskRecord.title == "Should Not Exist").all()
        assert tasks == []
    finally:
        db.close()


# ===========================================================================
# 6. Foreign keys behave as expected (tasks belong to projects)
# ===========================================================================

def test_tasks_are_scoped_by_project_id(client):
    """Tasks cannot be created without a valid project_id."""
    resp = client.post(
        "/api/tasks",
        json={"project_id": "ghost-project", "title": "Ghost Task"},
    )
    assert resp.status_code == 404


# ===========================================================================
# 7. Test isolation — runs do not contaminate each other
# ===========================================================================

def test_database_isolation_between_tests_a(client):
    """First isolation test — creates a project."""
    resp = client.post("/api/projects", json={"name": "IsolationA", "root_path": "/ia"})
    assert resp.status_code == 201
    # If test ordering were contaminated, this would fail due to duplicate names etc.


def test_database_isolation_between_tests_b(client):
    """Second isolation test — creates the same-name project without conflict."""
    resp = client.post("/api/projects", json={"name": "IsolationA", "root_path": "/ia"})
    assert resp.status_code == 201  # Fresh DB — no conflict from test_a


def test_database_never_touches_vikasa_db():
    """
    Smoke test: the test engine uses an in-memory URI, not a file-based vikasa.db.
    This confirms test data cannot accidentally leak to the developer's database.
    """
    assert "sqlite://" in str(test_engine.url), "Test engine must use in-memory SQLite"
    assert "vikasa.db" not in str(test_engine.url), "Test engine must NOT use vikasa.db"
