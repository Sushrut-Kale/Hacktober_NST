"use client";

import React, { useEffect, useState } from "react";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import {
  Cpu,
  Activity,
  FolderGit2,
  CheckSquare,
  ShieldCheck,
  Zap,
} from "lucide-react";

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
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 relative z-10 -mt-4 mb-16">
      <div className="p-3 sm:p-4 rounded-2xl glass-panel-subtle border border-white/10 flex flex-wrap items-center justify-between gap-3 sm:gap-4 text-xs font-mono text-slate-300">
        {/* Metric 1: AI Model */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#58AAE1]/15 text-[#9EDCFF] flex items-center justify-center border border-[#58AAE1]/25">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
              AI Model
            </div>
            <div className="text-white font-medium">{getModelLabel()}</div>
          </div>
        </div>

        <div className="hidden sm:block w-[1px] h-7 bg-white/10" />

        {/* Metric 2: Runtime Status */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/25">
            <Activity className="w-3.5 h-3.5" />
          </div>
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
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-sky-500/15 text-[#9EDCFF] flex items-center justify-center border border-sky-500/25">
            <FolderGit2 className="w-3.5 h-3.5" />
          </div>
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
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-500/15 text-[#58AAE1] flex items-center justify-center border border-blue-500/25">
            <CheckSquare className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
              Tasks
            </div>
            <div className="text-white font-medium">
              {taskCount !== null ? `${taskCount} Active` : "Loading..."}
            </div>
          </div>
        </div>

        <div className="hidden sm:block w-[1px] h-7 bg-white/10" />

        {/* Metric 5: Verification Engine Status */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#58AAE1]/15 text-[#9EDCFF] flex items-center justify-center border border-[#58AAE1]/25">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
              Verification Engine
            </div>
            <div className="text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              <span>Evidence Deterministic</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
