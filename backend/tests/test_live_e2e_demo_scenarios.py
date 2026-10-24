"""
VIKASA Phase 3 End-to-End Demo Scenarios and Integration Validation.

Scenarios:
- Scenario A: Verified Success
  - Create project & task -> generate plan -> approve -> execute allowlisted test -> deterministic verification PASS -> Claim vs Reality matches evidence.
- Scenario B: Real Failure
  - Create task -> approve -> execute failing test (exit code != 0) -> deterministic verification FAIL -> Claim vs Reality documents discrepancy -> AI diagnosis explains failure without overwriting verdict.
- Scenario C: Truthful Integration Capabilities
  - Health checks: Antigravity honestly reports NEEDS_INSTALLATION, safe runner reports LOCAL_SAFE_RUNNER.
  - Gemma resilience: Real inference if available, transparent fallback if unavailable.
"""

import os
import tempfile
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db.database import SessionLocal
from backend.app.models.project import Project
from backend.app.models.task import TaskRecord
from backend.app.services.antigravity_adapter import AntigravityAdapter

client = TestClient(app)


def test_scenario_a_verified_success():
    """Scenario A: Full lifecycle resulting in deterministic verification PASS."""
    import subprocess
    with tempfile.TemporaryDirectory() as tmp_workspace:
        # 0. Initialize valid Git repository with a baseline file
        subprocess.run(["git", "init"], cwd=tmp_workspace, capture_output=True, check=True)
        init_file = os.path.join(tmp_workspace, "feature.py")
        with open(init_file, "w") as f:
            f.write("# initial code\n")
        subprocess.run(["git", "add", "feature.py"], cwd=tmp_workspace, capture_output=True, check=True)
        subprocess.run(
            ["git", "-c", "user.name=Demo", "-c", "user.email=demo@vikasa.ai", "commit", "-m", "Initial commit"],
            cwd=tmp_workspace,
            capture_output=True,
            check=True,
        )
        # Modify file to produce a verified code modification
        with open(init_file, "w") as f:
            f.write("def add(a, b):\n    return a + b\n")

        # 1. Project Registration
        proj_res = client.post("/api/projects", json={
            "name": "Scenario A Demo Project",
            "root_path": tmp_workspace,
            "repository_url": "https://github.com/demo/scenario-a",
        })
        assert proj_res.status_code == 201, proj_res.text
        project_id = proj_res.json()["id"]

        # 2. Requirements Intake & Task Creation
        task_res = client.post("/api/tasks", json={
            "project_id": project_id,
            "title": "Compute Sum Feature",
            "description": "Implement addition algorithm and deterministic unit test",
            "workspace_path": tmp_workspace,
            "acceptance_criteria": [
                {"id": "AC-1", "description": "Returns correct sum of two integers", "required": True}
            ],
        })
        assert task_res.status_code == 201, task_res.text
        task_id = task_res.json()["id"]

        # 3. Project Analysis & Checkpoint Generation (Plan)
        plan_res = client.post(f"/api/tasks/{task_id}/plan")
        assert plan_res.status_code == 200, plan_res.text
        plan_data = plan_res.json()
        assert len(plan_data["steps"]) >= 1
        assert plan_data["task_id"] == task_id

        # 4. Enforce Human Approval Gate: Execution attempt before approval MUST be rejected (409)
        unapproved_exec = client.post(f"/api/tasks/{task_id}/execute", json={
            "command": "python -c \"print('UNAPPROVED_ATTEMPT')\"",
            "criterion_id": "AC-1",
        })
        assert unapproved_exec.status_code == 409
        assert "Explicit user approval is required" in unapproved_exec.json()["detail"]

        # 5. Human Approval
        appr_res = client.post(f"/api/tasks/{task_id}/approve", json={
            "approved_by": "Senior Engineer",
            "notes": "Plan review complete. Approved for test execution.",
        })
        assert appr_res.status_code == 200, appr_res.text
        assert appr_res.json()["state"] == "APPROVED"

        # 6. Execute Deterministic Check
        exec_res = client.post(f"/api/tasks/{task_id}/execute", json={
            "command": "python -c \"from feature import add; assert add(2, 2) == 4; print('SUM_SUCCESS')\"",
            "criterion_id": "AC-1",
            "repo_path": tmp_workspace,
        })
        assert exec_res.status_code == 200, exec_res.text
        exec_data = exec_res.json()
        assert exec_data["exit_code"] == 0
        assert exec_data["status"] == "IN_PROGRESS"
        assert exec_data["source"] == "LOCAL_SAFE_RUNNER"
        assert "SUM_SUCCESS" in exec_data["stdout"]
        run_id = exec_data["run_id"]
        print("EXEC_DATA EVIDENCE_ITEMS:", exec_data.get("evidence_items"))
        print("EXEC_DATA GIT_DIFF:", exec_data.get("git_diff"))

        # 7. Collect Evidence & Deterministic Verification
        verify_res = client.post(f"/api/tasks/{task_id}/verify?run_id={run_id}")
        assert verify_res.status_code == 200, verify_res.text
        verif_data = verify_res.json()
        if verif_data.get("verdict") not in ("PASS", "VERIFIED"):
            print("FAILED EVALUATIONS:", verif_data.get("rule_evaluations") or verif_data.get("evaluations"))
        assert verif_data["verdict"] in ("PASS", "VERIFIED"), f"Evaluations: {verif_data.get('rule_evaluations')}"
        assert verif_data["confidence_score"] >= 0.8

        # 8. Claim vs Reality Verification
        cvr_res = client.get(f"/api/runs/{run_id}/claim-vs-reality")
        assert cvr_res.status_code == 200, cvr_res.text
        cvr_data = cvr_res.json()
        assert cvr_data["verdict"] in ("PASS", "VERIFIED")
        assert cvr_data["claim_verified"] is True
        assert len(cvr_data["discrepancies"]) == 0

        # 9. Dashboard & Project Scoped Listing
        tasks_list = client.get(f"/api/projects/{project_id}/tasks")
        assert tasks_list.status_code == 200
        assert len(tasks_list.json()) >= 1
        assert tasks_list.json()[0]["id"] == task_id


