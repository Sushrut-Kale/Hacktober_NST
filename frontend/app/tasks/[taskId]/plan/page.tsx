"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { Task, TaskPlan } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ModelChip } from "@/components/ui/ModelChip";
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileCode,
  Terminal,
  Layers,
  Edit3,
  Save,
  X,
  Info,
} from "lucide-react";

export default function TaskPlanPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = (params?.taskId as string) || "task-user-auth";

  const { showToast } = useProject();
  const [task, setTask] = useState<Task | null>(null);
  const [plan, setPlan] = useState<TaskPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const taskRes = await api.getTask(taskId);
        setTask(taskRes.data);
        const planRes = await api.getPlan(taskId);
        setPlan(planRes.data);
        setEditedSummary(planRes.data?.summary || planRes.data?.task_summary || "");
      } catch (err) {
        console.error("Plan load error", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [taskId]);

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    try {
      const res = await api.generatePlan(taskId);
      setPlan(res.data);
      setEditedSummary(res.data.summary || res.data.task_summary);
      if (task) {
        setTask({ ...task, state: "PLANNED" });
      }
      showToast("Plan generated successfully by Gemma 4!", "success");
    } catch (err: any) {
      showToast(err?.message || "Plan generation failed", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const res = await api.approvePlan(taskId, "LEAD_REVIEWER", "Plan verified; proceed with test execution");
      setTask(res.data);
      showToast("Plan approved! Task is now unlocked for execution.", "success");
      router.push(`/tasks/${taskId}`);
    } catch (err: any) {
      showToast(err?.message || "Approval failed", "error");
    } finally {
      setIsApproving(false);
    }
  };

  const isApproved = task?.state === "APPROVED" || task?.state === "RUNNING" || task?.state === "VERIFIED";

  if (loading || !task) {
    return (
      <div className="p-12 text-center text-[#718198] font-mono text-sm">
        Loading plan review...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/tasks/${taskId}`}
            className="p-2 text-[#A4B2C5] hover:text-[#F1F4F8] rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-bold text-[#58AAE1]">
                {task.id}
              </span>
              <Badge status={task.state} size="sm" />
              {plan && (
                <ModelChip
                  status={plan.generator_status}
                  modelName={plan.model_name}
                />
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#F1F4F8] mt-1">
              Task Plan & Approval Gate
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGeneratePlan}
            loading={isGenerating}
            icon={<Sparkles className="w-4 h-4 text-[#58AAE1]" />}
          >
            Re-Generate Plan
          </Button>

          {!isApproved && (
            <Button
              variant="brand"
              size="sm"
              onClick={handleApprove}
              loading={isApproving}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Approve & Unlock Execution
            </Button>
          )}
        </div>
      </div>

      {/* AI Suggestion Invariant Banner */}
      <div className="p-4 rounded-xl border border-[#58AAE1]/25 bg-[#58AAE1]/10 flex items-start gap-3 text-xs text-[#A4B2C5]">
        <Info className="w-4 h-4 text-[#58AAE1] shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#9EDCFF]">Approval Gate Invariant:</strong> Proposed steps, affected files, and risks below are generated by Gemma 4 as AI recommendations. Execution is strictly blocked in the backend with HTTP 409 Conflict until a human reviewer explicitly approves this plan.
        </div>
      </div>

      {/* Plan Summary Card */}
      <Card className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#F1F4F8] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#58AAE1]" />
            <span>Executive Plan Summary</span>
          </h2>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1.5 text-xs text-[#A4B2C5] hover:text-[#F1F4F8] transition-colors cursor-pointer"
          >
            {isEditing ? <X className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            <span>{isEditing ? "Cancel Edit" : "Edit Summary"}</span>
          </button>
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <textarea
              rows={3}
              value={editedSummary}
              onChange={(e) => setEditedSummary(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#0B1423] border border-white/10 text-xs text-[#F1F4F8] focus:outline-none focus:border-[#58AAE1]/50"
            />
            <Button
              variant="brand"
              size="sm"
              icon={<Save className="w-3.5 h-3.5" />}
              onClick={() => {
                setIsEditing(false);
                showToast("Plan summary updated", "success");
              }}
            >
              Save Changes
            </Button>
          </div>
        ) : (
          <p className="text-sm text-[#A4B2C5] leading-relaxed bg-[#0B1423] p-4 rounded-xl border border-white/5">
            {editedSummary || plan?.task_summary || "No plan generated yet. Click Generate Plan to start."}
          </p>
        )}
      </Card>

      {/* Proposed Execution Steps */}
      <Card className="p-6 space-y-4">
        <h2 className="text-base font-bold text-[#F1F4F8] flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>Proposed Action Steps ({plan?.steps?.length || 0})</span>
        </h2>

        <div className="space-y-3">
          {plan?.steps?.map((step) => (
            <div
              key={step.step_number}
              className="flex items-start gap-4 p-4 rounded-xl bg-[#0B1423] border border-white/5"
            >
              <div className="w-7 h-7 rounded-full bg-[#58AAE1]/10 border border-[#58AAE1]/30 text-[#58AAE1] font-mono font-bold text-xs flex items-center justify-center shrink-0">
                {step.step_number}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[#F1F4F8]">
                    {step.action}
                  </h3>
                  {step.associated_criterion_id && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-[#718198] border border-white/5">
                      Target: {step.associated_criterion_id}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#A4B2C5] font-mono">
                  Expected outcome: <span className="text-[#F1F4F8]">{step.expected_outcome}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Affected Files & Allowlisted Tests */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Likely Affected Files */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#F1F4F8]">
            <FileCode className="w-4 h-4 text-[#9EDCFF]" />
            <span>Files to Inspect / Modify</span>
          </div>
          <div className="space-y-1.5 font-mono text-xs">
            {plan?.files_to_inspect?.map((f, i) => (
              <div
                key={i}
                className="px-3 py-2 rounded-lg bg-[#0B1423] border border-white/5 text-[#A4B2C5]"
              >
                {f}
              </div>
            ))}
          </div>
        </Card>

        {/* Verification Tests */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#F1F4F8]">
            <Terminal className="w-4 h-4 text-[#58AAE1]" />
            <span>Verification Test Commands</span>
          </div>
          <div className="space-y-1.5 font-mono text-xs">
            {plan?.tests_to_run?.map((t, i) => (
              <div
                key={i}
                className="px-3 py-2 rounded-lg bg-[#0B1423] border border-white/5 text-[#A4B2C5] flex items-center justify-between"
              >
                <span className="truncate">{t}</span>
                <span className="text-[10px] text-emerald-400 font-bold uppercase shrink-0 ml-2">
                  Allowed
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Risks & Strategy */}
      <Card className="p-6 space-y-4">
        <h2 className="text-base font-bold text-[#F1F4F8] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>Identified Risks & Deterministic Verification Strategy</span>
        </h2>

        <div className="space-y-2">
          {plan?.risks?.map((r, i) => (
            <div
              key={i}
              className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
              <span>{r}</span>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-white/5">
          <div className="text-xs font-semibold text-[#F1F4F8] mb-1 font-mono">
            Deterministic Verification Strategy:
          </div>
          <p className="text-xs text-[#A4B2C5] font-mono bg-[#0B1423] p-3 rounded-lg border border-white/5">
            {plan?.verification_strategy ||
              "Execute allowlisted pytest suite under safe runner and assert exit code 0 with git diff present."}
          </p>
        </div>
      </Card>

      {/* Bottom Approval Action Bar */}
      <div className="sticky bottom-4 z-20 p-4 rounded-xl bg-[#081426]/95 border border-white/10 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#718198]">Current Task State:</span>
          <Badge status={task.state} size="sm" />
          {task.approved_at && (
            <span className="text-[#718198] font-mono hidden sm:inline">
              (Approved at {new Date(task.approved_at).toLocaleTimeString()})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <Link href={`/tasks/${taskId}`}>
            <Button variant="outline" size="sm">
              Back to Details
            </Button>
          </Link>
          {!isApproved ? (
            <Button
              variant="brand"
              size="sm"
              loading={isApproving}
              onClick={handleApprove}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Approve Plan & Proceed
            </Button>
          ) : (
            <Link href={`/tasks/${taskId}`}>
              <Button
                variant="brand"
                size="sm"
                icon={<Play className="w-4 h-4" />}
              >
                Go to Execution
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
