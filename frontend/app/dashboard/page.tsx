"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { Task, ExecutionEvent } from "@/lib/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/formatters";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  Scale,
  ShieldCheck,
  Plus,
  Terminal,
  Cpu,
  History,
  FolderGit2,
  GitBranch,
  Activity,
  Layers,
  Sparkles,
  Info,
} from "lucide-react";

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
    (t) => t.state === "PLANNED" || t.state === "APPROVED" || t.state === "CREATED"
  ).length;

  return (
    <div className="space-y-6">
      {/* Demo Fixtures Notice */}
      {isMockMode || !isBackendOnline ? (
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-sky-500/20 bg-sky-500/5 text-xs text-slate-300">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
            <span>
              Showing <strong>deterministic demo fixtures</strong>. When the FastAPI backend (FastAPI 3.13) starts at <code>http://localhost:8000</code>, real executions will stream seamlessly.
            </span>
          </div>
          <Link
            href="/settings"
            className="text-sky-400 hover:text-sky-300 font-semibold underline shrink-0 ml-2"
          >
            Configure Backend
          </Link>
        </div>
      ) : null}

      {/* Project Overview Hero Card */}
      <Card borderVariant="brand" className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-sky-500/20 text-sky-400 rounded border border-sky-500/30">
                Active Project
              </span>
              <span className="text-xs text-slate-400 font-mono">
                ID: {currentProject?.id || "default"}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              {currentProject?.name || "VIKASA Platform"}
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              {currentProject?.description ||
                "Deterministic verification and evidence platform for autonomous coding agents."}
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-4 text-xs font-mono text-slate-300">
              <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                <FolderGit2 className="w-3.5 h-3.5 text-sky-400" />
                <span>{currentProject?.language || "Python 3.13 / TypeScript"}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                <GitBranch className="w-3.5 h-3.5 text-purple-400" />
                <span>branch: {currentProject?.branch || "main"}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>{currentProject?.framework || "FastAPI & Next.js"}</span>
              </div>
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
      </Card>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Tasks */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Tasks
            </span>
            <div className="p-2 rounded-lg bg-white/5 text-slate-300">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono">
            {tasks.length}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Registered lifecycle workflows
          </p>
        </Card>

        {/* Card 2: Verified Tasks */}
        <Card borderVariant="emerald" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Verified
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 mt-3 font-mono">
            {verifiedCount}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Passed 100% deterministic rules
          </p>
        </Card>

        {/* Card 3: Failed Checks */}
        <Card borderVariant="rose" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
              Failed Checks
            </span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-rose-400 mt-3 font-mono">
            {failedCount}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Exit code != 0 or missing evidence
          </p>
        </Card>

        {/* Card 4: Unverified / Pending */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              Unverified / Pending
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-amber-400 mt-3 font-mono">
            {unverifiedCount}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Awaiting human approval or run
          </p>
        </Card>
      </div>

      {/* Main Grid: Tasks Overview & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Tasks Overview Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Active Tasks</h2>
              <p className="text-xs text-slate-400">
                Tasks undergoing verification lifecycle
              </p>
            </div>
            <Link
              href="/tasks"
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {tasks.map((task) => (
              <Card
                key={task.id}
                className="p-4 hover:border-white/20 transition-all cursor-pointer group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400 font-medium">
                        {task.id}
                      </span>
                      <Badge status={task.state} size="sm" />
                    </div>
                    <Link
                      href={`/tasks/${task.id}`}
                      className="text-sm font-semibold text-slate-100 group-hover:text-sky-400 transition-colors block"
                    >
                      {task.title}
                    </Link>
                    <p className="text-xs text-slate-400 line-clamp-1">
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
            ))}
          </div>
        </div>

        {/* Right Col: Recent Activity Timeline */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Execution Audit</h2>
            <Link
              href="/executions"
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
            >
              <span>Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <Card className="p-4 space-y-4">
            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
              {events.slice(0, 5).map((evt) => (
                <div key={evt.id} className="relative text-xs">
                  <span
                    className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full border-2 border-[#0a0d14] ${
                      evt.event_type.includes("VERIF")
                        ? "bg-emerald-400"
                        : evt.event_type.includes("FAIL")
                        ? "bg-rose-400"
                        : "bg-sky-400"
                    }`}
                  />
                  <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
                    <span className="font-semibold text-slate-300">
                      {evt.event_type}
                    </span>
                    <span>{formatDate(evt.timestamp).split(",")[1]}</span>
                  </div>
                  <p className="text-slate-300 mt-1 leading-snug">{evt.message}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Links Card */}
          <Card className="p-4 bg-gradient-to-br from-surface-100 to-surface-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Essential Tools
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link
                href="/verification/run-b8f3e21a/claim-vs-reality"
                className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors flex flex-col gap-1 text-slate-200"
              >
                <Scale className="w-4 h-4 text-sky-400" />
                <span className="font-semibold">Claim vs Reality</span>
              </Link>
              <Link
                href="/executions/run-b8f3e21a/replay"
                className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors flex flex-col gap-1 text-slate-200"
              >
                <History className="w-4 h-4 text-amber-400" />
                <span className="font-semibold">Replay Run</span>
              </Link>
              <Link
                href="/security"
                className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors flex flex-col gap-1 text-slate-200"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold">Security Tests</span>
              </Link>
              <Link
                href="/model"
                className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors flex flex-col gap-1 text-slate-200"
              >
                <Cpu className="w-4 h-4 text-purple-400" />
                <span className="font-semibold">Model Status</span>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
