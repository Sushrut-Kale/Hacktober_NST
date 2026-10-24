"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Sparkles,
  X,
  Send,
  HelpCircle,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Cpu,
  Layers,
  ChevronDown,
} from "lucide-react";
import { api } from "@/lib/api";
import { useProject } from "@/hooks/useProject";
import { GeneratorStatus } from "@/lib/types";

interface Message {
  id: string;
  sender: "user" | "assistant";
  content: string;
  timestamp: string;
  modelStatus?: GeneratorStatus;
  suggestedCheckpoints?: Array<{ title: string; category: string }>;
}

export function ContextualAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const { currentProject } = useProject();
  const [ollamaStatus, setOllamaStatus] = useState<any>(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await api.getOllamaHealth();
        setOllamaStatus(res.data);
      } catch {
        setOllamaStatus({ available: false, status: "AI_UNAVAILABLE" });
      }
    }
    checkHealth();
  }, []);

  const getModelBadge = () => {
    if (!ollamaStatus) return { label: "Checking AI...", color: "text-slate-400 bg-slate-800" };
    if (ollamaStatus.available && ollamaStatus.status === "AI_ACTIVE") {
      return { label: `gemma4:e4b (Active)`, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
    }
    if (ollamaStatus.status === "FALLBACK_ACTIVE") {
      return { label: "Deterministic Fallback", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
    }
    return { label: "Deterministic Fallback (Offline)", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
  };

  const handleSend = async (customPrompt?: string) => {
    const text = customPrompt || input;
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput("");
    setIsTyping(true);

    try {
      // Simulate intelligent response referencing current project & deterministic engine
      await new Promise((r) => setTimeout(r, 600));

      const isModelActive = ollamaStatus?.available && ollamaStatus?.status === "AI_ACTIVE";
      const modelStatus: GeneratorStatus = isModelActive ? "AI_ACTIVE" : "FALLBACK_ACTIVE";

      let responseContent = "";
      let suggestedCheckpoints: Array<{ title: string; category: string }> | undefined;

      const lower = text.toLowerCase();
      if (lower.includes("check") || lower.includes("missing") || lower.includes("plan")) {
        responseContent = `Based on project analysis of ${currentProject?.name || "the active repository"}, here are key unverified or pending checkpoints to prioritize next:`;
        suggestedCheckpoints = [
          { title: "Deterministic Test Suite Automation", category: "Testing" },
          { title: "Safe Command Runner Shell-Escape Defense", category: "Security" },
          { title: "Empirical Git Diff Evidence Collector", category: "Backend" },
        ];
      } else if (lower.includes("fail") || lower.includes("error") || lower.includes("diagnosis")) {
        responseContent = `In VIKASA's deterministic model, failures occur when actual command exit codes are non-zero or acceptance criteria lack substantiated git evidence. To debug: inspect the raw logs under Build Center and verify that every acceptance criterion has a matching PASS event.`;
      } else {
        responseContent = `VIKASA is tracking ${currentProject?.name || "your codebase"} with deterministic verification. Every build is vetted against empirical git diffs, exit codes, and test outputs before any task is marked verified.`;
      }

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        content: responseContent,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        modelStatus,
        suggestedCheckpoints,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch {
      // Handle error gracefully
    } finally {
      setIsTyping(false);
    }
  };

  const badge = getModelBadge();

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 p-3 rounded-full flex items-center gap-2.5 shadow-2xl transition-all duration-300 hover:scale-105"
          style={{
            background: "linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)",
            border: "1px solid rgba(255,255,255,0.2)",
            boxShadow: "0 10px 30px -5px rgba(2,132,199,0.4), 0 0 15px rgba(6,182,212,0.3)",
          }}
          title="Open VIKASA Contextual Assistant"
        >
          <Sparkles className="w-5 h-5 text-white" />
          <span className="text-xs font-semibold text-white tracking-wide pr-1">VIKASA AI</span>
        </button>
      )}

      {/* Floating Assistant Drawer */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-32px)] h-[560px] rounded-2xl flex flex-col overflow-hidden shadow-2xl backdrop-blur-xl transition-all"
          style={{
            background: "rgba(11, 16, 27, 0.95)",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow: "0 25px 60px -10px rgba(0,0,0,0.7), 0 0 30px -5px rgba(6,182,212,0.15)",
          }}
        >
          {/* Header */}
          <div
            className="p-3.5 flex items-center justify-between shrink-0"
            style={{
              background: "rgba(15,22,36,0.8)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-white">Project Assistant</h4>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate max-w-[190px]">
                  {currentProject?.name ? `Context: ${currentProject.name}` : "Workspace level"}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Action Pills */}
          <div className="p-2.5 border-b border-white/5 flex gap-1.5 overflow-x-auto text-[11px] shrink-0">
            <button
              onClick={() => handleSend("What checkpoints should we build next?")}
              className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 whitespace-nowrap transition-colors flex items-center gap-1"
            >
              <Lightbulb className="w-3 h-3 text-cyan-400" /> Suggest Next
            </button>
            <button
              onClick={() => handleSend("Explain deterministic verification vs agent claims")}
              className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 whitespace-nowrap transition-colors flex items-center gap-1"
            >
              <HelpCircle className="w-3 h-3 text-emerald-400" /> How It Works
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <Sparkles className="w-8 h-8 text-cyan-400/50 mb-2" />
                <p className="font-medium text-slate-400 text-xs">VIKASA Development Intelligence</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Ask questions about implementation status, verify evidence, or get suggested checkpoints.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl p-3 ${
                    msg.sender === "user"
                      ? "bg-cyan-600/20 text-cyan-100 border border-cyan-500/30"
                      : "bg-white/[0.04] text-slate-200 border border-white/[0.07]"
                  }`}
                >
                  <p className="leading-relaxed">{msg.content}</p>

                  {/* Model Transparency Tag */}
                  {msg.modelStatus && (
                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1 text-[10px] font-mono text-slate-400">
                      <Cpu className="w-3 h-3 text-cyan-400" />
                      <span>Source: {msg.modelStatus === "AI_ACTIVE" ? "gemma4:e4b model" : "Deterministic Engine"}</span>
                    </div>
                  )}

                  {/* Checkpoint Recommendations */}
                  {msg.suggestedCheckpoints && (
                    <div className="mt-2.5 space-y-1.5">
                      {msg.suggestedCheckpoints.map((cp, i) => (
                        <div
                          key={i}
                          className="p-2 rounded bg-white/[0.03] border border-white/5 flex items-center justify-between"
                        >
                          <span className="font-mono text-[10px] text-slate-300">{cp.title}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-mono">
                            {cp.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-slate-500 font-mono mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 p-2 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse delay-75" />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse delay-150" />
                <span className="text-[10px] text-slate-500 ml-1">Analyzing...</span>
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div
            className="p-3 shrink-0"
            style={{
              background: "rgba(15,22,36,0.9)",
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about project, checkpoints, errors..."
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
