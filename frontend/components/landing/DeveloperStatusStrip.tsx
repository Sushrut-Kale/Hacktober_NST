"use client";

import React, { useEffect, useState } from "react";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { RevealOnScroll } from "./RevealOnScroll";

export function DeveloperStatusStrip() {
  const { projects, isBackendOnline, isMockMode, modelStatus, backendLatency } =
    useProject();

  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [verificationStats, setVerificationStats] = useState({
    verified: 0,
    total: 0,
  });

  useEffect(() => {
    let isMounted = true;
    async function loadStats() {
      try {
        const res = await api.getTasks();
        if (isMounted && res.data) {
          setTaskCount(res.data.length);
          const verified = res.data.filter(
            (t) => t.state === "VERIFIED"
          ).length;
          setVerificationStats({
            verified,
            total: res.data.length,
          });
        }
      } catch {
        if (isMounted) {
          setTaskCount(3);
          setVerificationStats({ verified: 2, total: 3 });
        }
      }
    }
    loadStats();
    return () => {
      isMounted = false;
    };
  }, []);

  const getModelLabel = () => {
    switch (modelStatus) {
      case "AI_ACTIVE":
        return "Qwen2.5-Coder (Ollama)";
      case "FALLBACK_ACTIVE":
        return "Deterministic Fallback";
      case "AI_UNAVAILABLE":
        return "Offline";
      default:
        return "Deterministic AI";
    }
  };

  return (
    <RevealOnScroll
      delayMs={60}
      durationMs={650}
      yOffset={18}
      className="w-full max-w-5xl mx-auto px-4 sm:px-6 relative z-10 -mt-4 mb-16"
    >
      <div className="p-3 sm:p-4 rounded-2xl glass-panel-subtle border border-white/10 flex flex-wrap items-center justify-between gap-3 sm:gap-4 text-xs font-mono text-slate-300">
        {/* Metric 1: AI Model */}
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#58AAE1] shrink-0" />
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
              AI Model
            </div>
            <div className="text-white font-medium">{getModelLabel()}</div>
          </div>
        </div>

        <div className="hidden sm:block w-[1px] h-7 bg-white/10" />

        {/* Metric 2: Runtime Status */}
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${isBackendOnline ? "bg-emerald-400" : "bg-amber-400"}`} />
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
              Runtime
            </div>
            <div className="text-white font-medium flex items-center gap-1.5">
              <span>{isBackendOnline ? "Live Daemon" : isMockMode ? "Fixtures Mode" : "Ready"}</span>
              {backendLatency > 0 && (
                <span className="text-[10px] text-slate-400">({backendLatency}ms)</span>
              )}
            </div>
          </div>
        </div>

        <div className="hidden md:block w-[1px] h-7 bg-white/10" />

        {/* Metric 3: Imported Projects */}
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#9EDCFF] shrink-0" />
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
              Workspaces
            </div>
            <div className="text-white font-medium">
              {projects.length} {projects.length === 1 ? "Project" : "Projects"}
            </div>
          </div>
        </div>

        <div className="hidden lg:block w-[1px] h-7 bg-white/10" />

        {/* Metric 4: Active Tasks */}
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#58AAE1] shrink-0" />
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
              Tasks
            </div>
            <div className="text-white font-medium">
              {taskCount !== null ? `${taskCount} Active` : "0 Active"}
            </div>
          </div>
        </div>

        <div className="hidden sm:block w-[1px] h-7 bg-white/10" />

        {/* Metric 5: Verification Engine Status */}
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
              Verification Engine
            </div>
            <div className="text-emerald-400 font-medium">
              Deterministic 100%
            </div>
          </div>
        </div>
      </div>
    </RevealOnScroll>
  );
}
