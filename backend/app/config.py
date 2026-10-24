import os
from typing import List, Union
from pydantic import BaseModel, Field


class Settings(BaseModel):
    app_name: str = "VIKASA API"
    app_version: str = "0.1.0"
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    gemma_model: str = os.getenv("GEMMA_MODEL", "gemma4:e4b")
    ollama_timeout_seconds: float = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "45.0"))
    sqlite_db_path: str = os.getenv("SQLITE_DB_PATH", "vikasa.db")

    # Integrated database settings
    database_url: str = os.getenv(
        "DATABASE_URL", f"sqlite:///./{os.getenv('SQLITE_DB_PATH', 'vikasa.db')}"
    )
    api_v1_prefix: str = "/api"
    debug: bool = os.getenv("DEBUG", "true").lower() in ("true", "1", "yes")

    # CORS settings
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


settings = Settings()
