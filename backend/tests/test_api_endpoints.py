from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.schemas.core import VerificationVerdict, GeneratorStatus

client = TestClient(app)

def test_health_check_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "VIKASA API"

def test_ollama_health_endpoint():
    response = client.get("/api/health/ollama")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] in [GeneratorStatus.AI_ACTIVE.value, GeneratorStatus.AI_UNAVAILABLE.value]
    assert "model" in data

def test_antigravity_health_endpoint():
    response = client.get("/api/health/antigravity")
    assert response.status_code == 200
    data = response.json()
    assert "sdk_package" in data
    assert "status" in data

def test_verify_endpoint_rejects_unsubstantiated_claim():
    payload = {
        "task": {
            "id": "t1",
            "title": "Build feature",
            "description": "Must have tests",
            "acceptance_criteria": [
                {"id": "AC1", "description": "Tests pass", "required": True}
            ]
        },
        "claim": {
            "task_id": "t1",
            "agent_name": "AntigravityAgent",
            "claimed_success": True,
            "statement": "I am done",
            "evidence_list": []
        }
    }
    response = client.post("/api/verify", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == VerificationVerdict.FAILED.value
    assert data["confidence_score"] == 0.0

def test_plan_endpoint_with_direct_task():
    payload = {
        "id": "task-plan-01",
        "title": "Add logging module",
        "description": "Log all verification runs to sqlite",
        "acceptance_criteria": [
            {"id": "AC-1", "description": "Create audit table", "required": True}
        ]
    }
    response = client.post("/api/plan", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "task-plan-01"
    assert "task_summary" in data
    assert len(data["steps"]) >= 1
    assert "generator_status" in data

def test_plan_endpoint_with_plan_request_wrapper():
    payload = {
        "task": {
            "id": "task-plan-02",
            "title": "Add logging module",
            "description": "Log all verification runs to sqlite",
            "acceptance_criteria": [
                {"id": "AC-1", "description": "Create audit table", "required": True}
            ]
        },
        "repo_context": "backend/app/main.py defines FastAPI endpoints"
    }
    response = client.post("/api/plan", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "task-plan-02"
    assert "generator_status" in data

def test_diagnosis_endpoint():
    payload = {
        "task": {
            "id": "t-diag-1",
            "title": "Fix broken route",
            "description": "Ensure route returns 200",
            "acceptance_criteria": [
                {"id": "AC-1", "description": "Returns 200 OK", "required": True}
            ]
        },
        "verification_result": {
            "task_id": "t-diag-1",
            "verdict": "FAILED",
            "confidence_score": 0.0,
            "rule_evaluations": [
                {
                    "rule_name": "CommandExitCodeCheck",
                    "passed": False,
                    "verdict_impact": "FAILED",
                    "message": "pytest exited with exit code 1",
                    "criterion_id": "AC-1"
                }
            ],
            "summary": "Verification FAILED: 0/1 rules passed",
            "raw_evidence_count": 0
        },
        "repo_diff": None,
        "evidence_list": []
    }
    response = client.post("/api/diagnosis", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "t-diag-1"
    assert data["verdict"] == "FAILED"
    assert data["insufficient_evidence"] is True
    assert "likely_causes" in data
    assert "recommended_fixes" in data
