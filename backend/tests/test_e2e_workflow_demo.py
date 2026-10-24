"""
End-to-End Reproducible Demonstration Scenario for VIKASA.

Demonstrates:
Plan → Approve → Execute (Failing) → Record Evidence → Verify (FAILED)
→ Diagnose → Correct → Approve → Re-execute → Verify (VERIFIED)
"""

import os
import subprocess
import tempfile
import pytest
from unittest.mock import AsyncMock, patch
import json

from backend.app.schemas.core import (
    TaskState,
    AcceptanceCriterion,
    VerificationVerdict,
    EvidenceType,
)
from backend.app.db.repository import DatabaseRepository
from backend.app.services.gemma_service import GemmaService
from backend.app.services.verification_engine import DeterministicVerificationEngine
from backend.app.services.safe_runner import SafeExecutionRunner
from backend.app.services.workflow_service import WorkflowService

@pytest.fixture
def demo_environment():
    tmp_dir = tempfile.mkdtemp(prefix="vikasa_e2e_demo_")
    db_path = os.path.join(tmp_dir, "vikasa_demo.db")

    # Initialize git repo in the temp workspace so git diff can track changes
    subprocess.run(["git", "init"], cwd=tmp_dir, capture_output=True, check=True)
    subprocess.run(["git", "config", "user.name", "VikasaTester"], cwd=tmp_dir, capture_output=True, check=True)
    subprocess.run(["git", "config", "user.email", "vikasa@example.com"], cwd=tmp_dir, capture_output=True, check=True)

    # Create buggy code
    calc_path = os.path.join(tmp_dir, "calculator.py")
    with open(calc_path, "w", encoding="utf-8") as f:
        f.write("def multiply(a: int, b: int) -> int:\n    return a + b  # Intentional bug: + instead of *\n")

    # Create test file
    test_path = os.path.join(tmp_dir, "test_calculator.py")
    with open(test_path, "w", encoding="utf-8") as f:
        f.write("from calculator import multiply\n\ndef test_multiply():\n    assert multiply(3, 4) == 12\n")

    # Initial git commit
    subprocess.run(["git", "add", "."], cwd=tmp_dir, capture_output=True, check=True)
    subprocess.run(["git", "commit", "-m", "Initial commit with buggy calculator"], cwd=tmp_dir, capture_output=True, check=True)

    repo = DatabaseRepository(db_path=db_path)
    gemma = GemmaService()
    verifier = DeterministicVerificationEngine()
    runner = SafeExecutionRunner(default_workspace=tmp_dir)
    wf = WorkflowService(repository=repo, gemma_service=gemma, verification_engine=verifier, safe_runner=runner)

    yield {
        "workspace": tmp_dir,
        "calc_path": calc_path,
        "workflow": wf,
        "repo": repo,
    }

    # Cleanup is managed by OS/tempfile

