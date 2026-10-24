from enum import Enum
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, timezone


class VerificationVerdict(str, Enum):
    """
    Verification outcomes distinguishing conclusive results from execution or evidence gaps.
    - PASS: All required configured checks passed.
    - FAIL: A required check established a failure.
    - NOT_RUN: Required checks have not been executed.
    - BLOCKED: An environment or dependency prevented verification.
    - UNKNOWN: Evidence is insufficient to determine the outcome.
    """
    PASS = "PASS"
    FAIL = "FAIL"
    NOT_RUN = "NOT_RUN"
    BLOCKED = "BLOCKED"
    UNKNOWN = "UNKNOWN"

    # Compatibility aliases for legacy checks
    VERIFIED = "PASS"
    FAILED = "FAIL"
    REVIEW_REQUIRED = "UNKNOWN"


class EvidenceType(str, Enum):
    TEST_OUTPUT = "TEST_OUTPUT"
    GIT_DIFF = "GIT_DIFF"
    COMMAND_EXIT_CODE = "COMMAND_EXIT_CODE"
    FILE_CONTENT = "FILE_CONTENT"
    LOG_OUTPUT = "LOG_OUTPUT"


class AcceptanceCriterion(BaseModel):
    id: str
    description: str
    required: bool = True


class Task(BaseModel):
    id: str
    title: str
    description: Optional[str] = ""
    acceptance_criteria: List[AcceptanceCriterion] = Field(default_factory=list)
    project_id: Optional[str] = None
    status: Optional[str] = "PLANNED"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("acceptance_criteria", mode="before")
    @classmethod
    def normalize_acceptance_criteria(cls, v: Any) -> List[Any]:
        if v is None:
            return []
        if isinstance(v, str):
            return [AcceptanceCriterion(id="AC-1", description=v.strip())]
        if isinstance(v, list):
            normalized = []
            for idx, item in enumerate(v):
                if isinstance(item, str):
                    normalized.append(AcceptanceCriterion(id=f"AC-{idx + 1}", description=item.strip()))
                elif isinstance(item, dict):
                    normalized.append(item)
                else:
                    normalized.append(item)
            return normalized
        return v


class PlanStep(BaseModel):
    step_number: int
    action: str
    expected_outcome: str
    associated_criterion_id: Optional[str] = None


class TaskPlan(BaseModel):
    task_id: str
    model_name: str = "gemma4:e4b"
    summary: str
    steps: List[PlanStep]
    verification_strategy: str


class EvidenceItem(BaseModel):
    criterion_id: Optional[str] = None
    evidence_type: EvidenceType
    content: Optional[str] = ""
    exit_code: Optional[int] = None
    file_path: Optional[str] = None
    passed: Optional[bool] = None


class ExecutionClaim(BaseModel):
    task_id: str
    agent_name: str
    claimed_success: bool
    statement: str
    git_diff: Optional[str] = None
    evidence_list: List[EvidenceItem] = Field(default_factory=list)


class RuleEvaluation(BaseModel):
    rule_name: str
    passed: bool
    verdict_impact: VerificationVerdict
    message: str
    criterion_id: Optional[str] = None


class VerificationResult(BaseModel):
    task_id: str
    verdict: VerificationVerdict
    confidence_score: float = Field(ge=0.0, le=1.0)
    rule_evaluations: List[RuleEvaluation]
    summary: str
    verified_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    raw_evidence_count: int


class ClaimVsRealityReport(BaseModel):
    task_id: str
    original_task: Task
    agent_claim: ExecutionClaim
    verification_result: VerificationResult
    verdict: VerificationVerdict
    claim_verified: bool
    discrepancies: List[str] = Field(default_factory=list)
    evidence_summary: Dict[str, Any] = Field(default_factory=dict)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EvidenceCollectionRequest(BaseModel):
    repo_path: str
    criterion_id: Optional[str] = None
    test_command: Optional[List[str]] = None
    timeout_seconds: Optional[float] = 30.0
