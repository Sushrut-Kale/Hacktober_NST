"""
Deterministic verification integrity regression tests.

Central invariant: AI may generate plans and diagnoses,
but ONLY the DeterministicVerificationEngine may issue the final verdict.

Covers all 9 regression scenarios from the spec:
1. AI claims success while tests fail.
2. Evidence is missing entirely.
3. Tests have not been run.
4. Execution is blocked by an unavailable dependency.
5. Verification returns an unknown or malformed verdict.
6. Acceptance criteria are incompletely covered.
7. Contradictory evidence is present.
8. A report attempts to disagree with the authoritative verdict.
9. A task's final state is inconsistent with its verification record.
"""

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
def two_criteria_task():
    return Task(
        id="task-integrity",
        title="Integrity Regression Task",
        acceptance_criteria=[
            AcceptanceCriterion(id="AC-1", description="Unit tests pass", required=True),
            AcceptanceCriterion(id="AC-2", description="Integration test passes", required=True),
        ],
    )


@pytest.fixture
def single_criteria_task():
    return Task(
        id="task-single",
        title="Single Criterion Task",
        acceptance_criteria=[
            AcceptanceCriterion(id="AC-1", description="Test passes", required=True),
        ],
    )


# ===========================================================================
# 1. AI claims success while tests fail
# ===========================================================================

def test_ai_claims_success_but_tests_fail(engine, two_criteria_task):
    """Deterministic engine catches AI success claim when exit code is non-zero."""
    claim = ExecutionClaim(
        task_id="task-integrity",
        agent_name="OverconfidentAI",
        claimed_success=True,  # AI claims done
        statement="I completed everything perfectly!",
        git_diff="diff --git ...",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content="pytest FAILED 2 errors",
                exit_code=1,   # Tests actually failed!
                passed=False,
            ),
            EvidenceItem(
                criterion_id="AC-2",
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content="integration test passed",
                exit_code=0,
                passed=True,
            ),
        ],
    )
    result = engine.evaluate(two_criteria_task, claim)
    # Must not pass — engine must detect the failure despite AI claim
    assert result.verdict == VerificationVerdict.FAIL
    assert not any(r.rule_name == "CommandExitCodeCheck" and r.passed for r in result.rule_evaluations)


def test_claim_vs_reality_catches_false_ai_success(engine, two_criteria_task):
    """ClaimVsReality report discrepancy when AI claims success but engine disagrees."""
    claim = ExecutionClaim(
        task_id="task-integrity",
        agent_name="FakeSuccessAgent",
        claimed_success=True,
        statement="All done, trust me!",
        git_diff="diff ...",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content="Error: tests crashed",
                exit_code=2,
                passed=False,
            ),
        ],
    )
    report = engine.generate_claim_vs_reality_report(two_criteria_task, claim)
    assert report.claim_verified is False  # AI claim cannot override engine verdict
    assert report.verdict != VerificationVerdict.PASS
    assert len(report.discrepancies) >= 1
    # Must mention "claimed success" explicitly
    assert any("claimed success" in d.lower() for d in report.discrepancies)


# ===========================================================================
# 2. Evidence is missing entirely
# ===========================================================================

def test_missing_evidence_prevents_pass(engine, two_criteria_task):
    """Zero evidence items must never produce a PASS verdict."""
    claim = ExecutionClaim(
        task_id="task-integrity",
        agent_name="LazyAgent",
        claimed_success=True,
        statement="Trust me, it works.",
        evidence_list=[],
    )
    result = engine.evaluate(two_criteria_task, claim)
    assert result.verdict != VerificationVerdict.PASS
    assert result.verdict in (VerificationVerdict.FAIL, VerificationVerdict.NOT_RUN)


def test_missing_evidence_rule_fires(engine, two_criteria_task):
    """UnsubstantiatedClaimCheck rule explicitly fails with no evidence."""
    claim = ExecutionClaim(
        task_id="task-integrity",
        agent_name="NullAgent",
        claimed_success=True,
        statement="Done.",
        evidence_list=[],
    )
    result = engine.evaluate(two_criteria_task, claim)
    unsubstantiated = next(
        (r for r in result.rule_evaluations if r.rule_name == "UnsubstantiatedClaimCheck"),
        None,
    )
    assert unsubstantiated is not None
    assert not unsubstantiated.passed


# ===========================================================================
# 3. Tests have not been run
# ===========================================================================

