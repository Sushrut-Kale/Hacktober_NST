"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { Task, TaskPlan, ExecutionRun, VerificationResult, ExecutionEvent } from "@/lib/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
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
  const [loading, setLoading] = useState(true);

  // Command Execution State
  const [command, setCommand] = useState("python -m pytest backend/tests/test_api_endpoints.py -v");
  const [isExecuting, setIsExecuting] = useState(false);

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
      } catch (e) {
        console.error("Task detail error", e);
      } finally {
        setLoading(false);
      }
    }
    loadTaskData();
  }, [taskId]);

  const handleExecute = async () => {
    if (!task) return;
    if (task.state !== "APPROVED" && task.state !== "VERIFYING" && task.state !== "FAILED") {
      showToast(
        `Cannot execute task in state '${task.state}'. Explicit approval is required.`,
        "error"
      );
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

  if (loading || !task) {
    return (
      <div className="p-12 text-center text-slate-400">
        Loading task details...
      </div>
    );
  }

  const isExecutionAllowed =
    task.state === "APPROVED" || task.state === "FAILED" || task.state === "REVIEW_REQUIRED";

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
              <span className="text-xs font-mono font-bold text-sky-400">
                {task.id}
              </span>
              <Badge status={task.state} size="sm" />
              <span className="text-[11px] text-slate-400 font-mono">
                Project: {task.project_id}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
              {task.title}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/tasks/${taskId}/plan`}>
            <Button
              variant="outline"
              size="sm"
              icon={<Sparkles className="w-4 h-4 text-sky-400" />}
            >
              Plan & Approval
            </Button>
          </Link>
          <Link href={`/verification/run-b8f3e21a/claim-vs-reality`}>
            <Button
              variant="brand"
              size="sm"
              icon={<Scale className="w-4 h-4" />}
            >
              Claim vs Reality
            </Button>
          </Link>
        </div>
      </div>

      {/* Task Description & Criteria */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Description & Criteria */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Requirement Description
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              {task.description}
            </p>

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
                        <p className="text-[11px] font-mono text-slate-400 mt-1">
                          Test: {c.verification_method}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Safe Execution Console */}
          <Card className="p-6 space-y-4 border-sky-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-sky-400" />
                <h2 className="text-base font-bold text-white">
                  Safe Execution Runner
                </h2>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Allowlisted: python, pytest, git
              </span>
            </div>

            {!isExecutionAllowed && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Execution blocked by state machine invariant. You must review and approve the task plan before running commands.
                </span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Command to Execute in Workspace:
              </label>
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
                  onClick={handleExecute}
                  icon={<Play className="w-4 h-4" />}
                >
                  Execute
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Col: Metadata, Latest Verification & Events */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <Card className="p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Task Metadata
            </h3>
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
                <span className="text-slate-200">
                  {task.approved_at ? formatDate(task.approved_at) : "Pending"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Reviewer</span>
                <span className="text-slate-200">{task.approved_by || "—"}</span>
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
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Latest Verdict
                </span>
                <Badge status={verification.verdict} size="sm" />
              </div>
              <p className="text-xs text-slate-300 leading-snug">
                {verification.summary}
              </p>
              <div className="pt-2 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">
                  Confidence: {(verification.confidence_score * 100).toFixed(0)}%
                </span>
                <Link
                  href="/verification/run-b8f3e21a"
                  className="text-sky-400 hover:text-sky-300 font-semibold"
                >
                  View Details →
                </Link>
              </div>
            </Card>
          )}

          {/* Task Events Timeline */}
          <Card className="p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Audit Trail
            </h3>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {events.map((evt) => (
                <div key={evt.id} className="text-xs space-y-0.5">
                  <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
                    <span className="font-semibold text-slate-300">
                      {evt.event_type}
                    </span>
                    <span>{formatDate(evt.timestamp).split(",")[1]}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-tight">
                    {evt.message}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
