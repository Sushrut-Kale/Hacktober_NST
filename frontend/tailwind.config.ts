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
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        glow: "0 0 30px -5px rgba(0, 195, 255, 0.3), 0 0 8px -2px rgba(0, 195, 255, 0.15)",
        "glow-sm": "0 0 15px -3px rgba(0, 195, 255, 0.25)",
        "glow-emerald": "0 0 25px -5px rgba(16, 185, 129, 0.3)",
        "glow-rose": "0 0 25px -5px rgba(239, 68, 68, 0.3)",
        "glow-purple": "0 0 25px -5px rgba(139, 92, 246, 0.3)",
        "inner-glow": "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.1)",
        card: "0 4px 24px -4px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0,0,0,0.3)",
        "card-hover": "0 12px 40px -8px rgba(0, 0, 0, 0.5), 0 0 20px -5px rgba(0, 195, 255, 0.08)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-brand": "linear-gradient(135deg, #00c3ff 0%, #7c3aed 100%)",
        "gradient-emerald": "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
        "mesh": "radial-gradient(ellipse 70% 40% at 50% -10%, rgba(0, 195, 255, 0.07) 0%, transparent 70%), radial-gradient(ellipse 50% 30% at 90% 20%, rgba(139, 92, 246, 0.05) 0%, transparent 60%), #07090e",
      },
      animation: {
        "slide-up": "slideUp 0.25s ease-out forwards",
        "slide-down": "slideDown 0.2s ease-out forwards",
        "fade-in": "fadeIn 0.3s ease-out forwards",
        "spin-slow": "spin 8s linear infinite",
        "ping-slow": "ping-slow 2.5s cubic-bezier(0, 0, 0.2, 1) infinite",
        "border-glow": "borderGlow 2.5s ease-in-out infinite",
        shimmer: "shimmer 1.5s infinite",
        scanline: "scanline 6s linear infinite",
        "count-up": "countUp 0.4s ease-out forwards",
        "pulse-brand": "pulseBrand 2s ease-in-out infinite",
      },
      keyframes: {
        slideUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "ping-slow": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "75%, 100%": { transform: "scale(2)", opacity: "0" },
        },
        borderGlow: {
          "0%, 100%": { borderColor: "rgba(0, 195, 255, 0.2)" },
          "50%": { borderColor: "rgba(0, 195, 255, 0.6)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { transform: "translateY(100vh)", opacity: "0" },
        },
        countUp: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseBrand: {
          "0%, 100%": { boxShadow: "0 0 15px -3px rgba(0, 195, 255, 0.2)" },
          "50%": { boxShadow: "0 0 30px -3px rgba(0, 195, 255, 0.5)" },
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
export default config;
