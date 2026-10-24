# VIKASA — Backend Hardening & Reliability Report

## 1. Executive Summary

During the Backend Audit, Hardening & Reliability Phase, the VIKASA backend was audited, fortified, and validated against its core architectural invariant:
> **"AI proposes and diagnoses. Humans approve. Deterministic verification decides the verdict."**

Every frontend-consumed backend endpoint was verified and preserved without breaking API contracts. All confirmed defects from the audit were remediated, hardened, and verified through regression tests.

- **Initial Test Baseline:** 181 passed, 0 failed in 81.19s (Exit Code: 0)
- **Final Hardened Test Suite:** **188 passed, 0 failed in 84.44s** (`pytest backend/tests/ -v`, Exit Code: 0)
- **Frontend Production Build:** **Compiled successfully (Exit Code: 0)** across all 16 static/dynamic routes (`npm --prefix frontend run build`).

---

## 2. Hardening Measures Implemented

### Phase 1 — Database Consistency & Relational Integrity
- **Defect Addressed:** SQLite disables foreign key enforcement by default. Concurrent writes across SQLAlchemy (`vikasa.db`) and `DatabaseRepository` (`sqlite3`) could allow orphaned child records (plans, execution runs, evidence, verifications) without enforcing parent relationships.
- **Remediation:**
  1. `backend/app/db/database.py`: Attached an `@event.listens_for(engine, "connect")` listener executing `PRAGMA foreign_keys=ON;` on every SQLite connection established by SQLAlchemy.
  2. `backend/app/db/repository.py`: Configured `_get_connection()` to execute `PRAGMA foreign_keys = ON;` immediately upon opening connections.
  3. `backend/tests/test_database.py`: Hardened test fixtures to ensure parent `Task` records are saved before child `TaskPlan`, `ExecutionRun`, and `VerificationResult` records, validating strict relational integrity.

### Phase 2 — Task Lifecycle & Approval Synchronization
- **Defect Addressed:** In `backend/app/main.py`, `approve_task_plan` set `rec.status = "PENDING_APPROVAL"` instead of transitioning to `"APPROVED"`, causing an out-of-sync state between SQLAlchemy's `TaskRecord` and `DatabaseRepository`'s `TaskState.APPROVED`.
- **Remediation:**
  1. Added `"APPROVED"` to `ALLOWED_TRANSITIONS` in `backend/app/main.py`:
     ```python
     "APPROVED": ["IN_PROGRESS", "CANCELLED", "FAILED"]
     ```
  2. Updated `approve_task_plan` to set `rec.status = "APPROVED"` upon plan approval, synchronizing state with `TaskState.APPROVED`.
  3. Verified that `/api/tasks/{task_id}/execute` checks approval before allowing execution and leaves task state in `IN_PROGRESS` until deterministic verification runs.

### Phase 3 — Safe Execution Runner Security
- **Defect Addressed:** Command strings were not screened for null bytes (`\0`), process execution inherited all host environment variables (potentially leaking sensitive developer API keys/tokens), and subprocess output was uncapped (creating potential memory exhaustion risks on high-volume logs).
- **Remediation:**
  1. **Null Byte Validation:** In `SafeExecutionRunner.validate_command`, added:
     ```python
     if command and "\0" in command:
         raise ValueError("Command contains invalid null bytes.")
     ```
  2. **Environment Variable Sanitization:** Implemented `_get_sanitized_environment()` in both `SafeExecutionRunner` and `EvidenceCollector`. The runner strips sensitive environment variables containing `KEY`, `SECRET`, `TOKEN`, `PASSWORD`, `AUTH`, `CREDENTIAL`, or `PRIVATE` before invoking `subprocess.run`.
  3. **Output Capping:** Implemented `_cap_output(output, max_bytes=512*1024)` in `SafeExecutionRunner` and `EvidenceCollector`. Process output exceeding 512 KB is cleanly truncated with an honest attribution marker:
     `\n\n[TRUNCATED: Output exceeded 524288 bytes. Remaining content trimmed for stability.]`

### Phase 4 & 5 — Deterministic Verification Engine & Evidence Provenance
- **Audit Findings:** Verified that the verification engine (`backend/app/services/verification_engine.py` and `rule_engine.py`) determines verdicts purely from deterministic rules (exit codes, test results, git diffs, acceptance criteria mapping). AI claims are treated strictly as untrusted hypotheses.
- **Evidence Provenance:** Verified that evidence records attribute the originating execution run (`run_id`), task (`task_id`), command exit code, and stdout. Missing evidence cannot produce a `PASS` verdict.

### Phase 6 — Gemma / Local AI Resilience & Fallback
- **Audit Findings:** Configured for `gemma4:e4b` on Ollama (`http://localhost:11434`).
- **Resilience Verified:** Tested across Ollama unavailability, JSON parsing failures, schema validation mismatches, and request timeouts. In all failure cases, `GemmaService` cleanly falls back to deterministic rule-based planning (`FALLBACK_ACTIVE`) without crashing the API or falsifying model output.

