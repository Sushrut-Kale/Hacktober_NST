import React from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "danger"
    | "ghost"
    | "brand"
    | "success";
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
    "inline-flex items-center justify-center font-semibold transition-all duration-200 rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none whitespace-nowrap hover:-translate-y-0.5 active:translate-y-0 hover:brightness-110 active:brightness-95 hover:shadow-md";

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2.5",
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: "#F1F4F8",
      color: "#05080F",
      boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
    },
    brand: {
      background: "linear-gradient(135deg, #58AAE1 0%, #244B78 100%)",
      color: "#FFFFFF",
      boxShadow:
        "0 0 20px -5px rgba(88,170,225,0.4), 0 2px 8px rgba(0,0,0,0.3)",
      border: "1px solid rgba(158,220,255,0.25)",
    },
    success: {
      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      color: "#FFFFFF",
      boxShadow:
        "0 0 20px -5px rgba(16,185,129,0.4), 0 2px 8px rgba(0,0,0,0.3)",
    },
    secondary: {
      background: "rgba(16, 29, 48, 0.8)",
      color: "#F1F4F8",
      border: "1px solid rgba(255, 255, 255, 0.10)",
    },
    outline: {
      background: "transparent",
      color: "#A4B2C5",
      border: "1px solid rgba(255, 255, 255, 0.14)",
    },
    danger: {
      background: "rgba(239, 68, 68, 0.10)",
      color: "#f87171",
      border: "1px solid rgba(239, 68, 68, 0.28)",
    },
    ghost: {
      background: "transparent",
      color: "#A4B2C5",
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
