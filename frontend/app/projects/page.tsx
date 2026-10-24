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
      {/* Header & Register Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F1F4F8]">
            Projects
          </h1>
          <p className="text-xs text-[#718198] mt-1">
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
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#718198]" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search projects by name, branch, or description..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B1423] border border-white/10 text-sm text-[#F1F4F8] placeholder:text-[#718198] focus:outline-none focus:border-[#58AAE1]/50 transition-colors"
        />
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-xl shimmer"
              style={{ border: "1px solid rgba(255, 255, 255, 0.08)" }}
            />
          ))
        ) : filteredProjects.length === 0 ? (
          <div className="col-span-full p-12 text-center rounded-2xl border border-dashed border-white/10 bg-[#0B1423]/40 text-[#718198]">
            <h3 className="text-base font-semibold text-[#F1F4F8] mb-1">
              No Projects Registered
            </h3>
            <p className="text-xs text-[#718198] max-w-md mx-auto mb-5 leading-relaxed">
              Register your codebase repository to configure autonomous coding task generation and deterministic test verification.
            </p>
            <Link href="/projects/new">
              <Button variant="brand" size="sm" icon={<Plus className="w-4 h-4" />}>
                Register Project
              </Button>
            </Link>
          </div>
        ) : (
          filteredProjects.map((project) => {
            const isSelected = project.id === currentProjectId;

            return (
              <Card
                key={project.id}
                borderVariant={isSelected ? "brand" : "default"}
                className="p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h2 className="text-base font-bold text-[#F1F4F8]">
                        {project.name}
                      </h2>
                      <div className="flex items-center gap-2 text-xs font-mono text-[#718198] mt-0.5">
                        <span className="text-[#9EDCFF]">branch: {project.branch}</span>
                      </div>
                    </div>

                    {isSelected ? (
                      <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase bg-[#58AAE1]/15 text-[#9EDCFF] rounded border border-[#58AAE1]/30">
                        Active
                      </span>
                    ) : (
                      <button
                        onClick={() => setCurrentProjectId(project.id)}
                        className="px-2.5 py-1 text-xs text-[#A4B2C5] hover:text-[#F1F4F8] rounded border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        Set Active
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-[#A4B2C5] line-clamp-2 mt-3 leading-relaxed">
                    {project.description}
                  </p>

                  {/* Tech Badges */}
                  <div className="flex flex-wrap gap-2 mt-3.5 text-[11px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[#A4B2C5]">
                      {project.language}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[#A4B2C5]">
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
                    <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {project.stats.verified_tasks}
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-400 font-mono">
                      <XCircle className="w-3.5 h-3.5" />
                      {project.stats.failed_tasks}
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-400 font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      {project.stats.unverified_tasks}
                    </span>
                  </div>

                  <Link
                    href={`/projects/${project.id}`}
                    className="font-medium text-[#58AAE1] hover:text-[#9EDCFF] flex items-center gap-1 transition-colors"
                  >
                    <span>Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
