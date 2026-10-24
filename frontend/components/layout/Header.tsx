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
  Shield,
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
        background: "rgba(8, 20, 38, 0.88)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.10)",
      }}
    >
      {/* Left: Hamburger Button, VIKASA Brand Logo (navigates to '/'), and Project Selector */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Hamburger Menu Toggle (visible across all viewport widths) */}
        <button
          onClick={onToggleSidebar}
          className="p-2 text-[#A4B2C5] hover:text-[#F1F4F8] rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Open navigation menu"
          title="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* VIKASA Logo and Brand - Always navigates to landing page '/' */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group cursor-pointer pr-1"
          title="VIKASA - Return to Home"
        >
          <div
            className="relative flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-transform group-hover:scale-105"
            style={{
              background: "linear-gradient(135deg, #58AAE1 0%, #244B78 100%)",
            }}
          >
            <Shield className="w-4 h-4 text-white" />
            <div
              className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background:
                  "linear-gradient(135deg, rgba(88, 170, 225, 0.5) 0%, rgba(36, 75, 120, 0.5) 100%)",
                filter: "blur(6px)",
              }}
            />
          </div>

          <div className="hidden sm:flex items-center gap-1.5">
            <span
              className="font-extrabold tracking-wider text-[14px] text-[#F1F4F8]"
              style={{ letterSpacing: "0.05em" }}
            >
              VIKASA
            </span>
            <span
              className="px-1.5 py-px text-[9px] font-bold font-mono uppercase rounded"
              style={{
                background: "rgba(88, 170, 225, 0.15)",
                color: "#9EDCFF",
                border: "1px solid rgba(88, 170, 225, 0.3)",
              }}
            >
              AI
            </span>
          </div>
        </Link>

        {/* Divider */}
        <div className="hidden sm:block h-5 w-px bg-white/10 mx-1" />

        {/* Project Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-[#F1F4F8] transition-all cursor-pointer"
            style={{
              background: "rgba(16, 29, 48, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.10)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor =
                "rgba(88, 170, 225, 0.4)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor =
                "rgba(255, 255, 255, 0.10)";
            }}
          >
            <FolderGit2
              className="w-4 h-4 shrink-0"
              style={{ color: "#58AAE1" }}
            />
            <span className="max-w-[120px] sm:max-w-[190px] md:max-w-[220px] truncate">
              {currentProject?.name || "Select Project"}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#718198] shrink-0" />
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
                  background: "rgba(8, 20, 38, 0.98)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  backdropFilter: "blur(20px)",
                  boxShadow:
                    "0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(88,170,225,0.06)",
                }}
              >
                <div className="px-2 py-1.5 text-[10px] font-bold text-[#718198] uppercase tracking-widest font-mono">
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
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                        proj.id === currentProjectId
                          ? "text-[#F1F4F8]"
                          : "text-[#A4B2C5] hover:bg-white/5 hover:text-[#F1F4F8]"
                      }`}
                      style={
                        proj.id === currentProjectId
                          ? {
                              background: "rgba(88, 170, 225, 0.12)",
                              border: "1px solid rgba(88, 170, 225, 0.3)",
                            }
                          : { border: "1px solid transparent" }
                      }
                    >
                      <div className="truncate">
                        <div className="font-semibold truncate">{proj.name}</div>
                        <div className="text-[10px] text-[#718198] font-mono">
                          branch: {proj.branch}
                        </div>
                      </div>
                      {proj.id === currentProjectId && (
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: "#58AAE1" }}
                        />
                      )}
                    </button>
                  ))}
                </div>
                <div
                  className="mt-2 pt-2"
                  style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}
                >
                  <Link
                    href="/projects/new"
                    onClick={() => setProjectDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                    style={{ color: "#58AAE1" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "rgba(88, 170, 225, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "transparent";
                    }}
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
              ? {
                  background: "rgba(16, 185, 129, 0.08)",
                  borderColor: "rgba(16, 185, 129, 0.25)",
                  color: "#10b981",
                }
              : isMockMode
              ? {
                  background: "rgba(245, 158, 11, 0.08)",
                  borderColor: "rgba(245, 158, 11, 0.25)",
                  color: "#f59e0b",
                }
              : {
                  background: "rgba(239, 68, 68, 0.08)",
                  borderColor: "rgba(239, 68, 68, 0.25)",
                  color: "#ef4444",
                }
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
              <span
                className="absolute animate-ping-slow inline-flex h-full w-full rounded-full opacity-60"
                style={{ background: "#10b981" }}
              />
            )}
            <span
              className="relative inline-flex rounded-full h-1.5 w-1.5"
              style={{
                background: isBackendOnline
                  ? "#10b981"
                  : isMockMode
                  ? "#f59e0b"
                  : "#ef4444",
              }}
            />
          </span>
        </div>

        {/* Mock/Live Toggle */}
        <button
          onClick={toggleMockMode}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer"
          style={
            isMockMode
              ? {
                  background: "rgba(245, 158, 11, 0.08)",
                  borderColor: "rgba(245, 158, 11, 0.3)",
                  color: "#fbbf24",
                }
              : {
                  background: "rgba(255, 255, 255, 0.03)",
                  borderColor: "rgba(255, 255, 255, 0.08)",
                  color: "#718198",
                }
          }
          title="Toggle between real API requests and demo fixtures"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{isMockMode ? "Mock: ON" : "Mock: OFF"}</span>
        </button>

        {/* Refresh health button */}
        <button
          onClick={handleRefresh}
          className="p-1.5 text-[#A4B2C5] hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          title="Refresh health and status"
        >
          <RefreshCw
            className={`w-4 h-4 transition-all ${
              isRefreshing ? "animate-spin text-[#58AAE1]" : ""
            }`}
          />
        </button>

        {/* Quick Create Task Button */}
        <Link href="/tasks/new">
          <Button
            variant="brand"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
          >
            <span className="hidden sm:inline">New Task</span>
          </Button>
        </Link>
      </div>
    </header>
  );
}
