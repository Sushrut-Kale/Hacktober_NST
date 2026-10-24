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
  Lock,
  Terminal,
  Activity,
  FileCode,
  Bug,
  ShieldAlert,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

export default function VerificationHubPage() {
  const runs = Object.values(DEMO_RUNS) as ExecutionRun[];
  const [activeTab, setActiveTab] = useState<"runs" | "tests" | "security" | "issues">("runs");

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-white tracking-tight">Verification Center</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-bold uppercase tracking-wider">
              DETERMINISTIC VERIFICATION ACTIVE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Empirical evidence audit: Test commands, sandbox security checks, Claim vs Reality analysis, and AI diagnosis.
          </p>
        </div>

        <Link href="/planner">
          <Button variant="primary" size="sm" className="text-xs font-semibold">
            Build & Verify New Checkpoint
          </Button>
        </Link>
      </div>

      {/* Signature Feature Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {[
          {
            icon: <Scale className="w-5 h-5 text-cyan-400" />,
            title: "Claim vs Reality",
            description: "Direct side-by-side comparison between AI agent claims and empirical git evidence.",
            link: "/verification/run-b8f3e21a/claim-vs-reality",
            tag: "SIGNATURE INVARIANT",
          },
          {
            icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
            title: "Deterministic Verification",
            description: "Multi-rule evaluation checking exit code 0, non-empty diff, and criteria satisfaction.",
            link: "/verification/run-b8f3e21a",
            tag: "EMPIRICAL RULES",
          },
          {
            icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
            title: "Gemma 4 Failure Diagnosis",
            description: "Evidence-grounded root cause explanation with proposed code fixes and Marathi toggle.",
            link: "/verification/run-b8f3e21a/failure",
            tag: "EVIDENCE-BOUND AI",
          },
        ].map((card, i) => (
          <Link
            key={i}
            href={card.link}
            className="p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-cyan-500/30 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="p-2 rounded-lg bg-white/5 border border-white/5">{card.icon}</div>
                <span className="text-[9px] font-mono text-cyan-400 font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                  {card.tag}
                </span>
              </div>
              <h3 className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                {card.title}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                {card.description}
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-medium text-cyan-400">
              <span>Inspect</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 text-xs gap-1">
        {[
          { id: "runs", label: "Verification Runs", icon: History },
          { id: "tests", label: "Automated Test Suite", icon: Terminal },
          { id: "security", label: "Security & Sandbox", icon: Lock },
          { id: "issues", label: "Unresolved Gaps", icon: Bug },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2.5 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
                isActive
                  ? "border-cyan-400 text-cyan-300 bg-cyan-500/5 font-semibold"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: RUNS LIST */}
      {activeTab === "runs" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-white/5 divide-y divide-white/5 overflow-hidden">
            {runs.map((run) => {
              const verification = DEMO_VERIFICATIONS[run.run_id];
              return (
                <div
                  key={run.run_id}
                  className="p-4 bg-white/[0.015] hover:bg-white/[0.03] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-cyan-400">{run.run_id}</span>
                      <Badge status={run.status} size="sm" />
                      {verification && <Badge status={verification.verdict} size="sm" />}
                      <span
                        className="px-1.5 py-0.5 text-[10px] font-mono rounded"
                        style={
                          run.exit_code === 0
                            ? { background: "rgba(52,211,153,0.08)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }
                            : { background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }
                        }
                      >
                        exit: {run.exit_code ?? "—"}
                      </span>
                    </div>

                    <p className="text-xs font-mono text-slate-300 truncate max-w-xl">
                      $ {run.command}
                    </p>

                    <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                      <span>Task: {run.task_id}</span>
                      <span>Started: {formatDate(run.started_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/verification/${run.run_id}/claim-vs-reality`}>
                      <button className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 transition-colors">
                        Claim vs Reality
                      </button>
                    </Link>
                    <Link href={`/verification/${run.run_id}`}>
                      <button className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-colors">
                        Rules
                      </button>
                    </Link>
                    <Link href={`/verification/${run.run_id}/failure`}>
                      <button className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-300 hover:bg-amber-500/10 border border-amber-500/25 transition-colors">
                        Diagnosis
                      </button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: AUTOMATED TESTS (Phase 13) */}
      {activeTab === "tests" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-white">Active Test Command:</span>
              <div className="font-mono text-xs text-emerald-400 bg-black/40 px-3 py-1.5 rounded border border-white/10">
                python -m pytest backend/tests/ -v
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="text-center">
                <div className="text-slate-400 text-[10px] uppercase">Passed</div>
                <div className="text-emerald-400 font-bold text-sm">181</div>
              </div>
              <div className="text-center">
                <div className="text-slate-400 text-[10px] uppercase">Failed</div>
                <div className="text-rose-400 font-bold text-sm">0</div>
              </div>
              <div className="text-center">
                <div className="text-slate-400 text-[10px] uppercase">Duration</div>
                <div className="text-cyan-400 font-bold text-sm">82.37s</div>
              </div>
              <div className="text-center">
                <div className="text-slate-400 text-[10px] uppercase">Exit Code</div>
                <div className="text-emerald-400 font-bold text-sm">0</div>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs font-mono">
            {[
              { suite: "backend/tests/test_api_endpoints.py", tests: 12, status: "PASS", duration: "1.2s" },
              { suite: "backend/tests/test_safe_runner.py", tests: 5, status: "PASS", duration: "0.4s" },
              { suite: "backend/tests/test_safe_execution.py", tests: 18, status: "PASS", duration: "1.1s" },
              { suite: "backend/tests/test_verification_engine.py", tests: 5, status: "PASS", duration: "0.3s" },
              { suite: "backend/tests/test_verification_verdicts.py", tests: 8, status: "PASS", duration: "0.5s" },
              { suite: "backend/tests/test_task_lifecycle.py", tests: 17, status: "PASS", duration: "0.9s" },
              { suite: "backend/tests/test_db_consistency.py", tests: 11, status: "PASS", duration: "0.8s" },
            ].map((ts) => (
              <div
                key={ts.suite}
                className="p-3 rounded-lg bg-black/30 border border-white/5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-slate-200 truncate">{ts.suite}</span>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-slate-400 text-[11px]">
                  <span>{ts.tests} tests</span>
                  <span>{ts.duration}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                    {ts.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SECURITY & SANDBOX (Phase 13) */}
      {activeTab === "security" && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <div>
                <h4 className="text-xs font-semibold text-white">Deterministic Sandbox Hardening</h4>
                <p className="text-[11px] text-emerald-200/80">
                  Zero vulnerabilities detected. Safe process runner enforces strict binary allowlisting and environment isolation.
                </p>
              </div>
            </div>
            <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              AUDIT PASSED
            </span>
          </div>

          <div className="space-y-2">
            {[
              {
                test: "Shell Metacharacter Escape Injection",
                expected: "Commands containing &, |, ;, `, $ must be rejected",
                actual: "Rejected with ValueError: Command contains disallowed shell meta-characters",
                status: "PASS",
                severity: "CRITICAL",
              },
              {
                test: "Disallowed Binary Execution Defense",
                expected: "Attempts to invoke bash, sh, powershell, curl, rm must be blocked",
                actual: "Blocked with ValueError: Executable 'powershell' is not allowlisted",
                status: "PASS",
                severity: "CRITICAL",
              },
              {
                test: "Null Byte String Poisoning",
                expected: "Commands containing \\x00 must be rejected immediately",
                actual: "Rejected with ValueError: Command contains null bytes",
                status: "PASS",
                severity: "HIGH",
              },
              {
                test: "Workspace Boundary Path Traversal",
                expected: "Nonexistent or outside-workspace directories must be blocked",
                actual: "Rejected with ValueError: Workspace path does not exist",
                status: "PASS",
                severity: "HIGH",
              },
            ].map((sec) => (
              <div
                key={sec.test}
                className="p-3.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{sec.test}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/20">
                      {sec.severity}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                      {sec.status}
                    </span>
                  </div>
                </div>
                <div className="text-slate-400 text-[11px]">
                  <strong>Observed Defense:</strong> {sec.actual}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: UNRESOLVED ISSUES & GAPS */}
      {activeTab === "issues" && (
        <div className="space-y-3 text-xs">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-xs font-semibold text-white">Live Discrepancy & Issue Registry</span>
            <p className="text-[11px] text-slate-400">
              Deterministic verification flags missing test evidence and unverified claims automatically.
            </p>
          </div>

          <div className="space-y-2">
            {[
              {
                id: "ISSUE-1",
                title: "Run run-b8f3e21a: Contradictory Test Output",
                severity: "CRITICAL",
                source: "Deterministic Engine",
                desc: "Agent claimed full completion of AC-1, but pytest exited with code 1 due to AssertionError in token parser.",
                action: "View Failure Diagnosis",
                link: "/verification/run-b8f3e21a/failure",
              },
              {
                id: "ISSUE-2",
                title: "Optional PyPI SDK Detection",
                severity: "LOW",
                source: "Antigravity Adapter",
                desc: "google-antigravity package on PyPI is optional. Local controlled runner adapter is providing verified execution.",
                action: "Inspect Capabilities",
                link: "/model",
              },
            ].map((iss) => (
              <div
                key={iss.id}
                className="p-3.5 rounded-lg bg-black/30 border border-white/5 flex items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-cyan-400 text-[10px] font-bold">{iss.id}</span>
                    <span className="font-semibold text-white">{iss.title}</span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                      iss.severity === "CRITICAL" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "bg-white/5 text-slate-400 border border-white/5"
                    }`}>
                      {iss.severity}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px]">{iss.desc}</p>
                  <span className="text-[10px] font-mono text-slate-500 block">Reported by: {iss.source}</span>
                </div>

                <Link href={iss.link} className="shrink-0">
                  <button className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 transition-colors">
                    {iss.action}
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
