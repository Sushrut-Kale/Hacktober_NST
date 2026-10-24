"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { ToastContainer } from "../ui/ToastContainer";
import { ProjectProvider } from "@/hooks/useProject";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  if (isLandingPage) {
    return (
      <ProjectProvider>
        <div className="min-h-screen bg-[#04060A] text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200 relative overflow-x-hidden">
          {children}
          <ToastContainer />
        </div>
      </ProjectProvider>
    );
  }

  return (
    <ProjectProvider>
      <div className="min-h-screen bg-mesh text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200 relative">
        {/* Global ambient glow */}
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 35% at 50% -5%, rgba(0,195,255,0.07) 0%, transparent 70%), radial-gradient(ellipse 40% 25% at 90% 15%, rgba(139,92,246,0.05) 0%, transparent 60%)",
          }}
        />

        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="lg:pl-64 flex flex-col flex-1 min-h-screen relative z-10">
          <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-fade-in">
            {children}
          </main>
        </div>

        <ToastContainer />
      </div>
    </ProjectProvider>
  );
}
