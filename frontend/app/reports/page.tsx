"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { ExecutionRun } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/formatters";
import { FileText, Scale } from "lucide-react";

export default function ReportsPage() {
  const [runs, setRuns] = useState<ExecutionRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRuns() {
      setLoading(true);
      try {
        const res = await api.getRuns();
        setRuns(res.data);
      } finally {
        setLoading(false);
      }
    }
    loadRuns();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F1F4F8]">
            Verification Run Reports
          </h1>
          <p className="text-xs text-[#718198] mt-1">
            Audit-ready technical verification reports substantiated by deterministic evidence
          </p>
        </div>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="p-12 text-center text-[#718198] font-mono text-sm">
          Loading audit-ready run reports...
        </div>
      ) : runs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Verification Reports Available"
          description="Detailed cryptographic evidence dossiers and run reports will be compiled as tasks complete deterministic execution."
        />
      ) : (
        <div className="space-y-3">
        {runs.map((run) => (
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
                  <Button variant="outline" size="sm" icon={<Scale className="w-3.5 h-3.5" />}>
                    Claim vs Reality
                  </Button>
                </Link>
                <Link href={`/reports/${run.run_id}`}>
                  <Button
                    variant="brand"
                    size="sm"
                    icon={<FileText className="w-3.5 h-3.5" />}
                  >
                    View Report
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        ))}
        </div>
      )}
    </div>
  );
}
