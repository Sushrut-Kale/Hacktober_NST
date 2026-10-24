"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DEMO_RUNS, DEMO_VERIFICATIONS } from "@/fixtures/demo-data";
import { ExecutionRun, VerificationResult } from "@/lib/types";
import { formatDate } from "@/lib/formatters";
import {
  Scale,
  ShieldCheck,
  AlertTriangle,
  History,
  ArrowRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// A hub page for all verification-related runs
export default function VerificationHubPage() {
  const runs = Object.values(DEMO_RUNS) as ExecutionRun[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Verification Hub</h1>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Inspect verification results, claim-vs-reality analysis, and failure diagnosis for each execution run
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: <Scale className="w-5 h-5" />,
            title: "Claim vs Reality",
            description: "Compare what the AI agent reported with verifiable code evidence",
            color: "#00c3ff",
            bg: "rgba(0,195,255,0.06)",
            border: "rgba(0,195,255,0.2)",
          },
          {
            icon: <ShieldCheck className="w-5 h-5" />,
            title: "Verification Results",
            description: "Deterministic rule evaluations, evidence coverage, and pass/fail verdicts",
            color: "#34d399",
            bg: "rgba(52,211,153,0.06)",
            border: "rgba(52,211,153,0.2)",
          },
          {
            icon: <AlertTriangle className="w-5 h-5" />,
            title: "Failure Diagnosis",
            description: "AI-assisted root cause analysis with suggested fixes (Gemma 4)",
            color: "#fbbf24",
            bg: "rgba(251,191,36,0.06)",
            border: "rgba(251,191,36,0.2)",
          },
        ].map((card, i) => (
          <div
            key={i}
            className="p-5 rounded-xl"
            style={{ background: card.bg, border: `1px solid ${card.border}` }}
          >
            <div className="mb-3" style={{ color: card.color }}>{card.icon}</div>
            <h3 className="text-sm font-semibold text-white mb-1">{card.title}</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">{card.description}</p>
          </div>
        ))}
      </div>

      {/* Runs table */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Execution Runs — Select to Inspect</h2>
        <div
          className="rounded-xl divide-y overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {runs.map((run) => {
            const verification = DEMO_VERIFICATIONS[run.run_id];
            return (
              <div
                key={run.run_id}
                className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-5 py-4 group transition-colors"
                style={{ background: "rgba(255,255,255,0.015)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.015)"; }}
              >
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-sky-500">{run.run_id}</span>
                    <Badge status={run.status} size="sm" />
                    {verification && <Badge status={verification.verdict} size="sm" />}
                    <span
                      className="px-1.5 py-px text-[10px] font-mono rounded"
                      style={
                        run.exit_code === 0
                          ? { background: "rgba(52,211,153,0.08)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }
                          : { background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }
                      }
                    >
                      exit: {run.exit_code ?? "—"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono truncate">{run.command}</p>
                  <p className="text-[11px] text-slate-600">{formatDate(run.started_at)}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/verification/${run.run_id}/claim-vs-reality`}>
                    <Button variant="brand" size="sm" icon={<Scale className="w-3.5 h-3.5" />}>
                      Claim vs Reality
                    </Button>
                  </Link>
                  <Link href={`/verification/${run.run_id}`}>
                    <Button variant="outline" size="sm" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                      Results
                    </Button>
                  </Link>
                  {run.status === "FAILED" && (
                    <Link href={`/verification/${run.run_id}/failure`}>
                      <Button variant="secondary" size="sm" icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}>
                        Diagnose
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="p-4 rounded-xl"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <p className="text-xs text-slate-500 font-mono">
          <strong className="text-slate-300">VIKASA Invariant:</strong> All verification verdicts are determined by deterministic rule evaluation against code evidence. Gemma 4 assists with planning and failure diagnosis only — it does not determine whether a task passes verification.
        </p>
      </div>
    </div>
  );
}
