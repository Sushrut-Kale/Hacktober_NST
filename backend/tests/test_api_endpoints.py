from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
import json

from backend.app.main import app
from backend.app.schemas.core import VerificationVerdict, GeneratorStatus, TaskState

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
    assert data["confidence_score"] < 0.5


def test_plan_endpoint_with_direct_task():
    payload = {
        "id": "task-plan-01",
        "title": "Add logging module",
        "description": "Log all verification runs to sqlite",
        "acceptance_criteria": [
            {"id": "AC-1", "description": "Create audit table", "required": True}
        ]
    }
    mock_plan_data = {
        "task_summary": "Implement audit log in sqlite",
        "steps": [
            {
                "step_number": 1,
                "action": "Create audit table",
                "expected_outcome": "Table exists",
                "associated_criterion_id": "AC-1"
            }
        ],
        "acceptance_criteria": [
            {
                "criterion_id": "AC-1",
                "description": "Create audit table",
                "verification_method": "pytest"
            }
        ],
        "files_to_inspect": ["backend/app/main.py"],
        "tests_to_run": ["pytest tests/test_audit.py"],
        "risks": ["Database locking"],
        "verification_strategy": "Deterministic table check"
    }
    with patch("backend.app.services.gemma_service.GemmaService._query_ollama", new=AsyncMock(return_value=json.dumps(mock_plan_data))):
        response = client.post("/api/plan", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "task-plan-01"
    assert data["task_summary"] == "Implement audit log in sqlite"
    assert len(data["steps"]) >= 1
    assert data["generator_status"] == GeneratorStatus.AI_ACTIVE.value

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
    mock_plan_data = {
        "task_summary": "Implement audit log with context",
        "steps": [
            {
                "step_number": 1,
                "action": "Create audit table",
                "expected_outcome": "Table exists",
                "associated_criterion_id": "AC-1"
            }
        ],
        "acceptance_criteria": [],
        "files_to_inspect": ["backend/app/main.py"],
        "tests_to_run": [],
        "risks": [],
        "verification_strategy": "Check sqlite"
    }
    with patch("backend.app.services.gemma_service.GemmaService._query_ollama", new=AsyncMock(return_value=json.dumps(mock_plan_data))):
        response = client.post("/api/plan", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "task-plan-02"
    assert data["generator_status"] == GeneratorStatus.AI_ACTIVE.value

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
    mock_diag_data = {
        "failure_summary": "Insufficient evidence: pytest exited with exit code 1",
        "likely_causes": ["Missing test assertion"],
        "evidence_references": ["CommandExitCodeCheck failed"],
        "recommended_fixes": ["Fix failing test in test_routes.py"],
        "suggested_retests": ["python -m pytest"],
        "confidence": 0.85
    }
    with patch("backend.app.services.gemma_service.GemmaService._query_ollama", new=AsyncMock(return_value=json.dumps(mock_diag_data))):
        response = client.post("/api/diagnosis", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "t-diag-1"
    assert data["verdict"] == "FAILED"
    assert data["insufficient_evidence"] is True
    assert "likely_causes" in data
    assert "recommended_fixes" in data

def test_persistent_task_lifecycle_routes():
    # 1. POST /api/tasks
    task_res = client.post("/api/tasks", json={
        "id": "api-task-lifecycle-01",
        "title": "API Lifecycle Task",
        "description": "Testing full persistent lifecycle via API",
        "acceptance_criteria": [
            {"id": "AC-1", "description": "Returns 200 from endpoint", "required": True}
        ]
    })
    assert task_res.status_code == 201
    task_data = task_res.json()
    assert task_data["id"] == "api-task-lifecycle-01"
    assert task_data["state"] == TaskState.CREATED.value

    # 2. GET /api/tasks
    list_res = client.get("/api/tasks")
    assert list_res.status_code == 200
    assert any(t["id"] == "api-task-lifecycle-01" for t in list_res.json())

    # 3. Execution rejected before approval (POST /api/tasks/{id}/execute)
    exec_reject_res = client.post(f"/api/tasks/{task_data['id']}/execute", json={
        "command": "python -c \"print(1)\""
    })
    assert exec_reject_res.status_code == 409

    # 4. POST /api/tasks/{id}/plan
    mock_plan = {
        "task_summary": "API lifecycle plan",
        "steps": [{"step_number": 1, "action": "Test step", "expected_outcome": "Passed", "associated_criterion_id": "AC-1"}],
        "acceptance_criteria": [],
        "files_to_inspect": [],
        "tests_to_run": [],
        "risks": [],
        "verification_strategy": "pytest"
    }
    with patch("backend.app.services.gemma_service.GemmaService._query_ollama", new=AsyncMock(return_value=json.dumps(mock_plan))):
        plan_res = client.post(f"/api/tasks/{task_data['id']}/plan")
    assert plan_res.status_code == 200
    assert plan_res.json()["task_id"] == task_data["id"]

    # 5. POST /api/tasks/{id}/approve
    approve_res = client.post(f"/api/tasks/{task_data['id']}/approve", json={
        "approved_by": "QA_ENGINEER"
    })
    assert approve_res.status_code == 200
    assert approve_res.json()["state"] == TaskState.APPROVED.value

    # 6. POST /api/tasks/{id}/execute
    exec_res = client.post(f"/api/tasks/{task_data['id']}/execute", json={
        "command": "python -c \"print('RUN_SUCCESS')\"",
        "criterion_id": "AC-1"
    })
    assert exec_res.status_code == 200
    run_data = exec_res.json()
    assert run_data["status"] == "COMPLETED"
    run_id = run_data["run_id"]

    # 7. GET /api/tasks/{id}/events
    events_res = client.get(f"/api/tasks/{task_data['id']}/events")
    assert events_res.status_code == 200
    assert len(events_res.json()) >= 4

    # 8. POST /api/tasks/{id}/verify
    verify_res = client.post(f"/api/tasks/{task_data['id']}/verify")
    assert verify_res.status_code == 200
    assert "verdict" in verify_res.json()

    # 9. GET /api/tasks/{id}/verification
    get_v_res = client.get(f"/api/tasks/{task_data['id']}/verification")
    assert get_v_res.status_code == 200
    assert get_v_res.json()["task_id"] == task_data["id"]

    # 10. GET /api/runs/{run_id}
    run_inspect_res = client.get(f"/api/runs/{run_id}")
    assert run_inspect_res.status_code == 200
    assert run_inspect_res.json()["run_id"] == run_id

    # 11. GET /api/runs/{run_id}/report
    report_res = client.get(f"/api/runs/{run_id}/report")
    assert report_res.status_code == 200
    assert report_res.json()["run"]["run_id"] == run_id

    # 12. GET /api/tasks/{id} (TaskDetail)
    detail_res = client.get(f"/api/tasks/{task_data['id']}")
    assert detail_res.status_code == 200
    assert detail_res.json()["task"]["id"] == task_data["id"]
    assert detail_res.json()["plan"] is not None
    assert detail_res.json()["latest_run"] is not None


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
    assert data["verdict"] in ("FAIL", "FAILED")
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