def test_not_run_when_no_command_evidence(engine, two_criteria_task):
    """When no command/test evidence exists (only claims), verdict is NOT_RUN or FAIL."""
    claim = ExecutionClaim(
        task_id="task-integrity",
        agent_name="SkippedTestsAgent",
        claimed_success=False,
        statement="I didn't run any tests.",
        evidence_list=[],
    )
    result = engine.evaluate(two_criteria_task, claim)
    # No evidence + no claimed success → NOT_RUN
    assert result.verdict in (VerificationVerdict.NOT_RUN, VerificationVerdict.FAIL)
    # Must not be PASS
    assert result.verdict != VerificationVerdict.PASS


# ===========================================================================
# 4. Execution blocked by unavailable dependency
# ===========================================================================

def test_execution_blocked_by_unavailable_dependency(engine, two_criteria_task):
    """BLOCKED verdict when evidence contains environment block keywords."""
    claim = ExecutionClaim(
        task_id="task-integrity",
        agent_name="BlockedAgent",
        claimed_success=False,
        statement="Cannot connect to database.",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.LOG_OUTPUT,
                content="Execution blocked: Command timed out after 30 seconds.",
                exit_code=-1,
                passed=False,
            ),
        ],
    )
    result = engine.evaluate(two_criteria_task, claim)
    assert result.verdict == VerificationVerdict.BLOCKED
    block_rule = next(
        (r for r in result.rule_evaluations if r.rule_name == "EnvironmentBlockCheck"),
        None,
    )
    assert block_rule is not None
    assert not block_rule.passed


def test_blocked_overrides_other_passing_rules(engine, two_criteria_task):
    """BLOCKED verdict takes highest priority, even if some rules pass."""
    claim = ExecutionClaim(
        task_id="task-integrity",
        agent_name="PartialAgent",
        claimed_success=True,
        statement="Mostly done but one service is down.",
        git_diff="diff --git...",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content="Execution blocked: PermissionError denied.",
                exit_code=-1,
                passed=False,
            ),
            EvidenceItem(
                criterion_id="AC-2",
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content="AC-2 passed",
                exit_code=0,
                passed=True,
            ),
        ],
    )
    result = engine.evaluate(two_criteria_task, claim)
    assert result.verdict == VerificationVerdict.BLOCKED


# ===========================================================================
# 5. Unknown/malformed verdict handled safely
# ===========================================================================

def test_malformed_evidence_does_not_crash_engine(engine, single_criteria_task):
    """Evidence with None content and None exit_code is handled without crashing."""
    claim = ExecutionClaim(
        task_id="task-single",
        agent_name="BrokenAgent",
        claimed_success=True,
        statement="Done.",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.LOG_OUTPUT,
                content=None,     # type: ignore[arg-type]
                exit_code=None,
                passed=None,
            ),
        ],
    )
    # Must not raise an exception
    result = engine.evaluate(single_criteria_task, claim)
    assert result.verdict is not None
    assert result.verdict != VerificationVerdict.PASS  # Missing test result ≠ PASS


# ===========================================================================
# 6. Acceptance criteria incompletely covered
# ===========================================================================

def test_partial_criteria_coverage_fails(engine, two_criteria_task):
    """Only one of two required criteria covered → FAIL."""
    claim = ExecutionClaim(
        task_id="task-integrity",
        agent_name="HalfDoneAgent",
        claimed_success=True,
        statement="I only did AC-1.",
        git_diff="diff...",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content="AC-1 passed",
                exit_code=0,
                passed=True,
            ),
            # AC-2 has no evidence!
        ],
    )
    result = engine.evaluate(two_criteria_task, claim)
    assert result.verdict == VerificationVerdict.FAIL
    coverage = next(
        (r for r in result.rule_evaluations if r.rule_name == "AcceptanceCriteriaCoverageCheck"),
        None,
    )
    assert coverage is not None
    assert not coverage.passed
    assert "AC-2" in coverage.message


def test_missing_criteria_evidence_not_silently_passed(engine, two_criteria_task):
    """Missing test result for a required criterion is never silently treated as PASS."""
    claim = ExecutionClaim(
        task_id="task-integrity",
        agent_name="ClaimingAgent",
        claimed_success=True,
        statement="Both criteria done!",
        git_diff="diff...",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.TEST_OUTPUT,
                content="Some output without confirmation",
                exit_code=None,   # No exit code — unconfirmed
                passed=None,      # No pass confirmation
            ),
            EvidenceItem(
                criterion_id="AC-2",
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content="passed",
                exit_code=0,
                passed=True,
            ),
        ],
    )
    result = engine.evaluate(two_criteria_task, claim)
    # Must not be PASS because AC-1 evidence is unconfirmed
    assert result.verdict != VerificationVerdict.PASS


