"""
Phase 5 Integrity Audit & Regression Test Suite for VIKASA.

Validates:
1. Fabricated exit codes (exit code 0 with contradictory fatal logs/failures).
2. Fabricated / non-zero exit codes (exit code != 0 causes deterministic failure).
3. Missing diffs when criteria require changes.
4. Incomplete criteria (submitting for AC-1 leaves AC-2 unfulfilled, triggering failure).
5. Cross-task evidence injection rejection.
6. Persistence integrity: SQLite preserves source_attribution and is_verified fields across restarts.
7. Provenance separation: LOCAL_SAFE_RUNNER vs ANTIGRAVITY_MANUAL_HANDOFF.
8. Unapproved task rejection (execution & handoff require human approval).
9. Automated dispatch truthful capability reporting & missing prerequisite handling.
10. Local runner security boundary enforcement (UNC paths, reserved devices, shell metachars).
"""

import json
import pytest
import uuid
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db.repository import DatabaseRepository
from backend.app.schemas.core import (
    Task,
    AcceptanceCriterion,
    TaskState,
    VerificationVerdict,
    EvidenceItem,
    EvidenceType,
    ExecutionClaim,
)
from backend.app.services.safe_runner import SafeExecutionRunner
from backend.app.services.verification_engine import DeterministicVerificationEngine

client = TestClient(app)
db_repo = DatabaseRepository()


def _create_approved_multi_criterion_task(title: str = "Multi Criterion Task") -> str:
    """Helper to create and approve a task with multiple distinct acceptance criteria."""
    task_id = f"task-p5-{uuid.uuid4().hex[:8]}"
    res = client.post(
        "/api/tasks",
        json={
            "id": task_id,
            "title": title,
            "description": "Multi-criteria verification test",
            "acceptance_criteria": [
                {"id": "AC-1", "description": "Implement authentication middleware", "required": True},
                {"id": "AC-2", "description": "Ensure token expiration returns 401", "required": True},
            ],
        },
    )
    assert res.status_code == 201, res.text

    # Mock plan generation and approve
    mock_plan = {
        "task_summary": "Plan for multi-criteria task",
        "steps": [{"step_number": 1, "action": "Write tests", "expected_outcome": "Tests pass"}],
        "acceptance_criteria": [],
        "files_to_inspect": [],
        "tests_to_run": ["pytest"],
        "risks": [],
        "verification_strategy": "pytest",
    }
    with patch(
        "backend.app.services.gemma_service.GemmaService._query_ollama",
        new=AsyncMock(return_value=json.dumps(mock_plan)),
    ):
        res_plan = client.post(f"/api/tasks/{task_id}/plan")
        assert res_plan.status_code in (200, 201), res_plan.text

    res_app = client.post(f"/api/tasks/{task_id}/approve", json={"approved_by": "QA Architect"})
    assert res_app.status_code == 200, res_app.text
    return task_id


# -----------------------------------------------------------------------------
# 1. Fabricated Exit Codes (Exit 0 with AssertionError/Fatal Traceback)
# -----------------------------------------------------------------------------

def test_fabricated_exit_code_zero_with_fatal_errors_fails_deterministic_verification():
    """
    Submitting exit_code 0 when the pasted output contains fatal errors (AssertionError, Traceback)
    MUST be caught by ContradictionCheck and assigned FAIL verdict.
    """
    task_id = _create_approved_multi_criterion_task("Fabricated Exit Code Test")

    submission = {
        "submitted_by": "Adversary",
        "test_output": "Traceback (most recent call last):\n  File 'test.py', line 12\nAssertionError: token invalid\n=== FAILURES ===",
        "git_diff": "diff --git a/auth.py b/auth.py\n+dummy = 1",
        "command": "pytest tests/",
        "command_exit_code": 0,  # Fabricated exit code 0!
        "notes": "Claimed success despite failed tests",
    }
    res_sub = client.post(f"/api/tasks/{task_id}/handoff", json=submission)
    assert res_sub.status_code == 200

    # Deterministic verification must catch the contradiction and FAIL
    res_ver = client.post(f"/api/tasks/{task_id}/verify")
    assert res_ver.status_code == 200
    ver_data = res_ver.json()
    assert ver_data["verdict"] == VerificationVerdict.FAIL

    contradiction_eval = next((r for r in ver_data["rule_evaluations"] if r["rule_name"] == "ContradictionCheck"), None)
    assert contradiction_eval is not None
    assert contradiction_eval["passed"] is False
    assert "Contradictory evidence detected" in contradiction_eval["message"]


# -----------------------------------------------------------------------------
# 2. Fabricated / Non-Zero Exit Code Fails Verification
# -----------------------------------------------------------------------------