@pytest.mark.asyncio
async def test_reproducible_end_to_end_verification_lifecycle(demo_environment):
    env = demo_environment
    wf: WorkflowService = env["workflow"]
    workspace = env["workspace"]
    calc_path = env["calc_path"]

    # -------------------------------------------------------------
    # 1. Create Task with explicit acceptance criteria
    # -------------------------------------------------------------
    task = wf.create_task(
        title="Fix multiplication logic in calculator.py",
        description="Ensure multiply(a, b) computes the product correctly.",
        acceptance_criteria=[
            AcceptanceCriterion(id="AC-1", description="multiply(3, 4) returns 12", required=True),
        ],
        workspace_path=workspace,
    )
    assert task.state == TaskState.CREATED

    # -------------------------------------------------------------
    # 2. Generate Plan
    # -------------------------------------------------------------
    mock_plan = {
        "task_summary": "Plan to fix multiplication bug and run pytest",
        "steps": [
            {"step_number": 1, "action": "Inspect calculator.py", "expected_outcome": "Identify bug", "associated_criterion_id": "AC-1"},
            {"step_number": 2, "action": "Run pytest test_calculator.py", "expected_outcome": "All tests pass", "associated_criterion_id": "AC-1"}
        ],
        "acceptance_criteria": [],
        "files_to_inspect": ["calculator.py"],
        "tests_to_run": ["python -m pytest test_calculator.py"],
        "risks": ["Breaking callers"],
        "verification_strategy": "Deterministic pytest exit code"
    }
    with patch.object(wf.gemma, "_query_ollama", new=AsyncMock(return_value=json.dumps(mock_plan))):
        plan = await wf.generate_and_save_plan(task.id)

    assert plan.task_summary == "Plan to fix multiplication bug and run pytest"
    assert wf.repo.get_task(task.id).state == TaskState.PLANNED

    # -------------------------------------------------------------
    # 3. Explicit User Approval
    # -------------------------------------------------------------
    approved_task = wf.approve_plan(task.id, approved_by="DEMO_LEAD")
    assert approved_task.state == TaskState.APPROVED
    assert approved_task.approved_at is not None

    # -------------------------------------------------------------
    # 4. Execute Initial Test (Failing Run)
    # -------------------------------------------------------------
    run_1 = wf.execute_task(
        task_id=task.id,
        command="python -m pytest test_calculator.py",
        criterion_id="AC-1",
    )
    assert run_1.status == "FAILED"
    assert run_1.exit_code == 1
    assert "AssertionError: assert 7 == 12" in run_1.stdout
    assert wf.repo.get_task(task.id).state == TaskState.VERIFYING

    # -------------------------------------------------------------
    # 5. Deterministic Verification on Run 1 -> VERDICT: FAILED
    # -------------------------------------------------------------
    mock_diag = {
        "failure_summary": "Test failed: assert multiply(3, 4) returned 7 instead of 12",
        "likely_causes": ["calculator.py used addition '+' instead of multiplication '*'"],
        "evidence_references": ["[TEST_OUTPUT] exit_code=1 snippet='AssertionError'"],
        "recommended_fixes": ["Replace return a + b with return a * b in calculator.py"],
        "suggested_retests": ["python -m pytest test_calculator.py"],
        "confidence": 0.95,
    }
    with patch.object(wf.gemma, "_query_ollama", new=AsyncMock(return_value=json.dumps(mock_diag))):
        verif_1 = await wf.verify_task(task.id, run_id=run_1.run_id)

    assert verif_1.verdict == VerificationVerdict.FAILED
    assert any(not r.passed and r.rule_name == "CommandExitCodeCheck" for r in verif_1.rule_evaluations)
    assert wf.repo.get_task(task.id).state == TaskState.FAILED

    # Check that failure diagnosis was automatically produced and saved
    diag = wf.repo.get_latest_diagnosis(task.id)
    assert diag is not None
    assert diag.verdict == VerificationVerdict.FAILED  # INVARIANT: Diagnosis does not alter verdict
    assert "calculator.py used addition" in diag.likely_causes[0]

    # -------------------------------------------------------------
    # 6. Apply Controlled Correction
    # -------------------------------------------------------------
    with open(calc_path, "w", encoding="utf-8") as f:
        f.write("def multiply(a: int, b: int) -> int:\n    return a * b  # Corrected to multiplication\n")

    # -------------------------------------------------------------
    # 7. Approve Correction & Re-Execute
    # -------------------------------------------------------------
    wf.approve_plan(task.id, approved_by="DEMO_LEAD", notes="Fixed multiplication operator")
    assert wf.repo.get_task(task.id).state == TaskState.APPROVED

    run_2 = wf.execute_task(
        task_id=task.id,
        command="python -m pytest test_calculator.py",
        criterion_id="AC-1",
    )
    assert run_2.status == "COMPLETED"
    assert run_2.exit_code == 0
    assert "1 passed" in run_2.stdout
    assert run_2.git_diff is not None
    assert "+    return a * b" in run_2.git_diff

    # -------------------------------------------------------------
    # 8. Re-Verify -> VERDICT: VERIFIED
    # -------------------------------------------------------------
    verif_2 = await wf.verify_task(task.id, run_id=run_2.run_id)
    assert verif_2.verdict == VerificationVerdict.VERIFIED
    assert verif_2.confidence_score == 1.0
    assert wf.repo.get_task(task.id).state == TaskState.VERIFIED

    # -------------------------------------------------------------
    # 9. Verify Run Report and History Integrity
    # -------------------------------------------------------------
    report_1 = wf.get_run_report(run_1.run_id)
    assert report_1.run.exit_code == 1
    assert report_1.verification.verdict == VerificationVerdict.FAILED
    assert report_1.diagnosis is not None

    report_2 = wf.get_run_report(run_2.run_id)
    assert report_2.run.exit_code == 0
    assert report_2.verification.verdict == VerificationVerdict.VERIFIED

    # Ensure all verifications and runs are preserved in history (never overwritten)
    all_runs = wf.repo.list_execution_runs(task.id)
    assert len(all_runs) == 2
    assert all_runs[0].exit_code == 1
    assert all_runs[1].exit_code == 0

    all_verifications = wf.repo.list_verifications(task.id)
    assert len(all_verifications) == 2
    assert all_verifications[0].verdict == VerificationVerdict.FAILED
    assert all_verifications[1].verdict == VerificationVerdict.VERIFIED
