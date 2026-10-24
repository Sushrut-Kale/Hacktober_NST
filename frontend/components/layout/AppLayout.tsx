"use client";

import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { ToastContainer } from "../ui/ToastContainer";
import { ProjectProvider } from "@/hooks/useProject";
import { ContextualAssistant } from "../assistant/ContextualAssistant";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ProjectProvider>
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
        {/* Subtle ambient background gradient */}
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 30% at 50% 0%, rgba(0,195,255,0.05) 0%, transparent 65%)",
          }}
          aria-hidden="true"
        />

        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content: offset by sidebar width (w-60 = 240px) */}
        <div className="lg:pl-60 flex flex-col flex-1 min-h-screen relative z-10">
          <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] w-full mx-auto animate-fade-in">
            {children}
          </main>
        </div>

        <ContextualAssistant />
        <ToastContainer />
      </div>
    </ProjectProvider>
  );
}
