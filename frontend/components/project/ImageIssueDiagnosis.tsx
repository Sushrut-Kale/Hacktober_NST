"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  AlertTriangle,
  Bug,
  Check,
  Copy,
  FileCode,
  Image as ImageIcon,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Terminal,
} from "lucide-react";

interface DiagnosisData {
  diagnosis_id: string;
  extracted_error_text: string;
  likely_cause: string;
  matching_repository_files: string[];
  hypothesized_fix: string;
  coding_agent_prompt: string;
  suggested_verification_tests: string[];
  confidence: number;
  is_hypothesis: boolean;
}

export function ImageIssueDiagnosis({ projectId }: { projectId: string }) {
  const [errorInput, setErrorInput] = useState(
    "KeyError: 'id' in backend/tests/test_db_consistency.py:137\nassert resp.json()['id'] == pid"
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedTest, setCopiedTest] = useState(false);

  const handleDiagnose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!errorInput.trim() || loading) return;

    setLoading(true);
    try {
      const res = await api.diagnoseProjectImage(projectId, {
        error_text_override: errorInput,
        context_notes: notes,
      });
      if (res.data) {
        setDiagnosis(res.data);
      }
    } catch (e) {
      console.error("Diagnosis failed", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPrompt = () => {
    if (diagnosis?.coding_agent_prompt) {
      navigator.clipboard.writeText(diagnosis.coding_agent_prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-cyan-400" />
                Paste Error Traceback, Terminal Logs, or Visual OCR Text
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                Supports pytest tracebacks, Next.js console errors, and stack traces
              </span>
            </div>
            <textarea
              rows={5}
              value={errorInput}
              onChange={(e) => setErrorInput(e.target.value)}
              placeholder="Paste terminal log, traceback, or console output here..."
              className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500">
              VIKASA will cross-reference the error against repository files and hypothesize a root cause.
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDiagnose}
              disabled={loading || !errorInput.trim()}
              className="flex items-center gap-1.5 text-xs font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {loading ? "Diagnosing..." : "Run Root Cause Diagnosis"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Diagnosis Results */}
      {diagnosis && (
        <div className="space-y-4">
          {/* Invariant Banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Invariant Notice:</strong> Visual and traceback diagnoses are <em>hypotheses</em> until verified by running deterministic test suites.
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-[10px] font-mono font-bold">
              CONFIDENCE: {Math.round(diagnosis.confidence * 100)}%
            </span>
          </div>

          {/* Diagnosis Details Card */}
          <div className="p-5 rounded-xl border border-white/5 bg-white/[0.01] space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div>
                <h4 className="text-sm font-semibold text-white">Likely Root Cause</h4>
                <p className="text-xs text-slate-400 mt-0.5">{diagnosis.likely_cause}</p>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                ID: {diagnosis.diagnosis_id}
              </span>
            </div>

            {/* Matching Files */}
            <div>
              <div className="text-xs font-medium text-slate-400 mb-2">Matching Repository Files:</div>
              <div className="flex flex-wrap gap-2">
                {diagnosis.matching_repository_files.map((file, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono flex items-center gap-1.5"
                  >
                    <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                    {file}
                  </span>
                ))}
              </div>
            </div>

            {/* Hypothesized Fix */}
            <div>
              <div className="text-xs font-medium text-slate-400 mb-1.5">Hypothesized Resolution Strategy:</div>
              <div className="p-3.5 rounded-lg bg-black/40 border border-white/5 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                {diagnosis.hypothesized_fix}
              </div>
            </div>

            {/* Antigravity Handoff Prompt */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Antigravity IDE Coding Agent Prompt
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPrompt}
                  className="h-6 text-[11px] flex items-center gap-1"
                >
                  {copiedPrompt ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedPrompt ? "Copied" : "Copy Prompt"}
                </Button>
              </div>
              <div className="p-3.5 rounded-lg bg-black/60 border border-cyan-500/30 text-xs text-cyan-200 font-mono whitespace-pre-wrap">
                {diagnosis.coding_agent_prompt}
              </div>
            </div>

            {/* Verification Commands */}
            <div>
              <div className="text-xs font-medium text-slate-400 mb-1.5">Suggested Verification Test Commands:</div>
              <div className="space-y-1.5">
                {diagnosis.suggested_verification_tests.map((cmd, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-2 rounded bg-black/40 border border-white/5 text-xs font-mono text-emerald-400 flex items-center justify-between"
                  >
                    <span>{cmd}</span>
                    <span className="text-[10px] text-slate-500 uppercase">Allowlisted Runner Command</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
