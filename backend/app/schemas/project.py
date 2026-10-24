"""Pydantic schemas for Project management."""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class AnalysisStatus(str, Enum):
    PENDING = "PENDING"
    ANALYZING = "ANALYZING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Display name of the project")
    root_path: str = Field(..., min_length=1, max_length=1024, description="Local filesystem root directory path")
    repository_url: Optional[str] = Field(None, max_length=1024, description="Optional remote Git repository URL")

    @field_validator("name", "root_path")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Field must not be empty or whitespace only.")
        return stripped


class ProjectCreate(ProjectBase):
    pass


class ProjectResponse(ProjectBase):
    id: str = Field(..., description="Unique UUID identifier for the project")
    analysis_status: AnalysisStatus = Field(default=AnalysisStatus.PENDING)
    created_at: datetime = Field(..., description="Timestamp when the project was created")

    model_config = ConfigDict(from_attributes=True)
