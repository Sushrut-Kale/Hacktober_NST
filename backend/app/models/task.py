"""SQLAlchemy ORM model for Tasks."""

from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship
from backend.app.db.database import Base


class TaskRecord(Base):
    """Database representation of an engineering task within a project."""

    __tablename__ = "tasks"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    project_id = Column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    acceptance_criteria = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="PLANNED")
    state = Column(String(50), nullable=False, default="CREATED")
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    project = relationship("Project", back_populates="tasks")
    verifications = relationship(
        "VerificationRecord",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="VerificationRecord.created_at.desc()",
    )

    def __repr__(self) -> str:
        return f"<TaskRecord(id='{self.id}', project_id='{self.project_id}', title='{self.title}')>"
