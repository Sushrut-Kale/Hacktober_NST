import {
  Project,
  Task,
  TaskPlan,
  ExecutionRun,
  VerificationResult,
  FailureDiagnosis,
  ClaimVsRealityComparison,
  ExecutionEvent,
  SecurityTestResult,
  ModelTransparencyInfo,
} from "../lib/types";

export const DEMO_PROJECTS: Project[] = [
  {
    id: "default",
    name: "VIKASA Verification Platform",
    description: "AI Development Intelligence & Deterministic Verification Core",
    git_url: "https://github.com/Sushrut-Kale/Hacktober_NST.git",
    branch: "Shourya-Thorat",
    repo_path: "e:/Hacktober_ADYPU",
    language: "Python 3.13 / TypeScript",
    framework: "FastAPI / Next.js 14",
    created_at: "2026-10-24T10:00:00Z",
    stats: {
      total_tasks: 4,
      verified_tasks: 1,
      failed_tasks: 1,
      unverified_tasks: 2,
    },
    directory_structure: [
      "backend/app/main.py",
      "backend/app/schemas/core.py",
      "backend/app/services/gemma_service.py",
      "backend/app/services/safe_runner.py",
      "backend/app/services/workflow_service.py",
      "backend/app/db/repository.py",
      "backend/tests/test_api_endpoints.py",
      "backend/tests/test_verification_engine.py",
      "frontend/app/dashboard/page.tsx",
      "API_CONTRACT.md",
      "README.md",
    ],
    dependencies: {
      fastapi: "^0.115.0",
      pydantic: "^2.9.2",
      uvicorn: "^0.31.0",
      pytest: "^8.3.3",
      httpx: "^0.27.2",
      next: "^14.2.15",
      react: "^18.3.1",
      tailwindcss: "^3.4.14",
    },
    detected_commands: [
      "python -m pytest backend/tests/test_api_endpoints.py -v",
      "python -m pytest backend/tests/test_verification_engine.py -v",
      "git status",
      "git diff",
    ],
    modules: ["Core API", "Gemma 4 Service", "Safe Runner", "Verification Engine", "SQLite Repository"],
    documentation: ["API_CONTRACT.md", "README.md", "PHASE2_ARCHITECTURE.md"],
    issues: ["Need e2e test execution", "Frontend WebSocket/SSE live streaming"],
    missing_information: ["Production Ollama GPU spec", "Remote Git webhook tokens"],
    analysis_status: "ANALYZED",
  },
  {
    id: "project-auth-gateway",
    name: "Microservices Auth Gateway",
    description: "Distributed JWT & OAuth2 authorization proxy for Kubernetes clusters",
    git_url: "https://github.com/org/auth-gateway.git",
    branch: "main",
    language: "Go 1.22",
    framework: "Gin / gRPC",
    created_at: "2026-10-20T14:30:00Z",
    stats: {
      total_tasks: 6,
      verified_tasks: 5,
      failed_tasks: 0,
      unverified_tasks: 1,
    },
    analysis_status: "ANALYZED",
  },
];

