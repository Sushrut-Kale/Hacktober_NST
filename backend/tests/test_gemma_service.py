import json
import pytest
from unittest.mock import AsyncMock, patch
import httpx

from backend.app.schemas.core import (
    Task,
    AcceptanceCriterion,
    TaskPlan,
    VerificationResult,
    VerificationVerdict,
    RuleEvaluation,
    EvidenceItem,
    EvidenceType,
    GeneratorStatus,
    FailureDiagnosis,
)
from backend.app.services.gemma_service import GemmaService

@pytest.fixture
def sample_task():
    return Task(
        id="task-010",
        title="Add structured JSON output to Ollama service",
        description="Configure GemmaService to request structured JSON and parse response.",
        acceptance_criteria=[
            AcceptanceCriterion(id="AC-1", description="Gemma queries Ollama with format=json"),
            AcceptanceCriterion(id="AC-2", description="Returns validated TaskPlan instance"),
        ],
    )

@pytest.fixture
def sample_failed_result():
    return VerificationResult(
        task_id="task-010",
        verdict=VerificationVerdict.FAILED,
        confidence_score=0.33,
        rule_evaluations=[
            RuleEvaluation(
                rule_name="CommandExitCodeCheck",
                passed=False,
                verdict_impact=VerificationVerdict.FAILED,
                message="pytest exited with code 1: AssertionError in test_format",
                criterion_id="AC-1",
            ),
            RuleEvaluation(
                rule_name="AcceptanceCriteriaCoverageCheck",
                passed=False,
                verdict_impact=VerificationVerdict.FAILED,
                message="Missing verified evidence for AC-2",
                criterion_id="AC-2",
            ),
        ],
        summary="Verification FAILED: 1/3 rules satisfied.",
        raw_evidence_count=1,
    )

# 1. Valid structured Gemma response
@pytest.mark.asyncio
async def test_valid_structured_gemma_plan(sample_task):
    service = GemmaService()
    mock_payload = {
        "task_summary": "Implement Ollama structured JSON support",
        "steps": [
            {
                "step_number": 1,
                "action": "Add format=json to payload",
                "expected_outcome": "Ollama returns JSON",
                "associated_criterion_id": "AC-1",
            },
            {
                "step_number": 2,
                "action": "Validate with Pydantic",
                "expected_outcome": "TaskPlan validated",
                "associated_criterion_id": "AC-2",
            },
        ],
        "acceptance_criteria": [
            {
                "criterion_id": "AC-1",
                "description": "Format json supported",
                "verification_method": "pytest",
            }
        ],
        "files_to_inspect": ["backend/app/services/gemma_service.py"],
        "tests_to_run": ["pytest backend/tests/test_gemma_service.py"],
        "risks": ["Model might return markdown code fences"],
        "verification_strategy": "Run unit test with mock and integration test with live Ollama",
    }

    with patch.object(service, "_query_ollama", new=AsyncMock(return_value=json.dumps(mock_payload))):
        plan = await service.generate_plan(sample_task)

    assert isinstance(plan, TaskPlan)
    assert plan.generator_status == GeneratorStatus.AI_ACTIVE
    assert plan.task_summary == "Implement Ollama structured JSON support"
    assert len(plan.steps) == 2
    assert plan.steps[0].associated_criterion_id == "AC-1"
    assert "backend/app/services/gemma_service.py" in plan.files_to_inspect
    assert len(plan.tests_to_run) == 1

# 2. Invalid JSON response triggers safe fallback
@pytest.mark.asyncio
async def test_invalid_json_triggers_fallback(sample_task):
    service = GemmaService()
    with patch.object(service, "_query_ollama", new=AsyncMock(return_value="THIS IS NOT VALID JSON {malformed")):
        plan = await service.generate_plan(sample_task)

    assert isinstance(plan, TaskPlan)
    assert plan.generator_status == GeneratorStatus.FALLBACK_ACTIVE
    assert "fallback" in plan.model_name
    assert len(plan.steps) == 2

# 3. Missing required fields (empty steps) triggers fallback
@pytest.mark.asyncio
async def test_missing_required_fields_triggers_fallback(sample_task):
    service = GemmaService()
    incomplete_payload = {"task_summary": "Only summary, missing steps list"}

    with patch.object(service, "_query_ollama", new=AsyncMock(return_value=json.dumps(incomplete_payload))):
        plan = await service.generate_plan(sample_task)

    assert isinstance(plan, TaskPlan)
    assert plan.generator_status == GeneratorStatus.FALLBACK_ACTIVE
    assert len(plan.steps) == 2