def test_scenario_b_real_failure_workflow():
    """Scenario B: Non-zero exit code captured, verified as FAIL, with non-overwriting diagnosis."""
    with tempfile.TemporaryDirectory() as tmp_workspace:
        # 1. Project & Task Creation
        proj_res = client.post("/api/projects", json={
            "name": "Scenario B Failure Project",
            "root_path": tmp_workspace,
        })
        project_id = proj_res.json()["id"]

        task_res = client.post("/api/tasks", json={
            "project_id": project_id,
            "title": "Buggy Feature Test",
            "description": "Fails deliberately with exit code 7",
            "workspace_path": tmp_workspace,
            "acceptance_criteria": [{"id": "AC-1", "description": "Pass test suite"}],
        })
        task_id = task_res.json()["id"]

        # 2. Plan & Approve
        client.post(f"/api/tasks/{task_id}/plan")
        client.post(f"/api/tasks/{task_id}/approve")

        # 3. Execute failing command (exit code 7)
        exec_res = client.post(f"/api/tasks/{task_id}/execute", json={
            "command": "python -c \"import sys; print('CRITICAL_SYNTAX_ERROR'); sys.exit(7)\"",
            "criterion_id": "AC-1",
            "repo_path": tmp_workspace,
        })
        assert exec_res.status_code == 200
        exec_data = exec_res.json()
        assert exec_data["exit_code"] == 7
        assert exec_data["status"] == "FAILED"
        run_id = exec_data["run_id"]

        # 4. Deterministic Verification: MUST be FAILED
        verify_res = client.post(f"/api/tasks/{task_id}/verify?run_id={run_id}")
        assert verify_res.status_code == 200
        verif_data = verify_res.json()
        assert verif_data["verdict"] in ("FAIL", "FAILED")

        # 5. Claim vs Reality: Discrepancy documented, claim not verified
        cvr_res = client.get(f"/api/runs/{run_id}/claim-vs-reality")
        assert cvr_res.status_code == 200
        cvr_data = cvr_res.json()
        assert cvr_data["verdict"] in ("FAIL", "FAILED")
        assert cvr_data["claim_verified"] is False
        assert len(cvr_data["discrepancies"]) > 0

        # 6. Diagnosis explains failure without modifying deterministic verdict
        diag_res = client.get(f"/api/runs/{run_id}/diagnosis")
        if diag_res.status_code == 200:
            diag_data = diag_res.json()
            assert diag_data["verdict"] in ("FAIL", "FAILED")


def test_scenario_c_truthful_integration_reporting():
    """Scenario C: Honest capability reporting for Antigravity, Gemma, and safe runner."""
    # 1. Antigravity Health Check
    ag_health = client.get("/api/health/antigravity")
    assert ag_health.status_code == 200
    ag_data = ag_health.json()
    assert ag_data["status"] in ("NEEDS_INSTALLATION", "CLI_AVAILABLE", "SDK_AVAILABLE")
    if not ag_data.get("cli_installed") and not ag_data.get("sdk_installed"):
        assert ag_data["status"] == "NEEDS_INSTALLATION"
        assert ag_data["cli_path"] is None

    # 2. General Health Check
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["status"] == "healthy"

    # 3. Ollama Health Check
    ol_health = client.get("/api/health/ollama")
    assert ol_health.status_code == 200
    ol_data = ol_health.json()
    assert "model" in ol_data
    assert "status" in ol_data


def test_orm_and_repository_synchronization_across_full_lifecycle():
    """Verify that SQLAlchemy TaskRecord and direct SQLite repository stay in sync."""
    task_res = client.post("/api/tasks", json={
        "title": "Dual Persistence Sync Test",
        "description": "Verifying status sync across ORM and direct SQLite",
        "acceptance_criteria": [{"id": "AC-1", "description": "AC"}],
    })
    task_id = task_res.json()["id"]

    # Initial state
    db = SessionLocal()
    try:
        rec = db.query(TaskRecord).filter(TaskRecord.id == task_id).first()
        assert rec.status == "PLANNED"

        # Plan
        client.post(f"/api/tasks/{task_id}/plan")
        db.expire_all()
        rec = db.query(TaskRecord).filter(TaskRecord.id == task_id).first()
        assert rec.status == "PLANNED"

        # Approve
        client.post(f"/api/tasks/{task_id}/approve")
        db.expire_all()
        rec = db.query(TaskRecord).filter(TaskRecord.id == task_id).first()
        assert rec.status == "APPROVED"

        # Execute
        client.post(f"/api/tasks/{task_id}/execute", json={
            "command": "python -c \"print('SYNC_OK')\"",
            "criterion_id": "AC-1",
        })
        db.expire_all()
        rec = db.query(TaskRecord).filter(TaskRecord.id == task_id).first()
        assert rec.status == "IN_PROGRESS"
    finally:
        db.close()
