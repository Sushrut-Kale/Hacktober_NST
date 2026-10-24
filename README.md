# VIKASA — AI Development Intelligence & Verification Platform

> **Plan → Approve → Execute → Record Evidence → Verify → Diagnose → Correct → Re-verify**

VIKASA verifies whether an AI coding agent has actually completed a task instead of trusting its completion message.

**Critical Invariant:** An AI model must never decide that a task is verified merely by claiming success. Only the deterministic verification engine issues the final verification verdict according to explicit rules, test results, exit codes, and recorded repository diffs.

---

## 1. System Architecture

```text
+-------------------------------------------------------------------------+
|                           VIKASA Frontend                               |
|        (Task board, approval gate, evidence inspector, run reports)     |
+------------------------------------+------------------------------------+
                                     | HTTP / REST
+------------------------------------v------------------------------------+
|                             FastAPI Backend                             |
|  +----------------------------+     +--------------------------------+  |
|  |       Workflow Engine      |     |  Deterministic Verification    |  |
|  | (Lifecycle state machine)  |     |     (Rule-based evaluation)    |  |
|  +----------------------------+     +--------------------------------+  |
|  +----------------------------+     +--------------------------------+  |
|  |        Gemma Service       |     |      Safe Execution Runner     |  |
|  |   (Planning & Diagnosis)   |     |    (Allowlisted sandbox & diff)|  |
|  +----------------------------+     +--------------------------------+  |
|  +-------------------------------------------------------------------+  |
|  |                 SQLite Database Repository                        |  |
|  |  (Tasks, Plans, Runs, Evidence, Verifications, Diagnoses, Events) |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

### Module Responsibilities & Team Boundaries

- **Member 1 (Frontend):** UI in `frontend/`, interactive task board, plan review & approval modal, execution console, diff viewer, and evidence badge inspector.
- **Member 2 (Gemma 4 & Antigravity):**
  - Gemma 4 (`gemma4:e4b`) service in [gemma_service.py](file:///s:/Hacktober_NST/backend/app/services/gemma_service.py) via local Ollama.
  - Antigravity interface adapter in [antigravity_adapter.py](file:///s:/Hacktober_NST/backend/app/services/antigravity_adapter.py).
- **Member 3 (Backend, Storage & Deterministic Verification):**
  - SQLite persistent repository in [repository.py](file:///s:/Hacktober_NST/backend/app/db/repository.py).
  - Safe execution runner in [safe_runner.py](file:///s:/Hacktober_NST/backend/app/services/safe_runner.py).
  - Lifecycle workflow orchestrator in [workflow_service.py](file:///s:/Hacktober_NST/backend/app/services/workflow_service.py).
  - Deterministic verification engine in [verification_engine.py](file:///s:/Hacktober_NST/backend/app/services/verification_engine.py).

---

## 2. Task Lifecycle State Machine

Tasks transition strictly through the following state machine:

```text
       [CREATED]
           │
           │ generate_plan()
           ▼
       [PLANNED]
           │
           │ approve_plan() (Explicit human approval required)
           ▼
       [APPROVED]
           │
           │ execute_task() (Safe allowlisted execution)
           ▼
        [RUNNING]
           │
           │ execution completes & captures evidence
           ▼
       [VERIFYING]
           │
           │ verify_task() (Deterministic verification engine)
           ├───────────────────────────────┬──────────────────────────────┐
           ▼                               ▼                              ▼
      [VERIFIED]                        [FAILED]                  [REVIEW_REQUIRED]
  (All criteria pass)              (Check violated)           (Incomplete / ambiguous)
                                           │                              │
                                           │ Gemma failure diagnosis      │
                                           │ + controlled code correction │
                                           ▼                              ▼
                                     [APPROVED]                     [APPROVED]
                                   (Re-execute)                   (Re-execute)
