import React from "react";
import { GeneratorStatus } from "@/lib/types";
import { GENERATOR_STATUS_MAP } from "@/lib/constants";
import { Cpu } from "lucide-react";

interface ModelChipProps {
  status: GeneratorStatus;
  modelName?: string;
  className?: string;
}

export function ModelChip({
  status,
  modelName = "gemma4:e4b",
  className = "",
}: ModelChipProps) {
  const config = GENERATOR_STATUS_MAP[status] || GENERATOR_STATUS_MAP.AI_ACTIVE;

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.border} ${config.text} ${className}`}
      title={`Model Generator Status: ${config.label}`}
    >
      <Cpu className="w-3.5 h-3.5 shrink-0" />
      <span className="font-mono">{modelName}</span>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
    </div>
  );
}
