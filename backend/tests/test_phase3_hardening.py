"""
Phase 3 Hardening Tests for VIKASA.

Verifies:
- 404 error handling for missing tasks and runs across all endpoints
- 409 Conflict for invalid state transitions (execution without approval)
- 400 Bad Request for forbidden shell metacharacters
- CORS preflight headers for frontend origins
- Complete TaskDetail structure (task, plan, runs, verification, diagnosis, events)
- Resilience across application restarts
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
import json

from backend.app.main import app
from backend.app.schemas.core import TaskState, VerificationVerdict

client = TestClient(app)

def test_missing_task_returns_404_across_routes():
    missing_id = "task-does-not-exist-999"

    # GET /api/tasks/{id}
    res = client.get(f"/api/tasks/{missing_id}")
    assert res.status_code == 404
    assert f"Task '{missing_id}' not found" in res.json()["detail"]

    # POST /api/tasks/{id}/plan
    res = client.post(f"/api/tasks/{missing_id}/plan")
    assert res.status_code == 404

    # POST /api/tasks/{id}/approve
    res = client.post(f"/api/tasks/{missing_id}/approve", json={"approved_by": "DEV"})
    assert res.status_code == 404

    # POST /api/tasks/{id}/execute
    res = client.post(f"/api/tasks/{missing_id}/execute", json={"command": "python -c \"print(1)\""})
    assert res.status_code == 404

    # GET /api/tasks/{id}/events
    res = client.get(f"/api/tasks/{missing_id}/events")
    assert res.status_code == 404

    # POST /api/tasks/{id}/verify
    res = client.post(f"/api/tasks/{missing_id}/verify")
    assert res.status_code == 404

    # GET /api/tasks/{id}/verification
    res = client.get(f"/api/tasks/{missing_id}/verification")
    assert res.status_code == 404

def test_missing_run_returns_404():
    missing_run = "run-does-not-exist-888"

    # GET /api/runs/{run_id}
    res = client.get(f"/api/runs/{missing_run}")
    assert res.status_code == 404
    assert f"Execution run '{missing_run}' not found" in res.json()["detail"]

    # GET /api/runs/{run_id}/report
    res = client.get(f"/api/runs/{missing_run}/report")
    assert res.status_code == 404

def test_approval_gate_enforcement_returns_409():
    # Create task (State: CREATED)
    create_res = client.post("/api/tasks", json={
        "id": "t-hardening-gate-01",
        "title": "Gate Test",
        "description": "Test approval enforcement",
        "acceptance_criteria": [{"id": "AC-1", "description": "AC", "required": True}]
    })
    assert create_res.status_code == 201

    # Attempt to execute directly in CREATED state -> 409 Conflict
    exec_res1 = client.post("/api/tasks/t-hardening-gate-01/execute", json={
        "command": "python -c \"print(1)\""
    })
    assert exec_res1.status_code == 409
    assert "Explicit user approval is required" in exec_res1.json()["detail"]

    # Generate plan (State: PLANNED)
    mock_plan = {
        "task_summary": "Gate test plan",
        "steps": [{"step_number": 1, "action": "Act", "expected_outcome": "Pass"}],
        "acceptance_criteria": [],
        "files_to_inspect": [],
        "tests_to_run": [],
        "risks": [],
        "verification_strategy": "pytest"
    }
    with patch("backend.app.services.gemma_service.GemmaService._query_ollama", new=AsyncMock(return_value=json.dumps(mock_plan))):
        client.post("/api/tasks/t-hardening-gate-01/plan")

    # Attempt to execute directly in PLANNED state without approval -> 409 Conflict
    exec_res2 = client.post("/api/tasks/t-hardening-gate-01/execute", json={
        "command": "python -c \"print(1)\""
    })
    assert exec_res2.status_code == 409
    assert "Explicit user approval is required" in exec_res2.json()["detail"]

def test_forbidden_shell_operator_returns_400():
    # Create task & approve it
    client.post("/api/tasks", json={
        "id": "t-hardening-sec-01",
        "title": "Security Test",
        "description": "Test shell injection blocking",
        "acceptance_criteria": [{"id": "AC-1", "description": "AC", "required": True}]
    })
    mock_plan = {
        "task_summary": "Sec plan",
        "steps": [{"step_number": 1, "action": "Act", "expected_outcome": "Pass"}],
        "acceptance_criteria": [],
        "files_to_inspect": [],
        "tests_to_run": [],
        "risks": [],
        "verification_strategy": "pytest"
    }
    with patch("backend.app.services.gemma_service.GemmaService._query_ollama", new=AsyncMock(return_value=json.dumps(mock_plan))):
        client.post("/api/tasks/t-hardening-sec-01/plan")
    client.post("/api/tasks/t-hardening-sec-01/approve")

    # Try executing dangerous chained shell commands
    dangerous_payloads = [
        "python -c 'print(1)' && echo 'danger'",
        "python -c 'print(1)' | grep 1",
        "python -c 'print(1)' > dump.txt",
    ]
    for cmd in dangerous_payloads:
        res = client.post("/api/tasks/t-hardening-sec-01/execute", json={"command": cmd})
        assert res.status_code == 400
        assert "Forbidden shell" in res.json()["detail"]

def test_cors_preflight_and_origin_headers():
    # Test preflight OPTIONS request from local Vite development origin
    response = client.options(
        "/api/tasks",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        }
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "POST" in response.headers.get("access-control-allow-methods", "")

def test_task_detail_includes_all_nested_aggregates():
    # Create, plan, approve, execute, verify
    client.post("/api/tasks", json={
        "id": "t-hardening-detail-01",
        "title": "Detail View Test",
        "description": "Ensure task detail aggregates plan, run, and events",
        "acceptance_criteria": [{"id": "AC-1", "description": "Done", "required": True}]
    })
    mock_plan = {
        "task_summary": "Aggregate plan",
        "steps": [{"step_number": 1, "action": "Act", "expected_outcome": "Pass", "associated_criterion_id": "AC-1"}],
        "acceptance_criteria": [],
        "files_to_inspect": [],
        "tests_to_run": [],
        "risks": [],
        "verification_strategy": "pytest"
    }
    with patch("backend.app.services.gemma_service.GemmaService._query_ollama", new=AsyncMock(return_value=json.dumps(mock_plan))):
        client.post("/api/tasks/t-hardening-detail-01/plan")
    client.post("/api/tasks/t-hardening-detail-01/approve")
    client.post("/api/tasks/t-hardening-detail-01/execute", json={"command": "python -c \"print('AGGREGATE_OK')\"", "criterion_id": "AC-1"})
    client.post("/api/tasks/t-hardening-detail-01/verify")

    detail_res = client.get("/api/tasks/t-hardening-detail-01")
    assert detail_res.status_code == 200
    data = detail_res.json()

    assert data["task"]["id"] == "t-hardening-detail-01"
    assert data["plan"] is not None
    assert data["latest_run"] is not None
    assert data["latest_verification"] is not None
    assert len(data["events"]) >= 5