### Phase 7 — Antigravity Integration & Truth-in-Reporting
- **Defect Addressed:** Local safe runner subprocess executions in `main.py` conditionally claimed `execution_mode = "ANTIGRAVITY_AGENT"` if the Antigravity CLI binary was found in `PATH`.
- **Remediation:**
  1. Updated `backend/app/main.py` execution route to assign:
     ```python
     execution_mode = "LOCAL_SAFE_RUNNER"
     ```
     This ensures local subprocess runs are never dishonestly labeled as Antigravity agent dispatches.
  2. Verified that `AntigravityAdapter.inspect_capabilities()` honestly reports `NEEDS_INSTALLATION` when the CLI or Python SDK is not installed on the host machine.

---

## 3. Endpoint Contract Inventory

The following 23 frontend-consumed routes were audited and verified. All existing URL paths, query parameters, request schemas, and response schemas remain fully intact.

| Method | Endpoint | Primary Handler | Status / Contract Preserved |
|---|---|---|---|
| `GET` | `/api/health` | `main.py:health_check` | Returns `{ status, timestamp, service }` |
| `GET` | `/api/health/ollama` | `main.py:ollama_health` | Returns `{ status, model, available }` |
| `GET` | `/api/health/antigravity` | `main.py:antigravity_health` | Returns honest capability map (`NEEDS_INSTALLATION`) |
| `GET` | `/api/projects` | `api/projects.py:list_projects` | Returns list of project summaries with metrics |
| `POST` | `/api/projects` | `api/projects.py:create_project` | Ingests Git repos or local workspace paths |
| `GET` | `/api/projects/{id}` | `api/projects.py:get_project` | Returns detailed project metadata and dashboard counts |
| `GET` | `/api/projects/{id}/tasks` | `main.py:list_project_tasks` | Scoped task listing by project ID |
| `GET` | `/api/tasks` | `main.py:list_tasks` | Global task listing |
| `POST` | `/api/tasks` | `main.py:create_task` | Creates task with acceptance criteria |
| `GET` | `/api/tasks/{id}` | `main.py:get_task` | Returns task details with plan, runs, and verifications |
| `POST` | `/api/tasks/{id}/plan` | `main.py:plan_task` | Generates structured plan (Gemma or fallback) |
| `POST` | `/api/tasks/{id}/approve` | `main.py:approve_task_plan` | Transitions task to `APPROVED` |
| `POST` | `/api/tasks/{id}/execute` | `main.py:execute_task_route` | Executes allowlisted command in safe runner |
| `POST` | `/api/tasks/{id}/verify` | `main.py:verify_task_route` | Authoritative deterministic verification verdict |
| `POST` | `/api/tasks/{id}/diagnose` | `main.py:diagnose_task_route` | AI diagnosis of failed verification evidence |
| `GET` | `/api/executions/{id}` | `main.py:get_execution_run` | Execution run logs and evidence items |
| `GET` | `/api/verification/{id}` | `main.py:get_verification_result` | Deterministic verification result and evaluations |
| `GET` | `/api/verification/{id}/claim-vs-reality` | `main.py:get_claim_vs_reality` | Claim vs Reality discrepancy analysis |
| `GET` | `/api/evidence/tasks/{id}` | `main.py:get_task_evidence` | Collected evidence items for task |
| `GET` | `/api/models/status` | `main.py:model_status` | Runtime status of local Gemma and planner |
| `GET` | `/api/stats/dashboard` | `main.py:dashboard_stats` | Authoritative dashboard aggregate metrics |
| `GET` | `/api/audit/events` | `main.py:audit_events` | Immutable audit log of approvals and executions |
| `GET` | `/api/security/policy` | `main.py:security_policy` | Safe runner allowlist and confinement settings |

---

## 4. Prioritized Risk Register

| Risk ID | Severity | Category | Description | Mitigation Status | Residual Risk |
|---|---|---|---|---|---|
| **RSK-01** | Medium | Architecture | Dual persistence layer: SQLAlchemy ORM and `DatabaseRepository` direct SQLite operate in parallel. | **Mitigated:** Foreign keys enforced in both; `main.py` explicitly updates both models on state transitions. | Low: Maintain synchronization whenever adding new database columns. |
| **RSK-02** | Medium | Security | Subprocess execution confinement on Windows: Subprocess allowlist prevents unauthorized binaries, but does not isolate filesystem like Docker/jail. | **Mitigated:** Directory traversal validation (`validate_repo_path`), command allowlisting, argument validation, environment stripping. | Medium: Documented honestly — allowlist confinement is not a complete OS sandbox. |
| **RSK-03** | Low | Integration | Antigravity CLI/SDK absent on host machine. | **Mitigated:** Adapter returns `NEEDS_INSTALLATION`. Local subprocess execution is labeled `LOCAL_SAFE_RUNNER`. | Low: No false claims; fallback path operates reliably. |
| **RSK-04** | Low | Resilience | Ollama cold-start latency or inference failure. | **Mitigated:** Explicit Pydantic validation on model output; bounded HTTP timeouts; fallback generator. | Very Low: Core verification operates independently of Ollama. |

---

## 5. Files Changed and Rationale

