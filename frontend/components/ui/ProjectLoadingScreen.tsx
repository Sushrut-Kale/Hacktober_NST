"use client";

import React, { useEffect, useState } from "react";
import { BrandLogo } from "./Logo";
import { Terminal, CheckCircle2, Loader2, AlertTriangle, RefreshCw } from "lucide-react";

interface Stage {
  id: string;
  label: string;
  detail: string;
}

const DEFAULT_STAGES: Stage[] = [
  { id: "db", label: "Database Consistency Check", detail: "Connecting to SQLite persistence repository..." },
  { id: "ai", label: "Model Runtime Diagnostics", detail: "Checking local Ollama / Gemma service readiness..." },
  { id: "adapter", label: "Execution Adapter Inspection", detail: "Probing Antigravity runner environment..." },
  { id: "sync", label: "Project State Synchronization", detail: "Loading active checkpoints and deterministic rule states..." },
];

interface ProjectLoadingScreenProps {
  title?: string;
  subtitle?: string;
  stages?: Stage[];
  currentStageIndex?: number;
  error?: string | null;
  onRetry?: () => void;
  onContinueAnyway?: () => void;
}

export function ProjectLoadingScreen({
  title = "Initializing VIKASA Workspace",
  subtitle = "Deterministically verifying system state and runtime adapters...",
  stages = DEFAULT_STAGES,
  currentStageIndex = 0,
  error = null,
  onRetry,
  onContinueAnyway,
}: ProjectLoadingScreenProps) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 450);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-[500px] flex items-center justify-center p-6">
      <div
        className="w-full max-w-xl rounded-2xl p-8 relative overflow-hidden backdrop-blur-xl"
        style={{
          background: "linear-gradient(145deg, rgba(15,22,36,0.9) 0%, rgba(10,13,20,0.95) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 20px 50px -10px rgba(0,0,0,0.5)",
        }}
      >
        {/* Subtle accent glow */}
        <div
          className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none"
          style={{ background: error ? "rgba(239,68,68,0.12)" : "rgba(6,182,212,0.12)" }}
        />

        {/* Brand header */}
        <div className="flex items-center gap-3.5 mb-6">
          <BrandLogo size={36} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white tracking-tight">{title}</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase tracking-widest font-bold">
                INIT
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-sans">{subtitle}</p>
          </div>
        </div>

        {/* Progress Stages */}
        <div className="space-y-3 mb-6">
          {stages.map((stage, idx) => {
            const isDone = idx < currentStageIndex;
            const isCurrent = idx === currentStageIndex && !error;
            const isPending = idx > currentStageIndex && !error;

            return (
              <div
                key={stage.id}
                className="flex items-start gap-3 p-3 rounded-lg transition-all duration-300"
                style={{
                  background: isCurrent
                    ? "rgba(6,182,212,0.05)"
                    : isDone
                    ? "rgba(16,185,129,0.03)"
                    : "rgba(255,255,255,0.015)",
                  border: isCurrent
                    ? "1px solid rgba(6,182,212,0.25)"
                    : isDone
                    ? "1px solid rgba(16,185,129,0.15)"
                    : "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-700/80 bg-slate-800/40" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-medium ${
                        isCurrent
                          ? "text-cyan-300 font-semibold"
                          : isDone
                          ? "text-slate-200"
                          : "text-slate-500"
                      }`}
                    >
                      {stage.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-mono text-cyan-400">
                        active{dots}
                      </span>
                    )}
                    {isDone && (
                      <span className="text-[10px] font-mono text-emerald-400">verified</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate font-mono">
                    {stage.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error State Banner */}
        {error && (
          <div
            className="p-3.5 rounded-lg mb-6 flex items-start gap-3"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
            }}
          >
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <span className="font-semibold text-rose-300">Initialization Notice: </span>
              <span className="text-rose-200/80">{error}</span>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            <Terminal className="w-3.5 h-3.5 text-slate-400" />
            <span>Deterministic verification active</span>
          </div>

          <div className="flex items-center gap-2">
            {error && onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            )}
            {error && onContinueAnyway && (
              <button
                onClick={onContinueAnyway}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors shadow-sm"
              >
                Proceed with Available Data
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
