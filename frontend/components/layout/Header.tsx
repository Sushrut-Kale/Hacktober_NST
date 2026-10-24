"use client";

import React, { useState } from "react";
import Link from "next/link";
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
  ExternalLink,
} from "lucide-react";
import { Button } from "../ui/Button";

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
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
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#0a0d14]/80 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Mobile Menu Toggle & Project Selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 lg:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Project Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-100 border border-white/10 hover:border-white/20 text-xs sm:text-sm font-medium text-slate-200 transition-all"
          >
            <FolderGit2 className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="max-w-[140px] sm:max-w-[220px] truncate">
              {currentProject?.name || "Select Project"}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {projectDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setProjectDropdownOpen(false)}
              />
              <div className="absolute left-0 mt-2 w-72 rounded-xl bg-surface-200 border border-white/10 shadow-2xl p-2 z-50 animate-slide-up">
                <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Active Projects
                </div>
                <div className="space-y-1">
                  {projects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => {
                        setCurrentProjectId(proj.id);
                        setProjectDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                        proj.id === currentProjectId
                          ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                          : "text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-semibold truncate">{proj.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          branch: {proj.branch}
                        </div>
                      </div>
                      {proj.id === currentProjectId && (
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-white/10">
                  <Link
                    href="/projects/new"
                    onClick={() => setProjectDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-sky-400 hover:bg-sky-500/10 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Register New Project</span>
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: Status Indicators & Quick Actions */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Model Status Chip */}
        <div className="hidden md:flex">
          <ModelChip status={modelStatus} modelName="gemma4:e4b" />
        </div>

        {/* Backend Connection Indicator */}
        <div
          className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border ${
            isBackendOnline
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : isMockMode
              ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}
          title={
            isBackendOnline
              ? `Backend Connected (Latency: ${backendLatency}ms)`
              : isMockMode
              ? "Mock Fixture Mode Active"
              : "Backend Offline (Falling back to demo fixtures)"
          }
        >
          <Server className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-mono">
            {isBackendOnline
              ? `Online (${backendLatency}ms)`
              : isMockMode
              ? "Mock Data"
              : "Demo Fallback"}
          </span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isBackendOnline
                ? "bg-emerald-400"
                : isMockMode
                ? "bg-amber-400"
                : "bg-rose-400"
            }`}
          />
        </div>

        {/* Mock/Live Toggle */}
        <button
          onClick={toggleMockMode}
          className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
            isMockMode
              ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
              : "bg-white/5 border-white/10 hover:border-white/20 text-slate-400 hover:text-slate-200"
          }`}
          title="Toggle between real API requests and demo fixtures"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{isMockMode ? "Mock Fixtures: ON" : "Mock Fixtures: OFF"}</span>
        </button>

        {/* Refresh health button */}
        <button
          onClick={handleRefresh}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          title="Refresh health and status"
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefreshing ? "animate-spin text-sky-400" : ""}`}
          />
        </button>

        {/* Quick Create Task Button */}
        <Link href="/tasks/new">
          <Button variant="brand" size="sm" icon={<Plus className="w-4 h-4" />}>
            <span className="hidden sm:inline">New Task</span>
          </Button>
        </Link>
      </div>
    </header>
  );
}
