import os
from pydantic import BaseModel

class Settings(BaseModel):
    app_name: str = "VIKASA API"
    app_version: str = "0.1.0"
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    gemma_model: str = os.getenv("GEMMA_MODEL", "gemma4:e4b")
    ollama_timeout_seconds: float = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "45.0"))
    sqlite_db_path: str = os.getenv("SQLITE_DB_PATH", "vikasa.db")

settings = Settings()
