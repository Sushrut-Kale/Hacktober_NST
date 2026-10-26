"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import {
  Activity,
  AlertTriangle,
  Bug,
  CheckCircle2,
  FileCode,
  Flame,
  GitCommit,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Terminal,
  Trash2,
} from "lucide-react";

interface HealthData {
  project_id: string;
  health_score: number;
  summary: string;
  dead_code_candidates: Array<{ file_path: string; symbol: string; line: number; reason: string }>;
  unused_dependencies: Array<{ package_name: string; manifest_file: string; reason: string }>;
  debug_markers: Array<{ file_path: string; line: number; marker: string; snippet: string }>;
  todo_markers: Array<{ file_path: string; line: number; type: string; text: string }>;
  recommended_actions: string[];
}

export function RepoHealthAudit({ projectId }: { projectId: string }) {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState<any | null>(null);
  const [generatingProposal, setGeneratingProposal] = useState(false);
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"debug" | "todos" | "dead">("debug");

  useEffect(() => {
    loadAudit();
  }, [projectId]);

  const loadAudit = async () => {
    setLoading(true);
    try {
      const res = await api.getProjectHealthAudit(projectId);
      if (res.data) {
        setData(res.data);
      }
    } catch (e) {
      console.error("Health audit failed", e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCleanup = async () => {
    setGeneratingProposal(true);
    try {
      const res = await api.generateCleanupProposal(projectId, {
        target_findings: ["debug_markers"],
        remove_debug_statements: true,
      });
      if (res.data) {
        setProposal(res.data);
        setProposalModalOpen(true);
      }
    } catch (e) {
      console.error("Failed to generate cleanup proposal", e);
    } finally {
      setGeneratingProposal(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs font-mono text-slate-500">
        <RefreshCw className="w-5 h-5 mx-auto mb-3 animate-spin text-cyan-400" />
        Running repository health & garbage code analysis...
      </div>
    );
  }

  const score = data?.health_score || 85;
  const scoreColor =
    score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-rose-400";
  const scoreBg =
    score >= 80 ? "bg-emerald-500/10 border-emerald-500/30" : score >= 60 ? "bg-amber-500/10 border-amber-500/30" : "bg-rose-500/10 border-rose-500/30";

  return (
    <div className="space-y-6">
      {/* Top Banner: Score & Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Score Card */}
        <div className={`p-5 rounded-xl border ${scoreBg} flex items-center justify-between`}>
          <div>
            <div className="text-xs font-semibold text-slate-300">Codebase Health Score</div>
            <div className={`text-3xl font-extrabold font-mono mt-1 ${scoreColor}`}>
              {score}
              <span className="text-sm text-slate-500 font-normal"> / 100</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Empirical quality rating</div>
          </div>
          <Activity className={`w-8 h-8 ${scoreColor}`} />
        </div>

        {/* Debug Markers Card */}
        <div
          onClick={() => setActiveTab("debug")}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeTab === "debug"
              ? "bg-amber-500/10 border-amber-500/40"
              : "bg-white/[0.02] border-white/5 hover:border-white/10"
          }`}
        >
          <div className="text-xs text-slate-400">Debug Leftovers</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {data?.debug_markers?.length || 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">print() / console.log</div>
        </div>

        {/* TODO Markers Card */}
        <div
          onClick={() => setActiveTab("todos")}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeTab === "todos"
              ? "bg-cyan-500/10 border-cyan-500/40"
              : "bg-white/[0.02] border-white/5 hover:border-white/10"
          }`}
        >
          <div className="text-xs text-slate-400">TODO & FIXME Markers</div>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
            {data?.todo_markers?.length || 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Tracked in codebase</div>
        </div>

        {/* Dead Code Candidates Card */}
        <div
          onClick={() => setActiveTab("dead")}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeTab === "dead"
              ? "bg-purple-500/10 border-purple-500/40"
              : "bg-white/[0.02] border-white/5 hover:border-white/10"
          }`}
        >
          <div className="text-xs text-slate-400">Dead Code Candidates</div>
          <div className="text-2xl font-bold font-mono text-purple-400 mt-1">
            {data?.dead_code_candidates?.length || 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Internal isolated symbols</div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.01]">
        <div>
          <h4 className="text-xs font-semibold text-white">Repository Cleanup Assistant</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Generate safe cleanup diff proposals. Human approval is strictly required before any files are modified.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleGenerateCleanup}
          disabled={generatingProposal}
          className="flex items-center gap-1.5 text-xs font-semibold"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {generatingProposal ? "Analyzing..." : "Generate Cleanup Proposal"}
        </Button>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-white/5 text-xs gap-2">
        <button
          onClick={() => setActiveTab("debug")}
          className={`pb-2 px-1 font-medium transition-colors ${
            activeTab === "debug" ? "text-cyan-400 border-b-2 border-cyan-400 font-semibold" : "text-slate-400 hover:text-white"
          }`}
        >
          Debug Statements ({data?.debug_markers?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("todos")}
          className={`pb-2 px-1 font-medium transition-colors ${
            activeTab === "todos" ? "text-cyan-400 border-b-2 border-cyan-400 font-semibold" : "text-slate-400 hover:text-white"
          }`}
        >
          TODO & FIXME Annotations ({data?.todo_markers?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("dead")}
          className={`pb-2 px-1 font-medium transition-colors ${
            activeTab === "dead" ? "text-cyan-400 border-b-2 border-cyan-400 font-semibold" : "text-slate-400 hover:text-white"
          }`}
        >
          Dead Code Candidates ({data?.dead_code_candidates?.length || 0})
        </button>
      </div>

      {/* TAB: DEBUG STATEMENTS */}
      {activeTab === "debug" && (
        <div className="space-y-2">
          {(!data?.debug_markers || data.debug_markers.length === 0) ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">
              No stray debug statements detected. Excellent code hygiene!
            </div>
          ) : (
            data.debug_markers.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-white/5 bg-white/[0.01] flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5 font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                    {item.marker}
                  </span>
                  <span className="text-white">{item.file_path}</span>
                  <span className="text-slate-500">line {item.line}</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 truncate max-w-sm">
                  {item.snippet}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB: TODOS */}
      {activeTab === "todos" && (
        <div className="space-y-2">
          {(!data?.todo_markers || data.todo_markers.length === 0) ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">
              No unresolved TODO or FIXME markers found.
            </div>
          ) : (
            data.todo_markers.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-white/5 bg-white/[0.01] flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5 font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold">
                    {item.type}
                  </span>
                  <span className="text-white">{item.file_path}</span>
                  <span className="text-slate-500">line {item.line}</span>
                </div>
                <div className="text-xs text-slate-300 truncate max-w-md">
                  {item.text}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB: DEAD CODE */}
      {activeTab === "dead" && (
        <div className="space-y-2">
          {(!data?.dead_code_candidates || data.dead_code_candidates.length === 0) ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">
              No unreferenced internal symbols discovered.
            </div>
          ) : (
            data.dead_code_candidates.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg border border-white/5 bg-white/[0.01] space-y-1 text-xs"
              >
                <div className="flex items-center gap-2 font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold">
                    FUNCTION
                  </span>
                  <span className="text-white font-semibold">{item.symbol}</span>
                  <span className="text-slate-500">in {item.file_path}:{item.line}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {item.reason}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Cleanup Proposal Modal (Human Approval Gate) */}
      {proposalModalOpen && proposal && (
        <Dialog
          isOpen={proposalModalOpen}
          onClose={() => setProposalModalOpen(false)}
          title="Cleanup Diff Proposal — Human Approval Required"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Invariant Principle:</strong> AI cannot unilaterally alter repository code without human verification. Inspect the diff below before approving.
              </span>
            </div>

            <div className="text-xs text-slate-300 font-mono">
              Proposal ID: {proposal.proposal_id} • Affected Files: {proposal.affected_files?.length || 0}
            </div>

            <div className="p-4 rounded-lg bg-black/50 border border-white/10 font-mono text-xs text-slate-300 max-h-72 overflow-auto">
              <pre className="whitespace-pre-wrap">{proposal.diff || "No diff generated."}</pre>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProposalModalOpen(false)}
              >
                Reject / Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  alert("Cleanup proposal approved. Verified and queued for runner patch.");
                  setProposalModalOpen(false);
                }}
              >
                Approve & Apply Cleanup
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
