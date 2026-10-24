import os
import tempfile
import pytest
from datetime import datetime, timezone

from backend.app.schemas.core import (
    Task,
    TaskState,
    AcceptanceCriterion,
    TaskPlan,
    PlanStep,
    MappedCriterion,
    ExecutionRun,
    EvidenceItem,
    EvidenceType,
    VerificationResult,
    VerificationVerdict,
    RuleEvaluation,
    FailureDiagnosis,
    ExecutionEvent,
)
from backend.app.db.repository import DatabaseRepository

@pytest.fixture
def temp_db():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    repo = DatabaseRepository(db_path=db_path)
    yield repo
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
        except Exception:
            pass

def test_task_persistence_and_retrieval(temp_db):
    task = Task(
        id="task-db-01",
        title="Persist task",
        description="Verify database store and reload",
        acceptance_criteria=[
            AcceptanceCriterion(id="AC-1", description="Store task in SQLite", required=True)
        ],
        state=TaskState.CREATED,
    )
    temp_db.save_task(task)

    loaded = temp_db.get_task("task-db-01")
    assert loaded is not None
    assert loaded.id == "task-db-01"
    assert loaded.title == "Persist task"
    assert loaded.state == TaskState.CREATED
    assert len(loaded.acceptance_criteria) == 1

def test_persistence_across_repository_restarts(temp_db):
    # Simulate restart by instantiating a new repository connected to the same file
    task = Task(
        id="task-restart-01",
        title="Survive restart",
        description="Check disk persistence",
        acceptance_criteria=[],
    )
    temp_db.save_task(task)

    # Re-open repo
    restarted_repo = DatabaseRepository(db_path=temp_db.db_path)
    loaded = restarted_repo.get_task("task-restart-01")
    assert loaded is not None
    assert loaded.title == "Survive restart"

def test_state_update(temp_db):
    task = Task(
        id="task-state-01",
        title="State update test",
        description="Test state transitions",
        acceptance_criteria=[],
    )
    temp_db.save_task(task)

    now = datetime.now(timezone.utc)
    updated = temp_db.update_task_state("task-state-01", TaskState.APPROVED, approved_at=now)
    assert updated.state == TaskState.APPROVED
    assert updated.approved_at is not None

def test_plan_persistence(temp_db):
    plan = TaskPlan(
        task_id="task-plan-store",
        task_summary="Plan summary",
        steps=[
            PlanStep(step_number=1, action="Step 1", expected_outcome="Done", associated_criterion_id="AC-1")
        ],
        acceptance_criteria=[
            MappedCriterion(criterion_id="AC-1", description="Desc", verification_method="pytest")
        ],
        files_to_inspect=["file.py"],
        tests_to_run=["pytest"],
        risks=["None"],
        verification_strategy="Run tests",
    )
    temp_db.save_plan(plan)

    loaded = temp_db.get_plan("task-plan-store")
    assert loaded is not None
    assert loaded.task_summary == "Plan summary"
    assert len(loaded.steps) == 1
    assert loaded.steps[0].action == "Step 1"

def test_execution_run_and_evidence_history(temp_db):
    ev = EvidenceItem(
        criterion_id="AC-1",
        evidence_type=EvidenceType.COMMAND_EXIT_CODE,
        content="exit code 0",
        exit_code=0,
        passed=True,
    )
    run = ExecutionRun(
        run_id="run-001",
        task_id="task-history-01",
        command="pytest",
        exit_code=0,
        stdout="passed",
        stderr="",
        evidence_items=[ev],
    )
    temp_db.save_execution_run(run)

    loaded_run = temp_db.get_execution_run("run-001")
    assert loaded_run is not None
    assert loaded_run.command == "pytest"
    assert len(loaded_run.evidence_items) == 1
    assert loaded_run.evidence_items[0].exit_code == 0

def test_verification_and_diagnosis_persistence(temp_db):
    verif = VerificationResult(
        task_id="task-verif-01",
        verdict=VerificationVerdict.FAILED,
        confidence_score=0.5,
        rule_evaluations=[
            RuleEvaluation(
                rule_name="ExitCodeCheck",
                passed=False,
                verdict_impact=VerificationVerdict.FAILED,
                message="Exit code 1",
            )
        ],
        summary="Failed 1 rule",
        raw_evidence_count=1,
    )
    temp_db.save_verification(verif)

    diag = FailureDiagnosis(
        task_id="task-verif-01",
        verdict=VerificationVerdict.FAILED,
        failure_summary="Test failed with exit code 1",
        likely_causes=["Bug in code"],
        evidence_references=["ExitCodeCheck"],
        recommended_fixes=["Fix bug"],
        suggested_retests=["pytest"],
        confidence=0.9,
    )
    temp_db.save_diagnosis(diag)

    latest_v = temp_db.get_latest_verification("task-verif-01")
    assert latest_v is not None
    assert latest_v.verdict == VerificationVerdict.FAILED

    latest_d = temp_db.get_latest_diagnosis("task-verif-01")
    assert latest_d is not None
    assert latest_d.failure_summary == "Test failed with exit code 1"
