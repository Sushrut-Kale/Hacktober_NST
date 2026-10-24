import React from "react";
import { getStatusBadge, getTestStatusBadge } from "@/lib/formatters";

interface BadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
  isTestStatus?: boolean;
  className?: string;
}

export function Badge({
  status,
  size = "md",
  isTestStatus = false,
  className = "",
}: BadgeProps) {
  const badgeConfig = isTestStatus
    ? getTestStatusBadge(status as any)
    : getStatusBadge(status);

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs font-medium",
    md: "px-2.5 py-1 text-xs font-semibold",
    lg: "px-3 py-1.5 text-sm font-semibold",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border tracking-wide uppercase ${badgeConfig.bg} ${badgeConfig.border} ${badgeConfig.text} ${sizeClasses[size]} ${className}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor:
            status === "VERIFIED" || status === "PASS"
              ? "#10b981"
              : status === "FAILED" || status === "FAIL"
              ? "#ef4444"
              : status === "RUNNING"
              ? "#3b82f6"
              : "#f59e0b",
        }}
      />
      {badgeConfig.label}
    </span>
  );
}
