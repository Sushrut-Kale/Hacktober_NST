"use client";

import React, { useState, useEffect } from "react";
import { useProject } from "@/hooks/useProject";
import { api, getApiBaseUrl, setApiBaseUrl } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { APP_VERSION } from "@/lib/constants";
import {
  CheckCircle2,
  XCircle,
  Save,
} from "lucide-react";

export default function SettingsPage() {
  const {
    projects,
    currentProjectId,
    setCurrentProjectId,
    isBackendOnline,
    backendLatency,
    isMockMode,
    toggleMockMode,
    refreshStatus,
    showToast,
  } = useProject();

  const [backendUrl, setBackendUrlState] = useState("http://localhost:8000");
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    ok: boolean;
    message: string;
    latency: number;
  } | null>(null);

  useEffect(() => {
    setBackendUrlState(getApiBaseUrl());
  }, []);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await api.testConnection(backendUrl);
      setTestResult({
        tested: true,
        ok: res.ok,
        message: res.ok ? "Connected successfully to VIKASA FastAPI backend." : res.statusText,
        latency: res.latencyMs,
      });
      if (res.ok) {
        showToast("Backend connection verified!", "success");
      } else {
        showToast("Backend connection failed.", "error");
      }
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveBackendUrl = async () => {
    setApiBaseUrl(backendUrl);
    showToast(`Backend URL updated to ${backendUrl}`, "success");
    await refreshStatus();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#F1F4F8]">
          System Settings & Configuration
        </h1>
        <p className="text-xs text-[#718198] mt-1">
          Configure API endpoints, execution runner settings, and application environments
        </p>
      </div>

      {/* Backend API Configuration Card */}
      <Card className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#F1F4F8]">
            FastAPI Backend Connection
          </h2>
          <span
            className={`px-2.5 py-1 text-xs font-mono font-bold rounded-full border ${
              isBackendOnline
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : isMockMode
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
            }`}
          >
            {isBackendOnline
              ? `ONLINE (${backendLatency}ms)`
              : isMockMode
              ? "FIXTURE MODE ACTIVE"
              : "BACKEND OFFLINE"}
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#F1F4F8] mb-1.5">
            Backend API Base URL (NEXT_PUBLIC_API_BASE_URL)
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={backendUrl}
              onChange={(e) => setBackendUrlState(e.target.value)}
              placeholder="http://localhost:8000"
              className="flex-1 px-3.5 py-2 rounded-lg bg-[#0B1423] border border-white/10 text-xs font-mono text-[#F1F4F8] focus:outline-none focus:border-[#58AAE1]/50 transition-colors"
            />
            <Button
              variant="outline"
              size="md"
              loading={testingConnection}
              onClick={handleTestConnection}
            >
              Test Connection
            </Button>
            <Button
              variant="brand"
              size="md"
              icon={<Save className="w-4 h-4" />}
              onClick={handleSaveBackendUrl}
            >
              Save URL
            </Button>
          </div>
          <p className="text-[11px] text-[#718198] mt-1.5">
            Default: <code className="text-[#58AAE1]">http://localhost:8000</code>. Changes are saved in browser local storage and will override environment defaults.
          </p>
        </div>

        {/* Test Connection Result Box */}
        {testResult && (
          <div
            className={`p-3.5 rounded-lg border text-xs font-mono flex items-center justify-between ${
              testResult.ok
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
            {testResult.ok && (
              <span className="text-[10px] text-emerald-400">
                Latency: {testResult.latency} ms
              </span>
            )}
          </div>
        )}
      </Card>

      {/* Mock Fixture Force Toggle */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-[#F1F4F8]">
              Forced Demo Fixture Mode
            </h2>
            <p className="text-xs text-[#718198] max-w-md">
              Enable to force the UI to render deterministic demo fixtures even if a backend server is detected on localhost. Useful for interface demonstration and QA.
            </p>
          </div>

          <button
            onClick={toggleMockMode}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
              isMockMode ? "bg-[#58AAE1]" : "bg-white/20"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isMockMode ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </Card>

      {/* Active Project Selection */}
      <Card className="p-6 space-y-4">
        <h2 className="text-sm font-bold text-[#F1F4F8]">
          Active Project Workspace
        </h2>

        <div>
          <label className="block text-xs font-medium text-[#F1F4F8] mb-1.5">
            Current Selected Project
          </label>
          <select
            value={currentProjectId}
            onChange={(e) => {
              setCurrentProjectId(e.target.value);
              showToast("Active project changed", "info");
            }}
            className="w-full px-3.5 py-2 rounded-lg bg-[#0B1423] border border-white/10 text-xs text-[#F1F4F8] focus:outline-none focus:border-[#58AAE1]/50 cursor-pointer"
          >
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id}>
                {proj.name} ({proj.branch}) — ID: {proj.id}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Security & Secrets Invariant Notice */}
      <Card className="p-6 space-y-3">
        <h2 className="text-sm font-bold text-emerald-400">
          Security & Environment Isolation
        </h2>
        <p className="text-xs text-[#A4B2C5] leading-relaxed">
          In compliance with VIKASA security invariants, no API keys, private tokens, or backend secrets are exposed in browser-visible environment variables or JavaScript bundles. All sensitive model queries and filesystem operations are handled on the server side.
        </p>
      </Card>

      {/* Application Version */}
      <div className="text-center font-mono text-xs text-[#718198] pt-4">
        VIKASA Platform Version: <strong>{APP_VERSION}</strong> | Architecture: Next.js App Router + FastAPI Core
      </div>
    </div>
  );
}
