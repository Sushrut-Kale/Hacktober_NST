import React from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost" | "brand" | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  className = "",
  style,
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center font-semibold transition-all duration-200 rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none whitespace-nowrap";

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2.5",
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: "#ffffff",
      color: "#0a0d14",
    },
    brand: {
      background: "linear-gradient(135deg, #00c3ff 0%, #0284c7 100%)",
      color: "#ffffff",
      boxShadow: "0 0 20px -5px rgba(0,195,255,0.4), 0 2px 8px rgba(0,0,0,0.3)",
    },
    success: {
      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      color: "#ffffff",
      boxShadow: "0 0 20px -5px rgba(16,185,129,0.4), 0 2px 8px rgba(0,0,0,0.3)",
    },
    secondary: {
      background: "rgba(255,255,255,0.05)",
      color: "#cbd5e1",
      border: "1px solid rgba(255,255,255,0.1)",
    },
    outline: {
      background: "transparent",
      color: "#94a3b8",
      border: "1px solid rgba(255,255,255,0.15)",
    },
    danger: {
      background: "rgba(239,68,68,0.08)",
      color: "#f87171",
      border: "1px solid rgba(239,68,68,0.25)",
    },
    ghost: {
      background: "transparent",
      color: "#94a3b8",
    },
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${className}`}
      style={{ ...variantStyles[variant], ...style }}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
}
