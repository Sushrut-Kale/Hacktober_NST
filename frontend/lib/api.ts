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
  RunReport,
} from "./types";
import {
  DEMO_PROJECTS,
  DEMO_TASKS,
  DEMO_PLANS,
  DEMO_RUNS,
  DEMO_VERIFICATIONS,
  DEMO_DIAGNOSES,
  DEMO_CLAIM_VS_REALITY,
  DEMO_EVENTS,
  DEMO_SECURITY_TESTS,
  DEMO_MODEL_TRANSPARENCY,
} from "../fixtures/demo-data";
import { DEFAULT_API_BASE_URL } from "./constants";

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("vikasa_backend_url");
    if (saved) return saved;
  }
  return DEFAULT_API_BASE_URL;
}

export function setApiBaseUrl(url: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("vikasa_backend_url", url);
  }
}

export function isMockModeForced(): boolean {
  if (typeof window !== "undefined") {
    return localStorage.getItem("vikasa_force_mock") === "true";
  }
  return false;
}

export function setMockModeForced(forced: boolean) {
  if (typeof window !== "undefined") {
    localStorage.setItem("vikasa_force_mock", String(forced));
  }
}

async function fetchWithFallback<T>(
  endpoint: string,
  options: RequestInit = {},
  fallbackData: T
): Promise<{ data: T; isMock: boolean; error?: string }> {
  if (isMockModeForced()) {
    return { data: fallbackData, isMock: true };
  }

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const json = JSON.parse(errText);
        if (json.detail) errorMsg = json.detail;
      } catch {
        if (errText) errorMsg = errText;
      }
      return {
        data: (Array.isArray(fallbackData) ? [] : fallbackData) as T,
        isMock: false,
        error: errorMsg,
      };
    }

    const data = await res.json();
    return { data, isMock: false };
  } catch (err: any) {
    return {
      data: (Array.isArray(fallbackData) ? [] : fallbackData) as T,
      isMock: false,
      error: err?.message || "Backend unreachable",
    };
  }
}

