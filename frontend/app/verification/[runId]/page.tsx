"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { VerificationResult } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/formatters";
import {
  ShieldCheck,
  Scale,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Terminal,
} from "lucide-react";

export default function VerificationResultsPage() {
  const params = useParams();
  const runId = (params?.runId as string) || "run-b8f3e21a";

  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadResult() {
      setLoading(true);
      try {
        const res = await api.getLatestVerification(runId);
        setResult(res.data);
      } catch (e) {
        console.error("Failed to load verification", e);
      } finally {
        setLoading(false);
      }
    }
    loadResult();
  }, [runId]);

  if (loading || !result) {
    return (
      <div className="p-12 text-center text-[#718198] font-mono text-sm">
        Loading deterministic verification outcomes...
      </div>
    );
  }

  const isVerified = result.verdict === "VERIFIED";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
              <Badge status={result.verdict} size="sm" />
              <span className="text-xs font-mono text-[#718198]">
                Task: <strong className="text-[#F1F4F8]">{result.task_id}</strong>
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#F1F4F8] mt-1">
              Deterministic Verification Results
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/verification/${runId}/claim-vs-reality`}>
            <Button
              variant="brand"
              size="sm"
              icon={<Scale className="w-4 h-4" />}
            >
              Claim vs Reality
            </Button>
          </Link>
          {!isVerified && (
            <Link href={`/verification/${runId}/failure`}>
              <Button
                variant="danger"
                size="sm"
                icon={<AlertTriangle className="w-4 h-4" />}
              >
                Failure Diagnosis
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card borderVariant={isVerified ? "emerald" : "rose"} className="p-4">
          <div className="text-[10px] font-bold text-[#718198] uppercase font-mono">
            Final Verdict
          </div>
          <div className="mt-1">
            <Badge status={result.verdict} size="lg" />
          </div>
          <div className="text-[10px] text-[#718198] font-mono mt-2">
            Non-negotiable rule evaluation
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-[10px] font-bold text-[#718198] uppercase font-mono">
            Confidence Score
          </div>
          <div className="text-2xl font-extrabold font-mono text-[#F1F4F8] mt-1">
            {(result.confidence_score * 100).toFixed(0)}%
          </div>
          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full ${isVerified ? "bg-emerald-400" : "bg-rose-400"}`}
              style={{ width: `${result.confidence_score * 100}%` }}
            />
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-[10px] font-bold text-[#718198] uppercase font-mono">
            Build & Lint
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              BUILD: {result.build_status || "SUCCESS"}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              LINT: {result.lint_status || "SUCCESS"}
            </span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-[10px] font-bold text-[#718198] uppercase font-mono">
            Evidence Items
          </div>
          <div className="text-2xl font-extrabold font-mono text-[#58AAE1] mt-1">
            {result.raw_evidence_count}
          </div>
          <div className="text-[10px] text-[#718198] font-mono mt-0.5">
            Verified at {formatDate(result.verified_at).split(",")[1]}
          </div>
        </Card>
      </div>

      {/* Summary Narrative */}
      <Card className="p-5">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#718198] font-mono mb-2">
          Engine Evaluation Summary
        </h2>
        <p className="text-sm text-[#F1F4F8] leading-relaxed font-sans">
          {result.summary}
        </p>
        <div className="mt-3 text-xs font-mono text-[#718198]">
          Scope: <span className="text-[#A4B2C5]">{result.verification_scope || "Full Deterministic Rule Engine"}</span>
        </div>
      </Card>

      {/* Rule Evaluations Table */}
      <Card className="p-6 space-y-4">
        <h2 className="text-base font-bold text-[#F1F4F8]">
          Rule Evaluations ({result.rule_evaluations.length})
        </h2>

        <div className="space-y-3">
          {result.rule_evaluations.map((rule, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-[#0B1423] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[#F1F4F8]">
                    {rule.rule_name}
                  </span>
                  {rule.criterion_id && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-[#718198]">
                      Target: {rule.criterion_id}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#A4B2C5]">{rule.message}</p>
              </div>

              <div className="shrink-0 self-end sm:self-center">
                {rule.passed ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>PASSED</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <XCircle className="w-4 h-4" />
                    <span>FAILED</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Test Results Table */}
      {result.test_results && result.test_results.length > 0 && (
        <Card className="p-6 space-y-4">
          <h2 className="text-base font-bold text-[#F1F4F8]">
            Test Cases Breakdown ({result.test_results.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0B1423] text-[#718198] uppercase text-[10px] border-b border-white/5">
                <tr>
                  <th className="px-4 py-2.5">Test Name</th>
                  <th className="px-4 py-2.5">Suite File</th>
                  <th className="px-4 py-2.5">Duration</th>
                  <th className="px-4 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {result.test_results.map((t, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-semibold text-[#F1F4F8]">
                      {t.name}
                      {t.message && (
                        <span className="block text-[11px] text-rose-400 font-sans mt-0.5">
                          {t.message}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#718198]">{t.suite}</td>
                    <td className="px-4 py-3 text-[#718198]">{t.duration_ms} ms</td>
                    <td className="px-4 py-3 text-right">
                      <Badge status={t.status} isTestStatus size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
