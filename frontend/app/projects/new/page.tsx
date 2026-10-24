"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Upload,
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
          className="p-2 text-[#A4B2C5] hover:text-[#F1F4F8] rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F1F4F8]">
            Register Project
          </h1>
          <p className="text-xs text-[#718198] mt-0.5">
            Connect a repository or workspace for AI intelligence and deterministic verification
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="space-y-6">
          <CardContent className="space-y-5">
            {/* Project Details */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#718198] font-mono">
                General Information
              </h2>

              <div>
                <label className="block text-xs font-medium text-[#F1F4F8] mb-1.5">
                  Project Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. VIKASA Auth Microservice"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1423] border border-white/10 text-sm text-[#F1F4F8] placeholder:text-[#718198] focus:outline-none focus:border-[#58AAE1]/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#F1F4F8] mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summary of the codebase, business domain, and verification scope..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1423] border border-white/10 text-sm text-[#F1F4F8] placeholder:text-[#718198] focus:outline-none focus:border-[#58AAE1]/50 resize-none transition-colors"
                />
              </div>
            </div>

            {/* Git & Workspace Integration */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#718198] font-mono">
                Repository Configuration
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#F1F4F8] mb-1.5">
                    Git Remote URL
                  </label>
                  <input
                    type="url"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    placeholder="https://github.com/org/repo.git"
                    className="w-full px-3.5 py-2 rounded-lg bg-[#0B1423] border border-white/10 text-xs font-mono text-[#F1F4F8] focus:outline-none focus:border-[#58AAE1]/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#F1F4F8] mb-1.5">
                    Target Branch
                  </label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="e.g. main, feature-x"
                    className="w-full px-3.5 py-2 rounded-lg bg-[#0B1423] border border-white/10 text-xs font-mono text-[#F1F4F8] focus:outline-none focus:border-[#58AAE1]/50 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#F1F4F8] mb-1.5">
                  Local Workspace Path (Server filesystem)
                </label>
                <input
                  type="text"
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  placeholder="e.g. /home/user/repo or e:/Hacktober_ADYPU"
                  className="w-full px-3.5 py-2 rounded-lg bg-[#0B1423] border border-white/10 text-xs font-mono text-[#F1F4F8] focus:outline-none focus:border-[#58AAE1]/50 transition-colors"
                />
                <p className="text-[11px] text-[#718198] mt-1.5 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 text-[#58AAE1]" />
                  <span>
                    Execution runners operate on paths registered on the backend runner.
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#F1F4F8] mb-1.5">
                    Primary Language
                  </label>
                  <input
                    type="text"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    placeholder="Python, TypeScript, Go"
                    className="w-full px-3.5 py-2 rounded-lg bg-[#0B1423] border border-white/10 text-xs text-[#F1F4F8] focus:outline-none focus:border-[#58AAE1]/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#F1F4F8] mb-1.5">
                    Framework
                  </label>
                  <input
                    type="text"
                    value={framework}
                    onChange={(e) => setFramework(e.target.value)}
                    placeholder="FastAPI, Next.js, Django"
                    className="w-full px-3.5 py-2 rounded-lg bg-[#0B1423] border border-white/10 text-xs text-[#F1F4F8] focus:outline-none focus:border-[#58AAE1]/50 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Direct Archive Upload */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#718198] font-mono">
                  Direct Archive / Documentation Upload
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-amber-500/10 text-amber-400 rounded border border-amber-500/25">
                  Backend Pending
                </span>
              </div>

              <div className="p-4 rounded-xl border border-dashed border-white/10 bg-[#0B1423]/50 text-center opacity-70">
                <Upload className="w-6 h-6 mx-auto mb-2 text-[#718198]" />
                <p className="text-xs font-medium text-[#A4B2C5]">
                  ZIP Archive & Documentation Upload
                </p>
                <p className="text-[11px] text-[#718198] mt-1">
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
