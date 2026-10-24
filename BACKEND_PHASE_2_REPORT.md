# VIKASA — Phase 2: Adversarial Security & End-to-End Reliability Report

## 1. Executive Summary

This report documents the second-stage adversarial security audit, lifecycle race-condition defense, and end-to-end reliability verification of the VIKASA platform backend.

Every modification was validated against VIKASA's core invariant:
> **"AI proposes and diagnoses. Humans approve. Deterministic verification decides the verdict."**

All frontend-consumed backend contracts and typings remain fully preserved.

- **Baseline Test Suite (Phase 1):** 188 passed in 84.44s (Exit Code: 0)
- **Phase 2 Adversarial Suite:** **12 passed, 0 failed in 64.77s** (`pytest backend/tests/test_backend_phase2_adversarial.py -v`, Exit Code: 0)
- **Full Backend Test Suite:** **200 passed, 0 failed in 152.71s** (`pytest backend/tests/ -v`, Exit Code: 0)
- **Frontend Production Build:** **Compiled successfully across all 16 static/dynamic routes** (`npm --prefix frontend run build`, Exit Code: 0)

---

## 2. Confirmed Findings & Hardening Implemented

### 2.1 Adversarial Execution Security (`safe_runner.py` & `evidence_collector.py`)
1. **Windows Path Normalization & UNC Rejection:**
   - *Finding:* `validate_workspace` and `validate_repo_path` previously performed simple `os.path.abspath()` checks. Network UNC paths (e.g. `\\remote-host\share` or `//evil-share`) could trigger Windows SMB NTLM credential relay attacks when resolved across the network. Furthermore, DOS reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1`..`9`, `LPT1`..`9`) can stall or hang filesystem calls.
   - *Fix:* Added explicit rejection of paths starting with `\\` or `//`. Added rejection of Windows reserved device names. Used `os.path.realpath` to resolve symbolic links and NTFS junction points to enforce true physical filesystem boundaries.
2. **Child Process Tree Cleanup on Windows:**
   - *Finding:* Standard Python `subprocess.run(timeout=...)` or `proc.kill()` calls `TerminateProcess(proc.handle)` on Windows, which terminates only the parent process. Any child processes spawned by tools (such as Python or Git) survived and continued running in the background as orphans.
   - *Fix:* Added `_terminate_process_tree(pid)`: On Windows, executes `taskkill /F /T /PID <pid>` to terminate the entire process tree before cleaning up process handles.
3. **Comprehensive Secret Scrubbing & Credential Redaction:**
   - *Finding:* The environment variable sanitizer only checked for a narrow set of substrings. Common secret variables such as `DATABASE_URL`, `MONGO_URI`, `REDIS_URL`, `POSTGRES_URL`, `SENTRY_DSN`, `API_URL`, `CONN_STR`, and `PAT` were not filtered. In addition, credentials embedded in command arguments (e.g., `https://user:pass@host` or `ghp_...` tokens) were recorded in evidence.
   - *Fix:* Expanded sensitive substrings in `_get_sanitized_environment()` to include `DATABASE_URL`, `MONGO_URI`, `REDIS_URL`, `POSTGRES_URL`, `SENTRY_DSN`, `CONN_STR`, `API_URL`, `PAT`, `BEARER`, `SIGNATURE`, and `CERT`. Added `_redact_secrets()` regex scrubbing to mask embedded URL credentials (`[REDACTED_AUTH]@`), GitHub tokens (`[REDACTED_GH_TOKEN]`), Bearer tokens (`[REDACTED_BEARER]`), and `--api-key` / `--password` command arguments in output and evidence records.

### 2.2 Atomic Task Lifecycle & Concurrency Defenses
1. **Concurrent Execution of the Same Task:**
   - *Finding:* If multiple execution requests arrived simultaneously for the same approved task, both requests passed the approval check and executed concurrently, resulting in overlapping processes, duplicate log records, and race conditions.
   - *Fix:* Introduced a thread-safe concurrency lock (`_execution_lock = threading.Lock()`) and in-flight execution tracker (`_active_executions: set[str]`). Any concurrent execution request for an actively executing task is rejected with HTTP `409 Conflict`.
2. **Plan Generation Synchronization with SQLAlchemy:**
   - *Finding:* When `/api/tasks/{task_id}/plan` was invoked, `workflow_service` transitioned the local task to `PLANNED`, but the SQLAlchemy `TaskRecord.status` was not updated, leaving SQLAlchemy reporting `CREATED` while the task was actually `PLANNED`.
   - *Fix:* Injected `db: Session = Depends(get_db)` into `generate_task_plan_route` and synchronized `TaskRecord.status = "PLANNED"` on plan generation.
3. **Idempotent State Transitions:**
   - *Finding:* In `workflow_service.py:transition_task_state`, transitioning a task to its current state (e.g. from `FAILED` to `FAILED` during verification of a failed test run) raised `InvalidStateTransitionError`.
   - *Fix:* Added an early exit check: if `current_state == target_state: return task`, ensuring idempotent transitions across all lifecycle states.

### 2.3 Deterministic Verification & Cross-Task Isolation
1. **Cross-Task Evidence Leak Prevention:**
   - *Finding:* `POST /api/tasks/{task_id}/verify?run_id={run_id}` did not verify whether the provided `run_id` belonged to `task_id`. Supplying an execution run from Task B when verifying Task A could evaluate Task B's git diff and evidence against Task A's criteria.
   - *Fix:* Enforced strict execution run ownership in `workflow_service.verify_task`:
     ```python
     if specified_run.task_id != task_id:
         raise ValueError(f"Execution run '{run_id}' belongs to task '{specified_run.task_id}', not task '{task_id}'. Cross-task verification is forbidden.")
     ```
     FastAPI maps this `ValueError` to HTTP `409 Conflict`.
