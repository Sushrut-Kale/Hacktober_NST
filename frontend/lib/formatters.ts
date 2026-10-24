import {
  TaskState,
  ExecutionStatus,
  VerificationVerdict,
  TestStatus,
} from "./types";
import { STATUS_CONFIG } from "./constants";

export function formatDate(isoString?: string | null): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return isoString;
  }
}

export function formatDuration(ms?: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms} ms`;
  const sec = (ms / 1000).toFixed(2);
  return `${sec} s`;
}

export function getStatusBadge(
  status: VerificationVerdict | TaskState | ExecutionStatus | string
) {
  const config =
    STATUS_CONFIG[status as VerificationVerdict | TaskState | ExecutionStatus];
  if (config) {
    return config;
  }
  return {
    label: String(status),
    color: "#64748b",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    text: "text-slate-400",
  };
}

export function getTestStatusBadge(status: TestStatus) {
  switch (status) {
    case "PASS":
      return {
        label: "PASS",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/30",
        text: "text-emerald-400",
      };
    case "FAIL":
      return {
        label: "FAIL",
        bg: "bg-rose-500/10",
        border: "border-rose-500/30",
        text: "text-rose-400",
      };
    case "BLOCKED":
      return {
        label: "BLOCKED",
        bg: "bg-slate-500/10",
        border: "border-slate-500/30",
        text: "text-slate-400",
      };
    case "NOT_RUN":
      return {
        label: "NOT RUN",
        bg: "bg-slate-500/10",
        border: "border-slate-500/30",
        text: "text-slate-400",
      };
    default:
      return {
        label: "UNKNOWN",
        bg: "bg-slate-500/10",
        border: "border-slate-500/30",
        text: "text-slate-400",
      };
  }
}

export interface DiffLine {
  type: "add" | "delete" | "header" | "context";
  text: string;
}

export function parseGitDiff(diff?: string | null): DiffLine[] {
  if (!diff) return [];
  const lines = diff.split("\n");
  return lines.map((line) => {
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff --git")) {
      return { type: "header", text: line };
    }
    if (line.startsWith("@@")) {
      return { type: "header", text: line };
    }
    if (line.startsWith("+")) {
      return { type: "add", text: line };
    }
    if (line.startsWith("-")) {
      return { type: "delete", text: line };
    }
    return { type: "context", text: line };
  });
}
