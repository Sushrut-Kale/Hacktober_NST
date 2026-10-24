"""Database initialization utilities."""

import logging
from backend.app.db.database import Base, engine
import backend.app.models  # noqa: F401

logger = logging.getLogger("vikasa.db")


def init_db() -> None:
    """Create all registered database tables."""
    logger.info("Initializing VIKASA database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")
