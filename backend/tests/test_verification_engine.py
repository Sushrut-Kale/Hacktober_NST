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
def sample_task():
    return Task(
        id="task-001",
        title="Add deterministic verification engine",
        description="Implement rule-based verification independent of agent completion messages.",
        acceptance_criteria=[
            AcceptanceCriterion(id="AC-1", description="DeterministicVerificationEngine class implemented"),
            AcceptanceCriterion(id="AC-2", description="Passes all unit tests with exit code 0"),
        ]
    )

def test_unsubstantiated_claim_fails(sample_task):
    engine = DeterministicVerificationEngine()
    claim = ExecutionClaim(
        task_id="task-001",
        agent_name="AntigravityWorker",
        claimed_success=True,
        statement="I finished all tasks perfectly!",
        evidence_list=[] # Zero evidence!
    )
    result = engine.evaluate(sample_task, claim)
    assert result.verdict == VerificationVerdict.FAILED
    assert any(r.rule_name == "UnsubstantiatedClaimCheck" and not r.passed for r in result.rule_evaluations)

def test_failed_exit_code_fails_verification(sample_task):
    engine = DeterministicVerificationEngine()
    claim = ExecutionClaim(
        task_id="task-001",
        agent_name="AntigravityWorker",
        claimed_success=True,
        statement="Everything passed except one test",
        git_diff="diff --git a/engine.py b/engine.py",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.FILE_CONTENT,
                content="class DeterministicVerificationEngine: pass",
                exit_code=0,
                passed=True,
            ),
            EvidenceItem(
                criterion_id="AC-2",
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content="pytest failed with 1 error",
                exit_code=1, # Failing exit code!
                passed=False,
            ),
        ]
    )
    result = engine.evaluate(sample_task, claim)
    assert result.verdict == VerificationVerdict.FAILED
    assert any(r.rule_name == "CommandExitCodeCheck" and not r.passed for r in result.rule_evaluations)

def test_missing_required_criterion_fails(sample_task):
    engine = DeterministicVerificationEngine()
    claim = ExecutionClaim(
        task_id="task-001",
        agent_name="AntigravityWorker",
        claimed_success=True,
        statement="Finished AC-1",
        git_diff="diff --git a/test.py b/test.py",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.FILE_CONTENT,
                content="Code for AC-1",
                exit_code=0,
                passed=True,
            )
            # AC-2 is missing!
        ]
    )
    result = engine.evaluate(sample_task, claim)
    assert result.verdict == VerificationVerdict.FAILED
    assert any(r.rule_name == "AcceptanceCriteriaCoverageCheck" and not r.passed for r in result.rule_evaluations)

def test_missing_git_diff_requires_review(sample_task):
    engine = DeterministicVerificationEngine()
    claim = ExecutionClaim(
        task_id="task-001",
        agent_name="AntigravityWorker",
        claimed_success=True,
        statement="All done, but forgot to record diff",
        git_diff=None, # No diff!
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.TEST_OUTPUT,
                content="AC-1 verified",
                exit_code=0,
                passed=True,
            ),
            EvidenceItem(
                criterion_id="AC-2",
                evidence_type=EvidenceType.TEST_OUTPUT,
                content="AC-2 verified",
                exit_code=0,
                passed=True,
            ),
        ]
    )
    result = engine.evaluate(sample_task, claim)
    assert result.verdict == VerificationVerdict.REVIEW_REQUIRED

def test_fully_substantiated_evidence_verifies(sample_task):
    engine = DeterministicVerificationEngine()
    claim = ExecutionClaim(
        task_id="task-001",
        agent_name="AntigravityWorker",
        claimed_success=True,
        statement="Implementation completed and tested.",
        git_diff="diff --git a/backend/app/services/verification_engine.py b/backend/app/services/verification_engine.py",
        evidence_list=[
            EvidenceItem(
                criterion_id="AC-1",
                evidence_type=EvidenceType.FILE_CONTENT,
                content="class DeterministicVerificationEngine",
                exit_code=0,
                passed=True,
            ),
            EvidenceItem(
                criterion_id="AC-2",
                evidence_type=EvidenceType.COMMAND_EXIT_CODE,
                content="pytest tests/ - 5 passed in 0.12s",
                exit_code=0,
                passed=True,
            ),
        ]
    )
    result = engine.evaluate(sample_task, claim)
    assert result.verdict == VerificationVerdict.VERIFIED
    assert result.confidence_score == 1.0
    assert result.raw_evidence_count == 2
