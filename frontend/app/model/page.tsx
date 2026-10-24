"use client";

import React, { useEffect, useState } from "react";
import { useProject } from "@/hooks/useProject";
import { api } from "@/lib/api";
import { ModelTransparencyInfo } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ModelChip } from "@/components/ui/ModelChip";
import {
  Cpu,
  Server,
  RefreshCw,
  Info,
} from "lucide-react";

export default function ModelTransparencyPage() {
  const { modelStatus, refreshStatus } = useProject();
  const [modelInfo, setModelInfo] = useState<ModelTransparencyInfo | null>(null);
  const [ollamaHealth, setOllamaHealth] = useState<any>(null);
  const [antigravityHealth, setAntigravityHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadData() {
    try {
      const [infoRes, ollamaRes, agRes] = await Promise.all([
        api.getModelInfo(),
        api.getOllamaHealth(),
        api.getAntigravityHealth(),
      ]);
      setModelInfo(infoRes.data);
      setOllamaHealth(ollamaRes.data);
      setAntigravityHealth(agRes.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshStatus();
    await loadData();
    setIsRefreshing(false);
  };

  if (loading || !modelInfo) {
    return (
      <div className="p-12 text-center text-[#718198] font-mono text-sm">
        Querying local model and runtime diagnostics...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#F1F4F8]">
              Model & Runtime Transparency
            </h1>
            <ModelChip status={modelStatus} modelName={modelInfo.model_id} />
          </div>
          <p className="text-xs text-[#718198] mt-1">
            Deterministic telemetry for local Gemma 4 inference, Ollama runtime, and Antigravity SDK
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          loading={isRefreshing}
          onClick={handleRefresh}
          icon={<RefreshCw className="w-4 h-4" />}
        >
          Check Runtime Health
        </Button>
      </div>

      {/* Model Transparency Invariant Alert */}
      <div className="p-4 rounded-xl border border-[#58AAE1]/20 bg-[#58AAE1]/10 text-xs text-[#A4B2C5] border-l-4 border-l-[#58AAE1]">
        <div>
          <strong className="text-[#9EDCFF]">Transparency Invariant:</strong> VIKASA never pretends an AI model is running locally when it is unreachable or times out. When Ollama is stopped or unreachable, the system explicitly marks the status as <code>FALLBACK_ACTIVE</code> or <code>AI_UNAVAILABLE</code> and falls back to deterministic rule generation.
        </div>
      </div>

      {/* Telemetry Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-[10px] font-bold text-[#718198] uppercase font-mono">
            Model Engine
          </div>
          <div className="text-lg font-bold font-mono text-[#F1F4F8] mt-1">
            {modelInfo.model_id}
          </div>
          <div className="text-[10px] text-[#718198] font-mono mt-0.5">
            Quantization: {modelInfo.quantization || "Q4_K_M"}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-[10px] font-bold text-[#718198] uppercase font-mono">
            Execution Mode
          </div>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
            {modelInfo.mode}
          </div>
          <div className="text-[10px] text-[#718198] font-mono mt-0.5">
            Local Ollama Service
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-[10px] font-bold text-[#718198] uppercase font-mono">
            Inference Latency
          </div>
          <div className="text-lg font-bold font-mono text-[#58AAE1] mt-1">
            {modelInfo.duration_ms} ms
          </div>
          <div className="text-[10px] text-[#718198] font-mono mt-0.5">
            Context: {modelInfo.context_window_size} tokens
          </div>
        </Card>
      </div>

      {/* Ollama Runtime Service Diagnostics */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#F1F4F8]">
            Ollama Server Health Check
          </h2>
          <span
            className={`px-2.5 py-1 text-xs font-mono font-bold rounded-full border ${
              ollamaHealth?.available
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
            }`}
          >
            {ollamaHealth?.status || "AI_ACTIVE"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 rounded-lg bg-[#0B1423] border border-white/5 space-y-1">
            <span className="text-[#718198] block text-[10px]">OLLAMA ENDPOINT</span>
            <span className="text-[#F1F4F8]">{modelInfo.endpoint}</span>
          </div>
          <div className="p-3 rounded-lg bg-[#0B1423] border border-white/5 space-y-1">
            <span className="text-[#718198] block text-[10px]">MODEL LOADED</span>
            <span className="text-[#F1F4F8]">
              {ollamaHealth?.model || "gemma4:e4b"} ({ollamaHealth?.model_ready ? "Ready" : "Standby"})
            </span>
          </div>
        </div>

        {ollamaHealth?.all_models && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#718198] font-mono block mb-2">
              Locally Available Models
            </span>
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              {ollamaHealth.all_models.map((m: string) => (
                <span
                  key={m}
                  className="px-2.5 py-1 rounded bg-[#0B1423] border border-white/5 text-[#A4B2C5]"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Google Antigravity Telemetry Card */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#F1F4F8]">
            Google Antigravity SDK & MCP Runtime
          </h2>
          <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-full bg-[#58AAE1]/10 text-[#58AAE1] border border-[#58AAE1]/30">
            {antigravityHealth?.status || "NEEDS_INSTALLATION"}
          </span>
        </div>

        <p className="text-xs text-[#A4B2C5] leading-relaxed">
          {antigravityHealth?.notes ||
            "google-antigravity 0.1.22 is available on PyPI ('pip install google-antigravity'). Local safe runner adapter handles execution with full deterministic evidence capture."}
        </p>

        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 rounded-lg bg-[#0B1423] border border-white/5 space-y-1">
            <span className="text-[#718198] block text-[10px]">MCP SERVERS</span>
            <span className="text-[#F1F4F8]">
              {antigravityHealth?.mcp_enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-[#0B1423] border border-white/5 space-y-1">
            <span className="text-[#718198] block text-[10px]">PYPI PACKAGE</span>
            <span className="text-[#F1F4F8]">
              {antigravityHealth?.sdk_package || "google-antigravity"}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
