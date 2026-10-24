# VIKASA — AI Development Intelligence & Verification Platform

> **Plan → Run → Claim → Verify → Fail → Correct → Verified**

VIKASA verifies whether an AI coding agent has actually completed a task instead of trusting its completion message.

**Critical Rule:** An AI model must never decide that a task is verified merely by claiming success. Only the deterministic verification engine issues the final verification verdict according to explicit rules, test results, exit codes, and recorded repository diffs.

---

## 1. System Architecture

```text
+--------------------------------------------------------------+
|                    VIKASA Frontend                           |
|       (Task board, execution status, evidence inspector)      |
+------------------------------+-------------------------------+
                               | HTTP / REST
+------------------------------v-------------------------------+
|                      FastAPI Backend                         |
|  +------------------------+     +-------------------------+  |
|  |     Gemma Service      |     |  Deterministic Engine   |  |
|  |  (Local Ollama gemma4) |     |  (Explicit Rule Checks) |  |
|  +------------------------+     +-------------------------+  |
|  +------------------------+     +-------------------------+  |
|  |  Antigravity Adapter   |     |    Evidence Storage     |  |
|  | (SDK / CLI / Evidence) |     |     (SQLite Audit)      |  |
|  +------------------------+     +-------------------------+  |
+--------------------------------------------------------------+
```

### Module Responsibilities & Team Boundaries

- **Member 1 (Frontend):** UI in `frontend/`, interactive task planner, execution console, verification diff viewer, and evidence badge inspector.
- **Member 2 (Gemma 4 & Antigravity):**
  - Gemma 4 (`gemma4:e4b`) integration at `backend/app/services/gemma_service.py` via local Ollama (`http://localhost:11434`).
  - Antigravity adapter at `backend/app/services/antigravity_adapter.py`.
- **Member 3 (Backend & Verification):**
  - Deterministic verification engine at `backend/app/services/verification_engine.py`.
  - Pydantic models at `backend/app/schemas/core.py`.
  - FastAPI application at `backend/app/main.py`.
  - Evidence audit logging and SQLite storage.

---

## 2. Environment Prerequisites

- **Python:** 3.11+ (verified on Python 3.13)
- **Node.js:** v18+ (verified on Node v24.18)
- **Git:** 2.x+
- **Ollama:** Running locally on `http://localhost:11434` with `gemma4:e4b` loaded.

---

## 3. Quick Start & Testing

### Backend Setup

```powershell
# Navigate to repository root
cd s:\Hacktober_NST

# Install dependencies (or use existing Python environment)
pip install -r backend/requirements.txt

# Run deterministic verification test suite
python -m pytest backend/tests/ -v

# Start FastAPI development server
uvicorn backend.app.main:app --reload --port 8000
```

### Key Endpoints

- `GET /health` — Service health check
- `GET /api/health/ollama` — Live local Ollama and `gemma4:e4b` model readiness
- `GET /api/health/antigravity` — Antigravity SDK & CLI interface status
- `POST /api/verify` — Deterministic verification evaluation
- `POST /api/plan` — Structured verification-first planning via Gemma 4

---

## 4. Verification Engine Invariants

1. **Unsubstantiated Claim Rule:** If an agent claims completion without attached evidence, verdict is `FAILED`.
2. **Command Exit Code Rule:** Any command, build, or test execution with non-zero exit code produces `FAILED`.
3. **Acceptance Criteria Coverage Rule:** Every required acceptance criterion must map to verified passing evidence.
4. **Repository Diff Rule:** If the task requires code modifications, a non-empty Git diff must be present (or verdict is `REVIEW_REQUIRED`).
5. **Contradiction Rule:** Fatal errors or tracebacks embedded in evidence flags `FAILED` regardless of claimed success.
