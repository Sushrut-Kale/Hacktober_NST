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


def test_api_health_check_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("healthy", "degraded")
    assert "database" in data


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


def test_verify_claim_vs_reality_endpoint():
    payload = {
        "task": {
            "id": "t2",
            "title": "Claim vs Reality Check",
            "description": "Evaluate discrepancies",
            "acceptance_criteria": [
                {"id": "AC1", "description": "Command passes", "required": True}
            ]
        },
        "claim": {
            "task_id": "t2",
            "agent_name": "DemoAgent",
            "claimed_success": True,
            "statement": "Completed AC1 successfully",
            "evidence_list": [
                {
                    "criterion_id": "AC1",
                    "evidence_type": "COMMAND_EXIT_CODE",
                    "content": "exit code 1 error",
                    "exit_code": 1,
                    "passed": False,
                }
            ]
        }
    }
    response = client.post("/api/verify/claim-vs-reality", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "FAIL"
    assert data["claim_verified"] is False
    assert len(data["discrepancies"]) >= 1


def test_evidence_collect_endpoint(tmp_path):
    payload = {
        "repo_path": str(tmp_path),
        "test_command": ["python", "-c", "print('collect-check')"]
    }
    response = client.post("/api/verify/collect", json=payload)
    assert response.status_code == 200
    items = response.json()
    assert isinstance(items, list)
    assert any(i["evidence_type"] == "COMMAND_EXIT_CODE" and i["exit_code"] == 0 for i in items)


def test_verify_diagnose_endpoint():
    """POST /api/verify/diagnose provides evidence-based failure explanation and corrective suggestions."""
    payload = {
        "task": {
            "id": "t-diag",
            "title": "Diagnose Test Task",
            "description": "Fix bug in calculation",
            "acceptance_criteria": [{"id": "AC1", "description": "Tests pass", "required": True}]
        },
        "verification_result": {
            "task_id": "t-diag",
            "verdict": "FAIL",
            "confidence_score": 0.0,
            "summary": "1 failed command execution",
            "raw_evidence_count": 1,
            "rule_evaluations": [
                {
                    "rule_name": "CommandExitCodeCheck",
                    "passed": False,
                    "verdict_impact": "FAIL",
                    "message": "Command exited with status 1."
                }
            ]
        }
    }
    response = client.post("/api/verify/diagnose", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "t-diag"
    assert data["verdict"] == "FAIL"
    assert data["failed_rule_count"] == 1
    assert "ai_explanation" in data

