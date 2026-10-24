from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime, timezone

class VerificationVerdict(str, Enum):
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"

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
    description: str
    acceptance_criteria: List[AcceptanceCriterion]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    content: str
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
