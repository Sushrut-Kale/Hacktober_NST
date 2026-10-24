"use client";

import React from "react";
import {
  Sparkles,
  FolderGit2,
  Plus,
  ArrowRight,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { RevealOnScroll } from "./RevealOnScroll";

interface HeroSectionProps {
  onOpenTaskModal: () => void;
  onOpenImportModal: () => void;
}

export function HeroSection({
  onOpenTaskModal,
  onOpenImportModal,
}: HeroSectionProps) {
  return (
    <section className="relative min-h-[90vh] lg:min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-16 text-center select-none">
      {/* Subtle radial focus vignette to enhance readability of typography without hiding the 3D helix */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center -z-10"
        aria-hidden="true"
      >
        <div className="w-[85vw] max-w-4xl h-[480px] rounded-full bg-[#071426]/60 blur-[90px]" />
      </div>

      <div className="max-w-5xl mx-auto flex flex-col items-center">
        {/* Hero Title & Description Block */}
        <RevealOnScroll delayMs={50} durationMs={750} yOffset={20}>
          <div className="flex flex-col items-center">
            {/* Subtle Category Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-panel-subtle text-[11px] font-mono tracking-widest text-[#9EDCFF] uppercase mb-4 animate-fade-in border border-white/10 shadow-[0_0_15px_rgba(88,170,225,0.15)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#58AAE1] animate-ping-slow" />
              <span>AI Development Intelligence & Verification</span>
            </div>

            {/* Dramatic Anton Display Typography (Inspired by Arix & Magnific) */}
            <h1
              className="font-heading font-normal tracking-[0.03em] uppercase leading-none text-transparent bg-clip-text select-none drop-shadow-[0_10px_35px_rgba(0,0,0,0.8)]"
              style={{
                fontSize: "clamp(4.25rem, 13vw, 11rem)",
                backgroundImage:
                  "linear-gradient(180deg, #FFFFFF 0%, #F1F4F8 45%, #9EDCFF 80%, #58AAE1 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "0 0 80px rgba(88, 170, 225, 0.35)",
              }}
            >
              VIKASA
            </h1>

            {/* Tagline */}
            <p className="mt-2 sm:mt-4 text-base sm:text-xl lg:text-2xl font-light text-slate-100 font-tight tracking-tight max-w-2xl text-balance">
              From idea to implementation. From code to verified progress.
            </p>

            {/* Supporting Description */}
            <p className="mt-2 text-xs sm:text-sm text-slate-300 font-tight max-w-xl text-balance leading-relaxed">
              Plan development tasks, inspect code changes, and verify actual implementation with evidence.
            </p>
          </div>
        </RevealOnScroll>

        {/* PRIMARY DEVELOPER ACTIONS: Side by Side Frosted Glass Cards */}
        <div className="mt-8 sm:mt-12 w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-left">
          {/* Card A: Create a New Task */}
          <RevealOnScroll delayMs={100} durationMs={650} yOffset={24} className="h-full">
            <div className="group relative rounded-3xl glass-panel p-6 sm:p-7 flex flex-col justify-between h-full transition-all duration-300 hover:border-white/30 hover:shadow-[0_25px_70px_rgba(88,170,225,0.2)] hover:-translate-y-1">
              {/* Top highlight refraction line */}
              <div className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#10294B] to-[#244B78] border border-white/10 flex items-center justify-center shadow-[0_0_15px_rgba(88,170,225,0.25)] group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5 text-[#9EDCFF]" />
                  </div>
                  <span className="text-[10px] font-mono tracking-wider text-[#58AAE1] uppercase bg-[#58AAE1]/10 px-2 py-0.5 rounded-full border border-[#58AAE1]/20">
                    Step 1
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl font-bold text-white font-tight tracking-tight">
                  Create a New Task
                </h2>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed font-tight">
                  Define a requirement, generate an implementation plan, and review it before execution.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                <button
                  onClick={onOpenTaskModal}
                  className="w-full py-2.5 px-4 rounded-xl bg-white text-[#04060A] hover:bg-[#F1F4F8] text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.25)] hover:shadow-[0_0_25px_rgba(255,255,255,0.5)] group-hover:bg-[#FFFFFF]"
                >
                  <Plus className="w-3.5 h-3.5 text-[#04060A]" />
                  <span>+ Create New Task</span>
                </button>
              </div>
            </div>
          </RevealOnScroll>

          {/* Card B: Import an Existing Project */}
          <RevealOnScroll delayMs={220} durationMs={650} yOffset={24} className="h-full">
            <div className="group relative rounded-3xl glass-panel p-6 sm:p-7 flex flex-col justify-between h-full transition-all duration-300 hover:border-white/30 hover:shadow-[0_25px_70px_rgba(88,170,225,0.2)] hover:-translate-y-1">
              {/* Top highlight refraction line */}
              <div className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#10294B] to-[#244B78] border border-white/10 flex items-center justify-center shadow-[0_0_15px_rgba(88,170,225,0.25)] group-hover:scale-105 transition-transform">
                    <FolderGit2 className="w-5 h-5 text-[#9EDCFF]" />
                  </div>
                  <span className="text-[10px] font-mono tracking-wider text-[#9EDCFF] uppercase bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                    Workspace
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl font-bold text-white font-tight tracking-tight">
                  Import Existing Project
                </h2>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed font-tight">
                  Connect a supported repository and prepare your codebase for analysis and task execution.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                <button
                  onClick={onOpenImportModal}
                  className="w-full py-2.5 px-4 rounded-xl border border-white/20 hover:border-white/40 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition-all duration-200 backdrop-blur-md"
                >
                  <FolderGit2 className="w-3.5 h-3.5 text-[#9EDCFF]" />
                  <span>Import Project</span>
                </button>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
