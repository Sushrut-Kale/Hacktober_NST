"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { Project } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import {
  FolderGit2,
  GitBranch,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Layers,
  ExternalLink,
} from "lucide-react";

export default function ProjectsPage() {
  const { currentProjectId, setCurrentProjectId } = useProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await api.getProjects();
        if (!cancelled) setProjects(res.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.branch.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Projects</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Registered codebases configured for AI planning and deterministic verification
          </p>
        </div>
        <Link href="/projects/new">
          <Button variant="brand" icon={<Plus className="w-4 h-4" />}>
            Register Project
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects by name, branch, or description..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 rounded-xl shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="py-16 text-center rounded-xl"
          style={{ border: "1px dashed rgba(255,255,255,0.08)" }}
        >
          <FolderGit2 className="w-8 h-8 mx-auto mb-2 text-slate-700" />
          <p className="text-sm font-medium text-slate-400">
            {search ? "No projects match your search." : "No projects registered yet."}
          </p>
          {!search && (
            <Link href="/projects/new" className="mt-4 inline-block">
              <Button variant="brand" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                Register First Project
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((project) => {
            const isActive = project.id === currentProjectId;
            return (
              <div
                key={project.id}
                className="flex flex-col justify-between p-5 rounded-xl transition-all group"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${isActive ? "rgba(0,195,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                  boxShadow: isActive ? "0 0 20px -5px rgba(0,195,255,0.12)" : "none",
                }}
              >
                {/* Top */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2 rounded-lg shrink-0"
                        style={{ background: isActive ? "rgba(0,195,255,0.1)" : "rgba(255,255,255,0.05)" }}
                      >
                        <FolderGit2
                          className="w-5 h-5"
                          style={{ color: isActive ? "#00c3ff" : "#475569" }}
                        />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-white">{project.name}</h2>
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 mt-0.5">
                          <GitBranch className="w-3 h-3 text-purple-400" />
                          {project.branch}
                        </div>
                      </div>
                    </div>

                    {isActive ? (
                      <span
                        className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded shrink-0"
                        style={{ background: "rgba(0,195,255,0.1)", color: "#00c3ff", border: "1px solid rgba(0,195,255,0.25)" }}
                      >
                        Active
                      </span>
                    ) : (
                      <button
                        onClick={() => setCurrentProjectId(project.id)}
                        className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-200 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all shrink-0"
                      >
                        Set Active
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                    {project.description}
                  </p>

                  {/* Tech badges */}
                  <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                    <span
                      className="px-2 py-0.5 rounded"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#94a3b8" }}
                    >
                      {project.language}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#94a3b8" }}
                    >
                      {project.framework}
                    </span>
                    {project.analysis_status && (
                      <span
                        className="px-2 py-0.5 rounded uppercase"
                        style={
                          project.analysis_status === "ANALYZED"
                            ? { background: "rgba(52,211,153,0.08)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }
                            : { background: "rgba(255,255,255,0.04)", color: "#64748b", border: "1px solid rgba(255,255,255,0.07)" }
                        }
                      >
                        {project.analysis_status}
                      </span>
                    )}
                    {project.git_url && (
                      <a
                        href={project.git_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded flex items-center gap-1 hover:text-sky-400 transition-colors"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#64748b" }}
                      >
                        <ExternalLink className="w-3 h-3" /> repo
                      </a>
                    )}
                  </div>
                </div>

                {/* Stats footer */}
                <div
                  className="mt-4 pt-4 flex items-center justify-between"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {project.stats.verified_tasks} verified
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-400">
                      <XCircle className="w-3.5 h-3.5" />
                      {project.stats.failed_tasks} failed
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <Clock className="w-3.5 h-3.5" />
                      {project.stats.unverified_tasks} pending
                    </span>
                  </div>

                  <Link
                    href={`/projects/${project.id}`}
                    className="text-xs font-medium text-sky-500 hover:text-sky-400 flex items-center gap-1 transition-colors"
                  >
                    Details <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
