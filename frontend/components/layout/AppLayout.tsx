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
      <div className="min-h-screen bg-[#05080F] text-[#F1F4F8] flex flex-col font-sans selection:bg-[#58AAE1]/30 selection:text-[#9EDCFF] relative">
        {/* Global ambient soft blue glow */}
        <div
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse 65% 40% at 50% -5%, rgba(36, 75, 120, 0.16) 0%, transparent 70%), radial-gradient(ellipse 45% 25% at 85% 12%, rgba(88, 170, 225, 0.08) 0%, transparent 60%)",
          }}
        />

        {/* Sliding Navigation Drawer */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Full-width Main Content Layout (no permanent sidebar footprint) */}
        <div className="flex flex-col flex-1 min-h-screen relative z-10 w-full">
          <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-page-enter">
            {children}
          </main>
        </div>

        <ToastContainer />
      </div>
    </ProjectProvider>
  );
}
