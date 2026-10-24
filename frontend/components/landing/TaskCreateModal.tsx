"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  FileCode,
  Shield,
  Layers,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

interface CriterionInput {
  id: string;
  description: string;
  required: boolean;
}

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TaskCreateModal({ isOpen, onClose }: TaskCreateModalProps) {
  const router = useRouter();
  const { projects, currentProjectId, setCurrentProjectId, showToast } =
    useProject();

  const [title, setTitle] = useState("");
  const [selectedProj, setSelectedProj] = useState(
    currentProjectId || (projects[0]?.id ?? "default")
  );
  const [description, setDescription] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [relevantFiles, setRelevantFiles] = useState("");
  const [constraints, setConstraints] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [criteria, setCriteria] = useState<CriterionInput[]>([
    {
      id: "AC-1",
      description: "Function returns expected payload with HTTP 200",
      required: true,
    },
    {
      id: "AC-2",
      description: "Deterministic test suite passes with zero regressions",
      required: true,
    },
  ]);

  if (!isOpen) return null;

  const addCriterion = () => {
    const nextNum = criteria.length + 1;
    setCriteria([
      ...criteria,
      {
        id: `AC-${nextNum}`,
        description: "",
        required: true,
      },
    ]);
  };

  const removeCriterion = (index: number) => {
    if (criteria.length <= 1) {
      showToast("A task must have at least one acceptance criterion", "warning");
      return;
    }
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const updateCriterion = (index: number, desc: string) => {
    const updated = [...criteria];
    updated[index].description = desc;
    setCriteria(updated);
  };

  const handleSubmit = async (e: React.FormEvent, proceedToPlan = true) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast("Please enter a task title", "warning");
      return;
    }
    if (criteria.some((c) => !c.description.trim())) {
      showToast("All acceptance criteria must have a description", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const generatedId = `task-${Date.now().toString(36).slice(2, 8)}`;
      const fullDescription = [
        description,
        expectedBehavior ? `Expected Behavior:\n${expectedBehavior}` : "",
        relevantFiles ? `Relevant Files: ${relevantFiles}` : "",
        constraints ? `Constraints: ${constraints}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const res = await api.createTask({
        id: generatedId,
        title,
        description: fullDescription,
        acceptance_criteria: criteria.map((c) => ({
          id: c.id,
          description: c.description,
          required: c.required,
        })),
        workspace_path: null,
      });

      setCurrentProjectId(selectedProj);
      showToast(`Task "${res.data.id}" created successfully!`, "success");
      onClose();

      if (proceedToPlan) {
        router.push(`/tasks/${res.data.id}/plan`);
      } else {
        router.push(`/tasks/${res.data.id}`);
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to create task", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl glass-panel p-6 sm:p-8 space-y-6 text-slate-100 border border-white/15 shadow-[0_25px_80px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase bg-[#58AAE1]/20 text-[#9EDCFF] border border-[#58AAE1]/30">
                AI Development Task
              </span>
              <span className="text-xs text-slate-400">Deterministic Verification</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-tight">
              Create a New Task
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Define requirements, constraints, and testable acceptance criteria
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-4">
          {/* Target Project Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Target Project <span className="text-rose-400">*</span>
            </label>
            <select
              value={selectedProj}
              onChange={(e) => setSelectedProj(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b101b] border border-white/10 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-[#58AAE1]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.language || "Python"} · {p.branch || "main"})
                </option>
              ))}
            </select>
          </div>

          {/* Task Title */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Task Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement deterministic JWT verification middleware"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b101b] border border-white/10 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#58AAE1]"
            />
          </div>

          {/* Requirement Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Requirement Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail what needs to be implemented or fixed..."
              className="w-full px-3.5 py-2 rounded-xl bg-[#0b101b] border border-white/10 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#58AAE1] resize-none"
            />
          </div>

          {/* Expected Behavior */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Expected Behavior & Edge Cases
            </label>
            <textarea
              rows={2}
              value={expectedBehavior}
              onChange={(e) => setExpectedBehavior(e.target.value)}
              placeholder="Expected HTTP status codes, error payloads, boundary conditions..."
              className="w-full px-3.5 py-2 rounded-xl bg-[#0b101b] border border-white/10 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#58AAE1] resize-none"
            />
          </div>

          {/* Relevant Files & Additional Constraints */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Relevant Files (Optional)
              </label>
              <input
                type="text"
                value={relevantFiles}
                onChange={(e) => setRelevantFiles(e.target.value)}
                placeholder="app/auth.py, tests/test_auth.py"
                className="w-full px-3 py-2 rounded-xl bg-[#0b101b] border border-white/10 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#58AAE1]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Additional Constraints
              </label>
              <input
                type="text"
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                placeholder="e.g. Zero external pip packages, 100% test pass"
                className="w-full px-3 py-2 rounded-xl bg-[#0b101b] border border-white/10 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#58AAE1]"
              />
            </div>
          </div>

          {/* Acceptance Criteria */}
          <div className="space-y-2.5 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Acceptance Criteria (Verification Assertions)
                </label>
                <p className="text-[11px] text-slate-400">
                  Verified with concrete test evidence during execution
                </p>
              </div>
              <button
                type="button"
                onClick={addCriterion}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-[#9EDCFF] hover:text-white rounded-lg border border-[#58AAE1]/30 bg-[#58AAE1]/10 hover:bg-[#58AAE1]/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {criteria.map((crit, idx) => (
                <div
                  key={crit.id}
                  className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5"
                >
                  <span className="px-2 py-0.5 text-[11px] font-mono text-[#58AAE1] bg-white/5 rounded font-bold">
                    {crit.id}
                  </span>
                  <input
                    type="text"
                    required
                    value={crit.description}
                    onChange={(e) => updateCriterion(idx, e.target.value)}
                    placeholder="Describe deterministic verification assertion..."
                    className="flex-1 px-2.5 py-1 rounded bg-[#0b101b] border border-white/10 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#58AAE1]"
                  />
                  <button
                    type="button"
                    onClick={() => removeCriterion(idx)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push("/tasks/new");
              }}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <span>Open in Full Editor</span>
              <ExternalLink className="w-3 h-3" />
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full border border-white/10 hover:bg-white/5 text-xs font-medium text-slate-300 transition-colors flex-1 sm:flex-initial"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-full bg-gradient-to-r from-[#58AAE1] to-[#9EDCFF] text-[#04060A] text-xs font-semibold hover:shadow-[0_0_20px_rgba(88,170,225,0.4)] transition-all duration-200 flex items-center justify-center gap-1.5 flex-1 sm:flex-initial"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isSubmitting ? "Generating Plan..." : "Generate Implementation Plan"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
