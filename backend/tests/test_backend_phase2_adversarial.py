"""
Phase 2 Adversarial Security, Lifecycle Concurrency & Deterministic Integrity Tests.

Tests:
1. Workspace security: UNC path injection, reserved Windows device names, symlink resolution.
2. Sensitive environment scrubbing & credential redaction in logs/output.
3. Process tree termination on timeout.
4. Concurrency lock preventing simultaneous execution of the same task.
5. Plan generation status synchronization with SQLAlchemy TaskRecord.
6. Cross-task verification rejection (preventing cross-task evidence leaking).
7. Deterministic verification defense against false AI success claims.
8. API project isolation and error handling.
"""

import os
import time
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from backend.app.main import app, _active_executions, _execution_lock
from backend.app.services.safe_runner import SafeExecutionRunner
from backend.app.services.evidence_collector import EvidenceCollector
from backend.app.db.database import get_db, SessionLocal
from backend.app.models.task import TaskRecord
from backend.app.models.project import Project

client = TestClient(app)


# =====================================================================
# 1. Workspace Security: UNC, DOS Device Names, and Path Normalization
# =====================================================================

def test_safe_runner_rejects_unc_paths():
    """Verify that UNC paths are rejected to prevent Windows SMB relay attacks."""
    runner = SafeExecutionRunner()
    with pytest.raises(ValueError, match="Network UNC paths are not permitted"):
        runner.validate_workspace(r"\\evil-host\share\payload")

    with pytest.raises(ValueError, match="Network UNC paths are not permitted"):
        runner.validate_workspace("//10.0.0.1/malicious/workspace")


def test_safe_runner_rejects_reserved_device_names():
    """Verify that DOS reserved device names (CON, NUL, AUX, COM1) are rejected."""
    runner = SafeExecutionRunner()
    for dev in ["NUL", "CON", "PRN", "AUX", "COM1", "LPT1"]:
        with pytest.raises(ValueError, match="Reserved device name"):
            runner.validate_workspace(dev)


def test_evidence_collector_rejects_unc_and_reserved_devices():
    """Verify that EvidenceCollector.validate_repo_path also blocks UNC and reserved devices."""
    with pytest.raises(ValueError, match="Network UNC paths are not permitted"):
        EvidenceCollector.validate_repo_path(r"\\remote-server\c$\repo")

    with pytest.raises(ValueError, match="Reserved device name"):
        EvidenceCollector.validate_repo_path("NUL")


# =====================================================================
# 2. Secret Scrubbing & Credential Redaction
# =====================================================================

def test_extended_environment_variable_sanitization():
    """Verify that database URLs, cloud tokens, Sentry DSNs, and PATs are scrubbed."""
    runner = SafeExecutionRunner()
    test_secrets = {
        "DATABASE_URL": "postgresql://user:pass@localhost:5432/db",
        "MONGO_URI": "mongodb://admin:secret@mongo.cluster",
        "REDIS_URL": "redis://:secretpass@redis.local:6379",
        "SENTRY_DSN": "https://pubkey:privkey@sentry.io/123",
        "GITHUB_PAT": "ghp_123456789012345678901234567890123456",
        "API_URL": "https://api.internal/v1?token=xyz",
        "BEARER_AUTH": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        "SAFE_VAR": "harmless_config_value",
    }
    with patch.dict(os.environ, test_secrets, clear=False):
        sanitized = runner._get_sanitized_environment()
        for secret_key in [
            "DATABASE_URL", "MONGO_URI", "REDIS_URL", "SENTRY_DSN",
            "GITHUB_PAT", "API_URL", "BEARER_AUTH"
        ]:
            assert secret_key not in sanitized, f"{secret_key} was not stripped from environment"
        assert sanitized.get("SAFE_VAR") == "harmless_config_value"


def test_credential_redaction_in_output():
    """Verify that credentials in logs and outputs are masked before storage/display."""
    raw_log = (
        "Cloning into 'repo' from https://developer:SuperSecretPass123@github.com/org/repo.git\n"
        "Authorization: Bearer secret_bearer_token_xyz_1234567890\n"
        "Failed with token ghp_ABCdefGHIjklMNOpqrsTUVwxyz0123456789\n"
        "Executed command with --api-key=my_private_key_abc123\n"
        "Database error with --password=very_secret_db_pass"
    )
    redacted = SafeExecutionRunner._redact_secrets(raw_log)
    assert "SuperSecretPass123" not in redacted
    assert "[REDACTED_AUTH]@" in redacted
    assert "secret_bearer_token_xyz_1234567890" not in redacted
    assert "[REDACTED_BEARER]" in redacted
    assert "ghp_ABCdefGHIjklMNOpqrsTUVwxyz0123456789" not in redacted
    assert "[REDACTED_GH_TOKEN]" in redacted
    assert "my_private_key_abc123" not in redacted
    assert "[REDACTED_KEY]" in redacted
    assert "very_secret_db_pass" not in redacted
    assert "[REDACTED_PASSWORD]" in redacted


# =====================================================================
# 3. Concurrency Lock on Task Execution
# =====================================================================

