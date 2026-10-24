"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { ExecutionRun } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate, formatDuration } from "@/lib/formatters";
import { DEMO_RUNS } from "@/fixtures/demo-data";
import {
  Terminal,
  History,
  Scale,
  ArrowRight,
  ChevronRight,
} from "lucide-react";

export default function ExecutionsPage() {
  const [runs] = useState<ExecutionRun[]>(Object.values(DEMO_RUNS));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Executions</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Audit log of commands executed via the safe runner with stdout, stderr, and captured evidence
          </p>
        </div>
      </div>

      {/* Run list */}
      {runs.length === 0 ? (
        <div
          className="py-16 text-center rounded-xl"
          style={{ border: "1px dashed rgba(255,255,255,0.08)" }}
        >
          <Terminal className="w-8 h-8 mx-auto mb-2 text-slate-700" />
          <p className="text-sm font-medium text-slate-400">No executions yet</p>
          <p className="text-xs text-slate-600 mt-1">Approve a task and execute it to see runs here.</p>
        </div>
      ) : (
        <div
          className="rounded-xl divide-y overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {/* Table header */}
          <div
            className="grid grid-cols-[1fr,auto,auto,auto,auto] gap-4 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <span>Run / Task</span>
            <span className="hidden md:block">Status</span>
            <span className="hidden md:block">Exit Code</span>
            <span className="hidden lg:block">Started</span>
            <span>Actions</span>
          </div>

          {runs.map((run) => (
            <div
              key={run.run_id}
              className="group px-5 py-4 transition-colors"
              style={{ background: "rgba(255,255,255,0.015)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.015)"; }}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Left: IDs + command */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-sky-500">{run.run_id}</span>
                    <Badge status={run.status} size="sm" />
                    <span className="text-[10px] font-mono text-slate-600">task: {run.task_id}</span>
                    <span
                      className="px-1.5 py-px text-[10px] font-mono font-bold rounded"
                      style={
                        run.exit_code === 0
                          ? { background: "rgba(52,211,153,0.08)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }
                          : { background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }
                      }
                    >
                      exit: {run.exit_code ?? "—"}
                    </span>
                  </div>

                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs text-slate-300"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <Terminal className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span className="truncate">{run.command}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-600">
                    <span>Started: {formatDate(run.started_at)}</span>
                    <span>Duration: {formatDuration(run.runtime_metadata?.duration_ms)}</span>
                    <span>Evidence: {run.evidence_items.length} records</span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/verification/${run.run_id}/claim-vs-reality`}>
                    <Button variant="outline" size="sm" icon={<Scale className="w-3.5 h-3.5" />}>
                      Claim vs Reality
                    </Button>
                  </Link>
                  <Link href={`/executions/${run.run_id}/replay`}>
                    <Button variant="secondary" size="sm" icon={<History className="w-3.5 h-3.5 text-amber-400" />}>
                      Replay
                    </Button>
                  </Link>
                  <Link href={`/executions/${run.run_id}`}>
                    <span className="p-1.5 text-slate-600 hover:text-slate-300 rounded-lg hover:bg-white/5 transition-colors flex">
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
