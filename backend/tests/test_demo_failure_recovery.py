"""
Demonstration of the complete VIKASA End-to-End Workflow:
Create Task → Generate Plan → Approve Plan → Execute → Detect Failure →
Collect Evidence → Diagnose Failure → Correct Code → Re-run Checks →
Verify Success → Display & Persist Final Report.

Operates in an isolated temporary directory without modifying repository files.
"""

import subprocess
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db.database import Base, get_db
from backend.app.models.verification import VerificationRecord
from backend.app.main import app

# Isolated in-memory database for testing
test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture
def client():
    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)


def test_full_failure_and_recovery_workflow(client, tmp_path):
    """
    Executes the complete 12-step failure and recovery demonstration:
    1. Isolated demo repo setup (simple math module with intentional bug).
    2. Register project and create task with acceptance criterion.
    3. Generate plan via /api/plan.
    4. Enforce approval gate: task cannot execute while PLANNED; approve via PENDING_APPROVAL.
    5. Execute via /api/tasks/{id}/execute -> safe runner captures failure (exit code 1).
    6. Collect empirical evidence via /api/verify/collect -> non-zero exit code captured.
    7. Verification evaluates claim -> returns FAIL verdict, rejects false agent claim.
    8. Diagnose failure via /api/verify/diagnose -> receives root-cause explanation.
    9. Apply code correction (fix function to return a + b).
    10. Re-execute test command -> captures passing exit code 0.
    11. Collect new evidence -> captures exit code 0 and git diff.
    12. Verification evaluates corrected reality -> returns PASS verdict, persists audit record.
    """
    demo_dir = tmp_path / "calc_repo"
    demo_dir.mkdir()

    # Step 1: Create intentional buggy code: add(a, b) returns a - b
    calc_file = demo_dir / "calc.py"
    calc_file.write_text("def add(a: int, b: int) -> int:\n    return a - b  # Intentional bug\n")

    test_file = demo_dir / "test_calc.py"
    test_file.write_text(
        "from calc import add\n\n"
        "assert add(2, 3) == 5, f'AssertionError: Expected 5 but got {add(2, 3)}'\n"
        "print('TEST PASSED: add(2, 3) == 5')\n"
    )


    # Initialize git repo in demo directory so git evidence collector can run
    try:
        subprocess.run(["git", "init"], cwd=str(demo_dir), capture_output=True, check=True)
        subprocess.run(["git", "add", "."], cwd=str(demo_dir), capture_output=True, check=True)
        subprocess.run(
            ["git", "-c", "user.name=Demo", "-c", "user.email=demo@vikasa.io", "commit", "-m", "initial buggy commit"],
            cwd=str(demo_dir),
            capture_output=True,
            check=True,
        )
    except Exception:
        pass  # If git is unavailable, evidence collector handles gracefully

    # Step 2: Register project & task
    proj_resp = client.post(
        "/api/projects",
        json={"name": "Calc Project", "root_path": str(demo_dir)},
    )
    assert proj_resp.status_code == 201
    pid = proj_resp.json()["id"]

    task_resp = client.post(
        "/api/tasks",
        json={
            "project_id": pid,
            "title": "Implement Addition Function",
            "description": "calc.py must return correct sum for add(a, b)",
            "acceptance_criteria": "[AC-1] test_addition passes with exit code 0",
        },
    )
    assert task_resp.status_code == 201
    tid = task_resp.json()["id"]
    assert task_resp.json()["status"] == "PLANNED"

    # Step 3: Generate plan
    plan_resp = client.post(
        "/api/plan",
        json={
            "id": tid,
            "title": "Implement Addition Function",
            "description": "calc.py must return correct sum for add(a, b)",
            "acceptance_criteria": [{"id": "AC-1", "description": "test_addition passes", "required": True}],
        },
    )
    assert plan_resp.status_code == 200
    plan_data = plan_resp.json()
    assert len(plan_data["steps"]) >= 1
    assert "verification_strategy" in plan_data

    # Step 4: Approval Gate Validation
    # Attempt execution while unapproved (PLANNED) -> must receive 409
    exec_unapproved = client.post(
        f"/api/tasks/{tid}/execute",
        json={"test_command": ["pytest", "test_calc.py"], "repo_path": str(demo_dir)},
    )
    assert exec_unapproved.status_code == 409
    assert "PLANNED" in exec_unapproved.json()["detail"]

    # Approve task
    appr_resp = client.patch(f"/api/tasks/{tid}/status", json={"status": "PENDING_APPROVAL"})
    assert appr_resp.status_code == 200
    assert appr_resp.json()["status"] == "PENDING_APPROVAL"

    # Step 5: Execute permitted test command (known failure)
    exec_resp = client.post(
        f"/api/tasks/{tid}/execute",
        json={
            "test_command": ["python", "test_calc.py"],
            "repo_path": str(demo_dir),
        },
    )
    assert exec_resp.status_code == 200
    exec_data = exec_resp.json()
    assert exec_data["exit_code"] != 0  # Captured failure
    assert exec_data["status"] == "FAILED"
    assert "AssertionError" in exec_data["stdout"]

    # Step 6: Collect empirical evidence
    collect_resp = client.post(
        "/api/verify/collect",
        json={
            "repo_path": str(demo_dir),
            "test_command": ["python", "test_calc.py"],
        },
    )
    assert collect_resp.status_code == 200
    evidence_items = collect_resp.json()
    assert any(ev["evidence_type"] == "COMMAND_EXIT_CODE" and ev["exit_code"] != 0 for ev in evidence_items)

    # Step 7: Verification rejects false agent claim
    claim_payload = {
        "task": {
            "id": tid,
            "title": "Implement Addition Function",
            "description": "calc.py must return correct sum",
            "acceptance_criteria": [{"id": "AC-1", "description": "test_addition passes", "required": True}],
        },
        "claim": {
            "task_id": tid,
            "agent_name": "OverconfidentAgent",
            "claimed_success": True,  # Overconfident claim!
            "statement": "I have completed the addition function successfully.",
            "evidence_list": evidence_items,
        },
    }
    verify_fail_resp = client.post("/api/verify/claim-vs-reality", json=claim_payload)
    assert verify_fail_resp.status_code == 200
    fail_report = verify_fail_resp.json()
    assert fail_report["verdict"] == "FAIL"
    assert fail_report["claim_verified"] is False
    assert len(fail_report["discrepancies"]) >= 1

    # Step 8: Diagnose failure via Gemma
    diag_resp = client.post(
        "/api/verify/diagnose",
        json={
            "task": claim_payload["task"],
            "verification_result": fail_report["verification_result"],
        },
    )
    assert diag_resp.status_code == 200
    diag_data = diag_resp.json()
    assert diag_data["verdict"] == "FAIL"
    assert "ai_explanation" in diag_data

    # Step 9: Apply correction (authorized workflow: fix calc.py)
    calc_file.write_text("def add(a: int, b: int) -> int:\n    return a + b  # Corrected implementation\n")

    # Step 10: Re-run checks
    # Transition task back to PENDING_APPROVAL for re-execution
    client.patch(f"/api/tasks/{tid}/status", json={"status": "PLANNED"})
    client.patch(f"/api/tasks/{tid}/status", json={"status": "PENDING_APPROVAL"})

    re_exec_resp = client.post(
        f"/api/tasks/{tid}/execute",
        json={
            "test_command": ["python", "test_calc.py"],
            "repo_path": str(demo_dir),
        },
    )
    assert re_exec_resp.status_code == 200
    re_exec_data = re_exec_resp.json()
    assert re_exec_data["exit_code"] == 0  # Now passes!
    assert re_exec_data["status"] == "IN_PROGRESS"
    assert "TEST PASSED" in re_exec_data["stdout"]

    # Step 11: Collect new passing evidence
    new_collect_resp = client.post(
        "/api/verify/collect",
        json={
            "repo_path": str(demo_dir),
            "test_command": ["python", "test_calc.py"],
        },
    )
    assert new_collect_resp.status_code == 200
    new_evidence = new_collect_resp.json()

    # Map command evidence to AC-1
    for ev in new_evidence:
        if ev["evidence_type"] == "COMMAND_EXIT_CODE":
            ev["criterion_id"] = "AC-1"

    # Step 12: Independent verification of corrected reality -> PASS
    pass_claim_payload = {
        "task": claim_payload["task"],
        "claim": {
            "task_id": tid,
            "agent_name": "VerifiedAgent",
            "claimed_success": True,
            "statement": "Fixed calculation bug and verified tests pass with exit code 0.",
            "evidence_list": new_evidence,
        },
    }
    verify_pass_resp = client.post("/api/verify/claim-vs-reality", json=pass_claim_payload)
    assert verify_pass_resp.status_code == 200
    pass_report = verify_pass_resp.json()
    assert pass_report["verdict"] == "PASS"
    assert pass_report["claim_verified"] is True
    assert len(pass_report["discrepancies"]) == 0

    # Mark task completed in lifecycle
    complete_resp = client.patch(f"/api/tasks/{tid}/status", json={"status": "COMPLETED"})
    assert complete_resp.status_code == 200
    assert complete_resp.json()["status"] == "COMPLETED"

    # Confirm audit records were persisted in database
    db = TestingSessionLocal()
    records = db.query(VerificationRecord).filter(VerificationRecord.task_id == tid).all()
    assert len(records) >= 2
    verdicts = [r.verdict for r in records]
    assert "FAIL" in verdicts
    assert "PASS" in verdicts
    db.close()