export const DEMO_TASKS: Task[] = [
  {
    id: "task-user-auth",
    project_id: "default",
    title: "Implement JWT authentication middleware",
    description: "Verify token signature validation, header parsing, and expiration handling with HTTP 401 returns.",
    state: "VERIFIED",
    acceptance_criteria: [
      {
        id: "AC-1",
        description: "Valid JWT token returns HTTP 200 with decoded user payload",
        required: true,
        verification_method: "pytest backend/tests/test_api_endpoints.py -k test_valid_jwt",
        satisfied: true,
      },
      {
        id: "AC-2",
        description: "Expired JWT token returns HTTP 401 Unauthorized with detailed code",
        required: true,
        verification_method: "pytest backend/tests/test_api_endpoints.py -k test_expired_jwt",
        satisfied: true,
      },
      {
        id: "AC-3",
        description: "Tampered cryptographic signature triggers 403 Forbidden",
        required: true,
        verification_method: "pytest backend/tests/test_api_endpoints.py -k test_tampered_jwt",
        satisfied: true,
      },
    ],
    workspace_path: "e:/Hacktober_ADYPU",
    created_at: "2026-10-24T12:00:00Z",
    updated_at: "2026-10-24T12:05:00Z",
    approved_at: "2026-10-24T12:01:30Z",
    approved_by: "LEAD_REVIEWER",
  },
  {
    id: "task-rate-limiter",
    project_id: "default",
    title: "Implement sliding window rate limiter",
    description: "Throttle client requests exceeding 100 req/min with 429 Too Many Requests response headers.",
    state: "FAILED",
    acceptance_criteria: [
      {
        id: "AC-RL-1",
        description: "Normal traffic below 100 req/min passes without throttling",
        required: true,
        verification_method: "pytest backend/tests/test_rate_limiter.py -k test_normal_burst",
        satisfied: true,
      },
      {
        id: "AC-RL-2",
        description: "101st request within window returns 429 with Retry-After header",
        required: true,
        verification_method: "pytest backend/tests/test_rate_limiter.py -k test_burst_throttling",
        satisfied: false,
      },
    ],
    workspace_path: "e:/Hacktober_ADYPU",
    created_at: "2026-10-24T12:10:00Z",
    updated_at: "2026-10-24T12:14:00Z",
    approved_at: "2026-10-24T12:11:00Z",
    approved_by: "QA_ENGINEER",
  },
  {
    id: "task-db-migrations",
    project_id: "default",
    title: "Transactional SQLite repository migration",
    description: "Ensure atomic task state updates with ACID rollback on database transaction failure.",
    state: "APPROVED",
    acceptance_criteria: [
      {
        id: "AC-DB-1",
        description: "Task state updates are atomic and rolled back if sub-operation fails",
        required: true,
        verification_method: "pytest backend/tests/test_database.py",
      },
    ],
    workspace_path: "e:/Hacktober_ADYPU",
    created_at: "2026-10-24T12:20:00Z",
    updated_at: "2026-10-24T12:22:00Z",
    approved_at: "2026-10-24T12:22:00Z",
    approved_by: "LEAD_REVIEWER",
  },
  {
    id: "task-sec-sql",
    project_id: "default",
    title: "SQL injection prevention verification",
    description: "Enforce parameterized query binding across all dynamic repository queries.",
    state: "PLANNED",
    acceptance_criteria: [
      {
        id: "AC-SEC-1",
        description: "Unsanitized user strings passed to repository do not alter SQL syntax tree",
        required: true,
        verification_method: "pytest backend/tests/test_security.py",
      },
    ],
    workspace_path: "e:/Hacktober_ADYPU",
    created_at: "2026-10-24T12:30:00Z",
    updated_at: "2026-10-24T12:32:00Z",
  },
];

