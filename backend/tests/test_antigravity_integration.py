"""
Phase 4 Tests for Genuine Antigravity Integration & Capability Completion.

Verifies:
1. Truthful capability reporting via GET /api/health/antigravity.
2. Structured task prompt generation for manual handoff (GET /api/tasks/{id}/handoff).
3. Human approval gate enforcement: 409 Conflict if attempting manual handoff or dispatch without approval.
4. Truthful provenance attribution:
   - ANTIGRAVITY_MANUAL_HANDOFF with is_manual_submission=True for user-pasted telemetry.
   - LOCAL_SAFE_RUNNER for safe subprocess execution.
   - ANTIGRAVITY_AGENT only when genuine automated agent dispatch succeeds.
5. Deterministic verification deciding verdicts on manual submissions (exit code, diff, criteria).
6. Automated agent dispatch:
   - 501 Not Implemented with explicit missing prerequisite when CLI/SDK is absent.
   - Mocked real dispatch executing agent process and attributing to ANTIGRAVITY_AGENT.
   - Timeout and error handling during dispatch.
7. Local runner fallback remaining fully operational when Antigravity agent is unavailable.
"""

import pytest
import shutil
import subprocess
import json
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.schemas.core import (
    TaskState,
    VerificationVerdict,
)
from backend.app.services.antigravity_adapter import antigravity_adapter

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_unique_task(title: str = "Auth Token Validation") -> str:
    """Helper to create a fresh task in CREATED state."""
    res = client.post(
        "/api/tasks",
        json={
            "title": title,
            "description": "Validate tokens deterministically",
            "acceptance_criteria": [
                {"id": "AC-1", "description": "Return 200 on valid token", "required": True},
                {"id": "AC-2", "description": "Return 401 on expired token", "required": True},
            ],
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _create_approved_task(title: str = "Approved Task") -> str:
    """Helper to create and approve a task through the official lifecycle."""
    task_id = _create_unique_task(title)
    mock_plan = {
        "task_summary": "Task plan",
        "steps": [{"step_number": 1, "action": "Act", "expected_outcome": "Pass"}],
        "acceptance_criteria": [],
        "files_to_inspect": [],
        "tests_to_run": [],
        "risks": [],
        "verification_strategy": "pytest"
    }
    with patch("backend.app.services.gemma_service.GemmaService._query_ollama", new=AsyncMock(return_value=json.dumps(mock_plan))):
        res_plan = client.post(f"/api/tasks/{task_id}/plan")
        assert res_plan.status_code in [200, 201], res_plan.text
    res_app = client.post(f"/api/tasks/{task_id}/approve", json={"approved_by": "QA Architect"})
    assert res_app.status_code == 200, res_app.text
    return task_id


# ---------------------------------------------------------------------------
# 1. Capability & Health Reporting Tests
# ---------------------------------------------------------------------------

def test_antigravity_health_capability_truthfulness():
    """GET /api/health/antigravity must truthfully report installation status and available modes."""
    res = client.get("/api/health/antigravity")
    assert res.status_code == 200
    data = res.json()

    assert "status" in data
    assert "cli_installed" in data
    assert "sdk_installed" in data
    assert "available_modes" in data
    assert "LOCAL_SAFE_RUNNER" in data["available_modes"]
    assert "ANTIGRAVITY_MANUAL_HANDOFF" in data["available_modes"]

    # Truthfulness check: should report NEEDS_INSTALLATION in current environment
    assert data["status"] == "NEEDS_INSTALLATION"
    assert data["cli_installed"] is False
    assert data["sdk_installed"] is False
    assert "missing_prerequisites" in data
    assert len(data["missing_prerequisites"]) > 0


def test_antigravity_adapter_inspect_capabilities():
    """Unit test for antigravity_adapter.inspect_capabilities()."""
    cap = antigravity_adapter.inspect_capabilities()
    assert isinstance(cap, dict)
    assert cap["status"] == "NEEDS_INSTALLATION"
    assert "LOCAL_SAFE_RUNNER" in cap["available_modes"]
    assert "ANTIGRAVITY_MANUAL_HANDOFF" in cap["available_modes"]
    assert cap["sdk_installed"] is False
    assert cap["cli_installed"] is False


# ---------------------------------------------------------------------------
# 2. Task Prompt Generation (Manual Handoff)
# ---------------------------------------------------------------------------

def test_generate_handoff_prompt_404_for_missing_task():
    """GET /api/tasks/{task_id}/handoff must return 404 for nonexistent tasks."""
    res = client.get("/api/tasks/task-nonexistent-9999/handoff")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_generate_handoff_prompt_content_and_structure():
    """GET /api/tasks/{task_id}/handoff must return structured instructions for Antigravity."""
    task_id = _create_unique_task("Antigravity Prompt Export Verification")

    res = client.get(f"/api/tasks/{task_id}/handoff")
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["task_id"] == task_id
    assert "prompt" in data
    prompt_text = data["prompt"]
    assert "TASK:" in prompt_text
    assert "Acceptance Criteria" in prompt_text
    assert "Instructions for Agent" in prompt_text
    assert "git diff" in prompt_text
    assert len(data["acceptance_criteria"]) > 0


# ---------------------------------------------------------------------------
# 3. Approval Gate Enforcement (Core Invariant)
# ---------------------------------------------------------------------------

def test_manual_handoff_requires_human_approval():
    """Submitting manual handoff before task approval must return 409 Conflict."""
    task_id = _create_unique_task("Unapproved Task Submission Test")

    # Task is in CREATED state, not APPROVED
    submission = {
        "submitted_by": "developer@example.com",
        "test_output": "Ran task manually in Antigravity",
        "git_diff": "diff --git a/file.py b/file.py\n+new line",
        "command_exit_code": 0,
        "notes": "Completed manual implementation",
    }

    res = client.post(f"/api/tasks/{task_id}/handoff", json=submission)
    assert res.status_code == 409
    assert "approval" in res.json()["detail"].lower()


def test_automated_dispatch_requires_human_approval():
    """Submitting automated dispatch before task approval must return 409 Conflict."""
    task_id = _create_unique_task("Unapproved Task Dispatch Test")

    res = client.post(f"/api/tasks/{task_id}/dispatch")
    assert res.status_code == 409
    assert "approval" in res.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 4. Successful Manual Handoff Submission & Provenance Attribution
# ---------------------------------------------------------------------------

def test_manual_handoff_submission_records_run_with_correct_provenance():
    """Approved task accepts manual handoff and stamps ANTIGRAVITY_MANUAL_HANDOFF provenance."""
    task_id = _create_approved_task("Approved Manual Handoff Task")

    submission = {
        "submitted_by": "Senior Architect",
        "test_output": "pytest passed (2 tests)\nCoverage: 100%",
        "agent_response": "Implemented in Antigravity IDE Chat",
        "git_diff": "diff --git a/backend/auth.py b/backend/auth.py\n+def verify(): return True",
        "command": "pytest tests/test_auth.py",
        "command_exit_code": 0,
        "notes": "Verified against local test database",
    }
    res_sub = client.post(f"/api/tasks/{task_id}/handoff", json=submission)
    assert res_sub.status_code == 200, res_sub.text
    run_data = res_sub.json()

    # Verify run attribution & provenance fields
    assert run_data["task_id"] == task_id
    assert run_data["source"] == "ANTIGRAVITY_MANUAL_HANDOFF"
    assert run_data["is_manual_submission"] is True
    assert run_data["status"] == "COMPLETED"
    assert run_data["exit_code"] == 0
    assert "ANTIGRAVITY_MANUAL_HANDOFF" in run_data["provenance_details"]["source"]
    assert run_data["submission_notes"] == "Verified against local test database"


# ---------------------------------------------------------------------------
# 5. Deterministic Verification on Manual Handoff Telemetry
# ---------------------------------------------------------------------------

def test_deterministic_verification_succeeds_for_clean_manual_handoff():
    """Deterministic verification passes clean manual handoff (exit_code 0, criteria satisfied)."""
    task_id = _create_approved_task("Clean Manual Verification Task")

    submission = {
        "submitted_by": "QA Lead",
        "test_output": "All 2 acceptance criteria passed.\nExit code: 0",
        "git_diff": "diff --git a/test.py b/test.py\n+assert True",
        "command": "pytest",
        "command_exit_code": 0,
        "notes": "Clean manual implementation",
    }
    client.post(f"/api/tasks/{task_id}/handoff", json=submission)

    # Trigger deterministic verification
    res_ver = client.post(f"/api/tasks/{task_id}/verify")
    assert res_ver.status_code == 200, res_ver.text
    ver_data = res_ver.json()
    assert ver_data["verdict"] in [VerificationVerdict.PASS, "PASS", "VERIFIED"]


def test_deterministic_verification_fails_for_nonzero_exit_code_manual_handoff():
    """Manual submission with exit_code != 0 MUST be rejected by deterministic verification."""
    task_id = _create_approved_task("Failing Manual Submission Task")

    submission = {
        "submitted_by": "QA Lead",
        "test_output": "AssertionError in test_auth.py: line 42",
        "git_diff": "diff --git a/auth.py b/auth.py\n+broken()",
        "command": "pytest",
        "command_exit_code": 1,
        "notes": "Failed test run",
    }
    res_sub = client.post(f"/api/tasks/{task_id}/handoff", json=submission)
    assert res_sub.status_code == 200
    assert res_sub.json()["status"] == "FAILED"

    # Trigger deterministic verification
    res_ver = client.post(f"/api/tasks/{task_id}/verify")
    assert res_ver.status_code == 200
    ver_data = res_ver.json()
    assert ver_data["verdict"] == VerificationVerdict.FAIL

    # Task state becomes FAILED
    res_task = client.get(f"/api/tasks/{task_id}")
    assert res_task.json()["state"] == "FAILED"


# ---------------------------------------------------------------------------
# 6. Automated Dispatch Missing Prerequisite & Mocked Live Dispatch
# ---------------------------------------------------------------------------

def test_automated_dispatch_missing_prerequisite_returns_501():
    """When CLI and SDK are absent, POST /api/tasks/{task_id}/dispatch returns 501 Not Implemented."""
    task_id = _create_approved_task("Automated Dispatch 501 Test")

    res = client.post(f"/api/tasks/{task_id}/dispatch")
    assert res.status_code == 501
    detail = res.json()["detail"]
    assert "Antigravity automated dispatch is not available" in detail
    assert "Missing prerequisite" in detail


def test_mocked_automated_dispatch_success_and_attribution():
    """Unit/integration test: When genuine CLI is available, dispatch attributes to ANTIGRAVITY_AGENT."""
    task_id = _create_approved_task("Mocked Dispatch Success Task")

    mock_completed_proc = subprocess.CompletedProcess(
        args=["agy", "task", "run", "--prompt", "prompt"],
        returncode=0,
        stdout="[ANTIGRAVITY_AGENT] Task completed successfully.\nGenerated 1 patch.",
        stderr="",
    )

    with patch("shutil.which", return_value="C:\\tools\\agy.exe"):
        with patch("subprocess.run", return_value=mock_completed_proc):
            res = client.post(f"/api/tasks/{task_id}/dispatch")
            assert res.status_code == 200, res.text
            run_data = res.json()

            # Attribution MUST be ANTIGRAVITY_AGENT, NOT LOCAL_SAFE_RUNNER or MANUAL
            assert run_data["source"] == "ANTIGRAVITY_AGENT"
            assert run_data["is_manual_submission"] is False
            assert run_data["status"] == "COMPLETED"
            assert run_data["exit_code"] == 0
            assert run_data["provenance_details"]["source"] == "ANTIGRAVITY_AGENT"


def test_mocked_automated_dispatch_timeout_handling():
    """When dispatch times out, status must be TIMED_OUT with explicit error logging."""
    task_id = _create_approved_task("Mocked Dispatch Timeout Task")

    with patch("shutil.which", return_value="C:\\tools\\agy.exe"):
        with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="agy task run", timeout=120)):
            res = client.post(f"/api/tasks/{task_id}/dispatch")
            assert res.status_code == 200
            run_data = res.json()

            assert run_data["source"] == "ANTIGRAVITY_AGENT"
            assert run_data["status"] == "TIMED_OUT"
            assert run_data["exit_code"] == 124
            assert "timed out" in run_data["message"].lower()


# ---------------------------------------------------------------------------
# 7. Local Safe Runner Coexistence & Non-interference
# ---------------------------------------------------------------------------

def test_local_safe_runner_remains_operational_independent_of_antigravity():
    """Local safe runner must remain functional and honestly attributed to LOCAL_SAFE_RUNNER."""
    task_id = _create_approved_task("Local Runner Coexistence Task")

    res_exec = client.post(
        f"/api/tasks/{task_id}/execute",
        json={"command": "python -c \"print('LOCAL_EXECUTION_VERIFIED')\""},
    )
    assert res_exec.status_code == 200, res_exec.text
    run_data = res_exec.json()

    assert run_data["source"] == "LOCAL_SAFE_RUNNER"
    assert run_data["is_manual_submission"] is False
    assert run_data["status"] in ("IN_PROGRESS", "COMPLETED")
    assert run_data["exit_code"] == 0
    assert "LOCAL_EXECUTION_VERIFIED" in run_data["stdout"]