2. **Deterministic Defense Against False AI Success Claims:**
   - *Verified:* When a command exits with a non-zero code (e.g. exit code 42), the verification engine unequivocally assigns a `FAILED` verdict and flags `claim_verified = False` in the Claim vs Reality report, regardless of any claim made by an AI agent.

---

## 3. Exact Test Commands & Real Execution Results

### 3.1 Targeted Phase 2 Adversarial Tests
- **Command:** `python -m pytest backend/tests/test_backend_phase2_adversarial.py -v`
- **Duration:** 64.77s
- **Result:** **12 passed, 0 failed (Exit Code: 0)**
- **Test Matrix:**
  1. `test_safe_runner_rejects_unc_paths` — PASSED
  2. `test_safe_runner_rejects_reserved_device_names` — PASSED
  3. `test_evidence_collector_rejects_unc_and_reserved_devices` — PASSED
  4. `test_extended_environment_variable_sanitization` — PASSED
  5. `test_credential_redaction_in_output` — PASSED
  6. `test_concurrent_execution_requests_rejected` — PASSED
  7. `test_plan_generation_synchronizes_sqlalchemy_status` — PASSED
  8. `test_cross_task_verification_rejected` — PASSED
  9. `test_deterministic_engine_rejects_ai_claimed_success_on_exit_failure` — PASSED
  10. `test_nonexistent_project_task_scoping_returns_404` — PASSED
  11. `test_nonexistent_execution_run_returns_404` — PASSED
  12. `test_nonexistent_run_report_returns_404` — PASSED

### 3.2 Full Backend Pytest Suite
- **Command:** `python -m pytest backend/tests/ -v`
- **Duration:** 152.71s (2m 32s)
- **Result:** **200 passed, 0 failed, 0 skipped (Exit Code: 0)**

### 3.3 Frontend Production Build Verification
- **Command:** `npm --prefix frontend run build`
- **Result:** **Compiled successfully (Exit Code: 0)**
- **Routes Optimized:** All 16 static/dynamic routes compiled without type or contract discrepancies.

---

## 4. Files Changed and Rationale

| File Path | Changes Made | Rationale |
|---|---|---|
| `backend/app/services/safe_runner.py` | Added UNC path rejection, DOS reserved device name checks, `os.path.realpath` resolution, extended secret environment filtering, `_redact_secrets()`, and `_terminate_process_tree()` using `taskkill /F /T /PID`. | Prevent Windows SMB relay attacks, credential exposure in logs, and orphaned subprocess trees. |
| `backend/app/services/evidence_collector.py` | Added UNC/device rejection, extended secret environment filtering, output secret redaction, and `_terminate_process_tree()` on timeout or exception. | Prevent credential leaks, SMB attacks, and lingering child processes during test runs. |
| `backend/app/services/workflow_service.py` | Added run ownership validation in `verify_task` to prevent cross-task verification leaks; made `transition_task_state` idempotent when `current_state == target_state`. | Prevent cross-task evidence tampering and avoid invalid transition errors on duplicate/failure verdicts. |
| `backend/app/main.py` | Added `_active_executions` concurrency lock to `execute_task_route`; synchronized `TaskRecord.status = "PLANNED"` in `generate_task_plan_route`; handled `ValueError` in `verify_persisted_task`. | Eliminate race conditions on concurrent executions and keep ORM models synchronized with direct SQLite state. |
| `backend/tests/test_backend_phase2_adversarial.py` | Created 12 targeted adversarial tests covering UNC, devices, secrets, concurrency, plan sync, and verification attacks. | Automated regression test coverage for all Phase 2 hardening measures. |

---

## 5. Remaining Security Limitations

1. **Operating System Boundary on Windows:**
   - The safe runner enforces strict binary allowlisting (`python`, `pytest`, `npm`, `git`, `node`), argument validation, directory confinement, and process tree termination.
   - On Windows, execution occurs under the current user's security token rather than an isolated Linux kernel cgroup or Windows AppContainer sandbox. While path traversal and unauthorized binaries are rejected, full kernel isolation would require containerization (e.g. Docker or WSL2).
2. **Network Access in Child Subprocesses:**
   - Child processes inherit the host machine's network stack. Malicious commands in custom test suites could attempt outbound socket connections if allowed by the host firewall. A dedicated network namespace is recommended for production container deployments.

---

## 6. Actual Model and Agent Availability

- **Local Gemma Model (Ollama):** Configured to target `gemma4:e4b` at `http://localhost:11434`. When Ollama is offline or uninstalled, `GemmaService` operates in `FALLBACK_ACTIVE` mode using deterministic rule-based planning. Core verification and database operations remain 100% available without Ollama.
- **Antigravity CLI / SDK:** Honestly reported by `GET /api/health/antigravity` as `NEEDS_INSTALLATION`. The adapter detects that neither `agy` nor `google.antigravity` is installed. Local subprocess executions are strictly stamped as `LOCAL_SAFE_RUNNER`.

---

## 7. Recommended Next Steps

1. **Commit Phase 2 Changes:** Stage and commit all Phase 2 hardening files and test additions to Git.
2. **Containerized Execution Profile (Future Production Roadmap):** For enterprise multi-tenant deployments, package the safe runner worker inside an ephemeral Docker container to establish an OS-level sandbox boundary.
3. **Frontend Showcase / Live Walkthrough:** With the backend hardened (200/200 tests passing) and the frontend build verified, the system is ready for demonstration and live evaluation.
