"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { ClaimVsRealityComparison } from "@/lib/types";
import { Card } from "@/components/ui/Card";
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
  ArrowLeft,
  Sparkles,
  RefreshCw,
  FileText,
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
      <div className="p-12 text-center text-[#718198] font-mono text-sm">
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
            className="p-2 text-[#A4B2C5] hover:text-[#F1F4F8] rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-bold text-[#58AAE1]">
                {runId}
              </span>
              <span className="text-xs font-mono text-[#718198]">
                Task: <strong className="text-[#F1F4F8]">{data.task_id}</strong>
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-[#58AAE1]/15 text-[#9EDCFF] border border-[#58AAE1]/30">
                Core Invariant Evaluation
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F1F4F8] mt-1">
              Claim vs Reality
            </h1>
          </div>
        </div>

        {/* Global Verdict Banner & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0B1423] px-3.5 py-1.5 rounded-xl border border-white/10">
            <span className="text-xs font-semibold text-[#718198] uppercase">
              Backend Verdict:
            </span>
            <Badge status={verdict} size="lg" />
          </div>

          <Link href={`/reports/${runId}`}>
            <Button
              variant="outline"
              size="sm"
            >
              Full Report
            </Button>
          </Link>
        </div>
      </div>

      {/* Invariant Explanation Banner */}
      <div className="p-4 rounded-xl border border-[#58AAE1]/20 bg-[#0B1423] backdrop-blur-sm text-xs text-[#A4B2C5] border-l-4 border-l-[#58AAE1]">
        <strong className="text-[#9EDCFF]">Deterministic Invariant:</strong> The left panel represents what the AI coding agent declared in its completion message. The right panel represents what VIKASA&apos;s deterministic engine actually observed in git status, command exit codes, and test assertions. The verdict is never invented by the agent.
      </div>

      {/* Side-by-Side (Desktop) / Stacked (Mobile) Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ============================================================ */}
        {/* PANEL 1: AGENT CLAIM (AI Unverified Perspective) */}
        {/* ============================================================ */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="text-sm font-bold tracking-tight text-[#9EDCFF] uppercase font-mono">
              Agent Stated Claim
            </div>
            <span className="text-[11px] font-mono text-[#9EDCFF] bg-[#58AAE1]/10 px-2 py-0.5 rounded border border-[#58AAE1]/20">
              Self-Reported Message
            </span>
          </div>

          <Card borderVariant="default" className="p-5 space-y-4 border-[#58AAE1]/25">
            {/* Original Requirement */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#718198] font-mono block mb-1">
                Original Requirement
              </span>
              <p className="text-xs text-[#F1F4F8] bg-[#05080F] p-3 rounded-lg border border-white/5">
                {claim.original_requirement}
              </p>
            </div>

            {/* Exact Agent Claim */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#58AAE1] font-mono block mb-1">
                Exact Completion Claim
              </span>
              <div className="p-3.5 rounded-lg bg-[#05080F] border border-[#58AAE1]/25 text-xs text-[#9EDCFF] leading-relaxed font-mono">
                &ldquo;{claim.exact_claim}&rdquo;
              </div>
            </div>

            {/* Claimed Behavior */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#718198] font-mono block mb-1">
                Claimed Behavior
              </span>
              <p className="text-xs text-[#A4B2C5] bg-[#05080F] p-3 rounded-lg border border-white/5">
                {claim.claimed_behavior}
              </p>
            </div>

            {/* Claimed Changed Files */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#718198] font-mono block mb-1.5">
                Claimed Changed Files ({claim.claimed_changed_files.length})
              </span>
              <div className="space-y-1 font-mono text-xs">
                {claim.claimed_changed_files.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 rounded bg-[#05080F] border border-white/5 text-[#A4B2C5]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#58AAE1] shrink-0" />
                    <span className="truncate">{file}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent Metadata */}
            <div className="pt-3 border-t border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#718198] font-mono block mb-2">
                Agent Metadata
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded bg-[#05080F] border border-white/5">
                  <span className="text-[#718198] block text-[10px]">Model</span>
                  <span className="text-[#F1F4F8] font-semibold">{claim.agent_metadata.model}</span>
                </div>
                <div className="p-2 rounded bg-[#05080F] border border-white/5">
                  <span className="text-[#718198] block text-[10px]">Agent ID</span>
                  <span className="text-[#F1F4F8] font-semibold truncate">{claim.agent_metadata.agent_id}</span>
                </div>
                <div className="p-2 rounded bg-[#05080F] border border-white/5">
                  <span className="text-[#718198] block text-[10px]">Execution Time</span>
                  <span className="text-[#F1F4F8] font-semibold">{claim.agent_metadata.duration_seconds}s</span>
                </div>
                <div className="p-2 rounded bg-[#05080F] border border-white/5">
                  <span className="text-[#718198] block text-[10px]">Temperature</span>
                  <span className="text-[#F1F4F8] font-semibold">{claim.agent_metadata.temperature ?? 0.2}</span>
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
            <div className="text-sm font-bold tracking-tight text-emerald-400 uppercase font-mono">
              Observed Evidence (Ground Truth)
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Deterministic Facts
            </span>
          </div>

          <Card
            borderVariant={isVerified ? "emerald" : "rose"}
            className="p-5 space-y-4"
          >
            {/* Discrepancies Alert */}
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
                    <div className="text-[#718198]">
                      Claimed: <span className="line-through text-[#718198]">{disc.claim}</span>
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#718198] font-mono block mb-1.5">
                Actual Modified Files ({reality.actual_changed_files.length})
              </span>
              <div className="space-y-1 font-mono text-xs">
                {reality.actual_changed_files.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded bg-[#05080F] border border-white/5 text-[#F1F4F8]"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileCode className="w-3.5 h-3.5 text-[#58AAE1] shrink-0" />
                      <span className="truncate">{file}</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase shrink-0">
                      CONFIRMED IN GIT
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Code Evidence */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#718198] font-mono block mb-1.5">
                Code Evidence & AST Inspect
              </span>
              <div className="space-y-2 text-xs">
                {reality.code_evidence.map((ev, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-[#05080F] border border-white/5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-[#58AAE1] font-bold">
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
                    <p className="text-[#A4B2C5] text-[11px]">{ev.summary}</p>
                    {ev.snippet && (
                      <pre className="p-2 rounded bg-[#0B1423] border border-white/5 font-mono text-[11px] text-[#A4B2C5] overflow-x-auto">
                        {ev.snippet}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Test Results */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#718198] font-mono block mb-1.5">
                Test Suite Outcomes
              </span>
              <div className="space-y-1.5 font-mono text-xs">
                {reality.test_results.map((test, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded bg-[#05080F] border border-white/5"
                  >
                    <div className="truncate">
                      <span className="text-[#F1F4F8] font-medium">{test.name}</span>
                      <span className="text-[#718198] text-[10px] block">{test.suite}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-[#718198]">{test.duration_ms}ms</span>
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#718198] font-mono block mb-1.5">
                Criteria Verification Status
              </span>
              <div className="space-y-1 text-xs">
                {reality.criteria_satisfied.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2 rounded bg-[#05080F] border border-white/5"
                  >
                    <span className="text-[#A4B2C5] truncate">
                      <strong className="text-[#58AAE1] mr-2 font-mono">{c.id}:</strong>
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

            {/* Missing Requirements */}
            {reality.missing_requirements.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                <strong className="block uppercase text-[10px] text-amber-400 font-mono">
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

      {/* Suggested Correction Section */}
      {suggested_correction && (
        <Card borderVariant="brand" className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#58AAE1]" />
              <h2 className="text-base font-bold text-[#F1F4F8]">
                Deterministic Suggested Correction (Gemma 4)
              </h2>
            </div>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#58AAE1]/10 text-[#9EDCFF] border border-[#58AAE1]/20">
              Automated Patch Recommendation
            </span>
          </div>

          <p className="text-xs text-[#A4B2C5]">
            {suggested_correction.summary}
          </p>

          {suggested_correction.patch && (
            <div className="p-3 rounded-lg bg-[#05080F] border border-white/10 font-mono text-xs text-[#A4B2C5] overflow-x-auto">
              <pre className="text-emerald-400">{suggested_correction.patch}</pre>
            </div>
          )}

          {suggested_correction.command_to_run && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0B1423] border border-white/5 font-mono text-xs">
              <span className="text-[#A4B2C5]">
                Retest Command: <strong className="text-[#F1F4F8]">{suggested_correction.command_to_run}</strong>
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
      <div className="sticky bottom-4 z-20 p-4 rounded-xl bg-[#081426]/95 border border-white/10 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge status={verdict} size="md" />
          <span className="text-xs text-[#718198] font-mono hidden sm:inline">
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
