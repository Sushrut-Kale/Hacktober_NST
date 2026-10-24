"""Tests for the five explicit verification verdicts and edge cases."""

import pytest
from backend.app.schemas.core import (
    Task,
    AcceptanceCriterion,
    ExecutionClaim,
    EvidenceItem,
    EvidenceType,
    VerificationVerdict,
)
from backend.app.services.verification_engine import DeterministicVerificationEngine


@pytest.fixture
def engine():
    return DeterministicVerificationEngine()


@pytest.fixture
def base_task():
    return Task(
        id="task-verdicts",
        title="Verification Verdict Test",
        acceptance_criteria=[
            AcceptanceCriterion(id="AC-1", description="Criterion 1", required=True),
            AcceptanceCriterion(id="AC-2", description="Criterion 2", required=True),
        ]
    )


def test_verdict_pass_when_all_checks_substantiated(engine, base_task):
    """Test PASS verdict when all required criteria have passing evidence, git diff, and exit code 0."""
    claim = ExecutionClaim(
        task_id=base_task.id,
        agent_name="Agent",
        claimed_success=True,
        statement="Completed",
        git_diff="diff --git a/file.py b/file.py\n+hello",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.TEST_OUTPUT,
                content="test passed",
                exit_code=0,
                passed=True,
            ),
            EvidenceItem(
                criterion_id="AC-2",
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content="test passed",
                exit_code=0,
                passed=True,
            ),
        ]
    )
    result = engine.evaluate(base_task, claim)
    assert result.verdict == VerificationVerdict.PASS
    assert result.confidence_score == 1.0


def test_verdict_fail_when_command_exits_nonzero(engine, base_task):
    """Test FAIL verdict when a test command returns exit code != 0."""
    claim = ExecutionClaim(
        task_id=base_task.id,
        agent_name="Agent",
        claimed_success=True,
        statement="Completed",
        git_diff="diff --git a/file.py b/file.py",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content="pytest failed",
                exit_code=1,
                passed=False,
            ),
            EvidenceItem(
                criterion_id="AC-2",
                evidence_type=EvidenceType.TEST_OUTPUT,
                content="passed",
                exit_code=0,
                passed=True,
            ),
        ]
    )
    result = engine.evaluate(base_task, claim)
    assert result.verdict == VerificationVerdict.FAIL


def test_verdict_fail_on_contradictory_error_logs(engine, base_task):
    """Test FAIL verdict when tracebacks or AssertionError are hidden in logs despite claimed success."""
    claim = ExecutionClaim(
        task_id=base_task.id,
        agent_name="Agent",
        claimed_success=True,
        statement="Done",
        git_diff="diff ...",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.TEST_OUTPUT,
                content="AssertionError: Expected 200 but got 500",
                exit_code=0,
                passed=True, # Maliciously or incorrectly claimed passed
            ),
        ]
    )
    result = engine.evaluate(base_task, claim)
    assert result.verdict == VerificationVerdict.FAIL
    assert any(r.rule_name == "ContradictionCheck" and not r.passed for r in result.rule_evaluations)


def test_verdict_blocked_when_environment_error(engine, base_task):
    """Test BLOCKED verdict when environment/dependency failure prevented verification."""
    claim = ExecutionClaim(
        task_id=base_task.id,
        agent_name="Agent",
        claimed_success=False,
        statement="Blocked by connection error",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.LOG_OUTPUT,
                content="Execution blocked: Command timed out after 30 seconds.",
                exit_code=-1,
                passed=False,
            )
        ]
    )
    result = engine.evaluate(base_task, claim)
    assert result.verdict == VerificationVerdict.BLOCKED


def test_verdict_unknown_when_diff_missing(engine, base_task):
    """Test UNKNOWN verdict when required code modification lacks diff evidence."""
    claim = ExecutionClaim(
        task_id=base_task.id,
        agent_name="Agent",
        claimed_success=True,
        statement="Done",
        git_diff=None, # Missing diff!
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.TEST_OUTPUT,
                content="passed",
                exit_code=0,
                passed=True,
            ),
            EvidenceItem(
                criterion_id="AC-2",
                evidence_type=EvidenceType.TEST_OUTPUT,
                content="passed",
                exit_code=0,
                passed=True,
            ),
        ]
    )
    result = engine.evaluate(base_task, claim)
    assert result.verdict == VerificationVerdict.UNKNOWN


def test_missing_test_result_not_silently_passed(engine, base_task):
    """Test that missing test results or unconfirmed criteria are NOT treated as pass."""
    claim = ExecutionClaim(
        task_id=base_task.id,
        agent_name="Agent",
        claimed_success=True,
        statement="All done",
        git_diff="diff --git a/x.py b/x.py\n+x",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.TEST_OUTPUT,
                content="Ran tests",
                exit_code=None, # Missing exit code / unconfirmed!
                passed=None,    # Missing pass confirmation!
            ),
            EvidenceItem(
                criterion_id="AC-2",
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content="passed",
                exit_code=0,
                passed=True,
            ),
        ]
    )
    result = engine.evaluate(base_task, claim)
    # Must NOT be PASS!
    assert result.verdict != VerificationVerdict.PASS
    assert result.verdict in (VerificationVerdict.UNKNOWN, VerificationVerdict.FAIL)


def test_claim_vs_reality_discrepancy_reporting(engine, base_task):
    """Test Claim vs Reality report detects discrepancies when agent claims success but tests fail."""
    claim = ExecutionClaim(
        task_id=base_task.id,
        agent_name="OverconfidentAgent",
        claimed_success=True,
        statement="Everything is completely finished and working!",
        git_diff="",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content="FAILED test_something",
                exit_code=1,
                passed=False,
            )
        ]
    )
    report = engine.generate_claim_vs_reality_report(base_task, claim)
    assert report.claim_verified is False
    assert report.verdict == VerificationVerdict.FAIL
    assert len(report.discrepancies) >= 1
    assert any("claimed success" in d.lower() for d in report.discrepancies)
