"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { ExecutionRun } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/formatters";

export default function ReportsPage() {
  const { isMockMode } = useProject();
  const [runs, setRuns] = useState<ExecutionRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      try {
        const res = await api.getExecutions();
        setRuns(res.data);
      } catch (err) {
        console.error("Failed to load execution reports:", err);
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#F1F4F8]">
              Verification Run Reports
            </h1>
            {isMockMode && (
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                DEV FIXTURE
              </span>
            )}
          </div>
          <p className="text-xs text-[#718198] mt-1">
            Audit-ready technical verification reports substantiated by deterministic evidence
          </p>
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl shimmer"
              style={{ border: "1px solid rgba(255, 255, 255, 0.08)" }}
            />
          ))
        ) : runs.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 bg-[#0B1423]/40 text-[#718198]">
            <h3 className="text-base font-semibold text-[#F1F4F8] mb-1">
              No Verification Run Reports Generated
            </h3>
            <p className="text-xs text-[#718198] max-w-md mx-auto mb-5 leading-relaxed">
              Technical reports will be compiled once execution runs are evaluated by the deterministic verification engine.
            </p>
            <Link href="/tasks">
              <Button variant="brand" size="sm">
                Go to Tasks
              </Button>
            </Link>
          </div>
        ) : (
          runs.map((run) => (
            <Card
              key={run.run_id}
              className="p-5 hover:border-white/20 transition-all group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono font-bold text-[#58AAE1]">
                      Report: {run.run_id}
                    </span>
                    <Badge status={run.status} size="sm" />
                    <span className="text-xs font-mono text-[#718198]">
                      Task: {run.task_id}
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-[#F1F4F8] group-hover:text-[#9EDCFF] transition-colors">
                    Verification Report for {run.task_id}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[#718198]">
                    <span>Timestamp: {formatDate(run.started_at)}</span>
                    <span>Exit code: {run.exit_code}</span>
                    <span>Evidence count: {run.evidence_items.length}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/verification/${run.run_id}/claim-vs-reality`}>
                    <Button variant="outline" size="sm">
                      Claim vs Reality
                    </Button>
                  </Link>
                  <Link href={`/reports/${run.run_id}`}>
                    <Button variant="brand" size="sm">
                      View Report
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
