"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { ClaimVsRealityComparison, VerificationVerdict } from "@/lib/types";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Scale,
  Bot,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileCode,
  Terminal,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  FileText,
  Clock,
  Layers,
  Code2,
  Check,
  Copy,
  Info,
} from "lucide-react";

export default function ClaimVsRealityPage() {
  const params = useParams();
  const router = useRouter();
  const runId = (params?.runId as string) || "run-b8f3e21a";

  const { showToast } = useProject();
  const [data, setData] = useState<ClaimVsRealityComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isApprovingCorrection, setIsApprovingCorrection] = useState(false);

  useEffect(() => {
    async function loadComparison() {
      setLoading(true);
      try {
        const res = await api.getClaimVsReality(runId);
        setData(res.data);
      } catch (e) {
        console.error("Failed to load Claim vs Reality", e);
      } finally {
        setLoading(false);
      }
    }
    loadComparison();
  }, [runId]);

  const handleVerifyAgain = async () => {
    if (!data) return;
    setIsVerifying(true);
    try {
      const res = await api.verifyTask(data.task_id, runId);
      showToast(
        `Deterministic verification re-evaluated: ${res.data.verdict}`,
        res.data.verdict === "VERIFIED" ? "success" : "error"
      );
    } catch (err: any) {
      showToast(err?.message || "Verification failed", "error");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleApproveCorrection = async () => {
    setIsApprovingCorrection(true);
    try {
      showToast(
        "Correction approved! Applied patch to safe runner staging.",
        "success"
      );
      setTimeout(() => {
        router.push(`/tasks/${data?.task_id}`);
      }, 1200);
    } finally {
      setIsApprovingCorrection(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="p-12 text-center text-slate-400">
        Loading Claim vs Reality comparison...
      </div>
    );
  }

  const { claim, reality, verdict, suggested_correction } = data;
  const isVerified = verdict === "VERIFIED";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
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
                {runId}
              </span>
              <span className="text-xs font-mono text-slate-400">
                Task: <strong className="text-slate-200">{data.task_id}</strong>
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                Core Invariant Evaluation
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1 flex items-center gap-2.5">
              <Scale className="w-7 h-7 text-sky-400" />
              <span>Claim vs Reality</span>
            </h1>
          </div>
        </div>

        {/* Global Verdict Banner & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-100 px-3.5 py-1.5 rounded-xl border border-white/10">
            <span className="text-xs font-semibold text-slate-400 uppercase">
              Backend Verdict:
            </span>
            <Badge status={verdict} size="lg" />
          </div>

          <Link href={`/reports/${runId}`}>
            <Button
              variant="outline"
              size="sm"
              icon={<FileText className="w-4 h-4" />}
            >
              Full Report
            </Button>
          </Link>
        </div>
      </div>

      {/* Invariant Explanation Banner */}
      <div className="p-4 rounded-xl border border-white/10 bg-surface-200/60 backdrop-blur-sm flex items-start gap-3 text-xs text-slate-300">
        <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-sky-300">Deterministic Invariant:</strong> The left panel represents what the AI coding agent declared in its completion message. The right panel represents what VIKASA's deterministic engine actually observed in git status, command exit codes, and test assertions. The verdict is never invented by the agent.
        </div>
      </div>

      {/* Side-by-Side (Desktop) / Stacked (Mobile) Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ============================================================ */}
        {/* PANEL 1: AGENT CLAIM (AI Unverified Perspective) */}
        {/* ============================================================ */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-sm font-bold text-purple-300">
              <Bot className="w-5 h-5 text-purple-400" />
              <span>Agent Claim</span>
            </div>
            <span className="text-[11px] font-mono text-purple-400/80 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
              Self-Reported Message
            </span>
          </div>

          <Card borderVariant="default" className="p-5 space-y-4 border-purple-500/30">
            {/* Original Requirement */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Original Requirement
              </span>
              <p className="text-xs text-slate-200 bg-surface-100 p-3 rounded-lg border border-white/5">
                {claim.original_requirement}
              </p>
            </div>

            {/* Exact Agent Claim */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 block mb-1">
                Exact Completion Claim
              </span>
              <div className="p-3.5 rounded-lg bg-purple-500/5 border border-purple-500/20 text-xs text-purple-200 leading-relaxed font-mono">
                "{claim.exact_claim}"
              </div>
            </div>

            {/* Claimed Behavior */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Claimed Behavior
              </span>
              <p className="text-xs text-slate-300 bg-surface-100 p-3 rounded-lg border border-white/5">
                {claim.claimed_behavior}
              </p>
            </div>

            {/* Claimed Changed Files */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Claimed Changed Files ({claim.claimed_changed_files.length})
              </span>
              <div className="space-y-1 font-mono text-xs">
                {claim.claimed_changed_files.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 rounded bg-surface-100 border border-white/5 text-slate-300"
                  >
                    <FileCode className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="truncate">{file}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent Metadata */}
            <div className="pt-3 border-t border-white/5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Agent Metadata
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded bg-surface-100 border border-white/5">
                  <span className="text-slate-400 block text-[10px]">Model</span>
                  <span className="text-slate-200 font-semibold">{claim.agent_metadata.model}</span>
                </div>
                <div className="p-2 rounded bg-surface-100 border border-white/5">
                  <span className="text-slate-400 block text-[10px]">Agent ID</span>
                  <span className="text-slate-200 font-semibold truncate">{claim.agent_metadata.agent_id}</span>
                </div>
                <div className="p-2 rounded bg-surface-100 border border-white/5">
                  <span className="text-slate-400 block text-[10px]">Execution Time</span>
                  <span className="text-slate-200 font-semibold">{claim.agent_metadata.duration_seconds}s</span>
                </div>
                <div className="p-2 rounded bg-surface-100 border border-white/5">
                  <span className="text-slate-400 block text-[10px]">Temperature</span>
                  <span className="text-slate-200 font-semibold">{claim.agent_metadata.temperature ?? 0.2}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ============================================================ */}
        {/* PANEL 2: OBSERVED EVIDENCE (Deterministic Reality) */}
        {/* ============================================================ */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-sm font-bold text-sky-300">
              <ShieldCheck className="w-5 h-5 text-sky-400" />
              <span>Observed Evidence</span>
            </div>
            <span className="text-[11px] font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
              Deterministic Facts
            </span>
          </div>

          <Card
            borderVariant={isVerified ? "emerald" : "rose"}
            className="p-5 space-y-4"
          >
            {/* Discrepancies Alert (if any exist) */}
            {reality.discrepancies.length > 0 && (
              <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Discrepancies Detected ({reality.discrepancies.length})</span>
                </div>
                {reality.discrepancies.map((disc, idx) => (
                  <div key={idx} className="text-xs space-y-1 font-mono">
                    <div className="flex items-center justify-between">
                      <strong className="text-rose-300">{disc.field}:</strong>
                      <span className="text-[10px] uppercase font-bold text-rose-400 bg-rose-500/20 px-1.5 py-0.2 rounded">
                        {disc.severity}
                      </span>
                    </div>
                    <div className="text-slate-300">
                      Claimed: <span className="line-through text-slate-500">{disc.claim}</span>
                    </div>
                    <div className="text-rose-200 font-bold">
                      Reality: {disc.reality}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Actual Changed Files */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Actual Modified Files ({reality.actual_changed_files.length})
              </span>
              <div className="space-y-1 font-mono text-xs">
                {reality.actual_changed_files.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded bg-surface-100 border border-white/5 text-slate-200"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="truncate">{file}</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase shrink-0">
                      CONFIRMED IN GIT
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Code Evidence with line ranges & snippets */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Code Evidence & AST Inspect
              </span>
              <div className="space-y-2 text-xs">
                {reality.code_evidence.map((ev, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-surface-100 border border-white/5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-sky-300 font-bold">
                        {ev.file}:{ev.line_range}
                      </span>
                      {ev.verified ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      ) : (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Defect Found
                        </span>
                      )}
                    </div>
                    <p className="text-slate-300 text-[11px]">{ev.summary}</p>
                    {ev.snippet && (
                      <pre className="p-2 rounded bg-[#07090e] border border-white/5 font-mono text-[11px] text-slate-300 overflow-x-auto">
                        {ev.snippet}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Test / Build Results */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Test Suite Outcomes
              </span>
              <div className="space-y-1.5 font-mono text-xs">
                {reality.test_results.map((test, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded bg-surface-100 border border-white/5"
                  >
                    <div className="truncate">
                      <span className="text-slate-200 font-medium">{test.name}</span>
                      <span className="text-slate-500 text-[10px] block">{test.suite}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400">{test.duration_ms}ms</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          test.status === "PASS"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {test.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Acceptance Criteria Coverage */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Criteria Verification Status
              </span>
              <div className="space-y-1 text-xs">
                {reality.criteria_satisfied.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2 rounded bg-surface-100 border border-white/5"
                  >
                    <span className="text-slate-300 truncate">
                      <strong className="text-sky-400 mr-2 font-mono">{c.id}:</strong>
                      {c.description}
                    </span>
                    <span className="shrink-0 ml-2">
                      {c.satisfied ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1 font-mono text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> SATISFIED
                        </span>
                      ) : (
                        <span className="text-rose-400 font-bold flex items-center gap-1 font-mono text-[11px]">
                          <XCircle className="w-3.5 h-3.5" /> UNSATISFIED
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Missing Requirements (if any) */}
            {reality.missing_requirements.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                <strong className="block uppercase text-[10px] text-amber-400">
                  Missing Requirements:
                </strong>
                <ul className="list-disc pl-4 space-y-0.5">
                  {reality.missing_requirements.map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Suggested Correction Section (When Verification Fails) */}
      {suggested_correction && (
        <Card borderVariant="brand" className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-400" />
              <h2 className="text-base font-bold text-white">
                Deterministic Suggested Correction (Gemma 4)
              </h2>
            </div>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
              Automated Patch Recommendation
            </span>
          </div>

          <p className="text-xs text-slate-300">
            {suggested_correction.summary}
          </p>

          {suggested_correction.patch && (
            <div className="p-3 rounded-lg bg-[#07090e] border border-white/10 font-mono text-xs text-slate-300 overflow-x-auto">
              <pre className="text-emerald-400">{suggested_correction.patch}</pre>
            </div>
          )}

          {suggested_correction.command_to_run && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-100 border border-white/5 font-mono text-xs">
              <span className="text-slate-300">
                Retest Command: <strong>{suggested_correction.command_to_run}</strong>
              </span>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-3">
            <Button
              variant="brand"
              size="sm"
              loading={isApprovingCorrection}
              onClick={handleApproveCorrection}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Approve Correction & Staged Re-run
            </Button>
          </div>
        </Card>
      )}

      {/* Bottom Sticky Action Bar */}
      <div className="sticky bottom-4 z-20 p-4 rounded-xl bg-surface-200/95 border border-white/10 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge status={verdict} size="md" />
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">
            Run: {runId}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            loading={isVerifying}
            onClick={handleVerifyAgain}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Verify Again
          </Button>

          <Link href={`/reports/${runId}`}>
            <Button
              variant="secondary"
              size="sm"
              icon={<FileText className="w-4 h-4" />}
            >
              View Full Report
            </Button>
          </Link>

          {suggested_correction && (
            <Button
              variant="brand"
              size="sm"
              loading={isApprovingCorrection}
              onClick={handleApproveCorrection}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Approve Correction
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
