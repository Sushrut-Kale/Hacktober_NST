"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/hooks/useProject";
import {
  Search,
  Sparkles,
  Layers,
  FolderGit2,
  ShieldCheck,
  Lock,
  Settings,
  Terminal,
  Activity,
  ArrowRight,
  Command,
} from "lucide-react";

interface NavCommand {
  id: string;
  title: string;
  category: "Navigation" | "Projects" | "Actions";
  href?: string;
  action?: () => void;
  icon: any;
  badge?: string;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const { projects, setCurrentProjectId } = useProject();

  // Listen for Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const baseCommands: NavCommand[] = [
    { id: "dash", title: "Command Center Dashboard", category: "Navigation", href: "/dashboard", icon: Activity },
    { id: "proj", title: "Project Workspaces Catalog", category: "Navigation", href: "/projects", icon: FolderGit2 },
    { id: "new", title: "New Project Intake (Git / Idea / Archive)", category: "Actions", href: "/projects/new", icon: Sparkles, badge: "INTAKE" },
    { id: "tasks", title: "Tasks & Backlog", category: "Navigation", href: "/tasks", icon: Layers },
    { id: "verif", title: "Deterministic Verification Hub", category: "Navigation", href: "/verification", icon: ShieldCheck, badge: "INVARIANT" },
    { id: "sec", title: "Security Sandbox & Threat Audit", category: "Navigation", href: "/security", icon: Lock },
    { id: "set", title: "System Settings & Model Diagnostics", category: "Navigation", href: "/settings", icon: Settings },
  ];

  const projectCommands: NavCommand[] = (projects || []).map((p) => ({
    id: `p-${p.id}`,
    title: `Switch to: ${p.name}`,
    category: "Projects",
    action: () => {
      setCurrentProjectId(p.id);
      router.push(`/projects/${p.id}`);
    },
    icon: FolderGit2,
    badge: p.source_type || p.language || "PROJECT",
  }));

  const allCommands = [...baseCommands, ...projectCommands];
  const filtered = query.trim()
    ? allCommands.filter(
        (c) =>
          c.title.toLowerCase().includes(query.toLowerCase()) ||
          c.category.toLowerCase().includes(query.toLowerCase())
      )
    : allCommands;

  const handleSelect = (cmd: NavCommand) => {
    setIsOpen(false);
    setQuery("");
    if (cmd.action) {
      cmd.action();
    } else if (cmd.href) {
      router.push(cmd.href);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl overflow-hidden flex flex-col"
        style={{
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(6, 182, 212, 0.15)",
        }}
      >
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-white/10 flex items-center gap-3 bg-white/[0.02]">
          <Search className="w-4 h-4 text-cyan-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, project, or view..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none font-sans"
          />
          <kbd className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-slate-400">
            ESC to close
          </kbd>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">
              No matching commands or projects found.
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={() => handleSelect(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-colors ${
                    isSelected
                      ? "bg-cyan-500/15 text-white border border-cyan-500/30"
                      : "text-slate-300 hover:bg-white/[0.03] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-1.5 rounded-lg ${
                        isSelected ? "bg-cyan-500/20 text-cyan-300" : "bg-white/5 text-slate-400"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold">{cmd.title}</div>
                      <div className="text-[10px] text-slate-500">{cmd.category}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {cmd.badge && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-white/5 text-slate-400 border border-white/10">
                        {cmd.badge}
                      </span>
                    )}
                    {isSelected && <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-white/5 bg-white/[0.01] flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>Navigate with arrows, Enter to select</span>
          <span className="flex items-center gap-1">
            <Command className="w-3 h-3 text-cyan-400" /> VIKASA Quick Command
          </span>
        </div>
      </div>
    </div>
  );
}
