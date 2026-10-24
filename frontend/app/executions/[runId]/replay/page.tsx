"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { RunReport } from "@/lib/types";
import { ReplayBanner } from "@/components/ui/ReplayBanner";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DiffViewer } from "@/components/ui/DiffViewer";
import { formatDate, formatDuration } from "@/lib/formatters";
import {
  ArrowLeft,
  History,
  Scale,
  FileCode,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  Layers,
  Bot,
} from "lucide-react";

export default function ReplayPage() {
  const params = useParams();
  const runId = (params?.runId as string) || "run-b8f3e21a";

  const [report, setReport] = useState<RunReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      try {
        const res = await api.getRunReport(runId);
        setReport(res.data);
      } catch (e) {
        console.error("Replay report error", e);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [runId]);

  if (loading || !report) {
    return (
      <div className="p-12 text-center text-slate-400">
        Loading recorded snapshot for replay...
      </div>
    );
  }

  const { run, task, plan, verification, events, comparison } = report;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back button & Title */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/executions"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Deterministic Run Replay
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Immutable recorded snapshot: {run.run_id}
            </p>
          </div>
        </div>

        <Link href={`/verification/${run.run_id}/claim-vs-reality`}>
          <Button variant="brand" size="sm" icon={<Scale className="w-4 h-4" />}>
            Claim vs Reality
          </Button>
        </Link>
      </div>

      {/* Prominent Mandatory REPLAY Banner */}
      <ReplayBanner runId={run.run_id} recordedAt={formatDate(run.started_at)} />

      {/* Overview Cards (Recorded Data Only) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase">
            Recorded Task
          </div>
          <div className="text-sm font-bold text-white mt-1 truncate">
            {task?.title || "Not recorded"}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            ID: {task?.id || "Not recorded"}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase">
            Recorded Verdict
          </div>
          <div className="mt-1">
            <Badge status={verification?.verdict || "NOT_RUN"} size="md" />
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Snapshot evaluation
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase">
            Exit Code
          </div>
          <div
            className={`text-xl font-mono font-bold mt-1 ${
              run.exit_code === 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {run.exit_code !== undefined && run.exit_code !== null
              ? run.exit_code
              : "Not recorded"}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Terminal status
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase">
            Duration
          </div>
          <div className="text-xl font-mono font-bold text-white mt-1">
            {run.runtime_metadata?.duration_ms
              ? formatDuration(run.runtime_metadata.duration_ms)
              : "Not recorded"}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Captured sandbox time
          </div>
        </Card>
      </div>

      {/* Recorded Agent Claim */}
      {comparison?.claim && (
        <Card className="p-6 space-y-3 border-purple-500/30">
          <div className="flex items-center gap-2 text-sm font-bold text-purple-300">
            <Bot className="w-5 h-5 text-purple-400" />
            <span>Recorded Agent Claim</span>
          </div>
          <div className="p-3.5 rounded-lg bg-purple-500/5 border border-purple-500/20 font-mono text-xs text-purple-200">
            "{comparison.claim.exact_claim}"
          </div>
        </Card>
      )}

      {/* Recorded Git Diff */}
      <DiffViewer
        diff={run.git_diff}
        title="Recorded Git Diff Snapshot"
      />

      {/* Recorded Test Results */}
      {verification?.test_results && (
        <Card className="p-6 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
            Recorded Test Assertions ({verification.test_results.length})
          </h2>
          <div className="space-y-2 font-mono text-xs">
            {verification.test_results.map((t, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-surface-100 border border-white/5 flex items-center justify-between"
              >
                <span className="text-slate-300 font-semibold">{t.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{t.duration_ms} ms</span>
                  <Badge status={t.status} isTestStatus size="sm" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recorded Timeline */}
      <Card className="p-6 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
          Recorded Event Timeline
        </h2>
        <div className="space-y-3">
          {events.map((evt) => (
            <div
              key={evt.id}
              className="p-3 rounded-lg bg-surface-100/60 border border-white/5 flex items-center justify-between text-xs"
            >
              <div className="space-y-0.5 font-mono">
                <span className="font-bold text-sky-400">{evt.event_type}</span>
                <p className="text-slate-300 font-sans">{evt.message}</p>
              </div>
              <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-4">
                {formatDate(evt.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
