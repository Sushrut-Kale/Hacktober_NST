"use client";

import React from "react";
import {
  FolderGit2,
  FileText,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  GitBranch,
  Sparkles,
  Terminal,
} from "lucide-react";

export function WorkflowSection() {
  const steps = [
    {
      num: "01",
      title: "Import or select a project",
      subtitle: "Codebase Context",
      description:
        "Connect your repository or server path. VIKASA analyzes project structure, dependencies, and environment configurations.",
      icon: <FolderGit2 className="w-5 h-5 text-[#9EDCFF]" />,
    },
    {
      num: "02",
      title: "Define a development task",
      subtitle: "Deterministic Scope",
      description:
        "State requirements, affected paths, and explicit acceptance criteria. Define what constitutes true success before writing code.",
      icon: <FileText className="w-5 h-5 text-[#58AAE1]" />,
    },
    {
      num: "03",
      title: "Review and approve the implementation plan",
      subtitle: "Human-in-the-Loop",
      description:
        "Inspect the structured execution steps, diff predictions, and dependency modifications. Retain full authority before execution runs.",
      icon: <Sparkles className="w-5 h-5 text-[#9EDCFF]" />,
    },
    {
      num: "04",
      title: "Verify the result against actual evidence",
      subtitle: "Proof Over Claims",
      description:
        "Execute automated assertions, compare claims against real stdout and exit codes, and receive an audit-grade cryptographic verdict.",
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    },
  ];

  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-t border-white/10 relative z-10">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass-panel-subtle text-[11px] font-mono tracking-widest text-[#58AAE1] uppercase mb-3">
          <span>End-to-End Reliability</span>
        </div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white font-tight">
          How VIKASA Works
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 mt-2 font-tight leading-relaxed">
          A four-stage deterministic cycle eliminating hallucinated progress and silent regressions in AI-driven software development.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {steps.map((step, idx) => (
          <div
            key={step.num}
            className="group relative rounded-2xl glass-panel p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 hover:border-white/30 hover:shadow-[0_15px_45px_rgba(88,170,225,0.15)] hover:-translate-y-1"
          >
            {/* Top refraction line */}
            <div className="absolute inset-x-6 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-heading text-2xl text-slate-500 group-hover:text-[#58AAE1] transition-colors">
                  {step.num}
                </span>
                <div className="w-9 h-9 rounded-xl bg-[#10294B]/50 border border-white/10 flex items-center justify-center">
                  {step.icon}
                </div>
              </div>

              <div className="text-[10px] font-mono tracking-wider uppercase text-[#58AAE1] mb-1">
                {step.subtitle}
              </div>
              <h3 className="text-base font-bold text-white font-tight leading-snug">
                {step.title}
              </h3>
              <p className="text-xs text-slate-300 mt-2.5 leading-relaxed font-tight">
                {step.description}
              </p>
            </div>

            <div className="mt-6 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Stage {idx + 1} of 4</span>
              {idx < 3 ? (
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
              ) : (
                <span className="text-emerald-400 font-bold">VERIFIED</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
