# VIKASA — Backend Audit & Reliability Baseline Report

**Date:** 2026-10-24  
**Repository:** `S:\Hacktober_NST`  
**Git Branch:** `main`  
**HEAD Commit:** `1bb0228497c9aa2381ceae3c0cbc1e6fa1c5751c`  
**Working Tree Status:** Clean  

---

## 1. Executive Summary

VIKASA is an AI-powered development intelligence and verification platform built upon the non-negotiable invariant:
$$\textbf{AI proposes and diagnoses. Humans approve. Deterministic verification decides the verdict.}$$

This audit establishes the empirical baseline of the backend across architecture, database access, task state machines, safe process execution, deterministic verification, Gemma AI integration, and Antigravity adapter status.

---

## 2. Test Suite Baseline

Before applying any modifications, the existing test suite was executed in full:

- **Command:** `python -m pytest backend/tests/ -v`
- **Exit Code:** `0`
- **Total Tests:** `181`
- **Passed:** `181`
- **Failed:** `0`
- **Skipped:** `0`
- **Duration:** `81.19s`

All 20 test modules passed under the current SQLite persistence and test runner fixtures.

---

## 3. Architecture & Dependency Map

The backend consists of:
- **FastAPI Core (`backend/app/main.py`)**: Root application with lifespan management, CORS configuration, and central endpoint definitions.
- **Relational ORM Layer (`backend/app/models/`, `backend/app/db/database.py`)**: SQLAlchemy declarative models (`Project`, `TaskRecord`, `VerificationRecord`) mapped to SQLite (`vikasa.db`).
- **Direct Repository Layer (`backend/app/db/repository.py`)**: Direct `sqlite3` connection manager for persistent core schemas (`Task`, `TaskPlan`, `ExecutionRun`, `ExecutionEvent`, `VerificationResult`, `FailureDiagnosis`).
- **Deterministic Verification Engine (`backend/app/services/verification_engine.py`)**: Pure deterministic rule evaluator executing 6 verification checks (Unsubstantiated claims, Environment blocks, Exit codes, Acceptance criteria coverage, Git diff existence, and Contradiction detection).
- **Safe Process Runner (`backend/app/services/safe_runner.py`)**: Sandboxed process execution enforcing command allowlisting (`pytest`, `python`, `python3`, `py`, `git`), shell injection checks, workspace path boundaries, and timeouts.
- **Evidence Collector (`backend/app/services/evidence_collector.py`)**: Captures real Git porcelain status, Git diffs, and executes verification commands.
- **Gemma / Ollama Service (`backend/app/services/gemma_service.py`)**: Local LLM interface for structured plan generation and evidence-grounded failure explanations with deterministic fallbacks.
- **Antigravity Adapter (`backend/app/services/antigravity_adapter.py`)**: Probes Antigravity CLI and Python SDK readiness.

---

## 4. Endpoint Implementation Map

