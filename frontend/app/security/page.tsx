"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SecurityTestResult } from "@/lib/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/formatters";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Terminal,
  CheckCircle2,
  XCircle,
  FileCode,
  Info,
  RefreshCw,
} from "lucide-react";

export default function SecurityTestResultsPage() {
  const [tests, setTests] = useState<SecurityTestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadSecurityTests() {
    try {
      const res = await api.getSecurityTests();
      setTests(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSecurityTests();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadSecurityTests();
    setIsRefreshing(false);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400">
        Loading safe runner security test results...
      </div>
    );
  }

  const passedCount = tests.filter((t) => t.status === "PASS").length;
  const failedCount = tests.filter((t) => t.status === "FAIL").length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Lock className="w-6 h-6 text-emerald-400" />
              <span>Safe Execution Runner Security Tests</span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Verification of sandbox containment, shell injection prevention, and allowlisted binaries
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          loading={isRefreshing}
          onClick={handleRefresh}
          icon={<RefreshCw className="w-4 h-4" />}
        >
          Re-run Security Suite
        </Button>
      </div>

      {/* Security Invariant Alert */}
      <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-slate-300 flex items-start gap-3">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-emerald-300">Sandbox Invariant:</strong> The Safe Execution Runner strictly rejects arbitrary command strings. Compound operators (<code>&&</code>, <code>||</code>, <code>;</code>, <code>|</code>) and unallowlisted binaries trigger immediate HTTP 400 Bad Request before child process spawning.
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card borderVariant="emerald" className="p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase">
            Tests Passing
          </div>
          <div className="text-3xl font-extrabold font-mono text-emerald-400 mt-1">
            {passedCount} / {tests.length}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Zero security compromises
          </div>
        </Card>

        <Card borderVariant={failedCount > 0 ? "rose" : "default"} className="p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase">
            Security Violations
          </div>
          <div className={`text-3xl font-extrabold font-mono mt-1 ${failedCount > 0 ? "text-rose-400" : "text-white"}`}>
            {failedCount}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Sandbox escapes / leaks
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase">
            Binary Allowlist
          </div>
          <div className="text-xs font-mono text-sky-400 font-semibold mt-2">
            python, pytest, git
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            All other executables blocked
          </div>
        </Card>
      </div>

      {/* Security Test Results List */}
      <div className="space-y-4">
        {tests.map((test) => (
          <Card
            key={test.id}
            borderVariant={test.status === "PASS" ? "emerald" : "rose"}
            className="p-5 space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono font-bold text-sky-400">
                  {test.id}
                </span>
                <span className="text-sm font-bold text-white">
                  {test.test_name}
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                  {test.category}
                </span>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  {test.severity}
                </span>
                <span
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold font-mono ${
                    test.status === "PASS"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {test.status === "PASS" ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  <span>{test.status}</span>
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              {test.description}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono pt-2">
              <div className="p-3 rounded-lg bg-surface-100 border border-white/5 space-y-1">
                <span className="text-slate-400 block text-[10px]">EXPECTED OUTCOME</span>
                <span className="text-slate-200">{test.expected_result}</span>
              </div>
              <div className="p-3 rounded-lg bg-surface-100 border border-white/5 space-y-1">
                <span className="text-slate-400 block text-[10px]">ACTUAL OUTCOME</span>
                <span className="text-emerald-400 font-semibold">{test.actual_result}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#07090e] border border-white/10 font-mono text-xs flex items-center justify-between text-slate-300">
              <span className="truncate">Evidence: {test.evidence}</span>
              <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                {formatDate(test.timestamp)}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