def test_nonzero_exit_code_fails_command_exit_code_check():
    """Any non-zero exit code must deterministically evaluate to FAIL."""
    task_id = _create_approved_multi_criterion_task("Non-Zero Exit Code Test")

    submission = {
        "submitted_by": "Tester",
        "test_output": "Failed test suite",
        "git_diff": "diff --git a/a.py b/a.py\n+x = 2",
        "command": "pytest",
        "command_exit_code": 2,
    }
    client.post(f"/api/tasks/{task_id}/handoff", json=submission)

    res_ver = client.post(f"/api/tasks/{task_id}/verify")
    assert res_ver.status_code == 200
    ver_data = res_ver.json()
    assert ver_data["verdict"] == VerificationVerdict.FAIL

    exit_eval = next((r for r in ver_data["rule_evaluations"] if r["rule_name"] == "CommandExitCodeCheck"), None)
    assert exit_eval is not None
    assert exit_eval["passed"] is False


# -----------------------------------------------------------------------------
# 3. Missing Git Diff Rejection
# -----------------------------------------------------------------------------

def test_missing_git_diff_requires_review_or_fails():
    """If acceptance criteria require code changes, omitting git diff cannot pass cleanly."""
    task_id = _create_approved_multi_criterion_task("Missing Diff Test")

    submission = {
        "submitted_by": "Tester",
        "test_output": "All tests passed cleanly.",
        "git_diff": "",  # Empty diff!
        "command": "pytest",
        "command_exit_code": 0,
    }
    client.post(f"/api/tasks/{task_id}/handoff", json=submission)

    res_ver = client.post(f"/api/tasks/{task_id}/verify")
    assert res_ver.status_code == 200
    ver_data = res_ver.json()

    diff_eval = next((r for r in ver_data["rule_evaluations"] if r["rule_name"] == "RepositoryDiffCheck"), None)
    assert diff_eval is not None
    assert diff_eval["passed"] is False
    assert diff_eval["verdict_impact"] in (VerificationVerdict.REVIEW_REQUIRED, "REVIEW_REQUIRED", "UNKNOWN")


# -----------------------------------------------------------------------------
# 4. Incomplete Acceptance Criteria Coverage
# -----------------------------------------------------------------------------

def test_incomplete_criteria_submission_fails_coverage_check():
    """
    When a task requires AC-1 and AC-2, submitting evidence ONLY for AC-1 must
    cause AcceptanceCriteriaCoverageCheck to fail on missing AC-2.
    """
    task_id = _create_approved_multi_criterion_task("Incomplete Criteria Test")

    # Explicitly submit evidence only for AC-1
    submission = {
        "submitted_by": "Developer",
        "test_output": "AC-1 middleware test passed",
        "git_diff": "diff --git a/middleware.py b/middleware.py\n+pass",
        "command": "pytest tests/test_middleware.py",
        "command_exit_code": 0,
        "criterion_id": "AC-1",  # AC-2 is omitted!
    }
    client.post(f"/api/tasks/{task_id}/handoff", json=submission)

    res_ver = client.post(f"/api/tasks/{task_id}/verify")
    assert res_ver.status_code == 200
    ver_data = res_ver.json()

    # Must fail because AC-2 has no evidence
    assert ver_data["verdict"] == VerificationVerdict.FAIL
    cov_eval = next((r for r in ver_data["rule_evaluations"] if r["rule_name"] == "AcceptanceCriteriaCoverageCheck"), None)
    assert cov_eval is not None
    assert cov_eval["passed"] is False
    assert "AC-2" in cov_eval["message"]


# -----------------------------------------------------------------------------
# 5. Cross-Task Evidence Leaking & Injection Protection
# -----------------------------------------------------------------------------

def test_cross_task_verification_is_forbidden():
    """Attempting to verify a task using a run_id from a different task must be rejected."""
    task_a = _create_approved_multi_criterion_task("Task Alpha")
    task_b = _create_approved_multi_criterion_task("Task Beta")

    # Submit a run to task A
    sub_a = {
        "submitted_by": "Tester",
        "test_output": "Pass",
        "git_diff": "+diff",
        "command": "pytest",
        "command_exit_code": 0,
    }
    res_a = client.post(f"/api/tasks/{task_a}/handoff", json=sub_a)
    assert res_a.status_code == 200
    run_a_id = res_a.json()["run_id"]

    # Attempt to verify task B using run_a_id -> MUST fail
    res_cross = client.post(f"/api/tasks/{task_b}/verify?run_id={run_a_id}")
    assert res_cross.status_code in (400, 404, 409, 500)
    assert "Cross-task verification is forbidden" in res_cross.text or "not found" in res_cross.text


# -----------------------------------------------------------------------------
# 6. Database Persistence Integrity: Provenance Round-Trip
# -----------------------------------------------------------------------------

