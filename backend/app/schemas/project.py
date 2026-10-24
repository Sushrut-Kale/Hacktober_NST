"""Pydantic schemas for Project management and Project Intelligence."""

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field, field_validator


class AnalysisStatus(str, Enum):
    PENDING = "PENDING"
    ANALYZING = "ANALYZING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class SourceType(str, Enum):
    GIT = "GIT"
    IDEA = "IDEA"
    FOLDER = "FOLDER"


class FeatureStatus(str, Enum):
    PRESENT = "PRESENT"          # Verified / Present in code + tests (Green)
    MISSING = "MISSING"          # Claimed in README/spec, but absent from code (Red)
    PARTIAL = "PARTIAL"          # Partial code / symbol exists, but incomplete (Amber)
    UNVERIFIED = "UNVERIFIED"    # Implementation file exists, but behavior unverified (Gray)
    FAILED = "FAILED"            # Relevant deterministic test failed (Red)


class FeatureFinding(BaseModel):
    id: str
    name: str
    category: str = "General"
    claim_source: str = "README.md"
    status: FeatureStatus = FeatureStatus.UNVERIFIED
    confidence: float = 0.8
    evidence_type: str = "FILE_SYMBOL"  # FILE_SYMBOL | TEST_FILE | ROUTE | CONFIG
    file_path: Optional[str] = None
    line_range: Optional[str] = None
    symbol: Optional[str] = None
    test_name: Optional[str] = None
    test_result: Optional[str] = None
    reason: str
    suggested_action: Optional[str] = None
    criterion_id: Optional[str] = None


class ArchitectureNode(BaseModel):
    id: str
    name: str
    type: str  # UI | Backend | API | Database | Service | External | Cache
    technology: str
    description: str
    is_proposed: bool = False


class ArchitectureEdge(BaseModel):
    source: str
    target: str
    label: str
    protocol: Optional[str] = "HTTP"
    is_proposed: bool = False


class ArchitectureSpec(BaseModel):
    summary: str
    components: List[ArchitectureNode] = Field(default_factory=list)
    relationships: List[ArchitectureEdge] = Field(default_factory=list)


class TechStackItem(BaseModel):
    name: str
    category: str  # Language | Framework | Database | Testing | DevOps | Tool
    version: Optional[str] = None
    detected_in: Optional[str] = None
    is_recommendation: bool = False
    usage_notes: Optional[str] = None


class ClarificationQuestion(BaseModel):
    id: str
    question: str
    rationale: str
    options: List[str] = Field(default_factory=list)
    selected_answer: Optional[str] = None
    is_inferred: bool = False


class ProjectDocumentation(BaseModel):
    summary: str = ""
    requirements: List[str] = Field(default_factory=list)
    architecture_overview: str = ""
    api_overview: str = ""
    database_overview: str = ""
    setup_guide: str = ""
    testing_guide: str = ""
    risks_and_limitations: List[str] = Field(default_factory=list)


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Display name of the project")
    root_path: Optional[str] = Field(".", max_length=1024, description="Local filesystem root directory path")
    repository_url: Optional[str] = Field(None, max_length=1024, description="Optional remote Git repository URL")
    source_type: SourceType = Field(default=SourceType.GIT)
    description: Optional[str] = Field(None, description="Optional project description")
    idea_prompt: Optional[str] = Field(None, description="Problem statement or initial idea prompt")
    target_branch: Optional[str] = Field("main", max_length=255, description="Target Git branch")

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Project name must not be empty or whitespace only.")
        return stripped


class ProjectCreate(ProjectBase):
    git_url: Optional[str] = None
    repo_path: Optional[str] = None
    language: Optional[str] = None
    framework: Optional[str] = None

    @field_validator("repository_url", mode="before")
    @classmethod
    def sync_git_url(cls, v: Any, info: Any) -> Any:
        return v


class ProjectResponse(ProjectBase):
    id: str = Field(..., description="Unique UUID identifier for the project")
    analysis_status: AnalysisStatus = Field(default=AnalysisStatus.PENDING)
    created_at: datetime = Field(..., description="Timestamp when the project was created")
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProjectDetailResponse(ProjectResponse):
    tech_stack: Optional[Dict[str, Any]] = None
    architecture: Optional[Dict[str, Any]] = None
    claimed_features: List[FeatureFinding] = Field(default_factory=list)
    clarification_questions: List[ClarificationQuestion] = Field(default_factory=list)
    documentation: Optional[Dict[str, Any]] = None
    scan_history: List[Dict[str, Any]] = Field(default_factory=list)
    feature_counts: Dict[str, int] = Field(default_factory=dict)
    linked_task_count: int = 0


class ClarificationAnswerRequest(BaseModel):
    answers: Dict[str, str]  # question_id -> answer_text


class SkipQuestionsRequest(BaseModel):
    use_defaults: bool = True
