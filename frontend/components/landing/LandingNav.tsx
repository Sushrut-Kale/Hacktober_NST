"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useProject } from "@/hooks/useProject";
import {
  ShieldCheck,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  Menu,
  X,
  ArrowRight,
  Sparkles,
  ExternalLink,
} from "lucide-react";

export function LandingNav() {
  const { isBackendOnline, isMockMode, modelStatus } = useProject();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: "Projects", href: "/projects" },
    { label: "Tasks", href: "/tasks" },
    { label: "Executions", href: "/executions" },
    { label: "Verification", href: "/verification" },
  ];

  const getModelLabel = () => {
    switch (modelStatus) {
      case "AI_ACTIVE":
        return "Qwen2.5-Coder Active";
      case "FALLBACK_ACTIVE":
        return "Deterministic Fallback";
      case "OLLAMA_OFFLINE":
        return "Model Offline";
      default:
        return "Deterministic AI";
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 lg:px-10 pt-4 sm:pt-6 pointer-events-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: VIKASA Logo & Wordmark */}
        <Link
          href="/"
          className="pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 rounded-full glass-panel-subtle hover:border-white/20 transition-all duration-200 group"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#58AAE1] to-[#9EDCFF] p-[1px] flex items-center justify-center shadow-[0_0_15px_rgba(88,170,225,0.4)]">
            <div className="w-full h-full rounded-full bg-[#071426] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-[#9EDCFF] group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 pr-1">
            <span className="font-heading text-lg tracking-wider text-white">
              VIKASA
            </span>
            <span className="text-[10px] font-mono tracking-widest text-[#58AAE1] uppercase opacity-80">
              CORE
            </span>
          </div>
        </Link>

        {/* Center: Arix-inspired floating navigation pill (Desktop) */}
        <nav className="pointer-events-auto hidden md:flex items-center gap-1 px-4 py-1.5 rounded-full glass-panel text-xs font-medium text-slate-300">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="px-3.5 py-1.5 rounded-full hover:text-white hover:bg-white/10 transition-all duration-150 tracking-wide"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right: AI & Backend Status + Workspace Link */}
        <div className="pointer-events-auto flex items-center gap-2 sm:gap-3">
          {/* AI Model Status Chip (hidden on small mobile) */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-panel text-[11px] font-mono text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-[#58AAE1]" />
            <span className="text-slate-400">AI:</span>
            <span className="text-white font-medium">{getModelLabel()}</span>
          </div>

          {/* Backend Connection Dot Indicator */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-panel text-[11px] font-mono text-slate-300"
            title={
              isBackendOnline
                ? "Backend connected (FastAPI :8000)"
                : isMockMode
                ? "Fixtures active"
                : "Backend offline - using deterministic fallback"
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isBackendOnline
                  ? "bg-emerald-400 shadow-[0_0_8px_#10b981]"
                  : "bg-amber-400 shadow-[0_0_8px_#f59e0b]"
              }`}
            />
            <span className="text-slate-400">
              {isBackendOnline ? "Online" : "Mock Active"}
            </span>
          </div>

          {/* Workspace Launch Button (Arix-style pill button) */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-[#04060A] hover:bg-[#F1F4F8] hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] text-xs font-semibold tracking-wide transition-all duration-200 group"
          >
            <span>Workspace</span>
            <div className="w-4 h-4 rounded-full bg-[#04060A] text-white flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
              <ArrowRight className="w-2.5 h-2.5" />
            </div>
          </Link>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-full glass-panel text-slate-300 hover:text-white"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="pointer-events-auto md:hidden mt-3 max-w-md mx-auto p-4 rounded-2xl glass-panel space-y-3 animate-slide-down border border-white/15">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="pt-3 border-t border-white/10 flex flex-col gap-2 text-xs font-mono text-slate-400">
            <div className="flex items-center justify-between px-2 py-1">
              <span>AI Engine:</span>
              <span className="text-[#9EDCFF]">{getModelLabel()}</span>
            </div>
            <div className="flex items-center justify-between px-2 py-1">
              <span>Backend Status:</span>
              <span
                className={
                  isBackendOnline ? "text-emerald-400" : "text-amber-400"
                }
              >
                {isBackendOnline ? "Connected (Live)" : "Mock Fixtures"}
              </span>
            </div>
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-2 w-full py-2.5 rounded-xl bg-white text-[#04060A] text-center font-semibold text-xs flex items-center justify-center gap-2"
            >
              <span>Open Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