export const DEMO_PLANS: Record<string, TaskPlan> = {
  "task-user-auth": {
    task_id: "task-user-auth",
    model_name: "gemma4:e4b",
    generator_status: "AI_ACTIVE",
    task_summary: "Implement JWT token validation and expiry handling in FastAPI middleware.",
    summary: "Implement JWT token validation and expiry handling in FastAPI middleware.",
    steps: [
      {
        step_number: 1,
        action: "Add token verification function in backend/app/services/auth.py",
        expected_outcome: "Tokens decode signature and claims properly",
        associated_criterion_id: "AC-1",
      },
      {
        step_number: 2,
        action: "Add expiry timestamp check raising HTTPException(401)",
        expected_outcome: "Expired tokens return 401 Unauthorized",
        associated_criterion_id: "AC-2",
      },
      {
        step_number: 3,
        action: "Run deterministic pytest suite with exit code verification",
        expected_outcome: "All 3 unit test cases pass with exit code 0",
        associated_criterion_id: "AC-3",
      },
    ],
    acceptance_criteria: [
      {
        criterion_id: "AC-1",
        description: "Valid JWT returns HTTP 200",
        verification_method: "pytest backend/tests/test_auth.py",
      },
      {
        criterion_id: "AC-2",
        description: "Expired JWT returns HTTP 401",
        verification_method: "pytest backend/tests/test_auth.py",
      },
    ],
    files_to_inspect: [
      "backend/app/services/gemma_service.py",
      "backend/tests/test_api_endpoints.py",
    ],
    tests_to_run: [
      "python -m pytest backend/tests/test_api_endpoints.py -v",
    ],
    risks: [
      "Clock drift between client and server during token verification",
      "Secret key exposure in runtime environment",
    ],
    verification_strategy: "Execute allowlisted pytest suite under safe runner and assert exit code 0 with git diff present.",
    created_at: "2026-10-24T12:01:00Z",
  },
  "task-rate-limiter": {
    task_id: "task-rate-limiter",
    model_name: "gemma4:e4b",
    generator_status: "AI_ACTIVE",
    task_summary: "Implement sliding window token bucket rate limiter middleware in FastAPI.",
    summary: "Implement sliding window token bucket rate limiter middleware in FastAPI.",
    steps: [
      {
        step_number: 1,
        action: "Create rate limiter service using in-memory rolling window",
        expected_outcome: "Count requests per client IP within 60 second bucket",
        associated_criterion_id: "AC-RL-1",
      },
      {
        step_number: 2,
        action: "Trigger 429 response when count exceeds 100 with Retry-After header",
        expected_outcome: "101st request returns 429 status code",
        associated_criterion_id: "AC-RL-2",
      },
    ],
    files_to_inspect: ["backend/app/main.py"],
    tests_to_run: ["python -m pytest backend/tests/test_rate_limiter.py -v"],
    risks: ["Memory leak in unbounded IP cache", "Concurrency race condition on counter increments"],
    verification_strategy: "Run rate limiter unit tests under concurrent load.",
    created_at: "2026-10-24T12:10:30Z",
  },
};