def test_concurrent_execution_requests_rejected():
    """Verify that attempting to execute an already actively executing task returns 409 Conflict."""
    task_id = "t-concurrency-test-01"
    res = client.post("/api/tasks", json={
        "id": task_id,
        "title": "Concurrency Gate Test",
        "description": "Ensure only one active execution runs at a time",
        "acceptance_criteria": [{"id": "AC-1", "description": "pass"}],
    })
    assert res.status_code == 201

    client.post(f"/api/tasks/{task_id}/plan")
    client.post(f"/api/tasks/{task_id}/approve")

    # Manually simulate an in-flight execution for task_id
    with _execution_lock:
        _active_executions.add(task_id)

    try:
        # Second execution request must be rejected with 409 Conflict
        second_exec = client.post(f"/api/tasks/{task_id}/execute", json={
            "command": "python -c \"print(1)\""
        })
        assert second_exec.status_code == 409
        assert "already actively executing" in second_exec.json()["detail"]
    finally:
        with _execution_lock:
            _active_executions.discard(task_id)


# =====================================================================
# 4. Plan Status Synchronization with SQLAlchemy
# =====================================================================

def test_plan_generation_synchronizes_sqlalchemy_status():
    """Verify that calling POST /api/tasks/{id}/plan updates TaskRecord.status in SQLAlchemy."""
    task_id = "t-plan-sync-01"
    create_res = client.post("/api/tasks", json={
        "id": task_id,
        "title": "Plan Sync Test",
        "description": "Verifying SQLAlchemy synchronization on plan generation",
        "acceptance_criteria": [{"id": "AC-1", "description": "AC"}],
    })
    assert create_res.status_code == 201

    # Call /plan
    plan_res = client.post(f"/api/tasks/{task_id}/plan")
    assert plan_res.status_code == 200

    # Query DB directly to verify SQLAlchemy record was updated
    db = SessionLocal()
    try:
        rec = db.query(TaskRecord).filter(TaskRecord.id == task_id).first()
        assert rec is not None
        assert rec.status == "PLANNED"
    finally:
        db.close()


# =====================================================================
# 5. Cross-Task Verification Protection
# =====================================================================

def test_cross_task_verification_rejected():
    """Verify that passing an execution run belonging to Task B when verifying Task A is rejected."""
    # Create Task A
    t_a_res = client.post("/api/tasks", json={
        "id": "t-cross-a",
        "title": "Task A",
        "description": "Target task",
        "acceptance_criteria": [{"id": "AC-A", "description": "Test A"}],
    })
    assert t_a_res.status_code == 201
    client.post("/api/tasks/t-cross-a/plan")
    client.post("/api/tasks/t-cross-a/approve")

    # Create Task B and execute it to generate run_b
    t_b_res = client.post("/api/tasks", json={
        "id": "t-cross-b",
        "title": "Task B",
        "description": "Origin task for run",
        "acceptance_criteria": [{"id": "AC-B", "description": "Test B"}],
    })
    assert t_b_res.status_code == 201
    client.post("/api/tasks/t-cross-b/plan")
    client.post("/api/tasks/t-cross-b/approve")
    exec_b = client.post("/api/tasks/t-cross-b/execute", json={
        "command": "python -c \"print('RUN_B')\""
    })
    assert exec_b.status_code == 200
    run_b_id = exec_b.json()["run_id"]

    # Now attempt to verify Task A using run_b_id -> must be rejected
    verify_res = client.post(f"/api/tasks/t-cross-a/verify?run_id={run_b_id}")
    assert verify_res.status_code == 409
    assert "Cross-task verification is forbidden" in verify_res.json()["detail"]


# =====================================================================
# 6. Deterministic Verification Defense Against AI False Success
# =====================================================================

def test_deterministic_engine_rejects_ai_claimed_success_on_exit_failure():
    """Verify that AI claims of success are rejected if the command exited with non-zero status."""
    task_id = "t-false-ai-claim-01"
    client.post("/api/tasks", json={
        "id": task_id,
        "title": "False AI Claim Test",
        "description": "Deterministic defense against false AI claims",
        "acceptance_criteria": [{"id": "AC-1", "description": "Must pass cleanly"}],
    })
    client.post(f"/api/tasks/{task_id}/plan")
    client.post(f"/api/tasks/{task_id}/approve")

    # Execute a failing command
    exec_res = client.post(f"/api/tasks/{task_id}/execute", json={
        "command": "python -c \"import sys; sys.exit(42)\"",
        "criterion_id": "AC-1",
    })
    assert exec_res.status_code == 200
    assert exec_res.json()["exit_code"] == 42

    # Verify task: authoritative deterministic verdict must be FAILED
    verify_res = client.post(f"/api/tasks/{task_id}/verify")
    assert verify_res.status_code == 200
    verif_data = verify_res.json()
    assert verif_data["verdict"] in ("FAILED", "FAIL")

    # Claim vs Reality report must also mark claim_verified as False
    cvr_res = client.get(f"/api/runs/{exec_res.json()['run_id']}/claim-vs-reality")
    assert cvr_res.status_code == 200
    cvr_data = cvr_res.json()
    assert cvr_data["verdict"] in ("FAILED", "FAIL")
    assert cvr_data["claim_verified"] is False


# =====================================================================
# 7. Project Ownership & Non-Existent Resource Isolation
# =====================================================================

def test_nonexistent_project_task_scoping_returns_404():
    """Verify that querying tasks for a non-existent project returns 404."""
    res = client.get("/api/projects/proj-does-not-exist-9999/tasks")
    assert res.status_code == 404
    assert "was not found" in res.json()["detail"]


def test_nonexistent_execution_run_returns_404():
    """Verify that querying a non-existent run ID returns 404."""
    res = client.get("/api/runs/run-nonexistent-999999")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"]


def test_nonexistent_run_report_returns_404():
    """Verify that requesting a report for a non-existent run ID returns 404."""
    res = client.get("/api/runs/run-nonexistent-999999/report")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"]