| File Path | Changes Made | Rationale |
|---|---|---|
| `backend/app/db/database.py` | Added `@event.listens_for(engine, "connect")` listener executing `PRAGMA foreign_keys=ON;`. | Enforce SQLite relational integrity for SQLAlchemy ORM models. |
| `backend/app/db/repository.py` | Added `conn.execute("PRAGMA foreign_keys = ON;")` in `_get_connection()`. | Enforce foreign key constraints on direct SQLite repository queries. |
| `backend/app/main.py` | Added `"APPROVED"` state to `ALLOWED_TRANSITIONS`; updated `approve_task_plan` to transition to `APPROVED`; set `execution_mode = "LOCAL_SAFE_RUNNER"`. | Synchronize task lifecycle state machine and eliminate dishonest agent reporting. |
| `backend/app/services/safe_runner.py` | Added null-byte validation; added `_get_sanitized_environment()`; added `_cap_output()` with 512 KB limit. | Protect against injection attacks, environment secret leakage, and unbounded log memory growth. |
| `backend/app/services/evidence_collector.py` | Added environment variable sanitization and 512 KB output capping to `execute_test_command`. | Prevent secret leakage and memory bloat during test command execution. |
| `backend/tests/test_database.py` | Updated fixtures in `test_plan_persistence`, `test_execution_run_and_evidence_history`, and `test_verification_and_diagnosis_persistence` to insert parent tasks. | Comply with strictly enforced SQLite foreign key constraints. |
| `backend/tests/test_backend_audit_hardening.py` | Created comprehensive regression test suite with 7 dedicated test cases. | Validated foreign keys, null bytes, secret sanitization, output limits, lifecycle sync, and honest status. |

---

## 6. Exact Test Commands & Execution Results

### Backend Test Execution
- **Command:** `python -m pytest backend/tests/ -v`
- **Result:** **188 passed in 84.44s**
- **Exit Code:** `0`
- **Coverage Breakdown:**
  - `test_backend_audit_hardening.py`: 7 passed
  - `test_database.py`: 6 passed
  - `test_db_consistency.py`: 12 passed
  - `test_task_lifecycle.py`: 23 passed
  - `test_safe_runner.py` & `test_safe_execution.py`: 19 passed
  - `test_verification_engine.py`, `test_verification_integrity.py`, `test_verification_verdicts.py`: 30 passed
  - `test_gemma_service.py` & `test_gemma_live_integration.py`: 10 passed
  - `test_api_endpoints.py`, `test_phase3_hardening.py`, `test_workflow.py`, `test_frontend_integration.py`: 81 passed

### Frontend Production Build
- **Command:** `npm --prefix frontend run build`
- **Result:** **Compiled successfully**
- **Exit Code:** `0`
- **Pages Built:** 16 static/dynamic routes (`/`, `/dashboard`, `/projects`, `/projects/new`, `/tasks`, `/planner`, `/verification`, `/executions`, `/reports`, `/security`, `/model`, `/settings`, etc.)

---

## 7. Remaining Limitations and Unverified Integrations

1. **Host Sandboxing Limitation:** The safe runner enforces strict binary allowlisting (`python`, `pytest`, `npm`, `git`, `node`) and argument validation. On Windows, native kernel-level sandboxing (e.g., AppContainer or Docker containers) is not configured; isolation relies on path traversal checks and directory confinement.
2. **Antigravity CLI / Python SDK:** Antigravity is not installed in the current environment (`shutil.which("agy") == None`). This is correctly and transparently reported by `/api/health/antigravity` as `NEEDS_INSTALLATION`. Execution gracefully routes to `LOCAL_SAFE_RUNNER`.
3. **Local Gemma Model:** Ollama is configured to target `gemma4:e4b`. If Ollama is offline or uninstalled, the backend operates in `FALLBACK_ACTIVE` mode without interrupting verification or project management.

---

## 8. End-to-End Manual Verification Checklist

1. [x] **Database Relational Integrity:** Attempting to insert an orphaned plan or execution run raises `sqlite3.IntegrityError: FOREIGN KEY constraint failed`.
2. [x] **Task Approval Gate:** `POST /api/tasks/{id}/execute` without prior plan approval returns HTTP `409 Conflict`.
3. [x] **Task Approval Synchronization:** `POST /api/tasks/{id}/approve` updates task status to `"APPROVED"`.
4. [x] **Safe Runner Security:** Commands containing null bytes or disallowed binaries (e.g. `curl`, `bash`, `powershell`) return HTTP `400 Bad Request`.
5. [x] **Secret Stripping:** Subprocess execution environment does not inherit host environment variables containing `API_KEY`, `TOKEN`, `PASSWORD`, or `SECRET`.
6. [x] **Deterministic Verification:** Passing commands do not automatically guarantee task completion; `POST /api/tasks/{id}/verify` evaluates deterministic rules against evidence.
7. [x] **Honest Capability Reporting:** `GET /api/health/antigravity` reports `NEEDS_INSTALLATION`, and task executions are recorded with source `"LOCAL_SAFE_RUNNER"`.
8. [x] **Frontend Compatibility:** Frontend compiles cleanly with `npm run build` and loads all dashboard views on `http://localhost:3000`.
