"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import {
  Task,
  TaskPlan,
  ExecutionRun,
  VerificationResult,
  ExecutionEvent,
  AntigravityCapabilityInfo,
  HandoffPrompt,
} from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/formatters";
import {
  ArrowLeft,
  Play,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Scale,
  Terminal,
  FileCode,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  History,
  Info,
  Copy,
  Check,
  Bot,
  Send,
  HelpCircle,
} from "lucide-react";

export default function TaskDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = (params?.taskId as string) || "task-user-auth";

  const { showToast } = useProject();
  const [task, setTask] = useState<Task | null>(null);
  const [plan, setPlan] = useState<TaskPlan | null>(null);
  const [latestRun, setLatestRun] = useState<ExecutionRun | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [agCaps, setAgCaps] = useState<AntigravityCapabilityInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Execution Mode State
  const [executionMode, setExecutionMode] = useState<
    "LOCAL_SAFE_RUNNER" | "ANTIGRAVITY_MANUAL_HANDOFF" | "ANTIGRAVITY_AGENT"
  >("LOCAL_SAFE_RUNNER");

  // Local Safe Runner State
  const [command, setCommand] = useState("python -m pytest backend/tests/test_api_endpoints.py -v");
  const [isExecuting, setIsExecuting] = useState(false);

  // Manual Handoff State
  const [handoffPrompt, setHandoffPrompt] = useState<HandoffPrompt | null>(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [handoffResponse, setHandoffResponse] = useState("");
  const [handoffDiff, setHandoffDiff] = useState("");
  const [handoffCmd, setHandoffCmd] = useState("pytest");
  const [handoffExitCode, setHandoffExitCode] = useState(0);
  const [isSubmittingHandoff, setIsSubmittingHandoff] = useState(false);

  useEffect(() => {
    async function loadTaskData() {
      setLoading(true);
      try {
        const taskRes = await api.getTask(taskId);
        setTask(taskRes.data);

        const planRes = await api.getPlan(taskId);
        setPlan(planRes.data);

        const runRes = await api.getExecutionRun("run-b8f3e21a");
        setLatestRun(runRes.data);

        const verifRes = await api.getLatestVerification(taskId);
        setVerification(verifRes.data);

        const evtsRes = await api.getEvents(taskId);
        setEvents(evtsRes.data);

        const capsRes = await api.getAntigravityHealth();
        setAgCaps(capsRes.data as any);
      } catch (e) {
        console.error("Task detail error", e);
      } finally {
        setLoading(false);
      }
    }
    loadTaskData();
  }, [taskId]);

  const isExecutionAllowed =
    task?.state === "APPROVED" || task?.state === "RUNNING" || task?.state === "FAILED" || task?.state === "REVIEW_REQUIRED";

  const handleExecuteLocal = async () => {
    if (!task) return;
    if (!isExecutionAllowed) {
      showToast(`Cannot execute task in state '${task.state}'. Explicit approval is required.`, "error");
      return;
    }

    setIsExecuting(true);
    try {
      const res = await api.executeTask(taskId, command);
      showToast("Command executed via safe runner adapter!", "success");
      setLatestRun(res.data);
      router.push(`/executions/${res.data.run_id}`);
    } catch (err: any) {
      showToast(err?.message || "Execution failed", "error");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleFetchHandoffPrompt = async () => {
    setIsLoadingPrompt(true);
    try {
      const res = await api.getHandoffPrompt(taskId);
      setHandoffPrompt(res.data);
      showToast("Generated task prompt for Antigravity session.", "success");
    } catch (err: any) {
      showToast("Failed to generate handoff prompt", "error");
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  const handleCopyPrompt = () => {
    if (!handoffPrompt) return;
    navigator.clipboard.writeText(handoffPrompt.prompt);
    setCopiedPrompt(true);
    showToast("Prompt copied to clipboard!", "success");
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleSubmitHandoff = async () => {
    if (!task) return;
    if (!isExecutionAllowed) {
      showToast(`Cannot submit run for task in state '${task.state}'. Explicit approval is required.`, "error");
      return;
    }

    setIsSubmittingHandoff(true);
    try {
      const res = await api.submitHandoff(taskId, {
        agent_response: handoffResponse,
        git_diff: handoffDiff,
        command: handoffCmd,
        command_exit_code: Number(handoffExitCode),
        test_output: handoffResponse,
        notes: "Submitted via Antigravity manual handoff console",
      });
      showToast("Manual Antigravity telemetry recorded (unverified user paste)", "info");
      setLatestRun(res.data);
      router.push(`/executions/${res.data.run_id}`);
    } catch (err: any) {
      showToast(err?.message || "Handoff submission failed", "error");
    } finally {
      setIsSubmittingHandoff(false);
    }
  };

  const handleDispatchAgent = async () => {
    if (!task) return;
    if (!isExecutionAllowed) {
      showToast(`Approval required before agent dispatch.`, "error");
      return;
    }
    try {
      const res = await api.dispatchAgent(taskId);
      showToast("Antigravity agent dispatched successfully!", "success");
      router.push(`/executions/${res.data.run_id}`);
    } catch (err: any) {
      showToast(err?.message || "Automated dispatch unavailable: CLI or SDK missing.", "error");
    }
  };

  if (loading || !task) {
    return <div className="p-12 text-center text-slate-400">Loading task details...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/tasks"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-bold text-sky-400">{task.id}</span>
              <Badge status={task.state} size="sm" />
              <span className="text-[11px] text-slate-400 font-mono">Project: {task.project_id}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1">{task.title}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/tasks/${taskId}/plan`}>
            <Button variant="outline" size="sm" icon={<Sparkles className="w-4 h-4 text-sky-400" />}>
              Plan & Approval
            </Button>
          </Link>
          <Link href={`/verification/run-b8f3e21a/claim-vs-reality`}>
            <Button variant="brand" size="sm" icon={<Scale className="w-4 h-4" />}>
              Claim vs Reality
            </Button>
          </Link>
        </div>
      </div>

      {/* Task Description & Criteria */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Description, Criteria, and Unified Execution Console */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Requirement Description</h2>
            <p className="text-sm text-slate-300 leading-relaxed">{task.description}</p>

            <div className="pt-4 border-t border-white/5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Explicit Acceptance Criteria ({task.acceptance_criteria.length})
              </h3>
              <div className="space-y-2.5">
                {task.acceptance_criteria.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-lg bg-surface-100/70 border border-white/5 flex items-start gap-3"
                  >
                    <span
                      className={`px-2 py-0.5 text-xs font-mono font-bold rounded ${
                        c.satisfied
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : c.satisfied === false
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-white/5 text-slate-300 border border-white/10"
                      }`}
                    >
                      {c.id}
                    </span>
                    <div className="flex-1 text-xs">
                      <p className="text-slate-200">{c.description}</p>
                      {c.verification_method && (
                        <p className="text-[11px] font-mono text-slate-400 mt-1">Test: {c.verification_method}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Unified Execution & Dispatch Console */}
          <Card className="p-6 space-y-5 border-sky-500/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-sky-400" />
                <h2 className="text-base font-bold text-white">Execution & Agent Console</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase bg-slate-800 text-slate-300 border border-white/10">
                  Antigravity: {agCaps?.status || "NEEDS_INSTALLATION"}
                </span>
              </div>
            </div>

            {/* Approval Gate Warning */}
            {!isExecutionAllowed && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Execution blocked by invariant. You must review and approve the task plan before executing code or
                  submitting agent telemetry.
                </span>
              </div>
            )}

            {/* Execution Mode Tabs */}
            <div className="flex rounded-lg bg-surface-100 p-1 border border-white/5 text-xs">
              <button
                type="button"
                onClick={() => setExecutionMode("LOCAL_SAFE_RUNNER")}
                className={`flex-1 py-1.5 px-3 rounded-md font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  executionMode === "LOCAL_SAFE_RUNNER"
                    ? "bg-sky-500 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                Local Safe Runner
              </button>
              <button
                type="button"
                onClick={() => setExecutionMode("ANTIGRAVITY_MANUAL_HANDOFF")}
                className={`flex-1 py-1.5 px-3 rounded-md font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  executionMode === "ANTIGRAVITY_MANUAL_HANDOFF"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                Antigravity Manual Handoff
              </button>
              <button
                type="button"
                onClick={() => setExecutionMode("ANTIGRAVITY_AGENT")}
                className={`flex-1 py-1.5 px-3 rounded-md font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  executionMode === "ANTIGRAVITY_AGENT"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white opacity-80"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Automated Dispatch
              </button>
            </div>

            {/* Tab 1: Local Safe Runner */}
            {executionMode === "LOCAL_SAFE_RUNNER" && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-surface-100/50 border border-white/5 text-xs text-slate-400 flex items-start gap-2">
                  <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <span>
                    Executes allowlisted binaries (<code>python</code>, <code>pytest</code>, <code>git</code>) locally in
                    the workspace with strict timeouts, sandbox boundaries, and automatic secret redaction.
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-300">Command to Execute in Workspace:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      disabled={!isExecutionAllowed || isExecuting}
                      className="flex-1 px-3 py-2 rounded-lg bg-surface-100 border border-white/10 text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-500/50 disabled:opacity-50"
                    />
                    <Button
                      variant="brand"
                      size="md"
                      disabled={!isExecutionAllowed}
                      loading={isExecuting}
                      onClick={handleExecuteLocal}
                      icon={<Play className="w-4 h-4" />}
                    >
                      Execute
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Antigravity Manual Handoff */}
            {executionMode === "ANTIGRAVITY_MANUAL_HANDOFF" && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 flex items-start gap-2">
                  <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Manual Handoff Mode: </span>
                    Generate a task prompt, copy it to your Antigravity chat session, and paste the code diff and test
                    output below for deterministic verification. Telemetry is labeled as user-provided until verified.
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFetchHandoffPrompt}
                    loading={isLoadingPrompt}
                    icon={<FileCode className="w-4 h-4 text-purple-400" />}
                  >
                    Generate Antigravity Prompt
                  </Button>
                  {handoffPrompt && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCopyPrompt}
                      icon={copiedPrompt ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    >
                      {copiedPrompt ? "Copied Prompt" : "Copy to Clipboard"}
                    </Button>
                  )}
                </div>

                {handoffPrompt && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono text-slate-400">Task Prompt for Antigravity Session:</label>
                    <textarea
                      readOnly
                      rows={5}
                      value={handoffPrompt.prompt}
                      className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-white/10 text-xs font-mono text-slate-300 focus:outline-none"
                    />
                  </div>
                )}

                <div className="pt-2 border-t border-white/5 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Submit Agent Output & Telemetry
                  </h4>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-400">Agent Response / Test Output:</label>
                    <textarea
                      rows={3}
                      value={handoffResponse}
                      onChange={(e) => setHandoffResponse(e.target.value)}
                      placeholder="Paste agent response or test run output..."
                      className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-white/10 text-xs font-mono text-slate-100 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-400">Git Diff (Optional):</label>
                    <textarea
                      rows={3}
                      value={handoffDiff}
                      onChange={(e) => setHandoffDiff(e.target.value)}
                      placeholder="Paste git diff from code modifications..."
                      className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-white/10 text-xs font-mono text-slate-100 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-slate-400">Verification Test Command:</label>
                      <input
                        type="text"
                        value={handoffCmd}
                        onChange={(e) => setHandoffCmd(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-surface-100 border border-white/10 text-xs font-mono text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-400">Claimed Exit Code:</label>
                      <input
                        type="number"
                        value={handoffExitCode}
                        onChange={(e) => setHandoffExitCode(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg bg-surface-100 border border-white/10 text-xs font-mono text-slate-100"
                      />
                    </div>
                  </div>

                  <Button
                    variant="brand"
                    size="md"
                    disabled={!isExecutionAllowed}
                    loading={isSubmittingHandoff}
                    onClick={handleSubmitHandoff}
                    icon={<Send className="w-4 h-4" />}
                  >
                    Submit Telemetry for Deterministic Verification
                  </Button>
                </div>
              </div>
            )}

            {/* Tab 3: Automated Agent Dispatch */}
            {executionMode === "ANTIGRAVITY_AGENT" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-surface-100/70 border border-white/10 space-y-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white">Antigravity Agent Dispatch Status</h3>
                  </div>

                  <div className="text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">CLI Binary (agy)</span>
                      <span className={agCaps?.cli_installed ? "text-emerald-400" : "text-amber-400"}>
                        {agCaps?.cli_installed ? "Available" : "Not Found"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">Python SDK (google.antigravity)</span>
                      <span className={agCaps?.sdk_installed ? "text-emerald-400" : "text-amber-400"}>
                        {agCaps?.sdk_installed ? "Installed" : "Not Installed"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">Overall Dispatch Readiness</span>
                      <span className="text-amber-400 font-bold">{agCaps?.status || "NEEDS_INSTALLATION"}</span>
                    </div>
                  </div>

                  {agCaps?.status === "NEEDS_INSTALLATION" && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                      <p className="font-bold">Missing Prerequisite:</p>
                      <p className="font-mono text-[11px]">
                        Install the Antigravity Python package: <code>pip install google-antigravity</code> or add the{" "}
                        <code>agy</code> CLI executable to your system PATH.
                      </p>
                      <p className="text-[11px] text-slate-400 pt-1">
                        Use the <strong>Antigravity Manual Handoff</strong> tab above to run prompts directly in your
                        chat session without requiring direct SDK dispatch.
                      </p>
                    </div>
                  )}

                  <Button
                    variant="brand"
                    size="md"
                    disabled={agCaps?.status === "NEEDS_INSTALLATION" || !isExecutionAllowed}
                    onClick={handleDispatchAgent}
                    icon={<Play className="w-4 h-4" />}
                  >
                    Dispatch Agent to Workspace
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Col: Metadata, Latest Verification & Events */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <Card className="p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Task Metadata</h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Created</span>
                <span className="text-slate-200">{formatDate(task.created_at)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Updated</span>
                <span className="text-slate-200">{formatDate(task.updated_at)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Approved</span>
                <span className="text-slate-200">{task.approved_at ? formatDate(task.approved_at) : "Pending"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Reviewer</span>
                <span className="text-slate-200">{task.approved_by || "—"}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Execution Mode</span>
                <span className="text-sky-400">{executionMode}</span>
              </div>
            </div>
          </Card>

          {/* Verification Status Card */}
          {verification && (
            <Card
              borderVariant={verification.verdict === "VERIFIED" ? "emerald" : "rose"}
              className="p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Latest Verdict</span>
                <Badge status={verification.verdict} size="sm" />
              </div>
              <p className="text-xs text-slate-300 leading-snug">{verification.summary}</p>
              <div className="pt-2 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">
                  Confidence: {(verification.confidence_score * 100).toFixed(0)}%
                </span>
                <Link href="/verification/run-b8f3e21a" className="text-sky-400 hover:text-sky-300 font-semibold">
                  View Details →
                </Link>
              </div>
            </Card>
          )}

          {/* Task Events Timeline */}
          <Card className="p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Audit Trail</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {events.map((evt) => (
                <div key={evt.id} className="text-xs space-y-0.5">
                  <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
                    <span className="font-semibold text-slate-300">{evt.event_type}</span>
                    <span>{formatDate(evt.timestamp).split(",")[1]}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-tight">{evt.message}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
