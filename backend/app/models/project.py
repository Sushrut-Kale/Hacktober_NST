"""SQLAlchemy ORM model for Projects."""

from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, DateTime, String, Text
from sqlalchemy.orm import relationship
from backend.app.db.database import Base


class Project(Base):
    """Database representation of a software project registered with VIKASA."""

    __tablename__ = "projects"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    name = Column(String(255), nullable=False)
    root_path = Column(String(1024), nullable=False, default=".")
    repository_url = Column(String(1024), nullable=True)
    source_type = Column(String(50), nullable=False, default="GIT")  # "GIT" | "IDEA" | "FOLDER"
    description = Column(Text, nullable=True)
    idea_prompt = Column(Text, nullable=True)
    target_branch = Column(String(255), nullable=True, default="main")
    analysis_status = Column(String(50), nullable=False, default="PENDING")  # PENDING | ANALYZING | COMPLETED | FAILED
    
    # Structured JSON fields for project intelligence
    tech_stack = Column(Text, nullable=True)               # Detected & recommended languages, frameworks, tools
    architecture = Column(Text, nullable=True)             # Discovered/proposed architecture nodes & edges
    claimed_features = Column(Text, nullable=True)         # Claim vs Reality feature list with evidence & status
    clarification_questions = Column(Text, nullable=True)  # Q&A clarification records & inferred assumptions
    documentation = Column(Text, nullable=True)            # Project summary, API overview, setup, testing guides
    scan_history = Column(Text, nullable=True)             # Historical scan records

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=True,
    )

    tasks = relationship(
        "TaskRecord",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="TaskRecord.created_at.desc()",
    )

    def __repr__(self) -> str:
        return f"<Project(id='{self.id}', name='{self.name}', status='{self.analysis_status}', source='{self.source_type}')>"
