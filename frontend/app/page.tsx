"use client";

import React, { useState } from "react";
import { DnaHelixBackground } from "@/components/landing/DnaHelixBackground";
import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { DeveloperStatusStrip } from "@/components/landing/DeveloperStatusStrip";
import { ProjectWorkspaceSection } from "@/components/landing/ProjectWorkspaceSection";
import { WorkflowSection } from "@/components/landing/WorkflowSection";
import { VerificationOverviewSection } from "@/components/landing/VerificationOverviewSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { TaskCreateModal } from "@/components/landing/TaskCreateModal";
import { ProjectImportModal } from "@/components/landing/ProjectImportModal";

export default function LandingPage() {
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-[#04060A] text-slate-100 flex flex-col font-sans selection:bg-[#58AAE1]/30 selection:text-[#9EDCFF] overflow-x-hidden">
      {/* Cinematic 3D Translucent DNA Helix Animated Canvas */}
      <DnaHelixBackground />

      {/* Minimal Floating Navigation (Inspired by Arix) */}
      <LandingNav />

      {/* Main Hero & Developer Actions */}
      <main className="relative z-10 flex-1 flex flex-col">
        <HeroSection
          onOpenTaskModal={() => setTaskModalOpen(true)}
          onOpenImportModal={() => setImportModalOpen(true)}
        />

        {/* Live Developer Status Strip */}
        <DeveloperStatusStrip />

        {/* Below-the-Fold: Project Workspace */}
        <ProjectWorkspaceSection
          onOpenImportModal={() => setImportModalOpen(true)}
        />

        {/* Below-the-Fold: Development Workflow */}
        <WorkflowSection />

        {/* Below-the-Fold: Verification Overview (Claim vs Reality) */}
        <VerificationOverviewSection />
      </main>

      {/* Minimal Footer */}
      <LandingFooter />

      {/* Task Creation Modal */}
      <TaskCreateModal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
      />

      {/* Project Import Modal */}
      <ProjectImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
    </div>
  );
}
