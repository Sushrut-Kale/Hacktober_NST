"""SQLAlchemy ORM model for Verification Records."""

from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, Float, Integer, Boolean
from sqlalchemy.orm import relationship
from backend.app.db.database import Base


class VerificationRecord(Base):
    """Database representation of an empirical verification finding."""

    __tablename__ = "verification_records"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    task_id = Column(
        String(36),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    agent_name = Column(String(255), nullable=False)
    claimed_success = Column(Boolean, nullable=False, default=False)
    claim_statement = Column(Text, nullable=True)
    verdict = Column(String(50), nullable=False)
    confidence_score = Column(Float, nullable=False, default=0.0)
    discrepancies = Column(Text, nullable=True)
    raw_evidence_count = Column(Integer, nullable=False, default=0)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    task = relationship("TaskRecord", back_populates="verifications")

    def __repr__(self) -> str:
        return f"<VerificationRecord(id='{self.id}', task_id='{self.task_id}', verdict='{self.verdict}')>"
