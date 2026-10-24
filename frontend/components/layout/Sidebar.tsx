"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderGit2,
  FolderPlus,
  CheckSquare,
  PlusCircle,
  Terminal,
  Scale,
  ShieldCheck,
  AlertTriangle,
  History,
  Lock,
  FileText,
  Cpu,
  Settings,
  Shield,
  Layers,
} from "lucide-react";
import { NAVIGATION_SECTIONS } from "@/lib/constants";

const ICON_MAP: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="w-4 h-4" />,
  FolderGit2: <FolderGit2 className="w-4 h-4" />,
  FolderPlus: <FolderPlus className="w-4 h-4" />,
  CheckSquare: <CheckSquare className="w-4 h-4" />,
  PlusCircle: <PlusCircle className="w-4 h-4" />,
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
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#0a0d14]/95 border-r border-white/10 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo / Brand Header */}
        <div className="h-16 px-5 border-b border-white/10 flex items-center justify-between shrink-0 bg-surface-200/50">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 group"
            onClick={onClose}
          >
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 shadow-glow-sm">
              <Shield className="w-5 h-5 text-slate-950 font-bold" />
              <div className="absolute inset-0 rounded-lg bg-sky-400/20 blur group-hover:blur-md transition-all" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-wider text-base text-white">
                  VIKASA
                </span>
                <span className="px-1.5 py-0.2 text-[9px] font-mono uppercase bg-sky-500/20 text-sky-400 rounded border border-sky-500/30">
                  AI Verifier
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono tracking-tight block">
                Intelligence & Evidence
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {NAVIGATION_SECTIONS.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`group relative flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? "bg-white/[0.08] text-white font-semibold shadow-sm"
                          : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`shrink-0 transition-colors ${
                            isActive
                              ? "text-sky-400"
                              : "text-slate-400 group-hover:text-slate-200"
                          }`}
                        >
                          {ICON_MAP[item.iconName] || <Layers className="w-4 h-4" />}
                        </span>
                        <span>{item.name}</span>
                      </div>

                      {item.badge && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          {item.badge}
                        </span>
                      )}

                      {isActive && (
                        <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-sky-400 rounded-r-full shadow-glow-sm" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Invariant Footer */}
        <div className="p-3 border-t border-white/10 bg-surface-200/40">
          <div className="p-3 rounded-lg bg-surface-100/60 border border-white/5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Core Invariant</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              AI claims never decide verdicts. Only deterministic rules & code evidence govern verification.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
