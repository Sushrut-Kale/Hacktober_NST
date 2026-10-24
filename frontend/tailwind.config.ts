import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./fixtures/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#07090e",
        surface: {
          50: "#131b2c",
          100: "#0f1624",
          200: "#0b101b",
          DEFAULT: "#0b101b",
          border: "rgba(255, 255, 255, 0.08)",
          hover: "rgba(255, 255, 255, 0.04)",
        },
        brand: {
          50: "#e0f7ff",
          100: "#b9edff",
          400: "#38bdf8",
          500: "#00c3ff",
          600: "#0284c7",
          glow: "rgba(0, 195, 255, 0.15)",
        },
        status: {
          verified: "#10b981",
          failed: "#ef4444",
          unverified: "#f59e0b",
          running: "#3b82f6",
          notrun: "#64748b",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-inter-tight)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        glow: "0 0 25px -5px rgba(0, 195, 255, 0.25)",
        "glow-sm": "0 0 15px -3px rgba(0, 195, 255, 0.2)",
        "glow-emerald": "0 0 25px -5px rgba(16, 185, 129, 0.25)",
        "glow-rose": "0 0 25px -5px rgba(239, 68, 68, 0.25)",
      },
    },
  },
  plugins: [],
};
export default config;
