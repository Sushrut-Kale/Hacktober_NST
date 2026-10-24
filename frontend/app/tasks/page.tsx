"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { Task } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  CheckSquare,
  Plus,
  Search,
  ShieldCheck,
  AlertTriangle,
  Play,
} from "lucide-react";

export default function TasksPage() {
  const { currentProjectId } = useProject();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTasks() {
      setLoading(true);
      try {
        const res = await api.getTasks(currentProjectId);
        setTasks(res.data);
      } finally {
        setLoading(false);
      }
    }
    loadTasks();
  }, [currentProjectId]);

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      stateFilter === "ALL" || t.state === stateFilter;

    return matchesSearch && matchesFilter;
  });

  const filterTabs: Array<{ id: string; label: string; count?: number }> = [
    { id: "ALL", label: "All Tasks", count: tasks.length },
    {
      id: "VERIFIED",
      label: "Verified",
      count: tasks.filter((t) => t.state === "VERIFIED").length,
    },
    {
      id: "FAILED",
      label: "Failed",
      count: tasks.filter((t) => t.state === "FAILED").length,
    },
    {
      id: "APPROVED",
      label: "Approved",
      count: tasks.filter((t) => t.state === "APPROVED").length,
    },
    {
      id: "PLANNED",
      label: "Planned",
      count: tasks.filter((t) => t.state === "PLANNED").length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F1F4F8]">
            Tasks Board
          </h1>
          <p className="text-xs text-[#718198] mt-1">
            Lifecycle state machine: Created → Planned → Approved → Running → Verifying → Verified / Failed
          </p>
        </div>
        <Link href="/tasks/new">
          <Button variant="brand" icon={<Plus className="w-4 h-4" />}>
            Create Task
          </Button>
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#718198]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tasks by ID, title, or requirement..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B1423] border border-white/10 text-sm text-[#F1F4F8] placeholder:text-[#718198] focus:outline-none focus:border-[#58AAE1]/50 transition-colors"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto p-1 rounded-xl bg-[#0B1423] border border-white/10">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStateFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                stateFilter === tab.id
                  ? "bg-[#58AAE1]/20 text-[#9EDCFF] border border-[#58AAE1]/30 shadow-sm"
                  : "text-[#718198] hover:text-[#F1F4F8] hover:bg-white/5 border border-transparent"
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/10 text-[#A4B2C5]">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl shimmer"
              style={{ border: "1px solid rgba(255, 255, 255, 0.08)" }}
            />
          ))
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 bg-[#0B1423]/40 text-[#718198]">
            <h3 className="text-base font-semibold text-[#F1F4F8] mb-1">
              No Tasks Found
            </h3>
            <p className="text-xs text-[#718198] max-w-md mx-auto mb-5 leading-relaxed">
              {tasks.length === 0
                ? "No tasks have been registered in this project yet. Create your first task to begin planning."
                : "No tasks match your current search and status filter."}
            </p>
            {tasks.length === 0 && (
              <Link href="/tasks/new">
                <Button variant="brand" size="sm" icon={<Plus className="w-4 h-4" />}>
                  Create Task
                </Button>
              </Link>
            )}
          </div>
        ) : (
          filteredTasks.map((task) => (
            <Card
              key={task.id}
              className="p-5 hover:border-white/20 transition-all group"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-xs font-mono font-bold text-[#58AAE1]">
                      {task.id}
                    </span>
                    <Badge status={task.state} size="sm" />
                    <span className="text-[11px] text-[#718198] font-mono">
                      Project: {task.project_id}
                    </span>
                    {task.approved_by && (
                      <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-purple-500/10 text-purple-400 rounded border border-purple-500/20">
                        Approved by {task.approved_by}
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/tasks/${task.id}`}
                    className="text-base font-bold text-[#F1F4F8] group-hover:text-[#9EDCFF] transition-colors block"
                  >
                    {task.title}
                  </Link>

                  <p className="text-xs text-[#A4B2C5] line-clamp-2 max-w-3xl leading-relaxed">
                    {task.description}
                  </p>

                  {/* Criteria badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <span className="text-[11px] font-mono text-[#718198]">
                      Criteria ({task.acceptance_criteria.length}):
                    </span>
                    {task.acceptance_criteria.map((c) => (
                      <span
                        key={c.id}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                          c.satisfied
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : c.satisfied === false
                            ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                            : "bg-white/5 border-white/10 text-[#718198]"
                        }`}
                        title={c.description}
                      >
                        {c.id}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions depending on state */}
                <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                  {task.state === "CREATED" && (
                    <Link href={`/tasks/${task.id}/plan`}>
                      <Button variant="brand" size="sm">
                        Generate Plan
                      </Button>
                    </Link>
                  )}

                  {task.state === "PLANNED" && (
                    <Link href={`/tasks/${task.id}/plan`}>
                      <Button variant="brand" size="sm">
                        Review & Approve
                      </Button>
                    </Link>
                  )}

                  {task.state === "APPROVED" && (
                    <Link href={`/tasks/${task.id}`}>
                      <Button
                        variant="brand"
                        size="sm"
                        icon={<Play className="w-3.5 h-3.5" />}
                      >
                        Execute Task
                      </Button>
                    </Link>
                  )}

                  {task.state === "VERIFIED" && (
                    <Link href="/verification/run-b8f3e21a">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                      >
                        Verification
                      </Button>
                    </Link>
                  )}

                  {task.state === "FAILED" && (
                    <Link href="/verification/run-auth-failed/failure">
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<AlertTriangle className="w-3.5 h-3.5" />}
                      >
                        Diagnosis
                      </Button>
                    </Link>
                  )}

                  <Link href={`/tasks/${task.id}`}>
                    <Button variant="secondary" size="sm">
                      Details
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