| Endpoint | Method | Implemented In | Persistence Handler | Response Schema |
| :--- | :--- | :--- | :--- | :--- |
| `/health` | `GET` | `main.py:85` | In-memory | `Dict[str, Any]` |
| `/api/health` | `GET` | `main.py:95` | SQLAlchemy (`SELECT 1`) | `Dict[str, Any]` |
| `/api/health/ollama` | `GET` | `main.py:112` | `GemmaService.check_readiness()` | `Dict[str, Any]` |
| `/api/health/antigravity` | `GET` | `main.py:117` | `AntigravityAdapter.inspect_capabilities()` | `Dict[str, Any]` |
| `/api/projects` | `POST` | `api/projects.py:24` | SQLAlchemy `Project` | `ProjectResponse` |
| `/api/projects` | `GET` | `api/projects.py:55` | SQLAlchemy `Project` | `List[ProjectResponse]` |
| `/api/projects/{id}` | `GET` | `api/projects.py:89` | SQLAlchemy `Project` | `ProjectResponse` |
| `/api/projects/{id}/tasks`| `GET` | `api/projects.py:109`| SQLAlchemy `TaskRecord` | `List[TaskResponse]` |
| `/api/tasks` | `POST` | `main.py:126` | `WorkflowService` + `TaskRecord` | `Task` |
| `/api/tasks` | `GET` | `main.py:184` | `DatabaseRepository.list_tasks()` | `List[Task]` |
| `/api/tasks/{id}` | `GET` | `main.py:214` | `DatabaseRepository` | `TaskDetail` |
| `/api/tasks/{id}/plan` | `POST` | `main.py:255` | `WorkflowService.generate_and_save_plan()` | `TaskPlan` |
| `/api/tasks/{id}/status`| `PATCH`| `main.py:274` | Dual (`TaskRecord` + `DatabaseRepository`) | `Task` / `TaskRecord` |
| `/api/tasks/{id}/approve` | `POST` | `main.py:324` | `WorkflowService.approve_plan()` | `Task` |
| `/api/tasks/{id}/execute` | `POST` | `main.py:349` | `SafeExecutionRunner` / `EvidenceCollector` | `ExecutionRun` |
| `/api/tasks/{id}/events` | `GET` | `main.py:496` | `DatabaseRepository.get_events()` | `List[ExecutionEvent]` |
| `/api/tasks/{id}/verify` | `POST` | `main.py:506` | `WorkflowService.verify_task()` | `VerificationResult` |
| `/api/tasks/{id}/verification`| `GET`| `main.py:519` | `DatabaseRepository.get_verification()` | `VerificationResult` |
| `/api/runs/{run_id}` | `GET` | `main.py:532` | `DatabaseRepository.get_execution_run()` | `ExecutionRun` |
| `/api/runs/{run_id}/report`| `GET` | `main.py:542` | `DatabaseRepository` aggregation | `RunReport` |
| `/api/runs/{run_id}/diagnosis`| `GET`| `main.py:552`| `DatabaseRepository.get_diagnosis()` | `FailureDiagnosis` |
| `/api/runs/{run_id}/claim-vs-reality`| `GET`| `main.py:565`| `DeterministicVerificationEngine` | `ClaimVsRealityReport` |
| `/api/verify/claim-vs-reality`| `POST`| `api/evidence.py:45`| `DeterministicVerificationEngine` | `ClaimVsRealityReport` |
| `/api/verify/collect` | `POST` | `api/evidence.py:81`| `EvidenceCollector` | `List[EvidenceItem]` |
| `/api/verify/verify-repo`| `POST`| `api/evidence.py:115`| `EvidenceCollector.collect_and_verify()`| `ClaimVsRealityReport` |

---

## 5. Confirmed Defects & Implementation Flaws

### Defect 1: State Inversion in `approve_task_plan` (`main.py:339`)
- **Location:** `backend/app/main.py:337-342`
- **Issue:** In `approve_task_plan`, the route erroneously assigned `rec.status = "PENDING_APPROVAL"` to the SQLAlchemy `TaskRecord`, even though `workflow_service.approve_plan` sets the task state to `APPROVED`.
- **Impact:** Leaves the relational task record in a pending approval state despite explicit human approval.
- **Severity:** High (Core invariant violation).

### Defect 2: Missing Null Byte Validation in Command Line Arguments (`safe_runner.py`)
- **Location:** `backend/app/services/safe_runner.py:47-92`
- **Issue:** While `validate_workspace` checked for `"\0"`, `validate_command` did not inspect for null bytes in input strings.
- **Impact:** Null-byte poisoning can truncate command strings passed to OS process wrappers.
- **Severity:** High (Security boundary).

### Defect 3: Unbounded Subprocess Output Capture (`safe_runner.py` & `evidence_collector.py`)
- **Location:** `backend/app/services/safe_runner.py:142-152` and `backend/app/services/evidence_collector.py:247-254`
- **Issue:** Subprocesses were executed with unbounded `capture_output=True`, allowing arbitrary output volume to consume memory.
- **Impact:** Memory exhaustion (DoS) if commands produce millions of lines of output.
- **Severity:** Medium.

