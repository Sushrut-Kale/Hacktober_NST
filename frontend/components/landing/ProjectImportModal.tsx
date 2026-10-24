"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import {
  X,
  FolderGit2,
  GitBranch,
  Upload,
  Folder,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

interface ProjectImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectImportModal({ isOpen, onClose }: ProjectImportModalProps) {
  const router = useRouter();
  const { showToast, refreshStatus } = useProject();

  const [activeTab, setActiveTab] = useState<"git" | "local" | "zip">("git");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gitUrl, setGitUrl] = useState("https://github.com/Sushrut-Kale/Hacktober_NST.git");
  const [branch, setBranch] = useState("Shourya-Thorat");
  const [repoPath, setRepoPath] = useState("e:/Hacktober_ADYPU");
  const [language, setLanguage] = useState("Python");
  const [framework, setFramework] = useState("FastAPI");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

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
        git_url: activeTab === "git" ? gitUrl : "",
        branch: activeTab === "git" ? branch : "main",
        repo_path: activeTab === "local" ? repoPath : repoPath,
        language,
        framework,
      });

      showToast(`Project "${res.data.name}" imported successfully!`, "success");
      await refreshStatus();
      onClose();
      router.push(`/projects/${res.data.id}`);
    } catch (err: any) {
      showToast(err?.message || "Failed to import project", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl glass-panel p-6 sm:p-8 space-y-6 text-slate-100 border border-white/15 shadow-[0_25px_80px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase bg-[#58AAE1]/20 text-[#9EDCFF] border border-[#58AAE1]/30">
                Workspace Import
              </span>
              <span className="text-xs text-slate-400">Codebase Intelligence</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-tight">
              Import Existing Project
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Connect a repository or workspace path for AST indexing and verification
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-[#0b101b] border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("git")}
            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === "git"
                ? "bg-[#58AAE1]/20 text-[#9EDCFF] shadow-[0_0_12px_rgba(88,170,225,0.25)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FolderGit2 className="w-4 h-4" />
            <span>Git Repository</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("local")}
            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === "local"
                ? "bg-[#58AAE1]/20 text-[#9EDCFF] shadow-[0_0_12px_rgba(88,170,225,0.25)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Folder className="w-4 h-4" />
            <span>Local Filesystem</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("zip")}
            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === "zip"
                ? "bg-[#58AAE1]/20 text-[#9EDCFF] shadow-[0_0_12px_rgba(88,170,225,0.25)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>ZIP Upload</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* General Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Project Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Hacktober NST Platform"
                className="w-full px-3.5 py-2 rounded-xl bg-[#0b101b] border border-white/10 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#58AAE1]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Description (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. AI verification test suite"
                className="w-full px-3.5 py-2 rounded-xl bg-[#0b101b] border border-white/10 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#58AAE1]"
              />
            </div>
          </div>

          {/* Tab 1: Git Repository */}
          {activeTab === "git" && (
            <div className="space-y-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5 animate-fade-in">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Git Remote URL <span className="text-rose-400">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    required
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    placeholder="https://github.com/org/repo.git"
                    className="flex-1 px-3.5 py-2 rounded-xl bg-[#0b101b] border border-white/10 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#58AAE1]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Target Branch
                </label>
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main, master, or feature-branch"
                    className="flex-1 px-3.5 py-2 rounded-xl bg-[#0b101b] border border-white/10 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#58AAE1]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Local Filesystem */}
          {activeTab === "local" && (
            <div className="space-y-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5 animate-fade-in">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Server Workspace Path <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  placeholder="e.g. e:/Hacktober_ADYPU or /workspace/project"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0b101b] border border-white/10 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#58AAE1]"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Direct filesystem access is executed securely through the backend runner daemon.
                </p>
              </div>
            </div>
          )}

          {/* Tab 3: ZIP Upload (Pending status) */}
          {activeTab === "zip" && (
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/15 text-center space-y-2 animate-fade-in">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                <Upload className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">
                ZIP Archive Upload
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Direct multipart archive extraction is queued for Backend Phase 3. Please import via Git repository URL or local server workspace path.
              </p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-mono text-amber-300 uppercase">
                <AlertCircle className="w-3 h-3" />
                <span>Backend Pending · Use Git/Local</span>
              </div>
            </div>
          )}

          {/* Language & Framework */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Primary Language
              </label>
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="Python, TypeScript, Go..."
                className="w-full px-3.5 py-2 rounded-xl bg-[#0b101b] border border-white/10 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#58AAE1]"
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
                placeholder="FastAPI, Next.js, Django..."
                className="w-full px-3.5 py-2 rounded-xl bg-[#0b101b] border border-white/10 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#58AAE1]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push("/projects/new");
              }}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <span>Open in Full Page</span>
              <ExternalLink className="w-3 h-3" />
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full border border-white/10 hover:bg-white/5 text-xs font-medium text-slate-300 transition-colors flex-1 sm:flex-initial"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || activeTab === "zip"}
                className={`px-5 py-2 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 flex-1 sm:flex-initial transition-all duration-200 ${
                  activeTab === "zip"
                    ? "bg-white/10 text-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-[#58AAE1] to-[#9EDCFF] text-[#04060A] hover:shadow-[0_0_20px_rgba(88,170,225,0.4)]"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isSubmitting ? "Importing & Indexing..." : "Import Project"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
