// VIKASA Types & Interfaces matching API_CONTRACT.md and Frontend Requirements

export type TaskState =
  | "CREATED"
  | "PLANNED"
  | "APPROVED"
  | "RUNNING"
  | "VERIFYING"
  | "VERIFIED"
  | "FAILED"
  | "REVIEW_REQUIRED";

export type ExecutionStatus =
  | "PENDING"
  | "AWAITING_APPROVAL"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "TIMED_OUT"
  | "CANCELLED"
  | "UNKNOWN";

export type VerificationVerdict =
  | "VERIFIED"
  | "FAILED"
  | "UNVERIFIED"
  | "REVIEW_REQUIRED"
  | "BLOCKED"
  | "NOT_RUN";

export type TestStatus = "PASS" | "FAIL" | "NOT_RUN" | "BLOCKED" | "UNKNOWN";

export type GeneratorStatus = "AI_ACTIVE" | "FALLBACK_ACTIVE" | "AI_UNAVAILABLE";

export type EvidenceType = "COMMAND_EXIT_CODE" | "TEST_OUTPUT" | "GIT_DIFF";

export interface AcceptanceCriterion {
  id: string;
  description: string;
  required?: boolean;
  verification_method?: string;
  satisfied?: boolean;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  state: TaskState;
  acceptance_criteria: AcceptanceCriterion[];
  workspace_path?: string | null;
  created_at: string;
  updated_at: string;
  approved_at?: string | null;
  approved_by?: string | null;
}

export interface PlanStep {
  step_number: number;
  action: string;
  expected_outcome: string;
  associated_criterion_id?: string;
}

export interface TaskPlan {
  task_id: string;
  model_name: string;
  generator_status: GeneratorStatus;
  task_summary: string;
  summary: string;
  steps: PlanStep[];
  acceptance_criteria?: Array<{
    criterion_id: string;
    description: string;
    verification_method: string;
  }>;
  files_to_inspect: string[];
  tests_to_run: string[];
  risks: string[];
  verification_strategy: string;
  created_at: string;
}

export interface EvidenceItem {
  criterion_id?: string | null;
  evidence_type: EvidenceType;
  content: string;
  exit_code?: number | null;
  passed?: boolean;
  file_path?: string;
  line_range?: string;
  timestamp?: string;
}

export interface ExecutionRun {
  run_id: string;
  task_id: string;
  started_at: string;
  completed_at?: string | null;
  status: ExecutionStatus;
  command: string;
  exit_code?: number | null;
  stdout?: string;
  stderr?: string;
  source: string;
  git_diff?: string;
  evidence_items: EvidenceItem[];
  model_name?: string;
  is_manual_submission?: boolean;
  submission_notes?: string;
  provenance_details?: Record<string, any>;
  runtime_metadata?: {
    duration_ms?: number;
    memory_mb?: number;
    host?: string;
  };
}

export interface RuleEvaluation {
  rule_name: string;
  passed: boolean;
  verdict_impact: VerificationVerdict;
  message: string;
  criterion_id?: string | null;
}

export interface TestCaseResult {
  name: string;
  suite: string;
  duration_ms: number;
  status: TestStatus;
  message?: string;
}

export interface VerificationResult {
  task_id: string;
  run_id: string;
  verdict: VerificationVerdict;
  confidence_score: number;
  summary: string;
  verified_at: string;
  raw_evidence_count: number;
  rule_evaluations: RuleEvaluation[];
  test_results?: TestCaseResult[];
  verification_scope?: string;
  build_status?: "SUCCESS" | "FAILURE" | "NOT_RUN";
  lint_status?: "SUCCESS" | "FAILURE" | "NOT_RUN";
}

export interface FailureDiagnosis {
  task_id: string;
  run_id: string;
  failure_summary: string;
  likely_cause: string;
  evidence_references: string[];
  recommended_fix: string;
  suggested_retest_command: string;
  generator_status: GeneratorStatus;
  explanation_mr?: string; // Marathi/Hinglish explanation toggle
}