export const DEMO_RUNS: Record<string, ExecutionRun> = {
  "run-b8f3e21a": {
    run_id: "run-b8f3e21a",
    task_id: "task-user-auth",
    started_at: "2026-10-24T12:02:00Z",
    completed_at: "2026-10-24T12:02:03Z",
    status: "COMPLETED",
    command: "python -m pytest backend/tests/test_api_endpoints.py -v",
    exit_code: 0,
    stdout: `============================= test session starts =============================
platform win32 -- Python 3.13.0, pytest-8.3.3
rootdir: e:\\Hacktober_ADYPU
collected 3 items

backend/tests/test_api_endpoints.py::test_valid_jwt PASSED               [ 33%]
backend/tests/test_api_endpoints.py::test_expired_jwt PASSED             [ 66%]
backend/tests/test_api_endpoints.py::test_tampered_jwt PASSED            [100%]

============================== 3 passed in 0.84s ==============================`,
    stderr: "",
    source: "LOCAL_EXECUTION_RUNNER",
    git_diff: `diff --git a/backend/app/services/auth.py b/backend/app/services/auth.py
new file mode 100644
index 0000000..f92a10c
--- /dev/null
+++ b/backend/app/services/auth.py
@@ -0,0 +1,24 @@
+import time
+import hmac
+import hashlib
+from fastapi import HTTPException, Security
+from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
+
+security = HTTPBearer()
+
+def verify_jwt_token(credentials: HTTPAuthorizationCredentials = Security(security)):
+    token = credentials.credentials
+    # Decodes signature and claims
+    claims = decode_claims(token)
+    if claims["exp"] < time.time():
+        raise HTTPException(status_code=401, detail="Token has expired")
+    return claims`,
    evidence_items: [
      {
        criterion_id: "AC-1",
        evidence_type: "COMMAND_EXIT_CODE",
        content: "Executed 'python -m pytest backend/tests/test_api_endpoints.py -v'. Exit status: 0",
        exit_code: 0,
        passed: true,
        timestamp: "2026-10-24T12:02:02Z",
      },
      {
        criterion_id: "AC-2",
        evidence_type: "TEST_OUTPUT",
        content: "test_expired_jwt PASSED (HTTP 401 verified)",
        exit_code: 0,
        passed: true,
        timestamp: "2026-10-24T12:02:03Z",
      },
      {
        criterion_id: "AC-3",
        evidence_type: "GIT_DIFF",
        content: "diff --git a/backend/app/services/auth.py b/backend/app/services/auth.py (+24 lines)",
        passed: true,
        file_path: "backend/app/services/auth.py",
        line_range: "1-24",
        timestamp: "2026-10-24T12:02:03Z",
      },
    ],
    model_name: "gemma4:e4b",
    runtime_metadata: {
      duration_ms: 1840,
      memory_mb: 64.2,
      host: "DESKTOP-VIKASA-DEV",
    },
  },
  "run-auth-failed": {
    run_id: "run-auth-failed",
    task_id: "task-rate-limiter",
    started_at: "2026-10-24T12:12:00Z",
    completed_at: "2026-10-24T12:12:02Z",
    status: "FAILED",
    command: "python -m pytest backend/tests/test_rate_limiter.py -v",
    exit_code: 1,
    stdout: `============================= test session starts =============================
platform win32 -- Python 3.13.0, pytest-8.3.3
collected 2 items

backend/tests/test_rate_limiter.py::test_normal_burst PASSED             [ 50%]
backend/tests/test_rate_limiter.py::test_burst_throttling FAILED         [100%]

================================== FAILURES ===================================
___________________________ test_burst_throttling ____________________________
response = client.get("/api/data")
> assert response.headers.get("Retry-After") is not None
E AssertionError: assert None is not None
backend/tests/test_rate_limiter.py:42: AssertionError
=========================== 1 failed, 1 passed in 0.92s ===========================`,
    stderr: "Traceback (most recent call last):\n  File 'test_rate_limiter.py', line 42, in test_burst_throttling",
    source: "LOCAL_EXECUTION_RUNNER",
    git_diff: `diff --git a/backend/app/middleware/rate_limiter.py b/backend/app/middleware/rate_limiter.py
index 4b9e110..812a3f0 100644
--- a/backend/app/middleware/rate_limiter.py
+++ b/backend/app/middleware/rate_limiter.py
@@ -15,4 +15,4 @@ class RateLimiter:
             if self.requests[ip] > 100:
-                return Response(status_code=429, headers={"Retry-After": "60"})
+                return Response(status_code=429) # Missing header!`,
    evidence_items: [
      {
        criterion_id: "AC-RL-1",
        evidence_type: "COMMAND_EXIT_CODE",
        content: "Command exited with status code 1",
        exit_code: 1,
        passed: false,
        timestamp: "2026-10-24T12:12:02Z",
      },
      {
        criterion_id: "AC-RL-2",
        evidence_type: "TEST_OUTPUT",
        content: "test_burst_throttling FAILED: AssertionError: assert None is not None",
        exit_code: 1,
        passed: false,
        timestamp: "2026-10-24T12:12:02Z",
      },
    ],
    model_name: "gemma4:e4b",
    runtime_metadata: {
      duration_ms: 1920,
      memory_mb: 72.8,
      host: "DESKTOP-VIKASA-DEV",
    },
  },
};