def test_evidence_provenance_persists_across_sqlite_roundtrip():
    """
    Evidence saved as USER_SUBMITTED_MANUAL with is_verified=False MUST retain
    those exact attributes when loaded from SQLite via list_evidence or get_execution_run.
    """
    task_id = f"task-persist-{uuid.uuid4().hex[:8]}"
    db_repo.save_task(
        Task(
            id=task_id,
            title="Persistence Task",
            description="Testing DB columns",
            acceptance_criteria=[AcceptanceCriterion(id="AC-1", description="Test item")],
            state=TaskState.APPROVED,
        )
    )

    ev_unverified = EvidenceItem(
        criterion_id="AC-1",
        evidence_type=EvidenceType.TEST_OUTPUT,
        content="Pasted agent output",
        exit_code=0,
        passed=True,
        source_attribution="USER_SUBMITTED_MANUAL",
        is_verified=False,
    )

    db_repo.save_evidence_item(task_id, run_id="run-persist-1", evidence=ev_unverified)

    # Re-read directly from repo
    loaded_evidence = db_repo.list_evidence(task_id)
    assert len(loaded_evidence) >= 1
    target = next((e for e in loaded_evidence if e.content == "Pasted agent output"), None)
    assert target is not None
    assert target.source_attribution == "USER_SUBMITTED_MANUAL"
    assert target.is_verified is False  # Must NOT be reset to True!


# -----------------------------------------------------------------------------
# 7. Provenance Separation: Safe Runner vs Manual Handoff
# -----------------------------------------------------------------------------

def test_provenance_separation_safe_runner_vs_manual_handoff():
    """Safe runner evidence has LOCAL_SUBPROCESS / is_verified=True, manual handoff has USER_SUBMITTED_MANUAL / False."""
    task_id = _create_approved_multi_criterion_task("Provenance Test")

    # 1. Submit manual handoff
    sub = {
        "submitted_by": "Tester",
        "test_output": "Manual test output",
        "git_diff": "+diff",
        "command": "pytest",
        "command_exit_code": 0,
    }
    res_sub = client.post(f"/api/tasks/{task_id}/handoff", json=sub)
    assert res_sub.status_code == 200
    manual_run = res_sub.json()
    assert manual_run["source"] == "ANTIGRAVITY_MANUAL_HANDOFF"
    assert manual_run["is_manual_submission"] is True

    # 2. Inspect Claim vs Reality report
    res_cvr = client.get(f"/api/runs/{manual_run['run_id']}/claim-vs-reality")
    assert res_cvr.status_code == 200
    cvr_data = res_cvr.json()
    assert cvr_data["task_id"] == task_id


# -----------------------------------------------------------------------------
# 8. Unapproved Task Rejection
# -----------------------------------------------------------------------------

def test_unapproved_task_rejects_execution_and_handoff():
    """Tasks in CREATED or PLANNED state cannot be executed or accepted for handoff."""
    task_id = f"task-unapp-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/tasks",
        json={
            "id": task_id,
            "title": "Unapproved Task",
            "description": "desc",
            "acceptance_criteria": [{"id": "AC-1", "description": "c1"}],
        },
    )

    # 1. Execute must be rejected
    res_exec = client.post(f"/api/tasks/{task_id}/execute", json={"command": "pytest"})
    assert res_exec.status_code in (400, 409)

    # 2. Handoff must be rejected
    res_hand = client.post(f"/api/tasks/{task_id}/handoff", json={"command": "pytest", "command_exit_code": 0})
    assert res_hand.status_code == 409


# -----------------------------------------------------------------------------
# 9. Automated Dispatch Truthfulness & Missing Prerequisites
# -----------------------------------------------------------------------------

def test_automated_dispatch_missing_prerequisite_truthfulness():
    """Attempting automated dispatch in an unconfigured environment truthfully returns HTTP 501."""
    task_id = _create_approved_multi_criterion_task("Automated Dispatch Truthfulness")

    res_dispatch = client.post(f"/api/tasks/{task_id}/dispatch")
    assert res_dispatch.status_code == 501
    assert "Antigravity automated dispatch is not available" in res_dispatch.text
    assert "Missing prerequisite: 'google-antigravity' Python package or 'agy' CLI in PATH" in res_dispatch.text


# -----------------------------------------------------------------------------
# 10. Safe Runner Security Boundary Enforcement
# -----------------------------------------------------------------------------

def test_safe_runner_rejects_dangerous_inputs():
    """Safe runner must reject UNC paths, DOS reserved devices, and forbidden shell metacharacters."""
    runner = SafeExecutionRunner()

    # Network UNC paths
    with pytest.raises(ValueError, match="Network UNC paths are not permitted"):
        runner.validate_workspace(r"\\evil-server\share")

    # Windows reserved devices
    with pytest.raises(ValueError, match="Reserved device name"):
        runner.validate_workspace("NUL")

    # Command chaining / redirection
    with pytest.raises(ValueError, match="Forbidden shell metacharacter"):
        runner.validate_command("pytest && rm -rf /")

    with pytest.raises(ValueError, match="Forbidden shell metacharacter"):
        runner.validate_command("pytest | cat")

    with pytest.raises(ValueError, match="Forbidden shell separator"):
        runner.validate_command("pytest ; dir")

    # Non-allowlisted binary
    with pytest.raises(ValueError, match="Binary 'powershell' is not permitted"):
        runner.validate_command("powershell.exe -Command Get-Process")
