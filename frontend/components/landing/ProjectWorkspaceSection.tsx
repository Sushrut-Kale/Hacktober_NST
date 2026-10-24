"use client";

import React from "react";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import {
  FolderGit2,
  GitBranch,
  ArrowRight,
  Plus,
  Code2,
  Layers,
  ChevronRight,
} from "lucide-react";
import { RevealOnScroll } from "./RevealOnScroll";

interface ProjectWorkspaceSectionProps {
  onOpenImportModal: () => void;
}

export function ProjectWorkspaceSection({
  onOpenImportModal,
}: ProjectWorkspaceSectionProps) {
  const { projects, setCurrentProjectId, currentProjectId } = useProject();

  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-t border-white/10 relative z-10">
      {/* Section Header with Reveal */}
      <RevealOnScroll delayMs={0} durationMs={650}>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-[#58AAE1] uppercase mb-1">
              <Layers className="w-3.5 h-3.5" />
              <span>Workspace Inventory</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-tight">
              Active Projects & Codebases
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl font-tight">
              Repositories registered for automated task planning, deterministic testing, and evidence collection.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/projects"
              className="text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-panel-subtle hover:border-white/20 transition-colors"
            >
              <span>View All Projects</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </RevealOnScroll>

      {/* Grid of Projects with Staggered Reveals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {projects.slice(0, 5).map((project, idx) => {
          const isSelected = project.id === currentProjectId;
          return (
            <RevealOnScroll
              key={project.id}
              delayMs={idx * 80}
              durationMs={600}
              yOffset={24}
              className="h-full"
            >
              <div
                className={`group relative rounded-2xl p-5 flex flex-col justify-between h-full transition-all duration-200 border ${
                  isSelected
                    ? "bg-gradient-to-b from-[#10294B]/40 to-[#0A1B35]/30 border-[#58AAE1]/50 shadow-[0_10px_35px_rgba(88,170,225,0.15)]"
                    : "glass-panel hover:border-white/25 hover:shadow-[0_15px_40px_rgba(0,0,0,0.4)]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-xl bg-[#58AAE1]/15 text-[#9EDCFF] flex items-center justify-center border border-[#58AAE1]/30">
                      <FolderGit2 className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300">
                      {project.language || "Python"}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-[#9EDCFF] transition-colors font-tight">
                    {project.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {project.description || "Active development repository and verification suite."}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
                    <span className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded border border-white/5">
                      <GitBranch className="w-3 h-3 text-[#58AAE1]" />
                      <span>{project.branch || "main"}</span>
                    </span>
                    {project.framework && (
                      <span className="bg-black/40 px-2 py-0.5 rounded border border-white/5">
                        {project.framework}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between">
                  <Link
                    href={`/projects/${project.id}`}
                    onClick={() => setCurrentProjectId(project.id)}
                    className="text-xs font-semibold text-[#9EDCFF] hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <span>Open Workspace</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                  {isSelected && (
                    <span className="text-[10px] font-mono uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Active
                    </span>
                  )}
                </div>
              </div>
            </RevealOnScroll>
          );
        })}

        {/* Action Card: Import Another Project with Staggered Reveal */}
        <RevealOnScroll
          delayMs={projects.slice(0, 5).length * 80}
          durationMs={600}
          yOffset={24}
          className="h-full"
        >
          <div
            onClick={onOpenImportModal}
            className="rounded-2xl border-2 border-dashed border-white/15 hover:border-[#58AAE1]/50 bg-white/[0.02] hover:bg-white/[0.04] p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group h-full min-h-[190px]"
          >
            <div className="w-10 h-10 rounded-2xl bg-white/5 text-slate-400 group-hover:text-[#9EDCFF] group-hover:bg-[#58AAE1]/15 group-hover:border-[#58AAE1]/40 border border-white/10 flex items-center justify-center transition-all mb-3">
              <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-[#9EDCFF] transition-colors font-tight">
              Import Another Project
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
              Connect a Git repository or local workspace for intelligence and verification.
            </p>
            <span className="mt-3 text-[11px] font-mono text-[#58AAE1] group-hover:underline">
              + Connect Repository
            </span>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
