from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.schemas.core import VerificationVerdict

client = TestClient(app)

def test_health_check_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "VIKASA API"

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