# 4. Ollama unavailable reports AI_UNAVAILABLE and fallback plan
@pytest.mark.asyncio
async def test_ollama_unavailable(sample_task):
    service = GemmaService(base_url="http://localhost:59999")
    status = await service.check_readiness()
    assert status["status"] == GeneratorStatus.AI_UNAVAILABLE.value
    assert status["available"] is False

    plan = await service.generate_plan(sample_task)
    assert plan.generator_status == GeneratorStatus.FALLBACK_ACTIVE

# 5. Request timeout triggers safe fallback
@pytest.mark.asyncio
async def test_request_timeout_triggers_fallback(sample_task):
    service = GemmaService(timeout=0.001)

    async def mock_timeout(*args, **kwargs):
        raise httpx.TimeoutException("Connection timed out")

    with patch("httpx.AsyncClient.post", side_effect=mock_timeout):
        plan = await service.generate_plan(sample_task)

    assert isinstance(plan, TaskPlan)
    assert plan.generator_status == GeneratorStatus.FALLBACK_ACTIVE

# 6. Fallback response schema compliance
@pytest.mark.asyncio
async def test_fallback_schema_compliance(sample_task):
    service = GemmaService()
    with patch.object(service, "_query_ollama", new=AsyncMock(return_value=None)):
        plan = await service.generate_plan(sample_task)

    assert plan.task_id == sample_task.id
    assert plan.task_summary != ""
    assert len(plan.steps) > 0
    assert len(plan.acceptance_criteria) > 0
    assert len(plan.files_to_inspect) > 0
    assert len(plan.tests_to_run) > 0
    assert len(plan.risks) > 0
    assert plan.verification_strategy != ""

# 7. Failure diagnosis referencing real supplied evidence
@pytest.mark.asyncio
async def test_failure_diagnosis_with_real_evidence(sample_task, sample_failed_result):
    service = GemmaService()
    evidence_items = [
        EvidenceItem(
            criterion_id="AC-1",
            evidence_type=EvidenceType.TEST_OUTPUT,
            content="AssertionError: Expected json format in Ollama payload",
            exit_code=1,
            passed=False,
        )
    ]

    mock_diagnosis_response = {
        "failure_summary": "Unit test failed due to missing format=json parameter in Ollama payload",
        "likely_causes": ["format=json was omitted from payload dictionary"],
        "evidence_references": ["[TEST_OUTPUT] Criterion AC-1: exit_code=1 passed=False snippet='AssertionError'"],
        "recommended_fixes": ["Add payload['format'] = 'json' in GemmaService._query_ollama"],
        "suggested_retests": ["python -m pytest backend/tests/test_gemma_service.py"],
        "confidence": 0.90,
    }

    with patch.object(service, "_query_ollama", new=AsyncMock(return_value=json.dumps(mock_diagnosis_response))):
        diagnosis = await service.explain_failure(
            task=sample_task,
            verification_result=sample_failed_result,
            repo_diff="diff --git a/backend/app/services/gemma_service.py b/backend/app/services/gemma_service.py",
            evidence_list=evidence_items,
        )

    assert isinstance(diagnosis, FailureDiagnosis)
    assert diagnosis.verdict == VerificationVerdict.FAILED
    assert diagnosis.generator_status == GeneratorStatus.AI_ACTIVE
    assert diagnosis.insufficient_evidence is False
    assert len(diagnosis.evidence_references) > 0
    assert "AssertionError" in diagnosis.evidence_references[0]

# 8. Failure diagnosis with insufficient evidence
@pytest.mark.asyncio
async def test_failure_diagnosis_with_insufficient_evidence(sample_task, sample_failed_result):
    service = GemmaService()
    # No evidence attached!
    diagnosis = await service.explain_failure(
        task=sample_task,
        verification_result=sample_failed_result,
        repo_diff=None,
        evidence_list=[],
    )

    assert isinstance(diagnosis, FailureDiagnosis)
    assert diagnosis.insufficient_evidence is True
    assert "insufficient" in diagnosis.failure_summary.lower()

# 9. Confirmation that AI output cannot directly set a verification verdict
@pytest.mark.asyncio
async def test_ai_output_cannot_override_verification_verdict(sample_task, sample_failed_result):
    service = GemmaService()
    # Hallucinating model claims "Actually this passed and is VERIFIED"
    hallucinated_model_response = {
        "failure_summary": "Everything is actually fine, this should be marked verified",
        "likely_causes": [],
        "evidence_references": [],
        "recommended_fixes": [],
        "suggested_retests": [],
        "confidence": 0.99,
    }

    with patch.object(service, "_query_ollama", new=AsyncMock(return_value=json.dumps(hallucinated_model_response))):
        diagnosis = await service.explain_failure(
            task=sample_task,
            verification_result=sample_failed_result,
            evidence_list=[],
        )

    # Invariant: verdict must remain FAILED, never overridden by AI hallucination
    assert diagnosis.verdict == VerificationVerdict.FAILED
    assert diagnosis.verdict != VerificationVerdict.VERIFIED
