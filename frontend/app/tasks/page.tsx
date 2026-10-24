"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { Task } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/formatters";
import {
  CheckSquare,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Play,
  Sparkles,
  ChevronRight,
} from "lucide-react";

const STATE_FILTERS = [
  { id: "ALL",      label: "All" },
  { id: "CREATED",  label: "Created" },
  { id: "PLANNED",  label: "Planned" },
  { id: "APPROVED", label: "Approved" },
  { id: "RUNNING",  label: "Running" },
  { id: "VERIFIED", label: "Verified" },
  { id: "FAILED",   label: "Failed" },
];

function getStateAction(task: Task): React.ReactNode {
  const base = "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5";
  if (task.state === "CREATED")
    return (
      <Link href={`/tasks/${task.id}/plan`} className={`${base} bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/30`}>
        <Sparkles className="w-3.5 h-3.5" /> Generate Plan
      </Link>
    );
  if (task.state === "PLANNED")
    return (
      <Link href={`/tasks/${task.id}/plan`} className={`${base} bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/30`}>
        <CheckCircle2 className="w-3.5 h-3.5" /> Review &amp; Approve
      </Link>
    );
  if (task.state === "APPROVED")
    return (
      <Link href={`/tasks/${task.id}`} className={`${base} bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30`}>
        <Play className="w-3.5 h-3.5" /> Execute
      </Link>
    );
  if (task.state === "VERIFIED")
    return (
      <Link href={`/tasks/${task.id}`} className={`${base} bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30`}>
        <ShieldCheck className="w-3.5 h-3.5" /> Verification
      </Link>
    );
  if (task.state === "FAILED")
    return (
      <Link href={`/tasks/${task.id}`} className={`${base} bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30`}>
        <AlertTriangle className="w-3.5 h-3.5" /> Diagnose
      </Link>
    );
  return null;
}

export default function TasksPage() {
  const { currentProjectId } = useProject();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await api.getTasks(currentProjectId);
        if (!cancelled) setTasks(res.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [currentProjectId]);

  const filtered = tasks.filter((t) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
    const matchesFilter = filter === "ALL" || t.state === filter;
    return matchesSearch && matchesFilter;
  });

  const countFor = (state: string) =>
    state === "ALL" ? tasks.length : tasks.filter((t) => t.state === state).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Tasks</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Lifecycle: Created → Planned → Approved → Running → Verifying → Verified / Failed
          </p>
        </div>
        <Link href="/tasks/new">
          <Button variant="brand" icon={<Plus className="w-4 h-4" />}>
            New Task
          </Button>
        </Link>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks by ID, title, or description..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
          />
        </div>

        <div
          className="flex items-center gap-1 p-1 rounded-xl overflow-x-auto shrink-0"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {STATE_FILTERS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                filter === tab.id
                  ? "bg-white/10 text-white"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              }`}
            >
              {tab.label}
              <span
                className="text-[10px] font-mono px-1.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.07)", color: filter === tab.id ? "#fff" : "#64748b" }}
              >
                {countFor(tab.id)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="py-16 text-center rounded-xl"
          style={{ border: "1px dashed rgba(255,255,255,0.08)" }}
        >
          <CheckSquare className="w-8 h-8 mx-auto mb-2 text-slate-700" />
          <p className="text-sm font-medium text-slate-400">No tasks found</p>
          <p className="text-xs text-slate-600 mt-1">
            {search ? "Try a different search query." : "Create your first task to get started."}
          </p>
          {!search && (
            <Link href="/tasks/new" className="mt-4 inline-block">
              <Button variant="brand" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                Create Task
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div
          className="rounded-xl divide-y overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {filtered.map((task) => (
            <div
              key={task.id}
              className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-5 py-4 group transition-colors"
              style={{ background: "rgba(255,255,255,0.015)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.035)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.015)"; }}
            >
              <div className="flex-1 min-w-0 space-y-1.5">
                {/* ID + badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-sky-500">{task.id}</span>
                  <Badge status={task.state} size="sm" />
                  {task.approved_by && (
                    <span
                      className="px-1.5 py-px text-[10px] font-mono rounded"
                      style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}
                    >
                      ✓ {task.approved_by}
                    </span>
                  )}
                </div>

                {/* Title */}
                <Link
                  href={`/tasks/${task.id}`}
                  className="text-sm font-semibold text-slate-100 group-hover:text-sky-400 transition-colors block"
                >
                  {task.title}
                </Link>

                {/* Description */}
                <p className="text-xs text-slate-500 line-clamp-1">{task.description}</p>

                {/* Criteria */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-slate-600 font-mono">
                    {task.acceptance_criteria.length} criteria
                  </span>
                  {task.acceptance_criteria.slice(0, 4).map((c) => (
                    <span
                      key={c.id}
                      className="px-1.5 py-px rounded text-[10px] font-mono"
                      style={{
                        background: c.satisfied ? "rgba(52,211,153,0.08)" : c.satisfied === false ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.04)",
                        color: c.satisfied ? "#34d399" : c.satisfied === false ? "#f87171" : "#64748b",
                        border: `1px solid ${c.satisfied ? "rgba(52,211,153,0.2)" : c.satisfied === false ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.07)"}`,
                      }}
                      title={c.description}
                    >
                      {c.id}
                    </span>
                  ))}
                  {task.acceptance_criteria.length > 4 && (
                    <span className="text-[10px] text-slate-600">+{task.acceptance_criteria.length - 4} more</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
                {getStateAction(task)}
                <Link
                  href={`/tasks/${task.id}`}
                  className="p-1.5 text-slate-600 hover:text-slate-300 rounded-lg hover:bg-white/5 transition-colors"
                  title="View details"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
