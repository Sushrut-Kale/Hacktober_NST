import os
from typing import List
from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "VIKASA API"
    app_version: str = "1.0.0"
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    gemma_model: str = os.getenv("GEMMA_MODEL", "gemma4:e4b")
    ollama_timeout_seconds: float = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "45.0"))
    sqlite_db_path: str = os.getenv("SQLITE_DB_PATH", "vikasa.db")

    # Integrated database settings
    database_url: str = os.getenv(
        "DATABASE_URL", f"sqlite:///./{os.getenv('SQLITE_DB_PATH', 'vikasa.db')}"
    )
    api_v1_prefix: str = "/api"
    debug: bool = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")

    # CORS settings
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @property
    def allowed_origins(self) -> List[str]:
        env_cors = os.getenv("CORS_ORIGINS")
        if env_cors:
            return [o.strip() for o in env_cors.split(",") if o.strip()]
        return self.cors_origins


settings = Settings()
