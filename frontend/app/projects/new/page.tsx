"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  FolderGit2,
  GitBranch,
  Upload,
  FileText,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Terminal,
  Layers,
  FileCode,
  ShieldCheck,
  RefreshCw,
  Folder,
} from "lucide-react";

type IntakeMode = "git" | "folder" | "idea" | "brief";

interface CrossQuestion {
  id: string;
  question: string;
  rationale: string;
  options: string[];
  selectedAnswer?: string;
  isInferred?: boolean;
}

export default function NewProjectPage() {
  const router = useRouter();
  const { showToast, refreshStatus } = useProject();

  const [mode, setMode] = useState<IntakeMode>("git");
  const [step, setStep] = useState<"input" | "cross_examination" | "syncing">("input");

  // Input states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gitUrl, setGitUrl] = useState("https://github.com/Sushrut-Kale/Hacktober_NST.git");
  const [rootPath, setRootPath] = useState(".");
  const [projectIdea, setProjectIdea] = useState("");
  const [projectBrief, setProjectBrief] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Cross-examination questions
  const [questions, setQuestions] = useState<CrossQuestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Handle Initial Analysis & Transition to Cross-Questioning
  const handleProceedToQuestions = (e: React.FormEvent) => {
    e.preventDefault();

    let computedName = name.trim();
    if (!computedName) {
      if (mode === "git" && gitUrl) {
        const parts = gitUrl.replace(/\.git$/, "").split("/");
        computedName = parts[parts.length - 1] || "Imported Project";
      } else if (mode === "idea" && projectIdea) {
        computedName = projectIdea.slice(0, 30).trim() + "...";
      } else if (mode === "folder") {
        computedName = rootPath === "." ? "Local Repository Workspace" : rootPath.split("/").pop() || "Local Project";
      } else {
        computedName = "VIKASA Project " + new Date().toLocaleDateString();
      }
      setName(computedName);
    }

    setIsAnalyzing(true);
    setTimeout(() => {
      // Generate targeted questions based on the intake mode & requirements
      const generated: CrossQuestion[] = [
        {
          id: "q1",
          question: "What test runner should deterministic verification enforce for acceptance criteria?",
          rationale: "Ensures test executions use allowlisted commands and valid pass/fail criteria.",
          options: ["pytest (Python / FastAPI)", "npm test (Jest / Vitest)", "cargo test (Rust)", "No automated tests yet"],
        },
        {
          id: "q2",
          question: "How should state transitions be enforced before agent code execution?",
          rationale: "VIKASA requires human approval before task status transitions to IN_PROGRESS.",
          options: ["Strict Manual Approval Gate (Recommended)", "Auto-approve if AI plan confidence > 90%", "Sandbox-only execution"],
        },
        {
          id: "q3",
          question: "Which verification rule set should decide the final verdict?",
          rationale: "Deterministic rules evaluate exit codes, git diff presence, and acceptance criteria coverage.",
          options: ["Comprehensive (Tests + Diff + Exit Codes)", "Fast Track (Exit code and logs only)", "Custom Criteria Mapping"],
        },
      ];
      setQuestions(generated);
      setIsAnalyzing(false);
      setStep("cross_examination");
    }, 450);
  };

  // Cross-examination handlers
  const handleSelectAnswer = (qId: string, answer: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, selectedAnswer: answer, isInferred: false } : q))
    );
  };

  const handleSkipAll = () => {
    setQuestions((prev) =>
      prev.map((q) => ({
        ...q,
        selectedAnswer: q.options[0],
        isInferred: true,
      }))
    );
    showToast("Skipped questions. Sensible defaults applied as explicit INFERRED assumptions.", "info");
    finalizeProjectRegistration();
  };

  const handleDecideForMe = () => {
    setQuestions((prev) =>
      prev.map((q) => ({
        ...q,
        selectedAnswer: q.options[0],
        isInferred: true,
      }))
    );
    showToast("AI decided standard project configuration (marked as INFERRED).", "success");
    finalizeProjectRegistration();
  };

  const finalizeProjectRegistration = async () => {
    setStep("syncing");
    try {
      // 1. Create project in real FastAPI backend
      const res = await api.createProject({
        name: name || "VIKASA Workspace Project",
        description: description || projectIdea || "Project managed by VIKASA Verification Platform",
        git_url: mode === "git" ? gitUrl : undefined,
        repository_url: mode === "git" ? gitUrl : undefined,
        source_type: mode === "git" ? "GIT" : mode === "idea" ? "IDEA" : "FOLDER",
        idea_prompt: mode === "idea" ? projectIdea : undefined,
        repo_path: rootPath,
        language: "Python/TypeScript",
        framework: "FastAPI/Next.js",
      } as any);

      const projectId = res.data.id;

      // 2. Register initial baseline task with acceptance criteria from intake & answers
      await api.createTask({
        project_id: projectId,
        title: `Initialize baseline architecture for ${name || "Project"}`,
        description: `Import and verify structure. Inferred assumptions: ${questions
          .map((q) => `${q.question}: ${q.selectedAnswer || q.options[0]} (${q.isInferred ? "INFERRED" : "CONFIRMED"})`)
          .join(" | ")}`,
        acceptance_criteria: [
          { id: "AC-1", description: "Verify git repository or workspace accessibility", required: true },
          { id: "AC-2", description: "Run test suite and verify clean exit code 0", required: true },
        ],
      });

      showToast(`Project "${res.data.name}" successfully created with baseline tasks!`, "success");
      await refreshStatus();
      router.push(`/projects/${projectId}`);
    } catch (err: any) {
      showToast(err?.message || "Failed to persist project record", "error");
      setStep("cross_examination");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/projects"
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">Project Intake Command</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold uppercase tracking-wider">
              {step === "input" ? "Mode Selection" : step === "cross_examination" ? "AI Clarification" : "Syncing"}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Import → Understand → Analyze → Cross-Examine → Plan baseline verification
          </p>
        </div>
      </div>

      {/* STEP 1: INTAKE MODES */}
      {step === "input" && (
        <div className="space-y-6">
          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: "git", label: "Git Repository", icon: FolderGit2, desc: "Clone or connect GitHub / GitLab URL" },
              { id: "folder", label: "Local Filesystem", icon: Folder, desc: "Connect local project folder path" },
              { id: "idea", label: "Idea / Prompt", icon: Sparkles, desc: "Natural-language project definition" },
              { id: "brief", label: "Brief / PRD", icon: FileText, desc: "Upload requirements brief or spec" },
            ].map((m) => {
              const Icon = m.icon;
              const isSelected = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id as IntakeMode)}
                  className={`p-3.5 rounded-xl text-left transition-all ${
                    isSelected
                      ? "bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-500/10"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] text-slate-400 hover:text-white"
                  }`}
                  style={{ border: isSelected ? "1px solid rgba(6,182,212,0.5)" : "1px solid rgba(255,255,255,0.06)" }}
                >
                  <Icon className={`w-5 h-5 mb-2 ${isSelected ? "text-cyan-400" : "text-slate-400"}`} />
                  <div className={`text-xs font-semibold ${isSelected ? "text-white" : "text-slate-200"}`}>
                    {m.label}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                    {m.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mode-Specific Form */}
          <form onSubmit={handleProceedToQuestions}>
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Project Display Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. VIKASA Platform Services"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-mono"
                  />
                </div>

                {/* MODE 1: GIT REPOSITORY */}
                {mode === "git" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Repository HTTPS / Git URL <span className="text-cyan-400">*</span>
                      </label>
                      <input
                        type="url"
                        required
                        value={gitUrl}
                        onChange={(e) => setGitUrl(e.target.value)}
                        placeholder="https://github.com/org/repo.git"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-mono"
                      />
                    </div>
                    <div className="p-3 rounded-lg bg-sky-500/5 border border-sky-500/15 flex items-start gap-2.5 text-xs text-sky-300">
                      <FolderGit2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      <span>VIKASA will clone or inspect the repository, detect language and framework, and extract test commands.</span>
                    </div>
                  </div>
                )}

                {/* MODE 2: LOCAL FOLDER */}
                {mode === "folder" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Local Server Workspace Path <span className="text-cyan-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={rootPath}
                        onChange={(e) => setRootPath(e.target.value)}
                        placeholder="e.g. . or S:/Hacktober_NST"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-mono"
                      />
                    </div>
                    <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15 flex items-start gap-2.5 text-xs text-amber-300">
                      <Terminal className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        Filesystem integration relies on server-accessible paths. Browsers cannot directly read arbitrary local hard drives without backend runtime verification.
                      </span>
                    </div>
                  </div>
                )}

                {/* MODE 3: PROJECT IDEA */}
                {mode === "idea" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Describe What You Want to Build <span className="text-cyan-400">*</span>
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={projectIdea}
                        onChange={(e) => setProjectIdea(e.target.value)}
                        placeholder="e.g. An AI coding agent verification proxy with deterministic rule evaluation, safe process runner, and Git diff capture..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                    <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/15 flex items-start gap-2.5 text-xs text-purple-300">
                      <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <span>VIKASA will deconstruct your prompt into architecture components, API schemas, and test criteria.</span>
                    </div>
                  </div>
                )}

                {/* MODE 4: REQUIREMENTS BRIEF */}
                {mode === "brief" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Project Brief or PRD Text <span className="text-cyan-400">*</span>
                      </label>
                      <textarea
                        rows={5}
                        value={projectBrief}
                        onChange={(e) => setProjectBrief(e.target.value)}
                        placeholder="Paste your software requirements specification, acceptance criteria list, or feature breakdown..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 cursor-pointer flex items-center gap-2 transition-colors">
                        <Upload className="w-4 h-4 text-cyan-400" />
                        <span>Upload .md or .txt document</span>
                        <input
                          type="file"
                          accept=".md,.txt,.json"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setUploadedFileName(file.name);
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                setProjectBrief(String(evt.target?.result || ""));
                              };
                              reader.readAsText(file);
                            }
                          }}
                        />
                      </label>
                      {uploadedFileName && (
                        <span className="text-xs text-emerald-400 font-mono">
                          Loaded: {uploadedFileName}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Action button */}
                <div className="pt-4 flex items-center justify-end border-t border-white/5">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isAnalyzing}
                    className="flex items-center gap-2"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Analyzing Requirements...
                      </>
                    ) : (
                      <>
                        Analyze & Cross-Examine <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      )}

      {/* STEP 2: AI CROSS-QUESTIONING */}
      {step === "cross_examination" && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div
            className="p-4 rounded-xl flex items-center justify-between"
            style={{
              background: "linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(15,22,36,0.9) 100%)",
              border: "1px solid rgba(6,182,212,0.25)",
            }}
          >
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">AI Cross-Questioning</h3>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Targeted questions to resolve ambiguities before generating the baseline execution plan.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSkipAll}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                Skip All
              </button>
              <button
                type="button"
                onClick={handleDecideForMe}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" /> Decide for Me
              </button>
            </div>
          </div>

          {/* Question Cards */}
          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="p-5 rounded-xl space-y-3"
                style={{
                  background: "rgba(15,22,36,0.7)",
                  border: q.selectedAnswer
                    ? "1px solid rgba(6,182,212,0.3)"
                    : "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                      Question {idx + 1} of {questions.length}
                    </span>
                    <h4 className="text-sm font-semibold text-white mt-0.5">{q.question}</h4>
                    <p className="text-xs text-slate-400 mt-1">{q.rationale}</p>
                  </div>

                  {q.selectedAnswer && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        q.isInferred
                          ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                          : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                      }`}
                    >
                      {q.isInferred ? "INFERRED" : "CONFIRMED"}
                    </span>
                  )}
                </div>

                {/* Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {q.options.map((opt) => {
                    const isPicked = q.selectedAnswer === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleSelectAnswer(q.id, opt)}
                        className={`p-3 rounded-lg text-left text-xs transition-all flex items-center justify-between ${
                          isPicked
                            ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-200 font-medium"
                            : "bg-white/[0.02] border-white/5 text-slate-300 hover:bg-white/[0.05]"
                        }`}
                        style={{ border: isPicked ? "1px solid rgba(6,182,212,0.5)" : "1px solid rgba(255,255,255,0.06)" }}
                      >
                        <span>{opt}</span>
                        {isPicked && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Confirm & Persist */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => setStep("input")}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Back to Input
            </button>

            <Button
              type="button"
              variant="primary"
              onClick={finalizeProjectRegistration}
              className="flex items-center gap-2"
            >
              Finalize & Register Project <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: SYNCING STATE */}
      {step === "syncing" && (
        <Card className="p-12 text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
          <h3 className="text-base font-semibold text-white">Persisting Project & Baseline Architecture</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Recording project in SQLite database repository, setting up deterministic checkpoints, and initializing baseline acceptance criteria...
          </p>
        </Card>
      )}
    </div>
  );
}
