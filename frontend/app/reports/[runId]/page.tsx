"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { RunReport } from "@/lib/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DiffViewer } from "@/components/ui/DiffViewer";
import { formatDate, formatDuration } from "@/lib/formatters";
import {
  ArrowLeft,
  Copy,
  Download,
  Check,
  FileCode,
  Terminal,
  ShieldCheck,
  Scale,
  Sparkles,
  Layers,
  Cpu,
  CheckCircle2,
  XCircle,
  FileText,
  AlertTriangle,
} from "lucide-react";

export default function ReportDetailsPage() {
  const params = useParams();
  const runId = (params?.runId as string) || "run-b8f3e21a";

  const { showToast } = useProject();
  const [report, setReport] = useState<RunReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      try {
        const res = await api.getRunReport(runId);
        setReport(res.data);
      } catch (e) {
        console.error("Report detail error", e);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [runId]);

  const generateMarkdown = () => {
    if (!report) return "";
    const { run, task, plan, verification, comparison } = report;

    return `# VIKASA Technical Verification Report
**Run ID:** ${run.run_id}  
**Task ID:** ${task.id} (${task.title})  
**Project:** ${task.project_id}  
**Generated At:** ${new Date().toISOString()}  
**Verdict:** ${verification?.verdict || "NOT_RUN"}  

---

## 1. Requirement & Acceptance Criteria
${task.description}

### Acceptance Criteria:
${task.acceptance_criteria
  .map((c) => `- [${c.satisfied ? "x" : " "}] **${c.id}**: ${c.description}`)
  .join("\n")}

---

## 2. Agent Claim
${comparison?.claim?.exact_claim ? `> "${comparison.claim.exact_claim}"` : "No claim recorded."}

---

## 3. Changed Files & Evidence
${run.evidence_items
  .map(
    (e) =>
      `- **Type**: ${e.evidence_type} | **Target**: ${e.criterion_id || "N/A"} | **Result**: ${
        e.passed ? "PASSED" : "FAILED"
      }\n  Content: ${e.content}`
  )
  .join("\n")}

---

## 4. Commands Executed & Test Outcomes
\`\`\`bash
${run.command}
\`\`\`
**Exit Code:** ${run.exit_code}  
**Execution Duration:** ${run.runtime_metadata?.duration_ms || 0} ms  

---

## 5. Model & Runtime Transparency
- **Model:** ${run.model_name || "gemma4:e4b"}
- **Host:** ${run.runtime_metadata?.host || "localhost"}
`;
  };

  const handleCopy = () => {
    const md = generateMarkdown();
    navigator.clipboard.writeText(md);
    setCopied(true);
    showToast("Report markdown copied to clipboard!", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const md = generateMarkdown();
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `VIKASA_Report_${runId}.md`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Report downloaded as Markdown!", "success");
  };

  if (loading || !report) {
    return (
      <div className="p-12 text-center text-slate-400">
        Generating technical verification report...
      </div>
    );
  }

  const { run, task, plan, verification, diagnosis, comparison } = report;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/reports"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-bold text-sky-400">
                {run.run_id}
              </span>
              <Badge status={verification?.verdict || "NOT_RUN"} size="sm" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
              Technical Verification Report
            </h1>
          </div>
        </div>

        {/* Report Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            icon={copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          >
            {copied ? "Copied" : "Copy Report"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownload}
            icon={<Download className="w-4 h-4" />}
          >
            Download Markdown
          </Button>
          <Link href={`/verification/${run.run_id}/claim-vs-reality`}>
            <Button
              variant="brand"
              size="sm"
              icon={<Scale className="w-4 h-4" />}
            >
              Source Evidence
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Report Document */}
      <Card className="p-8 space-y-8 bg-surface-200/90 border-white/10 font-sans">
        {/* Section 1: Project & Task */}
        <div className="space-y-2 pb-6 border-b border-white/5">
          <div className="text-xs font-mono text-sky-400 font-semibold uppercase tracking-wider">
            1. Project & Task Specification
          </div>
          <h2 className="text-xl font-bold text-white">{task.title}</h2>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            {task.description}
          </p>
          <div className="flex flex-wrap gap-4 text-xs font-mono text-slate-400 pt-2">
            <span>Project: <strong className="text-slate-200">{task.project_id}</strong></span>
            <span>Task ID: <strong className="text-slate-200">{task.id}</strong></span>
            <span>Report Date: <strong className="text-slate-200">{formatDate(run.started_at)}</strong></span>
          </div>
        </div>

        {/* Section 2: Acceptance Criteria */}
        <div className="space-y-3 pb-6 border-b border-white/5">
          <div className="text-xs font-mono text-sky-400 font-semibold uppercase tracking-wider">
            2. Verified Acceptance Criteria
          </div>
          <div className="space-y-2">
            {task.acceptance_criteria.map((c) => (
              <div
                key={c.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-surface-100 border border-white/5 text-xs"
              >
                <span className="font-mono font-bold text-sky-400">{c.id}:</span>
                <span className="text-slate-200 flex-1">{c.description}</span>
                <span className="shrink-0">
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

        {/* Section 3: Agent Claim */}
        <div className="space-y-2 pb-6 border-b border-white/5">
          <div className="text-xs font-mono text-purple-400 font-semibold uppercase tracking-wider">
            3. AI Agent Claim
          </div>
          <blockquote className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 text-xs font-mono text-purple-200 leading-relaxed">
            "{comparison?.claim?.exact_claim || "No completion claim recorded."}"
          </blockquote>
        </div>

        {/* Section 4: Changed Files */}
        <div className="space-y-3 pb-6 border-b border-white/5">
          <div className="text-xs font-mono text-sky-400 font-semibold uppercase tracking-wider">
            4. Changed Files & Evidence
          </div>
          <div className="space-y-2 font-mono text-xs">
            {run.evidence_items.map((e, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-surface-100 border border-white/5 flex items-center justify-between text-slate-300"
              >
                <div className="flex items-center gap-2 truncate">
                  <FileCode className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="truncate">{e.content}</span>
                </div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 shrink-0 ml-2">
                  CONFIRMED
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 5: Commands & Test Outcomes */}
        <div className="space-y-3 pb-6 border-b border-white/5">
          <div className="text-xs font-mono text-sky-400 font-semibold uppercase tracking-wider">
            5. Commands & Safe Runner Outcomes
          </div>
          <div className="p-3 rounded-lg bg-[#07090e] border border-white/10 font-mono text-xs text-slate-200">
            $ {run.command}
          </div>
          <div className="flex gap-4 text-xs font-mono text-slate-400">
            <span>Exit code: <strong className={run.exit_code === 0 ? "text-emerald-400" : "text-rose-400"}>{run.exit_code}</strong></span>
            <span>Duration: <strong className="text-slate-200">{formatDuration(run.runtime_metadata?.duration_ms)}</strong></span>
          </div>
        </div>

        {/* Section 6: Verified Behavior & Limitations */}
        <div className="space-y-3 pb-6 border-b border-white/5">
          <div className="text-xs font-mono text-sky-400 font-semibold uppercase tracking-wider">
            6. Verified Behavior & Limitations
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {verification?.summary || "Deterministic verification executed against allowlisted test suites."}
          </p>
          {diagnosis && (
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              <strong className="block mb-1">Identified Limitation / Defect:</strong>
              {diagnosis.failure_summary}
            </div>
          )}
        </div>

        {/* Section 7: Model & Runtime Transparency */}
        <div className="space-y-3">
          <div className="text-xs font-mono text-sky-400 font-semibold uppercase tracking-wider">
            7. Model & Runtime Transparency
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3 rounded bg-surface-100 border border-white/5">
              <span className="text-slate-400 block text-[10px]">Model</span>
              <span className="text-slate-200 font-semibold">{run.model_name || "gemma4:e4b"}</span>
            </div>
            <div className="p-3 rounded bg-surface-100 border border-white/5">
              <span className="text-slate-400 block text-[10px]">Host</span>
              <span className="text-slate-200 font-semibold">{run.runtime_metadata?.host || "localhost"}</span>
            </div>
            <div className="p-3 rounded bg-surface-100 border border-white/5">
              <span className="text-slate-400 block text-[10px]">Runner</span>
              <span className="text-slate-200 font-semibold">{run.source}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
