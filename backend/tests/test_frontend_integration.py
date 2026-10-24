"""End-to-end integration tests connecting frontend assets and full backend workflow."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db.database import Base, get_db
from backend.app.models.verification import VerificationRecord
from backend.app.main import app

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


def test_frontend_index_html_served(client):
    """Test that the frontend HTML interface is served at root."""
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "VIKASA" in response.text
    assert "Verification Studio" in response.text


def test_frontend_css_served(client):
    """Test that stylesheet is served properly."""
    response = client.get("/styles.css")
    assert response.status_code == 200
    assert "text/css" in response.headers["content-type"]
    assert "--bg-main" in response.text


def test_frontend_js_served(client):
    """Test that application JavaScript is served properly."""
    response = client.get("/app.js")
    assert response.status_code == 200
    assert "javascript" in response.headers["content-type"]
    assert "Deterministic Claim vs Reality Verification" in response.text


def test_frontend_favicon_served(client):
    """Test that favicon SVG is served properly."""
    response = client.get("/favicon.svg")
    assert response.status_code == 200
    assert "image/svg+xml" in response.headers["content-type"]


def test_e2e_complete_workflow(client):
    """
    Exercise the complete end-to-end workflow:
    1. System health check
    2. Register project
    3. Register task under project
    4. Run Claim vs Reality with PASS evidence
    5. Run Claim vs Reality with FAIL evidence
    6. Verify database persistence of verification audit record
    """
    # 1. Health check
    health_resp = client.get("/api/health")
    assert health_resp.status_code == 200
    assert health_resp.json()["status"] == "healthy"

    # 2. Register project
    proj_resp = client.post(
        "/api/projects",
        json={
            "name": "VIKASA E2E Workspace",
            "root_path": "d:/Hacktober_NST",
            "repository_url": "https://github.com/Sushrut-Kale/Hacktober_NST.git",
        },
    )
    assert proj_resp.status_code == 201
    proj_id = proj_resp.json()["id"]

    # 3. Create Task under project
    task_resp = client.post(
        "/api/tasks",
        json={
            "project_id": proj_id,
            "title": "Deterministic Verification Engine",
            "description": "Rule-based evaluator",
            "acceptance_criteria": "[AC-1] Unit tests exit with code 0\n[AC-2] Git diff recorded",
        },
    )
    assert task_resp.status_code == 201
    task_id = task_resp.json()["id"]

    # 4. List tasks to confirm linkage
    list_tasks_resp = client.get(f"/api/projects/{proj_id}/tasks")
    assert list_tasks_resp.status_code == 200
    assert any(t["id"] == task_id for t in list_tasks_resp.json())

    # 5. Run Claim vs Reality with PASS evidence
    pass_payload = {
        "task": {
            "id": task_id,
            "project_id": proj_id,
            "title": "Deterministic Verification Engine",
            "description": "Rule-based evaluator",
            "acceptance_criteria": [
                {"id": "AC-1", "description": "Unit tests exit with code 0", "required": True},
                {"id": "AC-2", "description": "Git diff recorded", "required": True},
            ]
        },
        "claim": {
            "task_id": task_id,
            "agent_name": "AntigravityWorker",
            "claimed_success": True,
            "statement": "Implemented and verified with passing pytest run.",
            "git_diff": "diff --git a/engine.py b/engine.py\n+class DeterministicVerificationEngine:",
            "evidence_list": [
                {
                    "criterion_id": "AC-1",
                    "evidence_type": "COMMAND_EXIT_CODE",
                    "content": "pytest tests/ - 10 passed in 0.2s",
                    "exit_code": 0,
                    "passed": True,
                },
                {
                    "criterion_id": "AC-2",
                    "evidence_type": "GIT_DIFF",
                    "content": "diff --git a/engine.py b/engine.py\n+class DeterministicVerificationEngine:",
                    "exit_code": 0,
                    "passed": True,
                }
            ]
        }
    }
    pass_cvr_resp = client.post("/api/verify/claim-vs-reality", json=pass_payload)
    assert pass_cvr_resp.status_code == 200
    pass_report = pass_cvr_resp.json()
    assert pass_report["verdict"] == "PASS"
    assert pass_report["claim_verified"] is True
    assert len(pass_report["discrepancies"]) == 0
    assert pass_report["verification_result"]["confidence_score"] == 1.0

    # 6. Run Claim vs Reality with FAIL evidence (exit code 1)
    fail_payload = {
        "task": pass_payload["task"],
        "claim": {
            "task_id": task_id,
            "agent_name": "AntigravityWorker",
            "claimed_success": True, # Claiming success despite failure!
            "statement": "I think it works",
            "git_diff": "diff ...",
            "evidence_list": [
                {
                    "criterion_id": "AC-1",
                    "evidence_type": "COMMAND_EXIT_CODE",
                    "content": "FAILED test_something with exit code 1",
                    "exit_code": 1,
                    "passed": False,
                }
            ]
        }
    }
    fail_cvr_resp = client.post("/api/verify/claim-vs-reality", json=fail_payload)
    assert fail_cvr_resp.status_code == 200
    fail_report = fail_cvr_resp.json()
    assert fail_report["verdict"] == "FAIL"
    assert fail_report["claim_verified"] is False
    assert len(fail_report["discrepancies"]) >= 1

    # 7. Check database persistence: query session to verify audit records
    db = TestingSessionLocal()
    records = db.query(VerificationRecord).filter(VerificationRecord.task_id == task_id).all()
    assert len(records) >= 2
    verdicts = [r.verdict for r in records]
    assert "PASS" in verdicts
    assert "FAIL" in verdicts
    db.close()
