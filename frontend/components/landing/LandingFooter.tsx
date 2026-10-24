"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, GitBranch, Terminal, ExternalLink } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="w-full border-t border-white/10 bg-[#04060A]/80 backdrop-blur-md relative z-10 py-12 px-4 sm:px-6 lg:px-8 text-xs text-slate-400">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#58AAE1] to-[#9EDCFF] p-[1px] flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-[#071426] flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-[#9EDCFF]" />
            </div>
          </div>
          <div>
            <div className="font-heading text-base tracking-wider text-white">
              VIKASA
            </div>
            <div className="text-[10px] text-slate-400 font-tight">
              AI Development Intelligence & Verification Platform
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="flex flex-wrap items-center justify-center gap-6 font-medium text-slate-300">
          <Link href="/dashboard" className="hover:text-white transition-colors">
            Workspace
          </Link>
          <Link href="/projects" className="hover:text-white transition-colors">
            Projects
          </Link>
          <Link href="/tasks" className="hover:text-white transition-colors">
            Tasks
          </Link>
          <Link href="/executions" className="hover:text-white transition-colors">
            Executions
          </Link>
          <Link href="/verification" className="hover:text-white transition-colors">
            Verification
          </Link>
          <Link href="/settings" className="hover:text-white transition-colors">
            Settings
          </Link>
        </div>

        {/* Status / Version */}
        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>v0.1.0-alpha</span>
          </span>
          <span>·</span>
          <span>Shourya-Thorat</span>
        </div>
      </div>
    </footer>
  );
}