export const api = {
  async testConnection(url: string): Promise<{ ok: boolean; statusText: string; latencyMs: number }> {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${url.replace(/\/$/, "")}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - start);
      if (res.ok) {
        return { ok: true, statusText: "Online", latencyMs };
      }
      return { ok: false, statusText: `HTTP ${res.status}`, latencyMs };
    } catch (e: any) {
      return { ok: false, statusText: e?.message || "Unreachable", latencyMs: 0 };
    }
  },

  async getHealth() {
    return fetchWithFallback<{ status: string; service: string; version: string }>(
      "/health",
      {},
      { status: "healthy", service: "VIKASA API (Demo Mode)", version: "0.1.0" }
    );
  },

  async getOllamaHealth() {
    return fetchWithFallback(
      "/api/health/ollama",
      {},
      {
        status: "AI_ACTIVE",
        available: true,
        model: "gemma4:e4b",
        model_ready: true,
        all_models: ["gemma4:e4b", "qwen2.5-coder:7b"],
      }
    );
  },

  async getAntigravityHealth() {
    return fetchWithFallback(
      "/api/health/antigravity",
      {},
      {
        sdk_installed: false,
        sdk_package: "google-antigravity (PyPI)",
        cli_installed: false,
        cli_path: null,
        mcp_enabled: true,
        status: "NEEDS_INSTALLATION",
        notes: "Local runner adapter handles execution with full deterministic evidence capture.",
      }
    );
  },

  async getProjects() {
    return fetchWithFallback<Project[]>("/api/projects", {}, DEMO_PROJECTS);
  },

  async getProject(projectId: string) {
    const fallback =
      DEMO_PROJECTS.find((p) => p.id === projectId) || DEMO_PROJECTS[0];
    return fetchWithFallback<Project>(`/api/projects/${projectId}`, {}, fallback);
  },

  async createProject(data: Partial<Project>) {
    const newProj: Project = {
      id: data.id || `proj-${Date.now().toString(36)}`,
      name: data.name || "Untitled Project",
      description: data.description || "",
      git_url: data.git_url,
      branch: data.branch || "main",
      repo_path: data.repo_path,
      language: data.language || "Python",
      framework: data.framework || "FastAPI",
      created_at: new Date().toISOString(),
      stats: { total_tasks: 0, verified_tasks: 0, failed_tasks: 0, unverified_tasks: 0 },
      analysis_status: "PENDING",
    };
    return fetchWithFallback<Project>(
      "/api/projects",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      newProj
    );
  },

  async getTasks(projectId?: string) {
    let fallback = DEMO_TASKS;
    if (projectId && projectId !== "all") {
      fallback = DEMO_TASKS.filter((t) => t.project_id === projectId);
    }
    const query = projectId && projectId !== "all" ? `?project_id=${projectId}` : "";
    return fetchWithFallback<Task[]>(`/api/tasks${query}`, {}, fallback);
  },

  async getTask(taskId: string) {
    const fallback = DEMO_TASKS.find((t) => t.id === taskId) || DEMO_TASKS[0];
    return fetchWithFallback<Task>(`/api/tasks/${taskId}`, {}, fallback);
  },

  async createTask(data: {
    id?: string;
    title: string;
    description: string;
    acceptance_criteria: Array<{ id: string; description: string; required?: boolean }>;
    workspace_path?: string | null;
  }) {
    const fallback: Task = {
      id: data.id || `task-${Date.now().toString(36)}`,
      project_id: "default",
      title: data.title,
      description: data.description,
      state: "CREATED",
      acceptance_criteria: data.acceptance_criteria.map((c) => ({
        ...c,
        required: c.required ?? true,
      })),
      workspace_path: data.workspace_path || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return fetchWithFallback<Task>(
      "/api/tasks",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      fallback
    );
  },

  async getPlan(taskId: string) {
    const fallback = DEMO_PLANS[taskId] || DEMO_PLANS["task-user-auth"];
    return fetchWithFallback<TaskPlan>(`/api/tasks/${taskId}/plan`, {}, fallback);
  },

  async generatePlan(taskId: string, repoContext?: string) {
    const fallback = DEMO_PLANS[taskId] || DEMO_PLANS["task-user-auth"];
    const query = repoContext ? `?repo_context=${encodeURIComponent(repoContext)}` : "";
    return fetchWithFallback<TaskPlan>(
      `/api/tasks/${taskId}/plan${query}`,
      { method: "POST" },
      fallback
    );
  },

  async approvePlan(taskId: string, approvedBy = "USER_LEAD", notes = "Approved via UI") {
    const baseTask = DEMO_TASKS.find((t) => t.id === taskId) || DEMO_TASKS[0];
    const fallback: Task = {
      ...baseTask,
      state: "APPROVED",
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
    };
    return fetchWithFallback<Task>(
      `/api/tasks/${taskId}/approve`,
      {
        method: "POST",
        body: JSON.stringify({ approved_by: approvedBy, notes }),
      },
      fallback
    );
  },

  async executeTask(
    taskId: string,
    command: string,
    criterionId?: string,
    timeoutSeconds = 30
  ) {
    const fallback = DEMO_RUNS["run-b8f3e21a"];
    return fetchWithFallback<ExecutionRun>(
      `/api/tasks/${taskId}/execute`,
      {
        method: "POST",
        body: JSON.stringify({ command, criterion_id: criterionId, timeout_seconds: timeoutSeconds }),
      },
      fallback
    );
  },

  async getEvents(taskId: string) {
    const fallback = DEMO_EVENTS.filter((e) => e.task_id === taskId);
    return fetchWithFallback<ExecutionEvent[]>(
      `/api/tasks/${taskId}/events`,
      {},
      fallback.length ? fallback : DEMO_EVENTS
    );
  },

  async verifyTask(taskId: string, runId?: string) {
    const fallback = (runId && DEMO_VERIFICATIONS[runId]) || DEMO_VERIFICATIONS["run-b8f3e21a"];
    const query = runId ? `?run_id=${runId}` : "";
    return fetchWithFallback<VerificationResult>(
      `/api/tasks/${taskId}/verify${query}`,
      { method: "POST" },
      fallback
    );
  },

  async getLatestVerification(taskId: string) {
    const fallback = DEMO_VERIFICATIONS["run-b8f3e21a"];
    return fetchWithFallback<VerificationResult>(
      `/api/tasks/${taskId}/verification`,
      {},
      fallback
    );
  },

  async getRuns(taskId?: string) {
    const query = taskId ? `?task_id=${taskId}` : "";
    return fetchWithFallback<ExecutionRun[]>(
      `/api/runs${query}`,
      {},
      Object.values(DEMO_RUNS)
    );
  },

  async getExecutionRun(runId: string) {
    const fallback = DEMO_RUNS[runId] || DEMO_RUNS["run-b8f3e21a"];
    return fetchWithFallback<ExecutionRun>(`/api/runs/${runId}`, {}, fallback);
  },

  async getClaimVsReality(runId: string) {
    const fallback =
      DEMO_CLAIM_VS_REALITY[runId] || DEMO_CLAIM_VS_REALITY["run-b8f3e21a"];
    return fetchWithFallback<ClaimVsRealityComparison>(
      `/api/runs/${runId}/claim-vs-reality`,
      {},
      fallback
    );
  },

  async getDiagnosis(runId: string) {
    const fallback =
      DEMO_DIAGNOSES[runId] || DEMO_DIAGNOSES["run-auth-failed"];
    return fetchWithFallback<FailureDiagnosis>(
      `/api/runs/${runId}/diagnosis`,
      {},
      fallback
    );
  },

  async getRunReport(runId: string) {
    const run = DEMO_RUNS[runId] || DEMO_RUNS["run-b8f3e21a"];
    const task = DEMO_TASKS.find((t) => t.id === run.task_id) || DEMO_TASKS[0];
    const plan = DEMO_PLANS[task.id];
    const verification = DEMO_VERIFICATIONS[runId];
    const diagnosis = DEMO_DIAGNOSES[runId];
    const comparison = DEMO_CLAIM_VS_REALITY[runId];
    const events = DEMO_EVENTS.filter((e) => e.task_id === task.id);

    const fallback: RunReport = {
      run,
      task,
      plan,
      verification,
      diagnosis,
      comparison,
      events,
    };

    return fetchWithFallback<RunReport>(`/api/runs/${runId}/report`, {}, fallback);
  },

  async getSecurityTests() {
    return fetchWithFallback<SecurityTestResult[]>(
      "/api/security/results",
      {},
      DEMO_SECURITY_TESTS
    );
  },

  async getModelInfo() {
    return fetchWithFallback<ModelTransparencyInfo>(
      "/api/model/info",
      {},
      DEMO_MODEL_TRANSPARENCY
    );
  },
};
