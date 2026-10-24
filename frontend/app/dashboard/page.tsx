"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { Task, ExecutionEvent } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/formatters";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Plus,
  GitBranch,
  FolderGit2,
  Layers,
  Info,
  AlertTriangle,
  Terminal,
  ShieldCheck,
  Scale,
  Bot,
  Cpu,
  Sparkles,
} from "lucide-react";
import { AntigravityCapabilityInfo } from "@/lib/types";

// ------------------------------------------------------------------
// Compact metric card
// ------------------------------------------------------------------
function MetricCard({
  label,
  value,
  description,
  accent,
}: {
  label: string;
  value: number;
  description: string;
  accent: "default" | "emerald" | "rose" | "amber";
}) {
  const colors = {
    default:  { num: "#94a3b8", border: "rgba(255,255,255,0.08)" },
    emerald:  { num: "#34d399", border: "rgba(52,211,153,0.2)"  },
    rose:     { num: "#f87171", border: "rgba(248,113,113,0.2)" },
    amber:    { num: "#fbbf24", border: "rgba(251,191,36,0.2)"  },
  };
  const c = colors[accent];

  return (
    <div
      className="px-5 py-4 rounded-xl"
      style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${c.border}` }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className="text-3xl font-black font-mono leading-none" style={{ color: c.num }}>
        {value}
      </p>
      <p className="text-[11px] text-slate-600 mt-1.5 leading-snug">{description}</p>
    </div>
  );
}

// ------------------------------------------------------------------
// Task row
// ------------------------------------------------------------------
function TaskRow({ task }: { task: Task }) {
  const actionByState = (): React.ReactNode => {
    if (task.state === "CREATED" || task.state === "PLANNED")
      return (
        <Link href={`/tasks/${task.id}/plan`}>
          <Button variant="brand" size="sm">
            {task.state === "CREATED" ? "Generate Plan" : "Review Plan"}
          </Button>
        </Link>
      );
    if (task.state === "APPROVED")
      return (
        <Link href={`/tasks/${task.id}`}>
          <Button variant="brand" size="sm" icon={<Terminal className="w-3.5 h-3.5" />}>
            Execute
          </Button>
        </Link>
      );
    if (task.state === "FAILED")
      return (
        <Link href={`/tasks/${task.id}`}>
          <Button variant="danger" size="sm" icon={<AlertTriangle className="w-3.5 h-3.5" />}>
            Diagnose
          </Button>
        </Link>
      );
    if (task.state === "VERIFIED")
      return (
        <Link href={`/tasks/${task.id}`}>
          <Button variant="outline" size="sm" icon={<ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}>
            Results
          </Button>
        </Link>
      );
    return (
      <Link href={`/tasks/${task.id}`}>
        <Button variant="secondary" size="sm">Details</Button>
      </Link>
    );
  };

  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl group transition-colors"
      style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-[11px] font-mono text-sky-500">{task.id}</span>
          <Badge status={task.state} size="sm" />
        </div>
        <Link
          href={`/tasks/${task.id}`}
          className="text-sm font-semibold text-slate-100 group-hover:text-sky-400 transition-colors block truncate"
        >
          {task.title}
        </Link>
        <p className="text-[11px] text-slate-500 truncate mt-0.5">{task.description}</p>
      </div>
      <div className="shrink-0">{actionByState()}</div>
    </div>
  );
}

// ------------------------------------------------------------------
// Dashboard Page
// ------------------------------------------------------------------
export default function DashboardPage() {
  const { currentProject, isMockMode, isBackendOnline } = useProject();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [antigravityCap, setAntigravityCap] = useState<AntigravityCapabilityInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [tasksRes, eventsRes, agRes] = await Promise.all([
          api.getTasks(currentProject?.id),
          api.getEvents("task-user-auth"),
          api.getAntigravityHealth(),
        ]);
        if (!cancelled) {
          setTasks(tasksRes.data);
          setEvents(eventsRes.data);
          setAntigravityCap(agRes.data);
        }
      } catch (e) {
        console.error("Dashboard load error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [currentProject?.id]);

  const verifiedCount  = tasks.filter((t) => t.state === "VERIFIED").length;
  const failedCount    = tasks.filter((t) => t.state === "FAILED").length;
  const pendingCount   = tasks.filter((t) => ["CREATED", "PLANNED", "APPROVED"].includes(t.state)).length;

  const activeTasks = tasks
    .filter((t) => !["VERIFIED"].includes(t.state))
    .slice(0, 6);

  const needsAttention = tasks.filter((t) =>
    ["FAILED", "REVIEW_REQUIRED", "PLANNED", "APPROVED"].includes(t.state)
  );

  return (
    <div className="space-y-6">
      {/* Demo mode banner */}
      {(isMockMode || !isBackendOnline) && (
        <div
          className="flex items-start gap-3 p-3 rounded-lg text-xs"
          style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}
        >
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-px" />
          <span className="text-slate-400">
            Showing <strong className="text-amber-400">demo fixtures</strong>.
            Start the FastAPI backend at{" "}
            <code className="font-mono text-slate-300 bg-white/5 px-1 rounded">http://localhost:8000</code>{" "}
            to load real data.{" "}
            <Link href="/settings" className="underline text-amber-400 hover:text-amber-300">
              Configure
            </Link>
          </span>
        </div>
      )}

      {/* Project header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase rounded"
              style={{ background: "rgba(0,195,255,0.1)", color: "#00c3ff", border: "1px solid rgba(0,195,255,0.2)" }}
            >
              Active Project
            </span>
            <span className="text-[11px] text-slate-600 font-mono">
              ID: {currentProject?.id || "—"}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {currentProject?.name || "VIKASA Platform"}
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            {currentProject?.description || "Deterministic verification and evidence platform for autonomous coding agents."}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {[
              { icon: <FolderGit2 className="w-3 h-3" />, label: currentProject?.language || "Python / TypeScript" },
              { icon: <GitBranch className="w-3 h-3" />, label: `branch: ${currentProject?.branch || "main"}` },
              { icon: <Layers className="w-3 h-3" />, label: currentProject?.framework || "FastAPI & Next.js" },
            ].map((tag, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono text-slate-400 rounded-md"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <span className="text-slate-500">{tag.icon}</span>
                {tag.label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Link href="/verification">
            <Button variant="outline" size="sm" icon={<Scale className="w-4 h-4" />}>
              Claim vs Reality
            </Button>
          </Link>
          <Link href="/tasks/new">
            <Button variant="brand" size="sm" icon={<Plus className="w-4 h-4" />}>
              New Task
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total Tasks"   value={tasks.length}  description="Registered lifecycle workflows" accent="default" />
        <MetricCard label="Verified"      value={verifiedCount} description="Passed all deterministic rules"  accent="emerald" />
        <MetricCard label="Failed"        value={failedCount}   description="Exit code ≠ 0 or missing evidence" accent="rose" />
        <MetricCard label="Pending"       value={pendingCount}  description="Awaiting approval or execution"  accent="amber"  />
      </div>

      {/* Attention banner (when tasks need action) */}
      {!loading && needsAttention.length > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)" }}
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-slate-300">
            <strong className="text-amber-400">{needsAttention.length}</strong>{" "}
            task{needsAttention.length !== 1 ? "s" : ""} need attention — pending approval or failing verification.
          </span>
          <Link href="/tasks" className="ml-auto text-xs font-semibold text-amber-400 hover:text-amber-300 shrink-0">
            View tasks →
          </Link>
        </div>
      )}

      {/* Main grid: tasks left, audit right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Tasks */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Active Tasks</h2>
              <p className="text-[11px] text-slate-600">Tasks in the verification lifecycle</p>
            </div>
            <Link
              href="/tasks"
              className="text-xs font-medium text-sky-500 hover:text-sky-400 flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[72px] rounded-xl shimmer" />
              ))}
            </div>
          ) : activeTasks.length === 0 ? (
            <div
              className="py-12 text-center rounded-xl"
              style={{ border: "1px dashed rgba(255,255,255,0.1)" }}
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
              <p className="text-sm font-medium text-slate-300">All tasks verified</p>
              <p className="text-xs text-slate-600 mt-1">No active tasks need attention right now.</p>
              <Link href="/tasks/new" className="mt-4 inline-block">
                <Button variant="brand" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                  Create Task
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {activeTasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>

        {/* Audit Events */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Execution Audit</h2>
              <p className="text-[11px] text-slate-600">Recent lifecycle events</p>
            </div>
            <Link
              href="/executions"
              className="text-xs font-medium text-sky-500 hover:text-sky-400 flex items-center gap-1 transition-colors"
            >
              Executions <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div
            className="rounded-xl divide-y divide-white/5"
            style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}
          >
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 rounded shimmer" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-slate-600">No audit events yet.</p>
              </div>
            ) : (
              events.slice(0, 7).map((evt) => {
                const dotColor =
                  evt.event_type.includes("VERIF") ? "#34d399" :
                  evt.event_type.includes("FAIL")  ? "#f87171" :
                  evt.event_type.includes("APPROV")? "#a78bfa" : "#38bdf8";

                return (
                  <div key={evt.id} className="flex items-start gap-3 px-4 py-3">
                    <span
                      className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                      style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}60` }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono font-semibold text-slate-300 truncate">
                          {evt.event_type}
                        </span>
                        <span className="text-[10px] font-mono text-slate-600 shrink-0">
                          {formatDate(evt.timestamp).split(",")[1]?.trim()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{evt.message}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Verification integrity notice */}
          <div
            className="px-4 py-3 rounded-xl"
            style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.12)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              <span className="text-xs font-semibold text-emerald-400">Rule Engine Active</span>
            </div>
            <p className="text-[10px] text-slate-600 font-mono leading-snug">
              All verdicts are governed by deterministic rule evaluation — never by AI inference.
            </p>
          </div>

          {/* Antigravity Integration & Execution Modes */}
          <div
            className="p-4 rounded-xl space-y-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-semibold text-white">Antigravity & Runner Capabilities</span>
              </div>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
                style={{
                  background: antigravityCap?.status === "READY" ? "rgba(52,211,153,0.1)" : "rgba(251,191,36,0.1)",
                  color: antigravityCap?.status === "READY" ? "#34d399" : "#fbbf24",
                  border: `1px solid ${antigravityCap?.status === "READY" ? "rgba(52,211,153,0.25)" : "rgba(251,191,36,0.25)"}`,
                }}
              >
                {antigravityCap?.status || "NEEDS_INSTALLATION"}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              {antigravityCap?.notes || "Truthful capability status reporting for local and agent execution environments."}
            </p>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
                <span className="text-slate-300">LOCAL_SAFE_RUNNER</span>
                <span className="text-emerald-400 text-[10px] uppercase font-bold">Enabled</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
                <span className="text-slate-300">ANTIGRAVITY_MANUAL_HANDOFF</span>
                <span className="text-sky-400 text-[10px] uppercase font-bold">Available</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
                <span className="text-slate-500">ANTIGRAVITY_AGENT (Automated)</span>
                <span className="text-amber-400 text-[10px] uppercase font-bold">
                  {antigravityCap?.cli_installed || antigravityCap?.sdk_installed ? "Enabled" : "Missing Prereq"}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">
                IDE Host: {antigravityCap?.ide_host_detected ? "Detected (Active)" : "Standalone"}
              </span>
              <Link href="/tasks" className="text-sky-400 hover:text-sky-300 font-medium">
                Execute Task →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Empty state — no tasks at all */}
      {!loading && tasks.length === 0 && (
        <div
          className="mt-4 p-12 rounded-2xl text-center"
          style={{ border: "1px dashed rgba(255,255,255,0.1)" }}
        >
          <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(0,195,255,0.08)", border: "1px solid rgba(0,195,255,0.15)" }}>
            <Plus className="w-6 h-6 text-sky-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Get started with VIKASA</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Create your first task, define acceptance criteria, generate an AI plan, and let deterministic verification confirm the result.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/tasks/new">
              <Button variant="brand" icon={<Plus className="w-4 h-4" />}>
                Create First Task
              </Button>
            </Link>
            <Link href="/projects/new">
              <Button variant="secondary">
                Register Project
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
