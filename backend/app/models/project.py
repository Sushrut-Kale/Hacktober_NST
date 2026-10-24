"""SQLAlchemy ORM model for Projects."""

from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, DateTime, String
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
    root_path = Column(String(1024), nullable=False)
    repository_url = Column(String(1024), nullable=True)
    analysis_status = Column(String(50), nullable=False, default="PENDING")
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    tasks = relationship(
        "TaskRecord",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="TaskRecord.created_at.desc()",
    )

    def __repr__(self) -> str:
        return f"<Project(id='{self.id}', name='{self.name}', status='{self.analysis_status}')>"
