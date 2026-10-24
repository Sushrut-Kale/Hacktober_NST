"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { FailureDiagnosis } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ModelChip } from "@/components/ui/ModelChip";
import {
  AlertTriangle,
  ArrowLeft,
  Languages,
  Sparkles,
  FileCode,
  CheckCircle2,
  Terminal,
  Info,
  Scale,
} from "lucide-react";

export default function FailureExplanationPage() {
  const params = useParams();
  const router = useRouter();
  const runId = (params?.runId as string) || "run-auth-failed";

  const { showToast } = useProject();
  const [diagnosis, setDiagnosis] = useState<FailureDiagnosis | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"en" | "mr">("en");
  const [isApplyingFix, setIsApplyingFix] = useState(false);

  useEffect(() => {
    async function loadDiagnosis() {
      setLoading(true);
      try {
        const res = await api.getDiagnosis(runId);
        setDiagnosis(res.data);
      } catch (e) {
        console.error("Failed to load failure diagnosis", e);
      } finally {
        setLoading(false);
      }
    }
    loadDiagnosis();
  }, [runId]);

  const handleApplyFix = async () => {
    setIsApplyingFix(true);
    try {
      showToast("Fix applied to working directory! Ready for re-run.", "success");
      setTimeout(() => {
        router.push(`/tasks/${diagnosis?.task_id || "task-rate-limiter"}`);
      }, 1000);
    } finally {
      setIsApplyingFix(false);
    }
  };

  if (loading || !diagnosis) {
    return (
      <div className="p-12 text-center text-[#718198] font-mono text-sm">
        Loading failure explanation and AI diagnosis...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/verification/${runId}`}
            className="p-2 text-[#A4B2C5] hover:text-[#F1F4F8] rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-bold text-[#58AAE1]">
                {runId}
              </span>
              <Badge status="FAILED" size="sm" />
              <ModelChip
                status={diagnosis.generator_status}
                modelName="gemma4:e4b"
              />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#F1F4F8] mt-1 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
              <span>Failure Diagnosis & Explanation</span>
            </h1>
          </div>
        </div>

        {/* Language Selection Toggle */}
        <div className="flex items-center gap-2 bg-[#0B1423] p-1 rounded-xl border border-white/10">
          <Languages className="w-4 h-4 text-[#718198] ml-2" />
          <button
            onClick={() => setLanguage("en")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              language === "en"
                ? "bg-[#58AAE1]/20 text-[#9EDCFF] border border-[#58AAE1]/30"
                : "text-[#718198] hover:text-[#F1F4F8]"
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLanguage("mr")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              language === "mr"
                ? "bg-[#58AAE1]/20 text-[#9EDCFF] border border-[#58AAE1]/30"
                : "text-[#718198] hover:text-[#F1F4F8]"
            }`}
          >
            मराठी / Hinglish
          </button>
        </div>
      </div>

      {/* Language Invariant Alert */}
      <div className="p-3.5 rounded-xl border border-[#58AAE1]/20 bg-[#0B1423] backdrop-blur-sm flex items-start gap-2.5 text-xs text-[#A4B2C5]">
        <Info className="w-4 h-4 text-[#58AAE1] shrink-0 mt-0.5" />
        <span>
          <strong className="text-[#9EDCFF]">Invariant:</strong> Switching between English and Marathi-Hinglish explains the failure in your preferred language without modifying the underlying deterministic failure verdict or evidence.
        </span>
      </div>

      {/* Failure Narrative Card */}
      <Card borderVariant="rose" className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-rose-400 font-mono">
            {language === "en" ? "Failure Summary" : "त्रुटी तपशील (Failure Summary)"}
          </h2>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Exit Status: 1
          </span>
        </div>

        <p className="text-base text-[#F1F4F8] font-semibold leading-snug">
          {diagnosis.failure_summary}
        </p>

        {language === "mr" && diagnosis.explanation_mr ? (
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 leading-relaxed font-sans">
            <div className="flex items-center gap-2 font-bold mb-1 text-purple-300">
              <Sparkles className="w-4 h-4" />
              <span>Gemma 4 Marathi Diagnosis:</span>
            </div>
            {diagnosis.explanation_mr}
          </div>
        ) : null}

        {/* Likely Root Cause */}
        <div className="pt-3 border-t border-white/5 space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-[#718198] font-mono block">
            {language === "en" ? "Identified Root Cause" : "मुख्य कारण (Root Cause)"}
          </span>
          <p className="text-xs text-[#A4B2C5] leading-relaxed bg-[#05080F] p-3.5 rounded-lg border border-white/5">
            {diagnosis.likely_cause}
          </p>
        </div>
      </Card>

      {/* Supporting Evidence References */}
      <Card className="p-6 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#718198] font-mono">
          Supporting Failure Evidence
        </h2>
        <div className="space-y-2 font-mono text-xs">
          {diagnosis.evidence_references.map((ref, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg bg-[#05080F] border border-white/5 text-[#A4B2C5] flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{ref}</span>
              </div>
              <span className="text-[10px] text-rose-400 font-bold uppercase shrink-0">
                EVIDENCE RECORD
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Recommended Fix & Retest Command */}
      <Card borderVariant="brand" className="p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-[#F1F4F8]">
          <Sparkles className="w-4 h-4 text-[#58AAE1]" />
          <span>Recommended Code Fix (Deterministic Correction)</span>
        </div>

        <p className="text-xs text-[#A4B2C5] leading-relaxed">
          {diagnosis.recommended_fix}
        </p>

        {diagnosis.suggested_retest_command && (
          <div className="p-3 rounded-lg bg-[#05080F] border border-white/10 font-mono text-xs flex items-center justify-between text-[#A4B2C5]">
            <div className="flex items-center gap-2 truncate">
              <Terminal className="w-4 h-4 text-[#58AAE1] shrink-0" />
              <span className="truncate">{diagnosis.suggested_retest_command}</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold uppercase shrink-0 ml-2">
              SAFE RUNNER
            </span>
          </div>
        )}

        <div className="pt-2 flex justify-end gap-3">
          <Link href={`/verification/${runId}/claim-vs-reality`}>
            <Button variant="outline" size="sm" icon={<Scale className="w-4 h-4" />}>
              Compare with Claim
            </Button>
          </Link>
          <Button
            variant="brand"
            size="sm"
            loading={isApplyingFix}
            onClick={handleApplyFix}
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            Stage Fix & Re-verify
          </Button>
        </div>
      </Card>
    </div>
  );
}
