"""Pydantic schemas for Task management."""

from datetime import datetime
from enum import Enum
from typing import Optional, Union, List, Any
from pydantic import BaseModel, ConfigDict, Field, field_validator
from backend.app.schemas.core import AcceptanceCriterion


class TaskStatus(str, Enum):
    PLANNED = "PLANNED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Brief summary title of the task")
    description: Optional[str] = Field(default="", description="Detailed description of task objectives")
    acceptance_criteria: Optional[Union[str, List[Union[str, AcceptanceCriterion]]]] = Field(
        default=None, description="Acceptance criteria for task completion"
    )

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Task title must not be empty or whitespace only.")
        return stripped

    @field_validator("acceptance_criteria", mode="before")
    @classmethod
    def normalize_acceptance_criteria(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, list):
            items = []
            for item in v:
                if isinstance(item, AcceptanceCriterion):
                    items.append(f"[{item.id}] {item.description}")
                elif isinstance(item, dict):
                    items.append(f"[{item.get('id', 'AC')}] {item.get('description', '')}")
                else:
                    items.append(str(item).strip())
            return "\n".join(i for i in items if i)
        return str(v).strip() or None


class TaskCreate(TaskBase):
    project_id: str = Field(..., min_length=1, description="ID of the parent project")
    status: Optional[TaskStatus] = Field(default=TaskStatus.PLANNED)


class TaskResponse(TaskBase):
    id: str = Field(..., description="Unique UUID identifier for the task")
    project_id: str = Field(..., description="Parent project identifier")
    status: str = Field(default=TaskStatus.PLANNED, description="Current lifecycle status of the task")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last modification timestamp")

    model_config = ConfigDict(from_attributes=True)


class TaskStatusUpdate(BaseModel):
    """Request body for PATCH /api/tasks/{task_id}/status."""

    status: TaskStatus = Field(..., description="The target status to transition the task into.")


class TaskExecuteRequest(BaseModel):
    """Request body for POST /api/tasks/{task_id}/execute."""

    command: Optional[str] = Field(default=None, description="Optional command string")
    test_command: Optional[List[str]] = Field(default=None, description="Optional whitelisted verification command to run")
    repo_path: Optional[str] = Field(default=None, description="Target repository directory path")
    criterion_id: Optional[str] = Field(default=None, description="Optional associated acceptance criterion")
    timeout_seconds: Optional[float] = Field(default=30.0, ge=1.0, le=120.0, description="Execution timeout in seconds")


class TaskExecuteResponse(BaseModel):
    """Response body for POST /api/tasks/{task_id}/execute."""

    task_id: str
    run_id: Optional[str] = None
    status: str
    execution_mode: str
    command: Optional[Union[List[str], str]] = None
    exit_code: Optional[int] = None
    stdout: Optional[str] = None
    evidence: List[Any] = Field(default_factory=list)
    message: str

