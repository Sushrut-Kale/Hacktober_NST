"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderGit2,
  CheckSquare,
  Terminal,
  Scale,
  ShieldCheck,
  AlertTriangle,
  History,
  Lock,
  FileText,
  Cpu,
  Settings,
  Layers,
} from "lucide-react";
import { NAVIGATION_SECTIONS } from "@/lib/constants";
import { BrandLogo } from "@/components/ui/Logo";

const ICON_MAP: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="w-4 h-4" />,
  FolderGit2: <FolderGit2 className="w-4 h-4" />,
  CheckSquare: <CheckSquare className="w-4 h-4" />,
  Terminal: <Terminal className="w-4 h-4" />,
  Scale: <Scale className="w-4 h-4" />,
  ShieldCheck: <ShieldCheck className="w-4 h-4" />,
  AlertTriangle: <AlertTriangle className="w-4 h-4" />,
  History: <History className="w-4 h-4" />,
  Lock: <Lock className="w-4 h-4" />,
  FileText: <FileText className="w-4 h-4" />,
  Cpu: <Cpu className="w-4 h-4" />,
  Settings: <Settings className="w-4 h-4" />,
};

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const isItemActive = (href: string): boolean => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/projects") return pathname === "/projects" || (pathname.startsWith("/projects") && !pathname.startsWith("/projects/new"));
    if (href === "/tasks") return pathname === "/tasks" || (pathname.startsWith("/tasks") && !pathname.startsWith("/tasks/new"));
    if (href === "/executions") return pathname.startsWith("/executions");
    if (href === "/verification") return pathname.startsWith("/verification");
    if (href === "/security") return pathname.startsWith("/security");
    if (href === "/reports") return pathname.startsWith("/reports");
    if (href === "/model") return pathname.startsWith("/model");
    if (href === "/settings") return pathname.startsWith("/settings");
    return pathname === href;
  };

  // Deduplicate nav items — show only unique hrefs per section
  const deduplicatedSections = NAVIGATION_SECTIONS.map((section) => {
    const seen = new Set<string>();
    const items = section.items.filter((item) => {
      if (seen.has(item.href + item.name)) return false;
      seen.add(item.href + item.name);
      return true;
    });
    return { ...section, items };
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-60 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "#0a0d14",
          borderRight: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Brand Header */}
        <div
          className="h-14 px-4 flex items-center shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <Link
            href="/dashboard"
            className="flex items-center group"
            onClick={onClose}
          >
            <BrandLogo size={32} />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main navigation">
          {deduplicatedSections.map((section, idx) => (
            <div key={idx} className="mb-4">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isItemActive(item.href);
                  return (
                    <Link
                      key={item.href + item.name}
                      href={item.href}
                      onClick={onClose}
                      className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                        active
                          ? "text-white bg-white/[0.07]"
                          : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                      }`}
                      style={
                        active
                          ? { boxShadow: "inset 3px 0 0 #00c3ff" }
                          : undefined
                      }
                      aria-current={active ? "page" : undefined}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`shrink-0 transition-colors ${
                            active
                              ? "text-[#00c3ff]"
                              : "text-slate-500 group-hover:text-slate-300"
                          }`}
                        >
                          {ICON_MAP[item.iconName] || <Layers className="w-4 h-4" />}
                        </span>
                        <span className="truncate">{item.name}</span>
                      </div>

                      {item.badge && (
                        <span
                          className="px-1.5 py-px text-[9px] font-bold uppercase rounded shrink-0 ml-1"
                          style={{
                            background: "rgba(0,195,255,0.1)",
                            color: "#00c3ff",
                            border: "1px solid rgba(0,195,255,0.2)",
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Core Invariant Footer */}
        <div className="p-2 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div
            className="px-3 py-2.5 rounded-lg"
            style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.12)" }}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-1">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              Core Invariant Active
            </div>
            <p className="text-[10px] text-slate-500 leading-snug font-mono">
              AI claims never decide verdicts. Only deterministic rules &amp; code evidence govern verification.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
