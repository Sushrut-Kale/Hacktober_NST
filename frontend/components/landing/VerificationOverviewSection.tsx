"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Scale,
  Bot,
  ShieldCheck,
  CheckCircle2,
  Terminal,
  ArrowRight,
  Sparkles,
  Check,
  ExternalLink,
} from "lucide-react";

export function VerificationOverviewSection() {
  const [activeTab, setActiveTab] = useState<"claim" | "evidence">("evidence");

  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 border-t border-white/10 relative z-10">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass-panel-subtle text-[11px] font-mono tracking-widest text-emerald-400 uppercase mb-2">
            <Scale className="w-3.5 h-3.5" />
            <span>Deterministic Ground Truth</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white font-tight">
            Claim vs Reality: Verification Without Guesswork
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-2 font-tight leading-relaxed">
            AI coding models frequently claim completion prematurely. VIKASA isolates every claim and tests it against actual exit codes, deterministic test suites, and cryptographic execution evidence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/verification/run-b8f3e21a/claim-vs-reality"
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <span>Live Verification Demo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Claim vs Reality Interactive Showcase Card */}
      <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-white/15 shadow-[0_20px_70px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_12px_#10b981]" />
            <div>
              <div className="text-sm font-bold text-white font-tight flex items-center gap-2">
                <span>Task: Implement JWT Authentication Middleware</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-slate-300">
                  RUN-B8F3E21A
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Deterministic Evaluator: pytest v8.3.3 · Python 3.11 · Sandbox Container
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>VERDICT: VERIFIED (100%)</span>
            </span>
          </div>
        </div>

        {/* Side-by-side comparison grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6">
          {/* Left Column: What AI Claimed */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Bot className="w-4 h-4 text-[#58AAE1]" />
                <span>AI Agent Stated Claim</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                Unverified Model Output
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-xs text-slate-300 font-tight leading-relaxed italic">
              &ldquo;I have completed the JWT middleware in backend/app/auth.py and created comprehensive tests. All test cases passed and token validation works as expected.&rdquo;
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-mono uppercase text-slate-400">
                Claimed Capabilities:
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#58AAE1]" />
                  <span>Valid token returns HTTP 200 with user payload</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#58AAE1]" />
                  <span>Expired tokens correctly rejected with HTTP 401</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#58AAE1]" />
                  <span>Tampered signatures return 401 Invalid Signature</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column: Ground Truth Reality & Actual Evidence */}
          <div className="rounded-2xl bg-white/[0.02] border border-emerald-500/30 p-5 space-y-4 shadow-[0_0_30px_rgba(16,185,129,0.08)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Deterministic Evidence (Reality)</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Exit Code 0
              </span>
            </div>

            {/* Test Run Output */}
            <div className="p-3.5 rounded-xl bg-[#07090e] border border-white/10 font-mono text-xs text-slate-200 space-y-1.5 overflow-x-auto">
              <div className="text-slate-400">
                $ pytest tests/test_auth.py -v --tb=short
              </div>
              <div className="text-emerald-400">
                ✓ test_valid_token_decode [PASSED] 4ms
              </div>
              <div className="text-emerald-400">
                ✓ test_expired_token_raises_401 [PASSED] 2ms
              </div>
              <div className="text-emerald-400">
                ✓ test_tampered_signature_rejected [PASSED] 3ms
              </div>
              <div className="text-emerald-400">
                ✓ test_missing_auth_header [PASSED] 1ms
              </div>
              <div className="pt-2 text-slate-300 font-bold border-t border-white/10">
                4 passed in 0.08s · 100% Assertion Match
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
              <span>Evidence Hash:</span>
              <span className="text-[#9EDCFF]">sha256:8f4c2...91b0</span>
            </div>
          </div>
        </div>

        {/* Footer Link */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <span className="text-slate-400 font-tight">
            Deterministic verification guarantees non-negotiable assertions without human fatigue.
          </span>
          <Link
            href="/verification/run-b8f3e21a"
            className="text-[#9EDCFF] hover:text-white font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span>Explore Full Evidence Dossier</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
