import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  glow?: boolean;
  borderVariant?: "default" | "brand" | "emerald" | "rose" | "purple";
  lift?: boolean;
}

export function Card({
  children,
  className = "",
  glow = false,
  borderVariant = "default",
  lift = false,
  ...props
}: CardProps) {
  const borderStyles: Record<string, React.CSSProperties> = {
    default: {
      background: "rgba(11, 16, 27, 0.85)",
      borderColor: "rgba(255,255,255,0.08)",
      backdropFilter: "blur(12px)",
    },
    brand: {
      background: "rgba(11, 16, 27, 0.85)",
      borderColor: "rgba(0,195,255,0.25)",
      boxShadow: "0 0 30px -8px rgba(0,195,255,0.15), inset 0 1px 0 rgba(0,195,255,0.06)",
      backdropFilter: "blur(12px)",
    },
    emerald: {
      background: "rgba(11, 16, 27, 0.85)",
      borderColor: "rgba(16,185,129,0.25)",
      boxShadow: "0 0 30px -8px rgba(16,185,129,0.15), inset 0 1px 0 rgba(16,185,129,0.05)",
      backdropFilter: "blur(12px)",
    },
    rose: {
      background: "rgba(11, 16, 27, 0.85)",
      borderColor: "rgba(239,68,68,0.25)",
      boxShadow: "0 0 30px -8px rgba(239,68,68,0.15), inset 0 1px 0 rgba(239,68,68,0.05)",
      backdropFilter: "blur(12px)",
    },
    purple: {
      background: "rgba(11, 16, 27, 0.85)",
      borderColor: "rgba(139,92,246,0.25)",
      boxShadow: "0 0 30px -8px rgba(139,92,246,0.15), inset 0 1px 0 rgba(139,92,246,0.05)",
      backdropFilter: "blur(12px)",
    },
  };

  return (
    <div
      className={`relative rounded-xl border overflow-hidden transition-all duration-200 ${lift ? "card-lift" : ""} ${className}`}
      style={borderStyles[borderVariant]}
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
      className={`px-6 py-4 flex items-center justify-between ${className}`}
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
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
      className={`px-6 py-3 flex items-center justify-between ${className}`}
      style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}
    >
      {children}
    </div>
  );
}
