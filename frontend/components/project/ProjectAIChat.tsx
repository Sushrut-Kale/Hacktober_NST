"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Sparkles,
  Send,
  Bot,
  User,
  Copy,
  Check,
  FileCode,
  ShieldCheck,
  Cpu,
  RefreshCw,
} from "lucide-react";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  grounded_files?: string[];
  handoff_prompt?: string;
  generator_status?: string;
}

export function ProjectAIChat({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Hello! I am the VIKASA Development Intelligence Assistant, grounded in your project's repository code, architecture, and Claim vs Reality matrix. How can I help you implement or verify code today?",
      generator_status: "AI_ACTIVE",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput("");
    const newHistory: ChatMsg[] = [...messages, { role: "user", content: userText }];
    setMessages(newHistory);
    setLoading(true);

    try {
      const apiHistory = newHistory.map((m) => ({ role: m.role, content: m.content }));
      const res = await api.sendProjectChat(projectId, userText, apiHistory);

      if (res.data) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.data.response,
            grounded_files: res.data.grounded_files,
            handoff_prompt: res.data.suggested_handoff_prompt,
            generator_status: res.data.generator_status,
          },
        ]);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error connecting to the intelligence engine.",
          generator_status: "AI_UNAVAILABLE",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyPrompt = (promptText: string, idx: number) => {
    navigator.clipboard.writeText(promptText);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="flex flex-col h-[600px] rounded-xl border border-white/5 bg-black/40 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-white">VIKASA Repository Intelligence Assistant</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Cpu className="w-3 h-3" />
          <span>STATUS: AI_ACTIVE (Ollama / Fallback Resilient)</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, idx) => {
          const isAssistant = m.role === "assistant";
          return (
            <div
              key={idx}
              className={`flex items-start gap-3 text-xs ${
                isAssistant ? "justify-start" : "justify-end"
              }`}
            >
              {isAssistant && (
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 text-cyan-400">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-xl p-3.5 space-y-2.5 leading-relaxed ${
                  isAssistant
                    ? "bg-white/[0.03] border border-white/5 text-slate-200"
                    : "bg-cyan-500/15 border border-cyan-500/30 text-white"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>

                {/* Grounded references */}
                {isAssistant && m.grounded_files && m.grounded_files.length > 0 && (
                  <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                    <span className="text-slate-500">Grounded files:</span>
                    {m.grounded_files.map((file, fIdx) => (
                      <span
                        key={fIdx}
                        className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 flex items-center gap-1"
                      >
                        <FileCode className="w-2.5 h-2.5 text-cyan-400" />
                        {file}
                      </span>
                    ))}
                  </div>
                )}

                {/* Antigravity Handoff Prompt Box */}
                {isAssistant && m.handoff_prompt && (
                  <div className="mt-2 p-2.5 rounded-lg bg-black/60 border border-cyan-500/30 font-mono text-[11px] text-slate-300">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10">
                      <span className="text-cyan-400 font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Antigravity IDE Handoff Prompt
                      </span>
                      <button
                        type="button"
                        onClick={() => copyPrompt(m.handoff_prompt!, idx)}
                        className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        {copiedIdx === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedIdx === idx ? "Copied" : "Copy Prompt"}
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap">{m.handoff_prompt}</pre>
                  </div>
                )}
              </div>

              {!isAssistant && (
                <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center shrink-0 text-slate-300">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            Generating grounded analysis...
          </div>
        )}
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSend} className="p-3 border-t border-white/5 bg-white/[0.01] flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about the project's architecture, missing features, or code..."
          className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={loading || !input.trim()}
          className="h-8 px-3 text-xs flex items-center gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />
          Send
        </Button>
      </form>
    </div>
  );
}
