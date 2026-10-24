"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  FolderGit2,
  GitBranch,
  Upload,
  FileCode,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Info,
} from "lucide-react";

export default function NewProjectPage() {
  const router = useRouter();
  const { showToast, refreshStatus } = useProject();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gitUrl, setGitUrl] = useState("https://github.com/Sushrut-Kale/Hacktober_NST.git");
  const [branch, setBranch] = useState("Shourya-Thorat");
  const [repoPath, setRepoPath] = useState("e:/Hacktober_ADYPU");
  const [language, setLanguage] = useState("Python");
  const [framework, setFramework] = useState("FastAPI");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast("Please enter a project name", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.createProject({
        name,
        description,
        git_url: gitUrl,
        branch,
        repo_path: repoPath,
        language,
        framework,
      });

      showToast(`Project "${res.data.name}" registered successfully!`, "success");
      await refreshStatus();
      router.push(`/projects/${res.data.id}`);
    } catch (err: any) {
      showToast(err?.message || "Failed to create project", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/projects"
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Register Project
          </h1>
          <p className="text-xs text-slate-400">
            Connect a repository or workspace for AI intelligence and deterministic verification
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="space-y-6">
          <CardContent className="space-y-5">
            {/* Project Details */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                General Information
              </h2>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Project Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. VIKASA Auth Microservice"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface-100 border border-white/10 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summary of the codebase, business domain, and verification scope..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface-100 border border-white/10 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50 resize-none"
                />
              </div>
            </div>

            {/* Git & Workspace Integration */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Repository Configuration
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Git Remote URL
                  </label>
                  <input
                    type="url"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    placeholder="https://github.com/org/repo.git"
                    className="w-full px-3.5 py-2 rounded-lg bg-surface-100 border border-white/10 text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Target Branch
                  </label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="e.g. main, feature-x"
                    className="w-full px-3.5 py-2 rounded-lg bg-surface-100 border border-white/10 text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Local Workspace Path (Server filesystem)
                </label>
                <input
                  type="text"
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  placeholder="e.g. /home/user/repo or e:/Hacktober_ADYPU"
                  className="w-full px-3.5 py-2 rounded-lg bg-surface-100 border border-white/10 text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-500/50"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Note: Web browsers cannot browse or mount arbitrary local directories directly due to browser security boundaries. Execution runners operate on paths registered on the backend runner.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Primary Language
                  </label>
                  <input
                    type="text"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    placeholder="Python, TypeScript, Go"
                    className="w-full px-3.5 py-2 rounded-lg bg-surface-100 border border-white/10 text-xs text-slate-100 focus:outline-none focus:border-sky-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Framework
                  </label>
                  <input
                    type="text"
                    value={framework}
                    onChange={(e) => setFramework(e.target.value)}
                    placeholder="FastAPI, Next.js, Django"
                    className="w-full px-3.5 py-2 rounded-lg bg-surface-100 border border-white/10 text-xs text-slate-100 focus:outline-none focus:border-sky-500/50"
                  />
                </div>
              </div>
            </div>

            {/* ZIP / Documentation Upload Section (Clearly labelled as Unsupported in current backend phase) */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                  Direct Archive / Documentation Upload
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-amber-500/20 text-amber-400 rounded border border-amber-500/30">
                  Backend Pending
                </span>
              </div>

              <div className="p-4 rounded-xl border border-dashed border-white/10 bg-surface-100/30 text-center opacity-60 pointer-events-none">
                <Upload className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                <p className="text-xs font-medium text-slate-300">
                  ZIP Archive & Documentation Upload
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Multipart file upload endpoints will be supported in backend Phase 3. Please register via Git URL or server workspace path.
                </p>
              </div>
            </div>
          </CardContent>

          <CardFooter className="justify-end gap-3">
            <Link href="/projects">
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </Link>
            <Button
              variant="brand"
              type="submit"
              loading={isSubmitting}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Register & Analyze
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