export const DEMO_VERIFICATIONS: Record<string, VerificationResult> = {
  "run-b8f3e21a": {
    task_id: "task-user-auth",
    run_id: "run-b8f3e21a",
    verdict: "VERIFIED",
    confidence_score: 1.0,
    summary: "Verification VERIFIED: 3/3 deterministic verification rules satisfied. Zero exit code, full criteria coverage, clean git diff.",
    verified_at: "2026-10-24T12:02:05Z",
    raw_evidence_count: 3,
    rule_evaluations: [
      {
        rule_name: "CommandExitCodeCheck",
        passed: true,
        verdict_impact: "VERIFIED",
        message: "All command executions and test runs reported exit code 0 / passed.",
        criterion_id: null,
      },
      {
        rule_name: "AcceptanceCriteriaCoverageCheck",
        passed: true,
        verdict_impact: "VERIFIED",
        message: "All 3 required acceptance criteria are substantiated by explicit test output evidence.",
        criterion_id: null,
      },
      {
        rule_name: "RepositoryDiffCheck",
        passed: true,
        verdict_impact: "VERIFIED",
        message: "Repository diff evidence is present and changes correspond directly to auth middleware (+24 lines).",
        criterion_id: null,
      },
    ],
    test_results: [
      { name: "test_valid_jwt", suite: "backend/tests/test_api_endpoints.py", duration_ms: 240, status: "PASS" },
      { name: "test_expired_jwt", suite: "backend/tests/test_api_endpoints.py", duration_ms: 310, status: "PASS" },
      { name: "test_tampered_jwt", suite: "backend/tests/test_api_endpoints.py", duration_ms: 290, status: "PASS" },
    ],
    verification_scope: "Full Deterministic Rule Suite (ExitCode, CriteriaCoverage, DiffIntegrity)",
    build_status: "SUCCESS",
    lint_status: "SUCCESS",
  },
  "run-auth-failed": {
    task_id: "task-rate-limiter",
    run_id: "run-auth-failed",
    verdict: "FAILED",
    confidence_score: 0.95,
    summary: "Verification FAILED: 1/2 acceptance criteria failed. Non-zero exit code (1) and missing Retry-After header.",
    verified_at: "2026-10-24T12:12:04Z",
    raw_evidence_count: 2,
    rule_evaluations: [
      {
        rule_name: "CommandExitCodeCheck",
        passed: false,
        verdict_impact: "FAILED",
        message: "Command execution failed with exit code 1 (expected 0).",
        criterion_id: "AC-RL-2",
      },
      {
        rule_name: "AcceptanceCriteriaCoverageCheck",
        passed: false,
        verdict_impact: "FAILED",
        message: "Criterion AC-RL-2 failed verification due to AssertionError in test_burst_throttling.",
        criterion_id: "AC-RL-2",
      },
      {
        rule_name: "RepositoryDiffCheck",
        passed: true,
        verdict_impact: "VERIFIED",
        message: "Repository diff detected (+1 line modification in rate_limiter.py).",
        criterion_id: null,
      },
    ],
    test_results: [
      { name: "test_normal_burst", suite: "backend/tests/test_rate_limiter.py", duration_ms: 350, status: "PASS" },
      {
        name: "test_burst_throttling",
        suite: "backend/tests/test_rate_limiter.py",
        duration_ms: 570,
        status: "FAIL",
        message: "AssertionError: assert None is not None",
      },
    ],
    verification_scope: "FastAPI Middleware & Deterministic Suite",
    build_status: "SUCCESS",
    lint_status: "SUCCESS",
  },
};

