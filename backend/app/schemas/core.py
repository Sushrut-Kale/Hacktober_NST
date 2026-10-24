from enum import Enum
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import datetime, timezone

class TaskState(str, Enum):
    CREATED = "CREATED"
    PLANNED = "PLANNED"
    APPROVED = "APPROVED"
    RUNNING = "RUNNING"
    VERIFYING = "VERIFYING"
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    BLOCKED = "BLOCKED"
    NOT_RUN = "NOT_RUN"


class VerificationVerdict(str, Enum):
    """
    Verification outcomes distinguishing conclusive results from execution or evidence gaps.
    - VERIFIED / PASS: All required configured checks passed.
    - FAILED / FAIL: A required check established a failure.
    - NOT_RUN: Required checks have not been executed.
    - BLOCKED: An environment or dependency prevented verification.
    - REVIEW_REQUIRED / UNKNOWN: Evidence is insufficient to determine the outcome.
    """
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    NOT_RUN = "NOT_RUN"
    BLOCKED = "BLOCKED"

    # Semantic aliases for verdict compatibility
    PASS = "VERIFIED"
    FAIL = "FAILED"
    UNKNOWN = "REVIEW_REQUIRED"



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
    description: Optional[str] = ""
    acceptance_criteria: List[AcceptanceCriterion] = Field(default_factory=list)
    state: TaskState = TaskState.CREATED
    project_id: Optional[str] = "default"
    workspace_path: Optional[str] = None
    status: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approved_at: Optional[datetime] = None

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="before")
    @classmethod
    def sync_summary_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
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
    run_id: Optional[str] = None


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
    run_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="before")
    @classmethod
    def sync_explanation_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "failure_summary" in data and not data.get("ai_explanation"):
                data["ai_explanation"] = data["failure_summary"]
            elif "ai_explanation" in data and not data.get("failure_summary"):
                data["failure_summary"] = data["ai_explanation"]
        return data

class ExecutionRun(BaseModel):
    run_id: str
    task_id: str
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    status: str = "COMPLETED"
    command: str
    exit_code: Optional[int] = None
    stdout: str = ""
    stderr: str = ""
    source: str = "LOCAL_EXECUTION_RUNNER"
    git_diff: Optional[str] = None
    evidence_items: List[EvidenceItem] = Field(default_factory=list)

class ExecutionEvent(BaseModel):
    id: Optional[int] = None
    task_id: str
    run_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    event_type: str
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)

class RunReport(BaseModel):
    run: ExecutionRun
    task: Task
    verification: Optional[VerificationResult] = None
    diagnosis: Optional[FailureDiagnosis] = None
    events: List[ExecutionEvent] = Field(default_factory=list)

class TaskDetail(BaseModel):
    task: Task
    plan: Optional[TaskPlan] = None
    latest_run: Optional[ExecutionRun] = None
    latest_verification: Optional[VerificationResult] = None
    latest_diagnosis: Optional[FailureDiagnosis] = None
    events: List[ExecutionEvent] = Field(default_factory=list)

    # Flat task attributes for backward compatibility with shallow task consumers
    id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    project_id: Optional[str] = None
    state: Optional[TaskState] = None
    acceptance_criteria: List[AcceptanceCriterion] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def populate_flat_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            task = data.get("task")
            if task:
                task_dict = task.model_dump() if hasattr(task, "model_dump") else (task if isinstance(task, dict) else task.__dict__)
                for key in ["id", "title", "description", "status", "project_id", "state", "acceptance_criteria"]:
                    if key not in data or data[key] is None:
                        val = task_dict.get(key)
                        if key == "status" and not val:
                            st = task_dict.get("state")
                            st_val = st.value if hasattr(st, "value") else str(st) if st else "PLANNED"
                            if st_val in ("CREATED", "PLANNED", "APPROVED"):
                                val = "PLANNED"
                            elif st_val in ("RUNNING", "VERIFYING"):
                                val = "IN_PROGRESS"
                            elif st_val == "VERIFIED":
                                val = "COMPLETED"
                            elif st_val in ("FAILED", "REVIEW_REQUIRED", "BLOCKED"):
                                val = "FAILED"
                            else:
                                val = "PLANNED"
                        data[key] = val
        return data



class PlanRequest(BaseModel):
    task: Task
    repo_context: Optional[str] = None

class FailureDiagnosisRequest(BaseModel):
    task: Task
    verification_result: VerificationResult
    repo_diff: Optional[str] = None
    evidence_list: Optional[List[EvidenceItem]] = None

class TaskCreateRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    acceptance_criteria: Union[List[AcceptanceCriterion], str, List[Any]] = Field(default_factory=list)
    id: Optional[str] = None
    workspace_path: Optional[str] = None
    project_id: Optional[str] = "default"

    @field_validator("acceptance_criteria", mode="before")
    @classmethod
    def normalize_criteria(cls, v: Any) -> List[AcceptanceCriterion]:
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
                    normalized.append(AcceptanceCriterion(**item))
                elif isinstance(item, AcceptanceCriterion):
                    normalized.append(item)
                else:
                    normalized.append(item)
            return normalized
        return v


class TaskApproveRequest(BaseModel):
    approved_by: str = "USER"
    notes: Optional[str] = None

class TaskExecuteRequest(BaseModel):
    command: str
    criterion_id: Optional[str] = None
    timeout_seconds: Optional[float] = 30.0


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

