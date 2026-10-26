"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Code,
  FileCode,
  FolderGit2,
  History,
  Layers,
  RefreshCw,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";

interface ReplayEvent {
  id: string;
  timestamp: string;
  event_type: string;
  description: string;
  author: string;
  metadata: Record<string, any>;
}

export function ReplayTimeline({ projectId }: { projectId: string }) {
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<ReplayEvent | null>(null);

  useEffect(() => {
    loadReplay();
  }, [projectId]);

  const loadReplay = async () => {
    setLoading(true);
    try {
      const res = await api.getProjectReplay(projectId);
      if (res.data?.events) {
        setEvents(res.data.events);
        if (res.data.events.length > 0) {
          setSelectedEvent(res.data.events[res.data.events.length - 1]);
        }
      }
    } catch (e) {
      console.error("Failed to load replay history", e);
    } finally {
      setLoading(false);
    }
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case "PROJECT_CREATED":
        return { label: "CREATED", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", icon: FolderGit2 };
      case "REPOSITORY_SCANNED":
        return { label: "SCANNED", color: "text-purple-400 bg-purple-500/10 border-purple-500/20", icon: Code };
      case "TASK_CREATED":
        return { label: "TASK", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: Layers };
      case "TASK_APPROVED":
        return { label: "APPROVED", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: ShieldCheck };
      default:
        return { label: type, color: "text-slate-400 bg-slate-500/10 border-slate-500/20", icon: History };
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs font-mono text-slate-500">
        <RefreshCw className="w-5 h-5 mx-auto mb-3 animate-spin text-cyan-400" />
        Loading historical event timeline...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
      {/* Left: Timeline List */}
      <div className="md:col-span-7 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div>
            <h3 className="text-sm font-semibold text-white">Project Activity & State Replay</h3>
            <p className="text-xs text-slate-400">
              Chronologically recorded events from scans, task creations, human approvals, and verifications.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {events.length} recorded events
          </span>
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 font-mono">
            No events recorded yet.
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/5">
            {events.map((evt, idx) => {
              const badge = getEventBadge(evt.event_type);
              const Icon = badge.icon;
              const isSelected = selectedEvent?.id === evt.id;

              return (
                <div
                  key={evt.id || idx}
                  onClick={() => setSelectedEvent(evt)}
                  className={`relative p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-cyan-500/10 border-cyan-500/40 shadow-lg shadow-cyan-500/5"
                      : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03]"
                  }`}
                >
                  {/* Timeline dot */}
                  <div
                    className={`absolute -left-[27px] top-4 w-3 h-3 rounded-full border-2 ${
                      isSelected
                        ? "bg-cyan-400 border-black"
                        : "bg-slate-700 border-slate-900"
                    }`}
                  />

                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1 ${badge.color}`}>
                      <Icon className="w-3 h-3" />
                      {badge.label}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(evt.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div className="text-xs font-medium text-slate-200 mt-1">
                    {evt.description}
                  </div>

                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>Actor: {evt.author}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: Selected Event Inspector */}
      <div className="md:col-span-5 rounded-xl border border-white/5 bg-black/40 p-5 flex flex-col h-[550px] overflow-hidden">
        <h4 className="text-xs font-semibold text-slate-300 pb-2 mb-3 border-b border-white/5 flex items-center gap-1.5">
          <History className="w-4 h-4 text-cyan-400" />
          Event Telemetry & Replay Snapshot
        </h4>

        {selectedEvent ? (
          <div className="space-y-4 flex-1 overflow-auto">
            <div>
              <div className="text-[11px] text-slate-500 uppercase font-mono">Event Type</div>
              <div className="text-xs font-semibold text-white mt-0.5">
                {selectedEvent.event_type}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 uppercase font-mono">Timestamp</div>
              <div className="text-xs text-slate-300 font-mono mt-0.5">
                {new Date(selectedEvent.timestamp).toISOString()}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 uppercase font-mono">Description</div>
              <div className="text-xs text-slate-200 mt-0.5">
                {selectedEvent.description}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 uppercase font-mono">Author / Trigger</div>
              <div className="text-xs text-slate-300 font-mono mt-0.5">
                {selectedEvent.author}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 uppercase font-mono mb-1">Metadata Snapshot</div>
              <div className="p-3 rounded-lg bg-black/60 border border-white/10 font-mono text-[11px] text-slate-300 max-h-56 overflow-auto">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(selectedEvent.metadata, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-500 font-mono">
            Select an event from the timeline to inspect its recorded telemetry.
          </div>
        )}
      </div>
    </div>
  );
}