export const DEMO_DIAGNOSES: Record<string, FailureDiagnosis> = {
  "run-auth-failed": {
    task_id: "task-rate-limiter",
    run_id: "run-auth-failed",
    failure_summary: "AssertionError in test_burst_throttling: HTTP 429 response is missing required 'Retry-After' header.",
    likely_cause: "In rate_limiter.py line 18, the Response constructor was called with `status_code=429` but without setting the `headers={'Retry-After': str(retry_seconds)}` parameter.",
    evidence_references: [
      "backend/tests/test_rate_limiter.py:42 (AssertionError: assert None is not None)",
      "diff line 18: - return Response(status_code=429, headers={'Retry-After': '60'})",
      "exit_code: 1",
    ],
    recommended_fix: "Update `backend/app/middleware/rate_limiter.py` line 18 to pass `headers={'Retry-After': str(int(reset_time - time.time()))}` in the 429 Response.",
    suggested_retest_command: "python -m pytest backend/tests/test_rate_limiter.py -k test_burst_throttling -v",
    generator_status: "AI_ACTIVE",
    explanation_mr: "Gemma 4 Diagnosis (मराठी): Rate limiter middleware मध्ये HTTP 429 response परत करताना 'Retry-After' header पाठवले गेले नाही. त्यामुळे टेस्ट केस फेल झाली आहे. तोडगा: `rate_limiter.py` फाईलमध्ये Response ऑब्जेक्ट बनवताना `headers={'Retry-After': '60'}` नक्की टाका आणि पुन्हा चाचणी घ्या.",
  },
};

export const DEMO_CLAIM_VS_REALITY: Record<string, ClaimVsRealityComparison> = {
  "run-b8f3e21a": {
    task_id: "task-user-auth",
    run_id: "run-b8f3e21a",
    verdict: "VERIFIED",
    claim: {
      original_requirement: "Implement JWT authentication middleware that validates token expiry and returns HTTP 401 for expired tokens.",
      exact_claim: "I have successfully created and tested JWT authentication middleware in backend/app/services/auth.py with all 3 test cases passing.",
      claimed_behavior: "All incoming requests with Bearer token are authenticated; expired tokens return HTTP 401 Unauthorized with detailed message.",
      claimed_changed_files: ["backend/app/services/auth.py", "backend/tests/test_api_endpoints.py"],
      agent_metadata: {
        model: "gemma4:e4b (Ollama local)",
        agent_id: "agent-vikasa-core-01",
        timestamp: "2026-10-24T12:02:00Z",
        duration_seconds: 1.84,
        temperature: 0.2,
      },
    },
    reality: {
      actual_changed_files: ["backend/app/services/auth.py", "backend/tests/test_api_endpoints.py"],
      code_evidence: [
        {
          file: "backend/app/services/auth.py",
          line_range: "12-16",
          summary: "Token expiry checked with time.time() and raises HTTPException(401)",
          verified: true,
          snippet: "if claims['exp'] < time.time():\n    raise HTTPException(status_code=401, detail='Token has expired')",
        },
        {
          file: "backend/tests/test_api_endpoints.py",
          line_range: "45-62",
          summary: "Three unit test cases covering valid, expired, and tampered signatures",
          verified: true,
        },
      ],
      test_results: [
        { name: "test_valid_jwt", suite: "test_api_endpoints.py", duration_ms: 240, status: "PASS" },
        { name: "test_expired_jwt", suite: "test_api_endpoints.py", duration_ms: 310, status: "PASS" },
        { name: "test_tampered_jwt", suite: "test_api_endpoints.py", duration_ms: 290, status: "PASS" },
      ],
      criteria_satisfied: [
        { id: "AC-1", description: "Valid JWT token returns HTTP 200", satisfied: true },
        { id: "AC-2", description: "Expired JWT token returns HTTP 401", satisfied: true },
        { id: "AC-3", description: "Tampered signature returns HTTP 403", satisfied: true },
      ],
      missing_requirements: [],
      discrepancies: [],
    },
    suggested_correction: undefined,
  },
  "run-auth-failed": {
    task_id: "task-rate-limiter",
    run_id: "run-auth-failed",
    verdict: "FAILED",
    claim: {
      original_requirement: "Throttle client requests exceeding 100 req/min with 429 Too Many Requests response headers (specifically Retry-After).",
      exact_claim: "I have implemented the sliding window rate limiter and verified that clients are throttled with 429 status code.",
      claimed_behavior: "All clients exceeding 100 req/min receive HTTP 429 Too Many Requests with retry headers.",
      claimed_changed_files: ["backend/app/middleware/rate_limiter.py"],
      agent_metadata: {
        model: "gemma4:e4b (Ollama local)",
        agent_id: "agent-vikasa-core-01",
        timestamp: "2026-10-24T12:12:00Z",
        duration_seconds: 1.92,
        temperature: 0.2,
      },
    },
    reality: {
      actual_changed_files: ["backend/app/middleware/rate_limiter.py"],
      code_evidence: [
        {
          file: "backend/app/middleware/rate_limiter.py",
          line_range: "15-18",
          summary: "Status 429 is returned, but headers dictionary was omitted from Response call",
          verified: false,
          snippet: "return Response(status_code=429)",
        },
      ],
      test_results: [
        { name: "test_normal_burst", suite: "test_rate_limiter.py", duration_ms: 350, status: "PASS" },
        {
          name: "test_burst_throttling",
          suite: "test_rate_limiter.py",
          duration_ms: 570,
          status: "FAIL",
          message: "AssertionError: assert None is not None (Retry-After header missing)",
        },
      ],
      criteria_satisfied: [
        { id: "AC-RL-1", description: "Normal traffic below 100 req/min passes", satisfied: true },
        { id: "AC-RL-2", description: "101st request returns 429 with Retry-After header", satisfied: false },
      ],
      missing_requirements: [
        "Missing 'Retry-After' response header in 429 response",
      ],
      discrepancies: [
        {
          field: "Response Headers",
          claim: "Agent claimed Retry-After header was included",
          reality: "Observed response header was null; test failed with AssertionError",
          severity: "CRITICAL",
        },
        {
          field: "Command Exit Code",
          claim: "Agent claimed tests passed cleanly",
          reality: "Execution runner recorded non-zero exit code 1",
          severity: "CRITICAL",
        },
      ],
    },
    suggested_correction: {
      summary: "Add `headers={'Retry-After': '60'}` to the Response constructor in `backend/app/middleware/rate_limiter.py`.",
      patch: `--- a/backend/app/middleware/rate_limiter.py\n+++ b/backend/app/middleware/rate_limiter.py\n@@ -17,2 +17,2 @@\n-                return Response(status_code=429)\n+                return Response(status_code=429, headers={"Retry-After": "60"})`,
      command_to_run: "python -m pytest backend/tests/test_rate_limiter.py -v",
    },
  },
};

