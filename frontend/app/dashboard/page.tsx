"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { Task, ExecutionEvent } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/formatters";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Scale,
  Plus,
  FolderGit2,
  GitBranch,
  Activity,
  Layers,
  Info,
  History,
  ShieldCheck,
  Cpu,
  Zap,
} from "lucide-react";

function StatCard({
  label,
  value,
  icon,
  color,
  description,
  delay = 0,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "brand" | "emerald" | "rose" | "amber" | "default";
  description: string;
  delay?: number;
}) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 600;
    const step = Math.ceil(value / (duration / 16)) || 1;
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        start = Math.min(start + step, value);
        setDisplayed(start);
        if (start >= value) clearInterval(interval);
      }, 16);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  const colorTokens = {
    brand: {
      text: "#58AAE1",
      bg: "rgba(11, 20, 35, 0.85)",
      border: "rgba(88, 170, 225, 0.25)",
      icon: "rgba(88, 170, 225, 0.15)",
    },
    emerald: {
      text: "#10b981",
      bg: "rgba(11, 20, 35, 0.85)",
      border: "rgba(16, 185, 129, 0.25)",
      icon: "rgba(16, 185, 129, 0.15)",
    },
    rose: {
      text: "#f87171",
      bg: "rgba(11, 20, 35, 0.85)",
      border: "rgba(239, 68, 68, 0.25)",
      icon: "rgba(239, 68, 68, 0.15)",
    },
    amber: {
      text: "#fbbf24",
      bg: "rgba(11, 20, 35, 0.85)",
      border: "rgba(245, 158, 11, 0.25)",
      icon: "rgba(245, 158, 11, 0.15)",
    },
    default: {
      text: "#9EDCFF",
      bg: "rgba(11, 20, 35, 0.85)",
      border: "rgba(255, 255, 255, 0.10)",
      icon: "rgba(36, 75, 120, 0.35)",
    },
  };

  const c = colorTokens[color];

  return (
    <div
      className="relative rounded-xl p-5 overflow-hidden card-lift animate-slide-up"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        backdropFilter: "blur(14px)",
        animationDelay: `${delay}ms`,
      }}
    >
      {/* Ambient glow spot */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full pointer-events-none"
        style={{ background: c.text, opacity: 0.08, filter: "blur(20px)" }}
      />
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#718198] font-mono">
          {label}
        </span>
        <div className="p-2 rounded-lg" style={{ background: c.icon }}>
          <span style={{ color: c.text }}>{icon}</span>
        </div>
      </div>
      <div
        className="text-4xl font-black font-mono animate-count-up"
        style={{ color: c.text, letterSpacing: "-0.02em" }}
      >
        {displayed}
      </div>
      <p className="text-xs text-[#718198] mt-1.5">{description}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { currentProject, isMockMode, isBackendOnline } = useProject();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const tasksRes = await api.getTasks(currentProject?.id);
        setTasks(tasksRes.data);
        const eventsRes = await api.getEvents("task-user-auth");
        setEvents(eventsRes.data);
      } catch (e) {
        console.error("Dashboard data load error", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentProject?.id]);

  const verifiedCount = tasks.filter((t) => t.state === "VERIFIED").length;
  const failedCount = tasks.filter((t) => t.state === "FAILED").length;
  const unverifiedCount = tasks.filter(
    (t) =>
      t.state === "PLANNED" || t.state === "APPROVED" || t.state === "CREATED"
  ).length;

  return (
    <div className="space-y-6">
      {/* Demo Fixtures Notice */}
      {(isMockMode || !isBackendOnline) && (
        <div
          className="flex items-center justify-between p-3.5 rounded-xl text-xs text-[#A4B2C5]"
          style={{
            border: "1px solid rgba(88, 170, 225, 0.20)",
            background: "rgba(11, 20, 35, 0.8)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 shrink-0" style={{ color: "#58AAE1" }} />
            <span>
              Showing <strong>deterministic demo fixtures</strong>. When the
              FastAPI backend is active, real executions stream seamlessly.
            </span>
          </div>
          <Link
            href="/settings"
            className="font-semibold underline shrink-0 ml-2"
            style={{ color: "#58AAE1" }}
          >
            Configure
          </Link>
        </div>
      )}

      {/* Project Hero Card */}
      <div
        className="relative rounded-2xl p-6 overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(36, 75, 120, 0.20) 0%, rgba(8, 20, 38, 0.95) 60%, rgba(11, 20, 35, 0.98) 100%)",
          border: "1px solid rgba(88, 170, 225, 0.25)",
          boxShadow: "0 10px 40px -10px rgba(0, 0, 0, 0.6)",
        }}
      >
        {/* Soft atmospheric blue glow */}
        <div
          className="absolute -top-10 -right-10 w-48 h-48 rounded-full pointer-events-none"
          style={{
            background: "rgba(88, 170, 225, 0.12)",
            filter: "blur(40px)",
          }}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="px-2 py-0.5 text-[10px] font-bold font-mono uppercase rounded"
                style={{
                  background: "rgba(88, 170, 225, 0.15)",
                  color: "#9EDCFF",
                  border: "1px solid rgba(88, 170, 225, 0.30)",
                }}
              >
                Active Project
              </span>
              <span className="text-xs text-[#718198] font-mono">
                ID: {currentProject?.id || "default"}
              </span>
            </div>
            <h1
              className="text-2xl font-black tracking-tight text-[#F1F4F8] mb-2"
              style={{ letterSpacing: "-0.02em" }}
            >
              {currentProject?.name || "VIKASA Platform"}
            </h1>
            <p className="text-sm text-[#A4B2C5] max-w-2xl leading-relaxed">
              {currentProject?.description ||
                "Deterministic verification and evidence platform for autonomous coding agents."}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-4 text-xs font-mono text-[#F1F4F8]">
              {[
                {
                  icon: <FolderGit2 className="w-3.5 h-3.5" />,
                  value:
                    currentProject?.language || "Python 3.13 / TypeScript",
                  color: "#58AAE1",
                },
                {
                  icon: <GitBranch className="w-3.5 h-3.5" />,
                  value: `branch: ${currentProject?.branch || "main"}`,
                  color: "#9EDCFF",
                },
                {
                  icon: <Layers className="w-3.5 h-3.5" />,
                  value: currentProject?.framework || "FastAPI & Next.js",
                  color: "#10b981",
                },
              ].map((tag, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md"
                  style={{
                    background: "rgba(16, 29, 48, 0.7)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <span style={{ color: tag.color }}>{tag.icon}</span>
                  <span>{tag.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
            <Link href="/verification/run-b8f3e21a/claim-vs-reality">
              <Button
                variant="brand"
                size="md"
                icon={<Scale className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                Claim vs Reality
              </Button>
            </Link>
            <Link href="/tasks/new">
              <Button
                variant="secondary"
                size="md"
                icon={<Plus className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                Create Task
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Tasks"
          value={tasks.length}
          icon={<Activity className="w-4 h-4" />}
          color="default"
          description="Registered lifecycle workflows"
          delay={0}
        />
        <StatCard
          label="Verified"
          value={verifiedCount}
          icon={<CheckCircle2 className="w-4 h-4" />}
          color="emerald"
          description="Passed 100% deterministic rules"
          delay={80}
        />
        <StatCard
          label="Failed Checks"
          value={failedCount}
          icon={<XCircle className="w-4 h-4" />}
          color="rose"
          description="Exit code ≠ 0 or missing evidence"
          delay={160}
        />
        <StatCard
          label="Pending"
          value={unverifiedCount}
          icon={<Clock className="w-4 h-4" />}
          color="amber"
          description="Awaiting approval or execution"
          delay={240}
        />
      </div>

      {/* Main Grid: Tasks Overview & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Tasks Overview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#F1F4F8]">
                Active Tasks
              </h2>
              <p className="text-xs text-[#718198]">
                Tasks undergoing verification lifecycle
              </p>
            </div>
            <Link
              href="/tasks"
              className="text-xs font-semibold flex items-center gap-1 transition-colors hover:opacity-80"
              style={{ color: "#58AAE1" }}
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl shimmer"
                  style={{ border: "1px solid rgba(255, 255, 255, 0.08)" }}
                />
              ))
            ) : (
              tasks.map((task) => (
                <Card key={task.id} lift className="p-4 group">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-mono font-bold"
                          style={{ color: "#58AAE1" }}
                        >
                          {task.id}
                        </span>
                        <Badge status={task.state} size="sm" />
                      </div>
                      <Link
                        href={`/tasks/${task.id}`}
                        className="text-sm font-semibold text-[#F1F4F8] group-hover:text-[#9EDCFF] transition-colors block"
                      >
                        {task.title}
                      </Link>
                      <p className="text-xs text-[#718198] line-clamp-1">
                        {task.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {task.state === "VERIFIED" ? (
                        <Link href="/verification/run-b8f3e21a">
                          <Button variant="outline" size="sm">
                            Results
                          </Button>
                        </Link>
                      ) : task.state === "FAILED" ? (
                        <Link href="/verification/run-auth-failed/failure">
                          <Button variant="danger" size="sm">
                            Diagnosis
                          </Button>
                        </Link>
                      ) : task.state === "PLANNED" ? (
                        <Link href={`/tasks/${task.id}/plan`}>
                          <Button variant="brand" size="sm">
                            Review Plan
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/tasks/${task.id}`}>
                          <Button variant="secondary" size="sm">
                            Details
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Right Col: Activity & Quick Tools */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#F1F4F8]">
              Execution Audit
            </h2>
            <Link
              href="/executions"
              className="text-xs font-semibold flex items-center gap-1 hover:opacity-80 transition-opacity"
              style={{ color: "#58AAE1" }}
            >
              <span>Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <Card className="p-4 space-y-4">
            <div
              className="relative pl-6 space-y-4"
              style={{
                borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
                marginLeft: "4px",
              }}
            >
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-10 rounded shimmer" />
                  ))
                : events.slice(0, 5).map((evt) => (
                    <div key={evt.id} className="relative text-xs">
                      <span
                        className="absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full border-2"
                        style={{
                          borderColor: "#05080F",
                          background: evt.event_type.includes("VERIF")
                            ? "#10b981"
                            : evt.event_type.includes("FAIL")
                            ? "#ef4444"
                            : "#58AAE1",
                        }}
                      />
                      <div className="flex items-center justify-between font-mono text-[10px] text-[#718198] mb-0.5">
                        <span className="font-semibold text-[#F1F4F8]">
                          {evt.event_type}
                        </span>
                        <span>{formatDate(evt.timestamp).split(",")[1]}</span>
                      </div>
                      <p className="text-[#A4B2C5] leading-snug">{evt.message}</p>
                    </div>
                  ))}
            </div>
          </Card>

          {/* Quick Tools Card */}
          <Card className="p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#718198] mb-3 font-mono">
              Essential Tools
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                {
                  href: "/verification/run-b8f3e21a/claim-vs-reality",
                  icon: <Scale className="w-4 h-4" />,
                  label: "Claim vs Reality",
                  color: "#58AAE1",
                },
                {
                  href: "/executions/run-b8f3e21a/replay",
                  icon: <History className="w-4 h-4" />,
                  label: "Replay Run",
                  color: "#fbbf24",
                },
                {
                  href: "/security",
                  icon: <ShieldCheck className="w-4 h-4" />,
                  label: "Security Tests",
                  color: "#10b981",
                },
                {
                  href: "/model",
                  icon: <Cpu className="w-4 h-4" />,
                  label: "Model Status",
                  color: "#9EDCFF",
                },
              ].map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="p-2.5 rounded-xl flex flex-col gap-1.5 text-[#F1F4F8] transition-all group"
                  style={{
                    background: "rgba(16, 29, 48, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(36, 75, 120, 0.25)";
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "rgba(88, 170, 225, 0.35)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(16, 29, 48, 0.6)";
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "rgba(255, 255, 255, 0.08)";
                  }}
                >
                  <span style={{ color: tool.color }}>{tool.icon}</span>
                  <span className="font-semibold text-[#A4B2C5] group-hover:text-[#F1F4F8] leading-tight">
                    {tool.label}
                  </span>
                </Link>
              ))}
            </div>
          </Card>

          {/* Verification Engine Active */}
          <div
            className="p-4 rounded-xl"
            style={{
              background: "rgba(11, 20, 35, 0.8)",
              border: "1px solid rgba(88, 170, 225, 0.20)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4" style={{ color: "#58AAE1" }} />
              <span className="text-xs font-bold text-[#F1F4F8]">
                Verification Engine
              </span>
            </div>
            <p className="text-[11px] text-[#718198] leading-snug font-mono">
              All verdicts are governed by deterministic rule evaluation —
              never by AI inference.
            </p>
            <div
              className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold"
              style={{ color: "#10b981" }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              Deterministic rule engine active
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
