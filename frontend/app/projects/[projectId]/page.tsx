"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { Project, Task } from "@/lib/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  FolderGit2,
  GitBranch,
  Terminal,
  FileCode,
  Package,
  Layers,
  FileText,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  ArrowLeft,
  Plus,
  RefreshCw,
} from "lucide-react";

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = (params?.projectId as string) || "default";

  const { setCurrentProjectId } = useProject();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const projRes = await api.getProject(projectId);
        setProject(projRes.data);
        const tasksRes = await api.getTasks(projectId);
        setTasks(tasksRes.data);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [projectId]);

  if (!project) {
    return (
      <div className="p-12 text-center text-slate-400">
        Loading project details...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/projects"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {project.name}
              </h1>
              {project.analysis_status && (
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded">
                  {project.analysis_status}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {project.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setCurrentProjectId(project.id)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-100 border border-white/10 hover:border-white/20 text-slate-200 transition-colors"
          >
            Set as Active Project
          </button>
          <Link href="/tasks/new">
            <Button variant="brand" size="sm" icon={<Plus className="w-4 h-4" />}>
              Add Task
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase">
            Language & Framework
          </div>
          <div className="text-base font-bold text-white mt-1">
            {project.language}
          </div>
          <div className="text-xs text-sky-400 font-mono mt-0.5">
            {project.framework}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase">
            Branch & Remote
          </div>
          <div className="text-base font-bold text-white mt-1 font-mono">
            {project.branch}
          </div>
          <div className="text-xs text-slate-400 font-mono truncate mt-0.5">
            {project.git_url || "Local only"}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase">
            Registered Tasks
          </div>
          <div className="text-base font-bold text-white mt-1 font-mono">
            {project.stats?.total_tasks || tasks.length}
          </div>
          <div className="text-xs text-emerald-400 font-mono mt-0.5">
            {project.stats?.verified_tasks || 0} Verified
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase">
            Filesystem Path
          </div>
          <div className="text-xs font-mono text-slate-200 truncate mt-1">
            {project.repo_path || "Default workspace"}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Normalized Server Root
          </div>
        </Card>
      </div>

      {/* Main Two-Column Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Col: Detected Commands, Dependencies, Modules */}
        <div className="space-y-6">
          {/* Detected Allowlisted Commands */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Terminal className="w-4 h-4 text-sky-400" />
              <span>Detected Verification Commands</span>
            </div>
            <div className="space-y-1.5 font-mono text-xs">
              {(
                project.detected_commands || [
                  "python -m pytest backend/tests/test_api_endpoints.py -v",
                  "git status",
                  "git diff",
                ]
              ).map((cmd, i) => (
                <div
                  key={i}
                  className="px-3 py-2 rounded-lg bg-surface-100 border border-white/5 text-slate-300 flex items-center justify-between"
                >
                  <span className="truncate">{cmd}</span>
                  <span className="text-[10px] text-emerald-400 uppercase font-semibold shrink-0 ml-2">
                    Allowlisted
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Dependencies */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Package className="w-4 h-4 text-purple-400" />
              <span>Dependencies & Versions</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {Object.entries(
                project.dependencies || {
                  fastapi: "^0.115.0",
                  pydantic: "^2.9.2",
                  pytest: "^8.3.3",
                  next: "^14.2.15",
                }
              ).map(([pkg, ver]) => (
                <div
                  key={pkg}
                  className="p-2 rounded bg-surface-100 border border-white/5 flex items-center justify-between"
                >
                  <span className="text-slate-300 truncate">{pkg}</span>
                  <span className="text-slate-400 text-[11px] shrink-0">{ver}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Detected Modules */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Architecture Modules</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {(
                project.modules || [
                  "Core API",
                  "Gemma 4 Service",
                  "Safe Runner",
                  "Verification Engine",
                  "SQLite DB Repository",
                ]
              ).map((m, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-slate-200"
                >
                  {m}
                </span>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Col: Directory Structure, Documentation, Issues & Missing Info */}
        <div className="space-y-6">
          {/* Directory Structure */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <FileCode className="w-4 h-4 text-amber-400" />
              <span>Workspace Directory Tree</span>
            </div>
            <div className="p-3 rounded-lg bg-[#07090e] border border-white/10 font-mono text-xs text-slate-300 space-y-1 max-h-56 overflow-y-auto">
              {(
                project.directory_structure || [
                  "backend/app/main.py",
                  "backend/app/schemas/core.py",
                  "backend/app/services/gemma_service.py",
                  "backend/app/services/safe_runner.py",
                  "backend/tests/test_api_endpoints.py",
                  "API_CONTRACT.md",
                  "README.md",
                ]
              ).map((path, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-400 hover:text-slate-200">
                  <span className="text-slate-600">├──</span>
                  <span>{path}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Documentation */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <FileText className="w-4 h-4 text-sky-400" />
              <span>Detected Documentation</span>
            </div>
            <div className="space-y-1 text-xs font-mono">
              {(
                project.documentation || [
                  "API_CONTRACT.md (Comprehensive API Contract)",
                  "README.md (Phase 2 Persistence & Tests)",
                ]
              ).map((doc, i) => (
                <div
                  key={i}
                  className="px-3 py-1.5 rounded bg-surface-100 border border-white/5 text-slate-300"
                >
                  {doc}
                </div>
              ))}
            </div>
          </Card>

          {/* Issues & Missing Information */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>Known Issues & Missing Context</span>
            </div>
            <div className="space-y-2 text-xs">
              {(
                project.issues || [
                  "Need live test execution against Ollama",
                  "Require SSE live log streaming for runner output",
                ]
              ).map((issue, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-rose-300 bg-rose-500/5 p-2 rounded border border-rose-500/20"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                  <span>{issue}</span>
                </div>
              ))}
              {(
                project.missing_information || [
                  "GPU hardware spec for local Ollama",
                ]
              ).map((info, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-amber-300 bg-amber-500/5 p-2 rounded border border-amber-500/20"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <span>Missing info: {info}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
