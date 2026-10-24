import {
  TaskState,
  ExecutionStatus,
  VerificationVerdict,
  TestStatus,
  GeneratorStatus,
} from "./types";

export const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export const APP_VERSION = "0.1.0-alpha";

export interface NavItem {
  name: string;
  href: string;
  iconName: string;
  badge?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAVIGATION_SECTIONS: NavSection[] = [
  {
    title: "Workspace",
    items: [
      { name: "Dashboard", href: "/dashboard", iconName: "LayoutDashboard" },
      { name: "All Projects", href: "/projects", iconName: "FolderGit2" },
    ],
  },
  {
    title: "Development",
    items: [
      { name: "Tasks", href: "/tasks", iconName: "CheckSquare" },
      { name: "Executions", href: "/executions", iconName: "Terminal" },
    ],
  },
  {
    title: "Verification",
    items: [
      {
        name: "Claim vs Reality",
        href: "/verification",
        iconName: "Scale",
        badge: "CORE",
      },
      {
        name: "Verification Results",
        href: "/verification",
        iconName: "ShieldCheck",
      },
      {
        name: "Failure Diagnosis",
        href: "/verification",
        iconName: "AlertTriangle",
      },
      {
        name: "Replay Runs",
        href: "/executions",
        iconName: "History",
      },
      {
        name: "Security Tests",
        href: "/security",
        iconName: "Lock",
      },
    ],
  },
  {
    title: "Reports",
    items: [
      { name: "Run Reports", href: "/reports", iconName: "FileText" },
      { name: "Audit History", href: "/model", iconName: "Cpu" },
    ],
  },
  {
    title: "Settings",
    items: [
      { name: "Settings", href: "/settings", iconName: "Settings" },
    ],
  },
];


export const STATUS_CONFIG: Record<
  VerificationVerdict | TaskState | ExecutionStatus,
  { label: string; color: string; bg: string; border: string; text: string }
> = {
  VERIFIED: {
    label: "Verified",
    color: "#10b981",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
  },
  FAILED: {
    label: "Failed",
    color: "#ef4444",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    text: "text-rose-400",
  },
  UNVERIFIED: {
    label: "Unverified",
    color: "#f59e0b",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
  },
  REVIEW_REQUIRED: {
    label: "Review Required",
    color: "#f59e0b",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
  },
  BLOCKED: {
    label: "Blocked",
    color: "#64748b",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    text: "text-slate-400",
  },
  NOT_RUN: {
    label: "Not Run",
    color: "#64748b",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    text: "text-slate-400",
  },
  CREATED: {
    label: "Created",
    color: "#64748b",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    text: "text-slate-400",
  },
  PLANNED: {
    label: "Planned",
    color: "#38bdf8",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
    text: "text-sky-400",
  },
  APPROVED: {
    label: "Approved",
    color: "#a855f7",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    text: "text-purple-400",
  },
  RUNNING: {
    label: "Running",
    color: "#3b82f6",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
  },
  VERIFYING: {
    label: "Verifying",
    color: "#06b6d4",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    text: "text-cyan-400",
  },
  PENDING: {
    label: "Pending",
    color: "#f59e0b",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
  },
  AWAITING_APPROVAL: {
    label: "Awaiting Approval",
    color: "#f59e0b",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
  },
  COMPLETED: {
    label: "Completed",
    color: "#10b981",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
  },
  TIMED_OUT: {
    label: "Timed Out",
    color: "#ef4444",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    text: "text-rose-400",
  },
  CANCELLED: {
    label: "Cancelled",
    color: "#64748b",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    text: "text-slate-400",
  },
  UNKNOWN: {
    label: "Unknown",
    color: "#64748b",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    text: "text-slate-400",
  },
};

export const GENERATOR_STATUS_MAP: Record<
  GeneratorStatus,
  { label: string; text: string; bg: string; border: string }
> = {
  AI_ACTIVE: {
    label: "AI Active (gemma4:e4b)",
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  FALLBACK_ACTIVE: {
    label: "Deterministic Fallback",
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  AI_UNAVAILABLE: {
    label: "AI Unavailable",
    text: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
  },
};