export interface ExecutionEvent {
  id: number;
  task_id: string;
  run_id?: string | null;
  timestamp: string;
  event_type: string;
  message: string;
  details?: Record<string, any>;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  git_url?: string;
  branch: string;
  repo_path?: string;
  language: string;
  framework?: string;
  source_type?: string;
  root_path?: string;
  repository_url?: string;
  created_at: string;
  stats?: {
    total_tasks: number;
    verified_tasks: number;
    failed_tasks: number;
    unverified_tasks: number;
  };
  directory_structure?: string[];
  dependencies?: Record<string, string>;
  detected_commands?: string[];
  modules?: string[];
  documentation?: string[];
  issues?: string[];
  missing_information?: string[];
  analysis_status?: "ANALYZED" | "IN_PROGRESS" | "FAILED" | "PENDING";
}

export interface AgentClaim {
  original_requirement: string;
  exact_claim: string;
  claimed_behavior: string;
  claimed_changed_files: string[];
  agent_metadata: {
    model: string;
    agent_id: string;
    timestamp: string;
    duration_seconds: number;
    temperature?: number;
  };
}

export interface CodeEvidenceItem {
  file: string;
  line_range: string;
  summary: string;
  verified: boolean;
  snippet?: string;
}

export interface ObservedEvidence {
  actual_changed_files: string[];
  code_evidence: CodeEvidenceItem[];
  test_results: TestCaseResult[];
  criteria_satisfied: Array<{ id: string; description: string; satisfied: boolean }>;
  missing_requirements: string[];
  discrepancies: Array<{
    field: string;
    claim: string;
    reality: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  }>;
}

export interface ClaimVsRealityComparison {
  task_id: string;
  run_id: string;
  claim: AgentClaim;
  reality: ObservedEvidence;
  verdict: VerificationVerdict;
  suggested_correction?: {
    summary: string;
    patch?: string;
    command_to_run?: string;
  };
}

export interface SecurityTestResult {
  id: string;
  test_name: string;
  category: "SANDBOX_ESCAPE" | "SHELL_INJECTION" | "UNAUTHORIZED_FILE_ACCESS" | "PATH_TRAVERSAL" | "SECRET_LEAK";
  description: string;
  expected_result: string;
  actual_result: string;
  status: "PASS" | "FAIL";
  evidence: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  timestamp: string;
}

export interface ModelTransparencyInfo {
  provider: string;
  model_id: string;
  mode: "LOCAL" | "HOSTED" | "FALLBACK";
  runtime_status: GeneratorStatus;
  endpoint: string;
  duration_ms: number;
  tokens_evaluated?: number;
  context_window_size: number;
  quantization?: string;
  fallback_reason?: string | null;
  last_health_check: string;
}

export interface RunReport {
  run: ExecutionRun;
  task: Task;
  plan?: TaskPlan;
  verification?: VerificationResult;
  diagnosis?: FailureDiagnosis;
  comparison?: ClaimVsRealityComparison;
  events: ExecutionEvent[];
}

export interface AntigravityCapabilityInfo {
  status: "NEEDS_INSTALLATION" | "CLI_AVAILABLE" | "SDK_AVAILABLE";
  cli_installed: boolean;
  cli_path?: string | null;
  sdk_installed: boolean;
  sdk_package: string;
  ide_host_detected: boolean;
  conversation_id?: string | null;
  available_modes: string[];
  supported_integrations: {
    local_safe_runner: { status: string; description: string; attribution: string };
    manual_handoff: { status: string; description: string; attribution: string };
    automated_agent_dispatch: {
      status: string;
      missing_prerequisite?: string | null;
      next_step?: string | null;
      attribution: string;
    };
  };
  notes?: string;
}

export interface HandoffPrompt {
  task_id: string;
  project_id: string;
  prompt: string;
  target_files: string[];
  acceptance_criteria: Array<{ id: string; description: string; required?: boolean }>;
  suggested_command?: string | null;
  workspace_path?: string | null;
  instructions: string;
  missing_prerequisite: string;
  next_step: string;
}

export interface HandoffSubmissionRequest {
  agent_response?: string;
  git_diff?: string;
  command?: string;
  command_exit_code?: number;
  test_output?: string;
  criterion_id?: string;
  submitted_by?: string;
  notes?: string;
}

