import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  glow?: boolean;
  borderVariant?: "default" | "brand" | "emerald" | "rose";
}

export function Card({
  children,
  className = "",
  glow = false,
  borderVariant = "default",
  ...props
}: CardProps) {
  const borderClasses = {
    default: "border-white/10 hover:border-white/15",
    brand: "border-brand-500/30 hover:border-brand-500/50 shadow-glow-sm",
    emerald: "border-emerald-500/30 hover:border-emerald-500/50 shadow-glow-emerald",
    rose: "border-rose-500/30 hover:border-rose-500/50 shadow-glow-rose",
  };

  return (
    <div
      className={`relative rounded-xl bg-surface-200/90 backdrop-blur-md border ${borderClasses[borderVariant]} transition-all duration-200 overflow-hidden ${
        glow ? "shadow-glow-sm" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`px-6 py-4 border-b border-white/5 flex items-center justify-between ${className}`}
    >
      {children}
    </div>
  );
}

export function CardContent({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

export function CardFooter({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`px-6 py-3 border-t border-white/5 bg-white/[0.02] flex items-center justify-between ${className}`}
    >
      {children}
    </div>
  );
}
