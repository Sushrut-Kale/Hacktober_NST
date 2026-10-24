# VIKASA — AI Development Intelligence & Verification Platform

> **Plan → Run → Claim → Verify → Fail → Correct → Verified**

VIKASA verifies whether an AI coding agent has actually completed a task instead of trusting its completion message.

**Critical Invariant:** An AI model must never decide that a task is verified merely by claiming success. Only the deterministic verification engine issues the final verification verdict according to explicit rules, test results, exit codes, and recorded repository diffs.

---

## 1. System Architecture

```text
+--------------------------------------------------------------+
|                    VIKASA Frontend                           |
|       (Task board, execution status, evidence inspector)     |
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
  - Gemma 4 (`gemma4:e4b`) service at `backend/app/services/gemma_service.py` via local Ollama (`http://localhost:11434`).
  - Structured task planning and evidence-grounded failure diagnosis.
  - Antigravity adapter at `backend/app/services/antigravity_adapter.py`.
- **Member 3 (Backend & Verification):**
  - Deterministic verification engine at `backend/app/services/verification_engine.py`.
  - Pydantic models at `backend/app/schemas/core.py`.
  - FastAPI application at `backend/app/main.py`.
  - Evidence audit logging and SQLite storage.

---

## 2. Environment Variables & Configuration

Configured in `backend/app/config.py` (with optional `.env` file):

| Variable | Default Value | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama service endpoint |
| `GEMMA_MODEL` | `gemma4:e4b` | Local Gemma model name |
| `OLLAMA_TIMEOUT_SECONDS` | `45.0` | Request timeout for model inference |
| `SQLITE_DB_PATH` | `vikasa.db` | Local SQLite audit database path |

---

## 3. Quick Start & Testing

### Installation

```powershell
# Navigate to repository root
cd s:\Hacktober_NST

# Install dependencies
pip install -r backend/requirements.txt
```

### Running Test Suites

```powershell
# Run all unit tests, schema tests, and live integration tests
python -m pytest backend/tests/ -v

# Run only Gemma unit tests (fast mocked tests)
python -m pytest backend/tests/test_gemma_service.py -v

# Run the live Gemma integration test (uses local Ollama instance)
python -m pytest backend/tests/test_gemma_live_integration.py -v
```

### Starting the API Server

```powershell
uvicorn backend.app.main:app --reload --port 8000
```

---

## 4. API Endpoints

### Health & Readiness

- `GET /health`
  Basic application health.
- `GET /api/health/ollama`
  Inspects local Ollama connection, loaded models, and returns generator status:
  - `status`: `"AI_ACTIVE"` or `"AI_UNAVAILABLE"`
  - `model`: `"gemma4:e4b"`
  - `model_ready`: `true` / `false`
- `GET /api/health/antigravity`
  Inspects available Antigravity interfaces (SDK, CLI, MCP).

### Task Planning (Gemma 4)

- `POST /api/plan`
  Generates a structured, verification-first development plan.
  - **Input:** `Task` or `PlanRequest(task, repo_context)`
  - **Output (`TaskPlan`):**
    ```json
    {
      "task_id": "task-001",
      "model_name": "gemma4:e4b",
      "generator_status": "AI_ACTIVE",
      "task_summary": "Summary of work",
      "steps": [
        {
          "step_number": 1,
          "action": "Implement core logic",
          "expected_outcome": "Tests pass",
          "associated_criterion_id": "AC-1"
        }
      ],
      "acceptance_criteria": [
        {
          "criterion_id": "AC-1",
          "description": "Criterion text",
          "verification_method": "pytest"
        }
      ],
      "files_to_inspect": ["backend/app/main.py"],
      "tests_to_run": ["pytest backend/tests/"],
      "risks": ["Potential edge cases"],
      "verification_strategy": "Deterministic assertions"
    }
    ```

### Deterministic Verification

- `POST /api/verify`
  Evaluates agent claims against explicit criteria, diffs, and evidence items.
  - **Output (`VerificationResult`):**
    - `verdict`: `"VERIFIED"`, `"FAILED"`, or `"REVIEW_REQUIRED"`
    - `confidence_score`: float
    - `rule_evaluations`: list of rule checks

### Evidence-Grounded Failure Diagnosis

- `POST /api/diagnosis` (or `/api/explain-failure`)
  Analyzes verification failures and suggests evidence-grounded corrections without changing the verdict.
  - **Input (`FailureDiagnosisRequest`):**
    - `task`: Task object
    - `verification_result`: VerificationResult object
    - `repo_diff`: Optional git diff string
    - `evidence_list`: Optional list of EvidenceItems
  - **Output (`FailureDiagnosis`):**
    ```json
    {
      "task_id": "task-001",
      "verdict": "FAILED",
      "generator_status": "AI_ACTIVE",
      "failure_summary": "Clear summary of failure observed in evidence",
      "likely_causes": ["Cause 1 based on test failure logs"],
      "evidence_references": ["[TEST_OUTPUT] exit_code=1 snippet='AssertionError'"],
      "recommended_fixes": ["Concrete fix steps to implement"],
      "suggested_retests": ["python -m pytest backend/tests/test_feature.py"],
      "confidence": 0.85,
      "insufficient_evidence": false
    }
    ```

---

## 5. Verification Engine Invariants

1. **Unsubstantiated Claim Rule:** If an agent claims completion without attached evidence, verdict is `FAILED`.
2. **Command Exit Code Rule:** Any command, build, or test execution with non-zero exit code produces `FAILED`.
3. **Acceptance Criteria Coverage Rule:** Every required acceptance criterion must map to verified passing evidence.
4. **Repository Diff Rule:** If the task requires code modifications, a non-empty Git diff must be present (or verdict is `REVIEW_REQUIRED`).
5. **Contradiction Rule:** Fatal errors or tracebacks embedded in evidence flags `FAILED` regardless of claimed success.
6. **AI Verdict Authority Rule:** AI failure explanations and plans can **never** override a deterministic verification verdict.