### Defect 4: Subprocess Environment Variable Secret Exposure
- **Location:** `backend/app/services/safe_runner.py` and `backend/app/services/evidence_collector.py`
- **Issue:** Subprocesses inherited the entire host environment without sanitizing potential API keys, credentials, or tokens.
- **Impact:** Sensitive environment variables accessible to executed subprocesses.
- **Severity:** High (Security boundary).

### Defect 5: Premature Labeling of Local Runner as `ANTIGRAVITY_AGENT` (`main.py:410-415`)
- **Location:** `backend/app/main.py:410-415`
- **Issue:** In `execute_task_route`, if capabilities reported CLI or SDK presence, `execution_mode` was stamped as `"ANTIGRAVITY_AGENT"`, even though local `collector.execute_test_command` was running.
- **Impact:** Violates the non-negotiable rule: "Never label a safe local subprocess as an Antigravity agent execution."
- **Severity:** High (Truth-in-reporting requirement).

### Defect 6: Unmounted Redundant Tasks Router (`backend/app/api/tasks.py`)
- **Location:** `backend/app/api/tasks.py`
- **Issue:** `api/tasks.py` is defined as a standalone APIRouter but is never mounted in `main.py` (which defines task endpoints directly on `app`).
- **Impact:** Code divergence, unmaintained dead router file, and risk of routing conflicts.
- **Severity:** Medium.

### Defect 7: Inconsistent SQLite Foreign Key Enforcement
- **Location:** `backend/app/db/database.py` and `backend/app/db/repository.py`
- **Issue:** SQLite connections did not explicitly enforce `PRAGMA foreign_keys = ON;` on initialization.
- **Impact:** Relational constraints could be silently bypassed on raw SQLite operations.
- **Severity:** Medium.

---

## 6. Prioritized Remediation Plan

1. **Phase 1 (Database Consistency):**
   - Enable `PRAGMA foreign_keys = ON;` across both SQLAlchemy engine connect hooks and `DatabaseRepository._get_connection`.
   - Ensure all task status updates atomatically synchronize `TaskRecord.status` and `db_repo.tasks.state`.
   - Resolve `backend/app/api/tasks.py` by ensuring all task management routes use one authoritative handler.

2. **Phase 2 (Lifecycle & Approval Enforcement):**
   - Correct `approve_task_plan` to persist `rec.status = "APPROVED"` and record `approved_at` and `approved_by` across both persistence paths.
   - Prevent execution of unapproved or terminal tasks with explicit atomic check-and-set updates.

3. **Phase 3 (Safe Execution Runner Security):**
   - Reject null bytes in `validate_command`.
   - Sanitize environment passed to subprocesses (stripping keys matching `*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*`, `*AUTH*`, `*CREDENTIALS*`).
   - Implement output size capping (512 KB per stream) with explicit truncation notices.
   - Enforce process tree termination on timeout.

4. **Phase 4 & 5 (Deterministic Verification & Evidence):**
   - Ensure `execution_mode` is strictly `"LOCAL_SAFE_RUNNER"` for all local subprocess executions.
   - Ensure Claim vs Reality discrepancy reports strictly link to verified execution run artifacts.

5. **Phase 6 & 7 (AI & Antigravity Truth-in-Reporting):**
   - Keep AI diagnosis and planning completely separate from deterministic verification verdicts.
   - Honestly report Antigravity adapter status as `NEEDS_INSTALLATION` when CLI/SDK are absent, noting that local safe runner is the active execution engine.

6. **Phase 8 & 9 (Contract Validation & Regression Tests):**
   - Add targeted regression test suites for all 7 confirmed defects.
   - Re-run full test suite and frontend build to verify zero regressions.
