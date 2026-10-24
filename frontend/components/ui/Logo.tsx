"use client";

import React from "react";

interface LogoProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

export function Logo({ size = 36, className = "", glow = true }: LogoProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Outer ambient glow */}
      {glow && (
        <div
          className="absolute inset-0 rounded-xl opacity-60 blur-md pointer-events-none transition-all duration-300 group-hover:opacity-100 group-hover:scale-110"
          style={{
            background:
              "radial-gradient(circle, rgba(0,240,255,0.4) 0%, rgba(139,92,246,0.25) 50%, transparent 75%)",
          }}
        />
      )}

      {/* High-fidelity Vector SVG Logo */}
      <svg
        viewBox="0 0 128 128"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 w-full h-full drop-shadow-sm"
      >
        <defs>
          <linearGradient id="comp-bg" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0B0F19" />
            <stop offset="50%" stopColor="#080C14" />
            <stop offset="100%" stopColor="#04060A" />
          </linearGradient>

          <linearGradient id="comp-border" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#8B5CF6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.85" />
          </linearGradient>

          <linearGradient id="comp-left-wing" x1="26" y1="24" x2="64" y2="92" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F0FF" />
            <stop offset="50%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>

          <linearGradient id="comp-left-facet" x1="38" y1="24" x2="64" y2="84" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#818CF8" stopOpacity="0.3" />
          </linearGradient>

          <linearGradient id="comp-check-wing" x1="50" y1="92" x2="104" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="40%" stopColor="#00E5FF" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>

          <linearGradient id="comp-check-glow" x1="58" y1="84" x2="100" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="60%" stopColor="#E0F2FE" />
            <stop offset="100%" stopColor="#FFFFFF" />
          </linearGradient>

          <linearGradient id="comp-nexus" x1="56" y1="44" x2="72" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#00F0FF" />
          </linearGradient>

          <radialGradient id="comp-ambient" cx="64" cy="60" r="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#0B0F19" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Base Squircle Container */}
        <rect
          x="2"
          y="2"
          width="124"
          height="124"
          rx="28"
          fill="url(#comp-bg)"
          stroke="url(#comp-border)"
          strokeWidth="2.5"
        />

        {/* Ambient Core Glow */}
        <circle cx="64" cy="60" r="46" fill="url(#comp-ambient)" />

        {/* Cyber Nodes */}
        <path
          d="M16 40 H24 M104 40 H112 M16 88 H24 M104 88 H112"
          stroke="#00F0FF"
          strokeOpacity="0.3"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Left Wing of 'V' */}
        <path
          d="M26 26 C25 26 24 27 24 28.5 L24 33 C24 35 25 36.5 26.5 37.5 L56 86 C58 89.5 62 90 64.5 87 L67 84 L39 26 Z"
          fill="url(#comp-left-wing)"
        />

        {/* Left Inner Facet Accent */}
        <path d="M39 26 L49 26 L67 78 L61 84 Z" fill="url(#comp-left-facet)" />

        {/* Neural Cross-Beam */}
        <path
          d="M48 46 L64 58 L80 46 L64 38 Z"
          fill="#1E293B"
          stroke="#00F0FF"
          strokeOpacity="0.4"
          strokeWidth="1.5"
        />

        {/* Right Arm: Verification Checkmark */}
        <g>
          <path
            d="M46 58 L60 80 C61.5 82.5 65 83 67 80.5 L102 29 C103 27.5 102 25 100 25 L88 25 C86.5 25 85 26 84 27.5 L64 63 L54 48 C53 46.5 51 46 49.5 47 L46.5 49 C45 50 45 52.5 46 54 Z"
            fill="url(#comp-check-wing)"
          />
          <path
            d="M84 27.5 L100 25 L67 80.5 L64 74 L84 31 Z"
            fill="url(#comp-check-glow)"
            opacity="0.6"
          />
        </g>

        {/* Central Verification Nexus Star */}
        <g>
          <path
            d="M64 42 L66.5 50 L74.5 52.5 L66.5 55 L64 63 L61.5 55 L53.5 52.5 L61.5 50 Z"
            fill="url(#comp-nexus)"
          />
          <circle cx="64" cy="52.5" r="2" fill="#FFFFFF" />
        </g>

        {/* Lower Sentinel Status Node */}
        <circle cx="64.5" cy="95" r="3.5" fill="#10B981" />
        <circle cx="64.5" cy="95" r="1.5" fill="#E0F2FE" />
      </svg>
    </div>
  );
}

export function BrandLogo({ size = 36, subtitle = "Verification Platform" }: { size?: number; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 group">
      <Logo size={size} glow={true} />
      <div>
        <div className="flex items-center gap-1.5">
          <span
            className="font-extrabold tracking-wider text-[15px] text-white transition-colors duration-200 group-hover:text-cyan-400"
            style={{ letterSpacing: "0.06em" }}
          >
            VIKASA
          </span>
          <span
            className="px-1.5 py-px text-[9px] font-bold font-mono uppercase rounded transition-all duration-200"
            style={{
              background: "rgba(0,195,255,0.12)",
              color: "#00c3ff",
              border: "1px solid rgba(0,195,255,0.25)",
            }}
          >
            AI
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono tracking-tight block leading-none mt-0.5">
          {subtitle}
        </span>
      </div>
    </div>
  );
}
