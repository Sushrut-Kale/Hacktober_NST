import React from "react";
import { History, AlertCircle } from "lucide-react";

interface ReplayBannerProps {
  runId?: string;
  recordedAt?: string;
}

export function ReplayBanner({ runId, recordedAt }: ReplayBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-amber-500/10 p-4 mb-6 shadow-lg backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
            <History className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wider text-xs sm:text-sm text-amber-300 uppercase">
                REPLAY — RECORDED RUN
              </span>
              <span className="px-2 py-0.5 text-[10px] uppercase font-semibold bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                Archival Mode
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Viewing deterministic snapshot data. This execution is an immutable historical record; actions cannot modify real repository state.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-slate-400 shrink-0 self-end sm:self-center">
          {runId && <span>Run: <strong className="text-slate-200">{runId}</strong></span>}
          {recordedAt && <span>Recorded: <strong className="text-slate-200">{recordedAt}</strong></span>}
        </div>
      </div>
    </div>
  );
}
