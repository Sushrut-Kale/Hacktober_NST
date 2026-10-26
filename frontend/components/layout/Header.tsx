"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProject } from "@/hooks/useProject";
import { ModelChip } from "@/components/ui/ModelChip";
import {
  Menu,
  ChevronDown,
  FolderGit2,
  Plus,
  RefreshCw,
  Server,
  SlidersHorizontal,
  ChevronRight,
  Search,
} from "lucide-react";
import { Button } from "../ui/Button";

interface HeaderProps {
  onToggleSidebar: () => void;
}

// Map pathname segments to human-readable breadcrumb labels
function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) return [];

  const crumbMap: Record<string, string> = {
    dashboard: "Dashboard",
    projects: "Projects",
    new: "New",
    tasks: "Tasks",
    plan: "Plan",
    executions: "Executions",
    replay: "Replay",
    verification: "Verification",
    "claim-vs-reality": "Claim vs Reality",
    failure: "Failure Diagnosis",
    reports: "Reports",
    security: "Security",
    model: "Model",
    settings: "Settings",
  };

  const crumbs: { label: string; href?: string }[] = [];
  let path = "";
  for (let i = 0; i < segments.length; i++) {
    path += "/" + segments[i];
    const label = crumbMap[segments[i]] || segments[i];
    crumbs.push({ label, href: i < segments.length - 1 ? path : undefined });
  }
  return crumbs;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const pathname = usePathname();
  const {
    projects,
    currentProjectId,
    currentProject,
    setCurrentProjectId,
    isBackendOnline,
    backendLatency,
    isMockMode,
    toggleMockMode,
    modelStatus,
    refreshStatus,
  } = useProject();

  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshStatus();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <header
      className="sticky top-0 z-30 h-14 px-4 sm:px-6 flex items-center justify-between gap-3"
      style={{
        background: "rgba(7, 9, 14, 0.9)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Left: Mobile Toggle + Project + Breadcrumbs */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Mobile menu toggle */}
        <button
          onClick={onToggleSidebar}
          className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-white/5 lg:hidden transition-colors shrink-0"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Project Selector */}
        <div className="relative shrink-0">
          <button
            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
            }}
          >
            <FolderGit2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            <span className="max-w-[120px] sm:max-w-[180px] truncate">
              {currentProject?.name || "Select Project"}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
          </button>

          {projectDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setProjectDropdownOpen(false)}
              />
              <div
                className="absolute left-0 top-full mt-1 w-72 rounded-xl p-2 z-50 animate-slide-down"
                style={{
                  background: "rgba(10, 13, 20, 0.98)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  backdropFilter: "blur(20px)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                }}
              >
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-1">
                  Projects
                </div>
                <div className="space-y-0.5">
                  {projects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => {
                        setCurrentProjectId(proj.id);
                        setProjectDropdownOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between"
                      style={
                        proj.id === currentProjectId
                          ? { background: "rgba(0,195,255,0.08)", color: "#e2e8f0", border: "1px solid rgba(0,195,255,0.18)" }
                          : { color: "#94a3b8", border: "1px solid transparent" }
                      }
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate text-inherit">{proj.name}</div>
                        <div className="text-[10px] font-mono text-slate-600 truncate">
                          branch: {proj.branch}
                        </div>
                      </div>
                      {proj.id === currentProjectId && (
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 ml-2 bg-sky-400" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="mt-1 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <Link
                    href="/projects/new"
                    onClick={() => setProjectDropdownOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-sky-500 hover:text-sky-400 hover:bg-sky-500/5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Register New Project
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Breadcrumbs — desktop only */}
        {breadcrumbs.length > 1 && (
          <nav className="hidden sm:flex items-center gap-1 text-xs text-slate-600 min-w-0" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="w-3 h-3 shrink-0" />}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-slate-300 transition-colors truncate max-w-[100px]">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-slate-400 font-medium truncate max-w-[120px]">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
      </div>

      {/* Right: Status + Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Model Status */}
        <div className="hidden md:flex">
          <ModelChip status={modelStatus} modelName="gemma4:e4b" />
        </div>

        {/* Backend status indicator */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border"
          style={
            isBackendOnline
              ? { background: "rgba(52,211,153,0.06)", borderColor: "rgba(52,211,153,0.2)", color: "#34d399" }
              : isMockMode
              ? { background: "rgba(251,191,36,0.06)", borderColor: "rgba(251,191,36,0.2)", color: "#fbbf24" }
              : { background: "rgba(248,113,113,0.06)", borderColor: "rgba(248,113,113,0.2)", color: "#f87171" }
          }
          title={
            isBackendOnline
              ? `Backend online — ${backendLatency}ms`
              : isMockMode
              ? "Demo fixture mode active"
              : "Backend offline — showing demo fixtures"
          }
        >
          <Server className="w-3 h-3" />
          <span className="hidden sm:inline font-mono text-[11px]">
            {isBackendOnline ? `${backendLatency}ms` : isMockMode ? "Demo" : "Offline"}
          </span>
          <span className="relative flex h-1.5 w-1.5">
            {isBackendOnline && (
              <span className="absolute animate-ping-slow inline-flex h-full w-full rounded-full opacity-60 bg-emerald-400" />
            )}
            <span
              className="relative inline-flex rounded-full h-1.5 w-1.5"
              style={{
                background: isBackendOnline ? "#34d399" : isMockMode ? "#fbbf24" : "#f87171",
              }}
            />
          </span>
        </div>

        {/* Quick Command Search (Ctrl+K) */}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
          className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-mono text-slate-400 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 transition-all cursor-pointer"
          title="Open Command Palette (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] text-slate-400">Search</span>
          <kbd className="px-1.5 py-0.2 rounded text-[9px] bg-white/5 border border-white/10 text-slate-500">
            Ctrl K
          </kbd>
        </button>

        {/* Mock toggle */}
        <button
          onClick={toggleMockMode}
          className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-all"
          style={
            isMockMode
              ? { background: "rgba(251,191,36,0.06)", borderColor: "rgba(251,191,36,0.25)", color: "#fbbf24" }
              : { background: "transparent", borderColor: "rgba(255,255,255,0.07)", color: "#475569" }
          }
          title="Toggle demo/live mode"
        >
          <SlidersHorizontal className="w-3 h-3" />
          <span>{isMockMode ? "Mock: ON" : "Mock: OFF"}</span>
        </button>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          className="p-1.5 text-slate-600 hover:text-slate-300 rounded-lg hover:bg-white/5 transition-colors"
          title="Refresh status"
          aria-label="Refresh backend status"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-sky-400" : ""}`} />
        </button>

        {/* CTA */}
        <Link href="/tasks/new">
          <Button variant="brand" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
            <span className="hidden sm:inline">New Task</span>
          </Button>
        </Link>
      </div>
    </header>
  );
}