```

---

## 3. Database Schema (SQLite)

Located at the path specified by `SQLITE_DB_PATH` (default `vikasa.db`):

- `tasks`: Core task attributes, project ID, state, acceptance criteria, workspace path, timestamps (`created_at`, `updated_at`, `approved_at`).
- `plans`: Generated task plans, model name, generator status (`AI_ACTIVE` / `FALLBACK_ACTIVE`), steps, criteria mappings, files, tests, risks.
- `execution_runs`: Execution runs, commands, exit codes, captured stdout/stderr, git diffs, run status.
- `evidence_records`: Discrete evidence records linked to criteria and runs (types: `COMMAND_EXIT_CODE`, `TEST_OUTPUT`, `GIT_DIFF`).
- `verifications`: Deterministic verification results, verdicts (`VERIFIED`, `FAILED`, `REVIEW_REQUIRED`), confidence scores, rule evaluations.
- `diagnoses`: AI failure diagnoses, failure summaries, likely causes, evidence references, recommended fixes, retests.
- `execution_events`: Chronological audit log of all lifecycle events.

---

## 4. Execution Safety Invariants

1. **Explicit Approval Gate:** A task **cannot** execute in `CREATED` or `PLANNED` state. Explicit approval (`POST /api/tasks/{task_id}/approve`) is mandatory.
2. **Command Allowlisting:** Only safe, allowlisted tools may be run: `python`, `pytest`, `git`. Arbitrary shell commands are rejected.
3. **Shell Injection Prevention:** Dangerous shell metacharacters and operators (`&&`, `||`, `|`, `>`, `<`, `` ` ``, `$()`, unquoted `;`) are strictly rejected.
4. **Workspace Containment:** Commands and diffs are strictly confined to the approved workspace path.
5. **Deterministic Verdict Authority:** AI explanations and model completion claims can **never** alter or override a verification verdict.

---

## 5. API Reference

### Task Lifecycle Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/tasks` | Create a new task with acceptance criteria (State: `CREATED`). |
| `GET` | `/api/tasks` | List all persisted tasks. |
| `GET` | `/api/tasks/{task_id}` | Retrieve task detail with plan, latest run, verification, and diagnosis. |
| `POST` | `/api/tasks/{task_id}/plan` | Generate and persist Gemma task plan (Advances to `PLANNED`). |
| `POST` | `/api/tasks/{task_id}/approve` | Explicitly approve the plan (Advances to `APPROVED`). |
| `POST` | `/api/tasks/{task_id}/execute` | Run an allowlisted command and record evidence (Advances to `VERIFYING`). |
| `GET` | `/api/tasks/{task_id}/events` | Retrieve audit event timeline for the task. |
| `POST` | `/api/tasks/{task_id}/verify` | Run deterministic verification; triggers diagnosis on failure. |
| `GET` | `/api/tasks/{task_id}/verification` | Retrieve latest deterministic verification result. |
| `GET` | `/api/runs/{run_id}` | Inspect a specific execution run. |
| `GET` | `/api/runs/{run_id}/report` | Evidence-backed execution run report. |

### Diagnostic & Stateless Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Basic application health check. |
| `GET` | `/api/health/ollama` | Local Ollama connection status and loaded models. |
| `GET` | `/api/health/antigravity` | Antigravity SDK and CLI integration status. |
| `POST` | `/api/verify` | Stateless deterministic verification evaluation. |
| `POST` | `/api/plan` | Stateless Gemma task planning. |
| `POST` | `/api/diagnosis` | Stateless failure diagnosis. |

---

## 6. Running Tests & Demonstration

```powershell
# Run the entire test suite (37 tests across 8 test suites)
python -m pytest backend/tests/ -v

# Run the end-to-end demonstration scenario
python -m pytest backend/tests/test_e2e_workflow_demo.py -v -s

# Run unit tests only (fast)
python -m pytest backend/tests/test_database.py backend/tests/test_safe_runner.py backend/tests/test_workflow.py -v
```