export const DEMO_EVENTS: ExecutionEvent[] = [
  {
    id: 1,
    task_id: "task-user-auth",
    run_id: null,
    timestamp: "2026-10-24T12:00:00Z",
    event_type: "TASK_CREATED",
    message: "Task 'Implement JWT authentication middleware' created with 3 criteria.",
    details: { title: "Implement JWT authentication middleware", criteria_count: 3 },
  },
  {
    id: 2,
    task_id: "task-user-auth",
    run_id: null,
    timestamp: "2026-10-24T12:01:00Z",
    event_type: "PLAN_GENERATED",
    message: "Plan generated via gemma4:e4b (Status: AI_ACTIVE)",
    details: { model: "gemma4:e4b", generator_status: "AI_ACTIVE", step_count: 3 },
  },
  {
    id: 3,
    task_id: "task-user-auth",
    run_id: null,
    timestamp: "2026-10-24T12:01:30Z",
    event_type: "PLAN_APPROVED",
    message: "Plan approved by LEAD_REVIEWER.",
    details: { approved_by: "LEAD_REVIEWER", notes: "Plan verified" },
  },
  {
    id: 4,
    task_id: "task-user-auth",
    run_id: "run-b8f3e21a",
    timestamp: "2026-10-24T12:02:00Z",
    event_type: "EXECUTION_STARTED",
    message: "Executing allowlisted command: 'python -m pytest backend/tests/test_api_endpoints.py -v'",
    details: { command: "python -m pytest backend/tests/test_api_endpoints.py -v" },
  },
  {
    id: 5,
    task_id: "task-user-auth",
    run_id: "run-b8f3e21a",
    timestamp: "2026-10-24T12:02:03Z",
    event_type: "EXECUTION_COMPLETED",
    message: "Execution completed with exit code 0 (Status: COMPLETED).",
    details: { run_id: "run-b8f3e21a", exit_code: 0, evidence_count: 3 },
  },
  {
    id: 6,
    task_id: "task-user-auth",
    run_id: "run-b8f3e21a",
    timestamp: "2026-10-24T12:02:05Z",
    event_type: "VERIFICATION_COMPLETED",
    message: "Deterministic verification passed with verdict VERIFIED (Confidence: 1.0).",
    details: { verdict: "VERIFIED", confidence: 1.0, rules_satisfied: "3/3" },
  },
];

