from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, model_validator
from datetime import datetime, timezone

class VerificationVerdict(str, Enum):
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"

class GeneratorStatus(str, Enum):
    AI_ACTIVE = "AI_ACTIVE"
    FALLBACK_ACTIVE = "FALLBACK_ACTIVE"
    AI_UNAVAILABLE = "AI_UNAVAILABLE"

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

class MappedCriterion(BaseModel):
    criterion_id: str
    description: str
    verification_method: str

class TaskPlan(BaseModel):
    task_id: str
    model_name: str = "gemma4:e4b"
    generator_status: GeneratorStatus = GeneratorStatus.AI_ACTIVE
    task_summary: str
    summary: Optional[str] = None
    steps: List[PlanStep] = Field(default_factory=list)
    acceptance_criteria: List[MappedCriterion] = Field(default_factory=list)
    files_to_inspect: List[str] = Field(default_factory=list)
    tests_to_run: List[str] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)
    verification_strategy: str = ""

    @model_validator(mode="before")
    @classmethod
    def sync_summary_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Synchronize task_summary and legacy summary field
            if "summary" in data and not data.get("task_summary"):
                data["task_summary"] = data["summary"]
            elif "task_summary" in data and not data.get("summary"):
                data["summary"] = data["task_summary"]
        return data

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

class FailureDiagnosis(BaseModel):
    task_id: str
    verdict: VerificationVerdict
    generator_status: GeneratorStatus = GeneratorStatus.AI_ACTIVE
    failure_summary: str
    likely_causes: List[str] = Field(default_factory=list)
    evidence_references: List[str] = Field(default_factory=list)
    recommended_fixes: List[str] = Field(default_factory=list)
    suggested_retests: List[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0, default=0.8)
    insufficient_evidence: bool = False
    ai_explanation: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def sync_explanation_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "failure_summary" in data and not data.get("ai_explanation"):
                data["ai_explanation"] = data["failure_summary"]
            elif "ai_explanation" in data and not data.get("failure_summary"):
                data["failure_summary"] = data["ai_explanation"]
        return data

class PlanRequest(BaseModel):
    task: Task
    repo_context: Optional[str] = None

class FailureDiagnosisRequest(BaseModel):
    task: Task
    verification_result: VerificationResult
    repo_diff: Optional[str] = None
    evidence_list: Optional[List[EvidenceItem]] = None
