import React from "react";
import { parseGitDiff } from "@/lib/formatters";
import { FileCode, Copy, Check } from "lucide-react";

interface DiffViewerProps {
  diff?: string | null;
  title?: string;
  className?: string;
}

export function DiffViewer({
  diff,
  title = "Repository Changes (Git Diff)",
  className = "",
}: DiffViewerProps) {
  const [copied, setCopied] = React.useState(false);
  const lines = parseGitDiff(diff);

  const handleCopy = () => {
    if (!diff) return;
    navigator.clipboard.writeText(diff);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!diff || lines.length === 0) {
    return (
      <div className="p-6 text-center rounded-xl bg-[#0B1423] border border-white/5 text-[#718198]">
        <FileCode className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm font-medium">No Git diff recorded for this execution.</p>
        <p className="text-xs text-[#718198] mt-1">Changes may not have modified files in the working directory.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-white/10 overflow-hidden bg-[#05080F] ${className}`}>
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0B1423] border-b border-white/10">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-[#58AAE1]" />
          <span className="text-xs font-mono text-[#F1F4F8] font-semibold">{title}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-[#A4B2C5] hover:text-[#F1F4F8] rounded bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          title="Copy diff to clipboard"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "Copied" : "Copy Diff"}</span>
        </button>
      </div>
      <div className="overflow-x-auto p-4 font-mono text-xs leading-relaxed max-h-[500px]">
        {lines.map((l, i) => {
          let lineStyle = "text-[#A4B2C5]";
          let bgStyle = "";
          if (l.type === "header") {
            lineStyle = "text-[#58AAE1] font-semibold";
            bgStyle = "bg-[#58AAE1]/10";
          } else if (l.type === "add") {
            lineStyle = "text-emerald-300 font-medium";
            bgStyle = "bg-emerald-500/10";
          } else if (l.type === "delete") {
            lineStyle = "text-rose-300 font-medium";
            bgStyle = "bg-rose-500/10";
          }

          return (
            <div
              key={i}
              className={`flex items-start px-2 py-0.5 rounded font-mono ${bgStyle}`}
            >
              <span className="w-8 shrink-0 select-none text-[#718198] text-right pr-3">
                {i + 1}
              </span>
              <span className={`whitespace-pre select-text ${lineStyle}`}>
                {l.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
