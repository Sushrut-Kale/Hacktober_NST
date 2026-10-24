"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Project, GeneratorStatus } from "../lib/types";
import { api, isMockModeForced, setMockModeForced } from "../lib/api";
import { DEMO_PROJECTS } from "../fixtures/demo-data";

export interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
}

interface ProjectContextType {
  projects: Project[];
  currentProjectId: string;
  currentProject?: Project;
  setCurrentProjectId: (id: string) => void;
  isBackendOnline: boolean;
  isMockMode: boolean;
  toggleMockMode: () => void;
  backendLatency: number;
  modelStatus: GeneratorStatus;
  refreshStatus: () => Promise<void>;
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastMessage["type"]) => void;
  removeToast: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() =>
    typeof window !== "undefined" && isMockModeForced() ? DEMO_PROJECTS : []
  );
  const [currentProjectId, setCurrentProjectIdState] = useState<string>("default");
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);
  const [isMockMode, setIsMockModeState] = useState<boolean>(false);
  const [backendLatency, setBackendLatency] = useState<number>(0);
  const [modelStatus, setModelStatus] = useState<GeneratorStatus>("AI_ACTIVE");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: ToastMessage["type"] = "info") => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleMockMode = () => {
    const next = !isMockMode;
    setIsMockModeState(next);
    setMockModeForced(next);
    if (next) {
      setProjects(DEMO_PROJECTS);
    } else {
      refreshStatus();
    }
    showToast(
      next ? "Mock Fixture Mode Forced [DEV FIXTURE]" : "Live Backend Mode Enabled",
      next ? "warning" : "success"
    );
  };

  const setCurrentProjectId = (id: string) => {
    setCurrentProjectIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("vikasa_current_project", id);
    }
  };

  const refreshStatus = async () => {
    try {
      const conn = await api.testConnection(
        typeof window !== "undefined"
          ? localStorage.getItem("vikasa_backend_url") || "http://localhost:8000"
          : "http://localhost:8000"
      );
      setIsBackendOnline(conn.ok);
      setBackendLatency(conn.latencyMs);

      const ollama = await api.getOllamaHealth();
      if (ollama.data?.status) {
        setModelStatus(ollama.data.status as GeneratorStatus);
      }

      const projs = await api.getProjects();
      if (projs.data) {
        setProjects(projs.data);
      }
    } catch {
      setIsBackendOnline(false);
      setModelStatus("FALLBACK_ACTIVE");
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMockModeState(isMockModeForced());
      const savedProj = localStorage.getItem("vikasa_current_project");
      if (savedProj) setCurrentProjectIdState(savedProj);
    }
    refreshStatus();
    const interval = setInterval(refreshStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const currentProject =
    projects.find((p) => p.id === currentProjectId) || projects[0];

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProjectId,
        currentProject,
        setCurrentProjectId,
        isBackendOnline,
        isMockMode,
        toggleMockMode,
        backendLatency,
        modelStatus,
        refreshStatus,
        toasts,
        showToast,
        removeToast,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
