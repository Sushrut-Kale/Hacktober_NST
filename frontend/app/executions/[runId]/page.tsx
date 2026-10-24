"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { ExecutionRun, ExecutionEvent } from "@/lib/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DiffViewer } from "@/components/ui/DiffViewer";
import { formatDate, formatDuration } from "@/lib/formatters";
import {
  ArrowLeft,
  Terminal,
  FileCode,
  ShieldCheck,
  Scale,
  History,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Cpu,
} from "lucide-react";

export default function ExecutionDetailsPage() {
  const params = useParams();
  const runId = (params?.runId as string) || "run-b8f3e21a";

  const { showToast } = useProject();
  const [run, setRun] = useState<ExecutionRun | null>(null);
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedStdout, setCopiedStdout] = useState(false);

  useEffect(() => {
    async function loadRun() {
      setLoading(true);
      try {
        const res = await api.getExecutionRun(runId);
        setRun(res.data);
        const evts = await api.getEvents(res.data.task_id);
        setEvents(evts.data);
      } finally {
        setLoading(false);
      }
    }
    loadRun();
  }, [runId]);

  const copyStdout = () => {
    if (!run?.stdout) return;
    navigator.clipboard.writeText(run.stdout);
    setCopiedStdout(true);
    setTimeout(() => setCopiedStdout(false), 2000);
  };

  if (loading || !run) {
    return (
      <div className="p-12 text-center text-slate-400">
        Loading execution output...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/executions"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-bold text-sky-400">
                {run.run_id}
              </span>
              <Badge status={run.status} size="sm" />
              <span className="text-xs font-mono text-slate-400">
                Task: <Link href={`/tasks/${run.task_id}`} className="text-sky-400 hover:underline">{run.task_id}</Link>
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
              Execution Console & Evidence
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/verification/${run.run_id}/claim-vs-reality`}>
            <Button
              variant="brand"
              size="sm"
              icon={<Scale className="w-4 h-4" />}
            >
              Claim vs Reality
            </Button>
          </Link>
          <Link href={`/executions/${run.run_id}/replay`}>
            <Button
              variant="outline"
              size="sm"
              icon={<History className="w-4 h-4 text-amber-400" />}
            >
              Replay
            </Button>
          </Link>
        </div>
      </div>

      {/* Command & Metadata Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase">
            Exit Code
          </div>
          <div
            className={`text-2xl font-extrabold font-mono mt-1 ${
              run.exit_code === 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {run.exit_code}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            {run.exit_code === 0 ? "Deterministic Success" : "Command Terminated with Error"}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase">
            Execution Duration
          </div>
          <div className="text-2xl font-extrabold font-mono text-white mt-1">
            {formatDuration(run.runtime_metadata?.duration_ms)}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Sandbox Wall Clock
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase">
            Captured Evidence
          </div>
          <div className="text-2xl font-extrabold font-mono text-sky-400 mt-1">
            {run.evidence_items.length}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Discrete Verification Records
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase">
            Inference Model
          </div>
          <div className="text-sm font-bold font-mono text-purple-300 mt-1 truncate">
            {run.model_name || "gemma4:e4b"}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Host: {run.runtime_metadata?.host || "localhost"}
          </div>
        </Card>
      </div>

      {/* Command Bar */}
      <div className="p-3.5 rounded-xl bg-surface-100 border border-white/10 flex items-center justify-between font-mono text-xs">
        <div className="flex items-center gap-2 text-slate-300 truncate">
          <Terminal className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="text-slate-500">$</span>
          <span className="truncate">{run.command}</span>
        </div>
        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 ml-2">
          ALLOWLISTED RUNNER
        </span>
      </div>

      {/* Terminal Output (Stdout & Stderr) */}
      <Card className="overflow-hidden bg-[#07090e] border-white/10">
        <div className="flex items-center justify-between px-4 py-2.5 bg-surface-100/70 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
            <span className="text-xs font-mono text-slate-400 font-semibold ml-2">
              Captured Execution Stream (Stdout)
            </span>
          </div>
          <button
            onClick={copyStdout}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-white rounded bg-white/5 hover:bg-white/10 transition-colors"
          >
            {copiedStdout ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedStdout ? "Copied" : "Copy Output"}</span>
          </button>
        </div>

        <div className="p-4 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto max-h-96 select-text">
          <pre>{run.stdout || "No stdout recorded."}</pre>
          {run.stderr && (
            <pre className="text-rose-400 mt-3 pt-3 border-t border-rose-500/20">
              {run.stderr}
            </pre>
          )}
        </div>
      </Card>

      {/* Git Diff Changes */}
      <DiffViewer diff={run.git_diff} />

      {/* Discrete Evidence Records */}
      <Card className="p-6 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span>Recorded Verification Evidence ({run.evidence_items.length})</span>
        </h2>

        <div className="space-y-3">
          {run.evidence_items.map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-surface-100 border border-white/5 flex items-start justify-between gap-4 text-xs font-mono"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    {item.evidence_type}
                  </span>
                  {item.criterion_id && (
                    <span className="text-slate-400">
                      Target: {item.criterion_id}
                    </span>
                  )}
                  {item.file_path && (
                    <span className="text-slate-300">
                      File: {item.file_path}:{item.line_range}
                    </span>
                  )}
                </div>
                <p className="text-slate-300 font-sans">{item.content}</p>
              </div>

              <div className="shrink-0">
                {item.passed ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>PASSED</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-400 font-bold">
                    <XCircle className="w-4 h-4" />
                    <span>FAILED</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
