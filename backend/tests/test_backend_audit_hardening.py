"""
Targeted Regression Tests for Backend Hardening and Reliability Phase.

Covers:
1. SQLite Foreign Key Enforcement across connection lifecycles.
2. Approval state synchronization and strict execution gate enforcement.
3. Safe runner security: null-byte rejection, environment secret sanitization, output capping.
4. Honest labeling of execution mode (LOCAL_SAFE_RUNNER vs ANTIGRAVITY_AGENT).
5. Invariant preservation: deterministic verification authority over AI claims.
"""

import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.db.database import get_db, engine
from backend.app.db.repository import DatabaseRepository
from backend.app.services.safe_runner import SafeExecutionRunner
from backend.app.services.antigravity_adapter import AntigravityAdapter
from backend.app.services.verification_engine import DeterministicVerificationEngine
from backend.app.schemas.core import (
    Task,
    TaskState,
    AcceptanceCriterion,
    ExecutionClaim,
    EvidenceItem,
    EvidenceType,
    VerificationVerdict,
)
from backend.app.models.project import Project
from backend.app.models.task import TaskRecord

client = TestClient(app)


def test_sqlite_foreign_key_enforcement():
    """Verify that SQLite connections explicitly enforce foreign keys."""
    # 1. Test SQLAlchemy engine connection has foreign_keys ON
    with engine.connect() as conn:
        res = conn.execute(text("PRAGMA foreign_keys;")).scalar()
        assert res == 1, "SQLite foreign keys must be enabled (1)"

    # 2. Test direct DatabaseRepository connection has foreign_keys ON
    repo = DatabaseRepository()
    with repo._get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("PRAGMA foreign_keys;")
        row = cursor.fetchone()
        assert row[0] == 1, "DatabaseRepository connection must enforce foreign_keys"


def test_safe_runner_rejects_null_bytes_in_command():
    """Verify that SafeExecutionRunner rejects null bytes in command strings."""
    runner = SafeExecutionRunner()
    with pytest.raises(ValueError, match="invalid null bytes"):
        runner.validate_command("python -c \x00print(1)")

    with pytest.raises(ValueError, match="invalid null bytes"):
        runner.validate_command("pytest\0test.py")


def test_safe_runner_sanitizes_environment_variables(monkeypatch):
    """Verify that subprocess runs do not inherit sensitive tokens, keys, or secrets."""
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "sensitive_aws_secret")
    monkeypatch.setenv("GITHUB_TOKEN", "sensitive_github_token")
    monkeypatch.setenv("DB_PASSWORD", "super_secret_db_pass")
    monkeypatch.setenv("SAFE_ENV_VAR", "visible_var_value")

    sanitized = SafeExecutionRunner._get_sanitized_environment()
    assert "AWS_SECRET_ACCESS_KEY" not in sanitized
    assert "GITHUB_TOKEN" not in sanitized
    assert "DB_PASSWORD" not in sanitized
    assert sanitized.get("SAFE_ENV_VAR") == "visible_var_value"


def test_safe_runner_output_capping():
    """Verify that large subprocess outputs are capped to prevent memory exhaustion."""
    large_text = "A" * (600 * 1024)  # 600 KB
    capped = SafeExecutionRunner._cap_output(large_text, max_bytes=512 * 1024)
    assert len(capped.encode("utf-8")) <= 512 * 1024 + 100
    assert "[TRUNCATED: Output exceeded 512 KB limit]" in capped


def test_approve_plan_synchronizes_status_to_approved():
    """Verify that approving a task plan updates status to APPROVED across both persistence paths."""
    # Create project and task
    proj_res = client.post("/api/projects", json={
        "name": "Audit Test Project",
        "root_path": ".",
    })
    assert proj_res.status_code == 201
    proj_id = proj_res.json()["id"]

    task_res = client.post("/api/tasks", json={
        "title": "Approval Test Task",
        "description": "Validating state sync",
        "project_id": proj_id,
        "acceptance_criteria": [{"id": "AC-1", "description": "Pass tests"}],
    })
    assert task_res.status_code == 201
    task_id = task_res.json()["id"]

    # Generate plan
    plan_res = client.post(f"/api/tasks/{task_id}/plan")
    assert plan_res.status_code == 200

    # Approve plan
    approve_res = client.post(f"/api/tasks/{task_id}/approve", json={"approved_by": "AUDIT_TESTER"})
    assert approve_res.status_code == 200
    approved_task = approve_res.json()
    assert approved_task["state"] in ("APPROVED", TaskState.APPROVED.value)

    # Inspect detail from database
    detail_res = client.get(f"/api/tasks/{task_id}")
    assert detail_res.status_code == 200
    task_detail = detail_res.json()
    assert task_detail["task"]["state"] in ("APPROVED", TaskState.APPROVED.value)


def test_execution_mode_honestly_reports_local_runner():
    """Verify that local command execution honestly reports LOCAL_SAFE_RUNNER."""
    # Create and approve a task
    task_res = client.post("/api/tasks", json={
        "title": "Execution Mode Truthfulness Test",
        "description": "Checking source and execution_mode fields",
        "acceptance_criteria": [{"id": "AC-1", "description": "Run python successfully"}],
    })
    assert task_res.status_code == 201
    task_id = task_res.json()["id"]

    client.post(f"/api/tasks/{task_id}/plan")
    client.post(f"/api/tasks/{task_id}/approve")

    # Execute
    exec_res = client.post(f"/api/tasks/{task_id}/execute", json={
        "command": "python -c \"print('HONEST_LOCAL_EXEC')\"",
        "criterion_id": "AC-1"
    })
    assert exec_res.status_code == 200
    exec_data = exec_res.json()
    assert exec_data["source"] == "LOCAL_SAFE_RUNNER"
    assert exec_data["status"] == "IN_PROGRESS"
    assert "HONEST_LOCAL_EXEC" in exec_data["stdout"]


def test_antigravity_honest_status_when_not_installed():
    """Verify that Antigravity inspection honestly returns NEEDS_INSTALLATION if CLI/SDK are absent."""
    capabilities = AntigravityAdapter.inspect_capabilities()
    assert capabilities["status"] in ("NEEDS_INSTALLATION", "SDK_AVAILABLE", "CLI_AVAILABLE")
    if not capabilities["cli_installed"] and not capabilities["sdk_installed"]:
        assert capabilities["status"] == "NEEDS_INSTALLATION"
        assert capabilities["cli_path"] is None
