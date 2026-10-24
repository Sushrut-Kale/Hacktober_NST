"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderGit2,
  FolderPlus,
  CheckSquare,
  PlusCircle,
  Terminal,
  Scale,
  ShieldCheck,
  AlertTriangle,
  History,
  Lock,
  FileText,
  Cpu,
  Settings,
  Shield,
  Layers,
  X,
} from "lucide-react";
import { NAVIGATION_SECTIONS } from "@/lib/constants";

const ICON_MAP: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="w-4 h-4" />,
  FolderGit2: <FolderGit2 className="w-4 h-4" />,
  FolderPlus: <FolderPlus className="w-4 h-4" />,
  CheckSquare: <CheckSquare className="w-4 h-4" />,
  PlusCircle: <PlusCircle className="w-4 h-4" />,
  Terminal: <Terminal className="w-4 h-4" />,
  Scale: <Scale className="w-4 h-4" />,
  ShieldCheck: <ShieldCheck className="w-4 h-4" />,
  AlertTriangle: <AlertTriangle className="w-4 h-4" />,
  History: <History className="w-4 h-4" />,
  Lock: <Lock className="w-4 h-4" />,
  FileText: <FileText className="w-4 h-4" />,
  Cpu: <Cpu className="w-4 h-4" />,
  Settings: <Settings className="w-4 h-4" />,
};

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  // Close drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop (visible on all screen sizes when drawer is open) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm transition-opacity duration-300"
          onClick={onClose}
          aria-label="Close navigation drawer"
        />
      )}

      {/* Drawer Panel */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 max-w-[85vw] flex flex-col transition-transform duration-300 ease-out shadow-2xl ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "rgba(8, 20, 38, 0.98)",
          borderRight: "1px solid rgba(255, 255, 255, 0.10)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Ambient top glow inside drawer */}
        <div
          className="pointer-events-none absolute top-0 left-0 right-0 h-40 z-0"
          style={{
            background:
              "radial-gradient(ellipse 100% 80% at 50% 0%, rgba(88, 170, 225, 0.12) 0%, transparent 70%)",
          }}
        />

        {/* Logo / Brand Header & Close Button */}
        <div
          className="h-16 px-5 flex items-center justify-between shrink-0 z-10 relative"
          style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.10)" }}
        >
          {/* Logo navigates to landing page '/' */}
          <Link
            href="/"
            className="flex items-center gap-3 group"
            onClick={onClose}
            title="VIKASA - Return to Home"
          >
            {/* Animated logo icon */}
            <div
              className="relative flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
              style={{
                background: "linear-gradient(135deg, #58AAE1 0%, #244B78 100%)",
              }}
            >
              <Shield className="w-5 h-5 text-white" />
              <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(88, 170, 225, 0.4) 0%, rgba(36, 75, 120, 0.4) 100%)",
                  filter: "blur(6px)",
                }}
              />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className="font-extrabold tracking-wider text-[15px] text-[#F1F4F8]"
                  style={{ letterSpacing: "0.05em" }}
                >
                  VIKASA
                </span>
                <span
                  className="px-1.5 py-px text-[9px] font-bold font-mono uppercase rounded"
                  style={{
                    background: "rgba(88, 170, 225, 0.14)",
                    color: "#9EDCFF",
                    border: "1px solid rgba(88, 170, 225, 0.3)",
                  }}
                >
                  AI
                </span>
              </div>
              <span className="text-[10px] text-[#718198] font-mono tracking-tight block leading-none mt-0.5">
                Verification Platform
              </span>
            </div>
          </Link>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1.5 text-[#A4B2C5] hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Close navigation drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 z-10 relative">
          {NAVIGATION_SECTIONS.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#718198]">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                        isActive
                          ? "text-[#F1F4F8]"
                          : "text-[#A4B2C5] hover:text-[#F1F4F8] hover:bg-white/[0.04]"
                      }`}
                      style={
                        isActive
                          ? {
                              background: "rgba(88, 170, 225, 0.12)",
                              boxShadow:
                                "inset 3px 0 0 #58AAE1, 0 0 20px -5px rgba(88, 170, 225, 0.2)",
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`shrink-0 transition-colors duration-150 ${
                            isActive
                              ? "text-[#58AAE1]"
                              : "text-[#718198] group-hover:text-[#A4B2C5]"
                          }`}
                          style={
                            isActive
                              ? {
                                  filter: "drop-shadow(0 0 6px rgba(88, 170, 225, 0.5))",
                                }
                              : undefined
                          }
                        >
                          {ICON_MAP[item.iconName] || <Layers className="w-4 h-4" />}
                        </span>
                        <span className={isActive ? "font-semibold" : ""}>
                          {item.name}
                        </span>
                      </div>

                      {item.badge && (
                        <span
                          className="px-1.5 py-px text-[9px] font-bold uppercase rounded"
                          style={{
                            background: "rgba(88, 170, 225, 0.15)",
                            color: "#9EDCFF",
                            border: "1px solid rgba(88, 170, 225, 0.3)",
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Invariant Footer */}
        <div
          className="p-3 z-10 relative"
          style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}
        >
          <div
            className="p-3 rounded-xl"
            style={{
              background: "rgba(16, 185, 129, 0.05)",
              border: "1px solid rgba(16, 185, 129, 0.18)",
            }}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span>Core Invariant Active</span>
            </div>
            <p className="text-[10px] text-[#A4B2C5] leading-snug font-mono">
              AI claims never decide verdicts. Only deterministic rules & code
              evidence govern verification.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
