"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { ExecutionRun } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate, formatDuration } from "@/lib/formatters";
import { DEMO_RUNS } from "@/fixtures/demo-data";
import {
  Terminal,
  History,
  Scale,
} from "lucide-react";

export default function ExecutionsPage() {
  const [runs] = useState<ExecutionRun[]>(Object.values(DEMO_RUNS));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F1F4F8]">
            Execution Console & History
          </h1>
          <p className="text-xs text-[#718198] mt-1">
            Audit log of commands executed under the safe runner with stdout, stderr, and captured evidence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/executions/run-b8f3e21a/replay">
            <Button
              variant="outline"
              size="sm"
              icon={<History className="w-4 h-4 text-amber-400" />}
            >
              Replay Console
            </Button>
          </Link>
        </div>
      </div>

      {/* Execution Runs List */}
      <div className="space-y-3">
        {runs.map((run) => (
          <Card
            key={run.run_id}
            borderVariant={run.status === "COMPLETED" ? "emerald" : "rose"}
            className="p-5 hover:border-white/20 transition-all group"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-xs font-mono font-bold text-[#58AAE1]">
                    {run.run_id}
                  </span>
                  <Badge status={run.status} size="sm" />
                  <span className="text-xs font-mono text-[#718198]">
                    Task: {run.task_id}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                      run.exit_code === 0
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    Exit code: {run.exit_code}
                  </span>
                  {run.model_name && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-[#718198]">
                      {run.model_name}
                    </span>
                  )}
                </div>

                {/* Command executed */}
                <div className="flex items-center gap-2 font-mono text-xs text-[#F1F4F8] bg-[#0B1423] px-3 py-2 rounded-lg border border-white/5">
                  <Terminal className="w-4 h-4 text-[#58AAE1] shrink-0" />
                  <span className="truncate">{run.command}</span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[#718198]">
                  <span>Started: {formatDate(run.started_at)}</span>
                  <span>Duration: {formatDuration(run.runtime_metadata?.duration_ms)}</span>
                  <span>Evidence records: {run.evidence_items.length}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                <Link href={`/verification/${run.run_id}/claim-vs-reality`}>
                  <Button
                    variant="brand"
                    size="sm"
                    icon={<Scale className="w-3.5 h-3.5" />}
                  >
                    Claim vs Reality
                  </Button>
                </Link>
                <Link href={`/executions/${run.run_id}/replay`}>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<History className="w-3.5 h-3.5 text-amber-400" />}
                  >
                    Replay
                  </Button>
                </Link>
                <Link href={`/executions/${run.run_id}`}>
                  <Button variant="secondary" size="sm">
                    Console Logs
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
