"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  Info,
  Shield,
  FileCode,
} from "lucide-react";

interface CriterionInput {
  id: string;
  description: string;
  required: boolean;
}

export default function NewTaskPage() {
  const router = useRouter();
  const { currentProjectId, showToast } = useProject();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskId, setTaskId] = useState(`task-${Date.now().toString(36).slice(2, 8)}`);
  const [workspacePath, setWorkspacePath] = useState("");
  const [relevantFiles, setRelevantFiles] = useState("");
  const [constraints, setConstraints] = useState("");

  const [criteria, setCriteria] = useState<CriterionInput[]>([
    {
      id: "AC-1",
      description: "Endpoint returns HTTP 200 with verified payload",
      required: true,
    },
    {
      id: "AC-2",
      description: "Invalid or malformed inputs return HTTP 400/401",
      required: true,
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const res = await api.createTask({
        id: taskId,
        title,
        description: `${description}\n\nRelevant Files: ${relevantFiles}\nConstraints: ${constraints}`,
        acceptance_criteria: criteria.map((c) => ({
          id: c.id,
          description: c.description,
          required: c.required,
        })),
        workspace_path: workspacePath || null,
      });

      showToast(`Task "${res.data.id}" created successfully!`, "success");
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
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/tasks"
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Create Verification Task
          </h1>
          <p className="text-xs text-slate-400">
            Define requirements and explicit acceptance criteria before plan generation
          </p>
        </div>
      </div>

      <form onSubmit={(e) => handleSubmit(e, true)}>
        <Card className="space-y-6">
          <CardContent className="space-y-5">
            {/* Task Info */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                  Task Specification
                </h2>
                <div className="text-xs font-mono text-slate-400">
                  ID: <span className="text-sky-400">{taskId}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Task Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Implement JWT authentication middleware"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface-100 border border-white/10 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Requirement Details & Scope
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the expected functionality, edge cases, expected HTTP response formats..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface-100 border border-white/10 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Relevant Files (Optional)
                  </label>
                  <input
                    type="text"
                    value={relevantFiles}
                    onChange={(e) => setRelevantFiles(e.target.value)}
                    placeholder="backend/app/main.py, tests/test_auth.py"
                    className="w-full px-3.5 py-2 rounded-lg bg-surface-100 border border-white/10 text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Constraints & Policies
                  </label>
                  <input
                    type="text"
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                    placeholder="e.g. No new external dependencies, exit code 0 required"
                    className="w-full px-3.5 py-2 rounded-lg bg-surface-100 border border-white/10 text-xs text-slate-100 focus:outline-none focus:border-sky-500/50"
                  />
                </div>
              </div>
            </div>

            {/* Acceptance Criteria (Critical for Deterministic Verification) */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                    Acceptance Criteria
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Deterministic verification checks evidence against each required criterion.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addCriterion}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-sky-400 hover:text-sky-300 rounded border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Criterion</span>
                </button>
              </div>

              <div className="space-y-3">
                {criteria.map((crit, idx) => (
                  <div
                    key={crit.id}
                    className="flex items-start gap-2.5 p-3 rounded-lg bg-surface-100 border border-white/5"
                  >
                    <span className="px-2 py-1 text-xs font-mono font-bold text-sky-400 rounded bg-white/5 shrink-0 mt-0.5">
                      {crit.id}
                    </span>
                    <input
                      type="text"
                      required
                      value={crit.description}
                      onChange={(e) => updateCriterion(idx, e.target.value)}
                      placeholder="e.g. Valid token returns HTTP 200 with decoded user payload"
                      className="flex-1 px-3 py-1.5 rounded bg-surface-200 border border-white/10 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => removeCriterion(idx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded transition-colors"
                      title="Remove criterion"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>

          <CardFooter className="justify-between gap-3">
            <Link href="/tasks">
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                type="button"
                loading={isSubmitting}
                onClick={(e) => handleSubmit(e, false)}
              >
                Save as Draft
              </Button>
              <Button
                variant="brand"
                type="submit"
                loading={isSubmitting}
                icon={<Sparkles className="w-4 h-4" />}
              >
                Generate AI Plan
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
