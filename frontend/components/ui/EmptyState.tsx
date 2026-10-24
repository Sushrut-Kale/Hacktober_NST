import React from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-white/10 bg-[#0B1423]/40 ${className}`}
    >
      <div className="p-3.5 rounded-2xl bg-[#101D30] border border-white/10 text-[#58AAE1] mb-4 shadow-sm">
        <Icon className="w-8 h-8 opacity-90" />
      </div>
      <h3 className="text-base font-semibold text-[#F1F4F8] mb-1">{title}</h3>
      <p className="text-sm text-[#718198] max-w-md mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button variant="brand" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
