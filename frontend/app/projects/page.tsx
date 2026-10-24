"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { Project } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  FolderGit2,
  GitBranch,
  Plus,
  Search,
  ExternalLink,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
} from "lucide-react";

export default function ProjectsPage() {
  const { currentProjectId, setCurrentProjectId } = useProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      setLoading(true);
      try {
        const res = await api.getProjects();
        setProjects(res.data);
      } finally {
        setLoading(false);
      }
    }
    loadProjects();
  }, []);

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.branch.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Projects
          </h1>
          <p className="text-xs text-slate-400">
            Registered codebases configured for AI intelligence and deterministic verification
          </p>
        </div>
        <Link href="/projects/new">
          <Button variant="brand" icon={<Plus className="w-4 h-4" />}>
            Register Project
          </Button>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search projects by name, branch, or description..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-100 border border-white/10 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
        />
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProjects.map((project) => {
          const isSelected = project.id === currentProjectId;

          return (
            <Card
              key={project.id}
              borderVariant={isSelected ? "brand" : "default"}
              className="p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                      <FolderGit2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">
                        {project.name}
                      </h2>
                      <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                        <GitBranch className="w-3 h-3 text-purple-400" />
                        <span>{project.branch}</span>
                      </div>
                    </div>
                  </div>

                  {isSelected ? (
                    <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase bg-sky-500/20 text-sky-400 rounded border border-sky-500/30">
                      Active
                    </span>
                  ) : (
                    <button
                      onClick={() => setCurrentProjectId(project.id)}
                      className="px-2.5 py-1 text-xs text-slate-400 hover:text-white rounded border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors"
                    >
                      Set Active
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 mt-2">
                  {project.description}
                </p>

                {/* Tech Badges */}
                <div className="flex flex-wrap gap-2 mt-3 text-[11px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-slate-300">
                    {project.language}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-slate-300">
                    {project.framework}
                  </span>
                  {project.analysis_status && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase">
                      {project.analysis_status}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats Footer */}
              <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-emerald-400 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {project.stats.verified_tasks}
                  </span>
                  <span className="flex items-center gap-1 text-rose-400 font-mono">
                    <XCircle className="w-3.5 h-3.5" />
                    {project.stats.failed_tasks}
                  </span>
                  <span className="flex items-center gap-1 text-amber-400 font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    {project.stats.unverified_tasks}
                  </span>
                </div>

                <Link
                  href={`/projects/${project.id}`}
                  className="font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1"
                >
                  <span>Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