export const DEMO_SECURITY_TESTS: SecurityTestResult[] = [
  {
    id: "SEC-01",
    test_name: "Forbidden Shell Metacharacter Injection (;)",
    category: "SHELL_INJECTION",
    description: "Assert that commands with unquoted semicolons are rejected with HTTP 400 Bad Request.",
    expected_result: "HTTP 400 Bad Request with 'Forbidden shell separator ';' detected'",
    actual_result: "Rejected with HTTP 400 and detail: 'Forbidden shell separator ';' detected'",
    status: "PASS",
    evidence: "safe_runner.py::validate_command rejected 'pytest; rm -rf /'",
    severity: "CRITICAL",
    timestamp: "2026-10-24T11:00:00Z",
  },
  {
    id: "SEC-02",
    test_name: "Compound Command Operator Chaining (&&)",
    category: "SHELL_INJECTION",
    description: "Assert that chained execution operators like '&&' and '||' are blocked.",
    expected_result: "HTTP 400 Bad Request blocking compound operators",
    actual_result: "Blocked with HTTP 400 Bad Request",
    status: "PASS",
    evidence: "safe_runner.py line 58 matched forbidden operator '&&'",
    severity: "CRITICAL",
    timestamp: "2026-10-24T11:01:00Z",
  },
  {
    id: "SEC-03",
    test_name: "Path Traversal Escapes Outside Approved Workspace",
    category: "PATH_TRAVERSAL",
    description: "Assert that execution cannot access or modify directories above the registered workspace root.",
    expected_result: "Workspace containment constraint active",
    actual_result: "Resolved path must start with workspace_path prefix",
    status: "PASS",
    evidence: "Path comparison normalized absolute path to 'e:/Hacktober_ADYPU'",
    severity: "HIGH",
    timestamp: "2026-10-24T11:02:00Z",
  },
  {
    id: "SEC-04",
    test_name: "Non-Allowlisted Binary Execution Blocking",
    category: "SANDBOX_ESCAPE",
    description: "Assert that only allowlisted binaries ('python', 'pytest', 'git') can be executed.",
    expected_result: "Execution of 'bash', 'curl', 'powershell', etc. rejected",
    actual_result: "Binary 'curl' rejected with HTTP 400 (not in ALLOWLISTED_BINARIES)",
    status: "PASS",
    evidence: "ALLOWLISTED_BINARIES = {'python', 'pytest', 'git'}",
    severity: "CRITICAL",
    timestamp: "2026-10-24T11:03:00Z",
  },
];

export const DEMO_MODEL_TRANSPARENCY: ModelTransparencyInfo = {
  provider: "Ollama (Local Runtime)",
  model_id: "gemma4:e4b",
  mode: "LOCAL",
  runtime_status: "AI_ACTIVE",
  endpoint: "http://localhost:11434/api/generate",
  duration_ms: 1840,
  tokens_evaluated: 486,
  context_window_size: 8192,
  quantization: "Q4_K_M",
  fallback_reason: null,
  last_health_check: "2026-10-24T12:00:00Z",
};
