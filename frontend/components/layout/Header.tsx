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
  Zap,
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
    <header
      className="sticky top-0 z-30 h-16 px-4 sm:px-6 flex items-center justify-between"
      style={{
        background: "rgba(7, 9, 14, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Left: Mobile Menu Toggle & Project Selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 lg:hidden transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Project Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-slate-200 transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.18)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.09)"; }}
          >
            <FolderGit2 className="w-4 h-4 shrink-0" style={{ color: "#00c3ff" }} />
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
              <div
                className="absolute left-0 mt-2 w-72 rounded-xl p-2 z-50 animate-slide-down"
                style={{
                  background: "rgba(11, 16, 27, 0.98)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  backdropFilter: "blur(20px)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,195,255,0.05)",
                }}
              >
                <div className="px-2 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
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
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${
                        proj.id === currentProjectId
                          ? "text-white"
                          : "text-slate-300 hover:bg-white/5"
                      }`}
                      style={
                        proj.id === currentProjectId
                          ? { background: "rgba(0,195,255,0.08)", border: "1px solid rgba(0,195,255,0.2)" }
                          : { border: "1px solid transparent" }
                      }
                    >
                      <div className="truncate">
                        <div className="font-semibold truncate">{proj.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          branch: {proj.branch}
                        </div>
                      </div>
                      {proj.id === currentProjectId && (
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#00c3ff" }} />
                      )}
                    </button>
                  ))}
                </div>
                <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                  <Link
                    href="/projects/new"
                    onClick={() => setProjectDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors"
                    style={{ color: "#00c3ff" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,195,255,0.07)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
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
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Model Status Chip */}
        <div className="hidden md:flex">
          <ModelChip status={modelStatus} modelName="gemma4:e4b" />
        </div>

        {/* Backend Connection Indicator */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
          style={
            isBackendOnline
              ? { background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.25)", color: "#10b981" }
              : isMockMode
              ? { background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.25)", color: "#f59e0b" }
              : { background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", color: "#ef4444" }
          }
          title={
            isBackendOnline
              ? `Backend Connected (Latency: ${backendLatency}ms)`
              : isMockMode
              ? "Mock Fixture Mode Active"
              : "Backend Offline (Falling back to demo fixtures)"
          }
        >
          <Server className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-mono text-[11px]">
            {isBackendOnline
              ? `${backendLatency}ms`
              : isMockMode
              ? "Mock"
              : "Offline"}
          </span>
          {/* Pulsing dot */}
          <span className="relative flex h-1.5 w-1.5">
            {isBackendOnline && (
              <span className="absolute animate-ping-slow inline-flex h-full w-full rounded-full opacity-60" style={{ background: "#10b981" }} />
            )}
            <span
              className="relative inline-flex rounded-full h-1.5 w-1.5"
              style={{
                background: isBackendOnline ? "#10b981" : isMockMode ? "#f59e0b" : "#ef4444",
              }}
            />
          </span>
        </div>

        {/* Mock/Live Toggle */}
        <button
          onClick={toggleMockMode}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all"
          style={
            isMockMode
              ? { background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.3)", color: "#fbbf24" }
              : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", color: "#64748b" }
          }
          title="Toggle between real API requests and demo fixtures"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{isMockMode ? "Mock: ON" : "Mock: OFF"}</span>
        </button>

        {/* Refresh health button */}
        <button
          onClick={handleRefresh}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          title="Refresh health and status"
        >
          <RefreshCw
            className={`w-4 h-4 transition-all ${isRefreshing ? "animate-spin text-[#00c3ff]" : ""}`}
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