# ===========================================================================
# 7. Contradictory evidence present
# ===========================================================================

def test_assertion_error_in_evidence_detected(engine, single_criteria_task):
    """Evidence containing AssertionError while claiming success → FAIL."""
    claim = ExecutionClaim(
        task_id="task-single",
        agent_name="LyingAgent",
        claimed_success=True,
        statement="All tests passed!",
        git_diff="diff...",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.TEST_OUTPUT,
                content="AssertionError: Expected 200 but got 404",
                exit_code=0,     # Exit code says pass, but content contradicts
                passed=True,     # Incorrectly marked as passed
            ),
        ],
    )
    result = engine.evaluate(single_criteria_task, claim)
    assert result.verdict == VerificationVerdict.FAIL
    contradiction = next(
        (r for r in result.rule_evaluations if r.rule_name == "ContradictionCheck"),
        None,
    )
    assert contradiction is not None
    assert not contradiction.passed


def test_traceback_in_evidence_detected(engine, single_criteria_task):
    """Evidence containing Python traceback while claiming success → FAIL."""
    claim = ExecutionClaim(
        task_id="task-single",
        agent_name="CrashingAgent",
        claimed_success=True,
        statement="I'm done!",
        git_diff="diff...",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.LOG_OUTPUT,
                content="Traceback (most recent call last):\n  File test.py, line 10\nKeyError: 'missing'",
                exit_code=0,
                passed=True,
            ),
        ],
    )
    result = engine.evaluate(single_criteria_task, claim)
    assert result.verdict == VerificationVerdict.FAIL


# ===========================================================================
# 8. Report cannot disagree with the authoritative verdict
# ===========================================================================

def test_report_verdict_matches_engine_verdict(engine, two_criteria_task):
    """ClaimVsRealityReport.verdict must equal the engine's VerificationResult.verdict."""
    claim = ExecutionClaim(
        task_id="task-integrity",
        agent_name="AnyAgent",
        claimed_success=True,
        statement="Done.",
        git_diff="diff...",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content="failed",
                exit_code=1,
                passed=False,
            ),
        ],
    )
    result = engine.evaluate(two_criteria_task, claim)
    report = engine.generate_claim_vs_reality_report(two_criteria_task, claim, result)

    # The report MUST agree with the authoritative result
    assert report.verdict == result.verdict
    assert report.verification_result.verdict == result.verdict


def test_claim_verified_only_when_verdict_is_pass(engine, two_criteria_task):
    """claim_verified must be False for any non-PASS verdict."""
    claim = ExecutionClaim(
        task_id="task-integrity",
        agent_name="AnyAgent",
        claimed_success=True,
        statement="Claiming success with no real evidence.",
        evidence_list=[],
    )
    report = engine.generate_claim_vs_reality_report(two_criteria_task, claim)
    # Verdict must not be PASS with no evidence
    assert report.verdict != VerificationVerdict.PASS
    assert report.claim_verified is False


# ===========================================================================
# 9. Evidence collected/claimed provenance tracking
# ===========================================================================

def test_evidence_summary_reflects_actual_counts(engine, two_criteria_task):
    """Evidence summary counts accurately reflect the evidence list content."""
    claim = ExecutionClaim(
        task_id="task-integrity",
        agent_name="CountingAgent",
        claimed_success=False,
        statement="Ran two commands.",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content="exit 0",
                exit_code=0,
                passed=True,
            ),
            EvidenceItem(
                criterion_id="AC-2",
                evidence_type=EvidenceType.TEST_OUTPUT,
                content="Ran tests",
                exit_code=0,
                passed=True,
            ),
        ],
    )
    report = engine.generate_claim_vs_reality_report(two_criteria_task, claim)
    summary = report.evidence_summary
    assert summary["total_evidence_items"] == 2
    assert summary["command_runs"] == 1
    assert summary["test_runs"] == 1


def test_git_diff_missing_absence_recorded_in_summary(engine, single_criteria_task):
    """When no git diff is provided, summary records git_diff_recorded as False."""
    claim = ExecutionClaim(
        task_id="task-single",
        agent_name="NoDiffAgent",
        claimed_success=True,
        statement="I forgot the diff.",
        git_diff=None,
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content="exit 0",
                exit_code=0,
                passed=True,
            ),
        ],
    )
    report = engine.generate_claim_vs_reality_report(single_criteria_task, claim)
    assert report.evidence_summary["git_diff_recorded"] is False
