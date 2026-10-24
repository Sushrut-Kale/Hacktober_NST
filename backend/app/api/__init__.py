from backend.app.api.projects import router as projects_router
from backend.app.api.tasks import router as tasks_router
from backend.app.api.evidence import router as evidence_router

__all__ = ["projects_router", "tasks_router", "evidence_router"]
