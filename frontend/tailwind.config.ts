import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Speclyn exact palette — see docs/SPECLYN_FULL_BUILD.md
        background: "#0F1117",
        surface: "#1A1D27",
        border: "#2D3748",
        primary: "#3B82F6",
        success: "#10B981",
        warning: "#F59E0B",
        foreground: "#F9FAFB", // text primary
        muted: "#9CA3AF", // text secondary
      },
      keyframes: {
        wave: {
          "0%, 100%": { transform: "scaleY(0.25)" },
          "50%": { transform: "scaleY(1)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "pulse-red": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 rgba(239, 68, 68, 0.6)" },
          "50%": { opacity: "0.6", boxShadow: "0 0 0 6px rgba(239, 68, 68, 0)" },
        },
      },
      animation: {
        wave: "wave 1.1s ease-in-out infinite",
        blink: "blink 1s step-end infinite",
        "pulse-red": "pulse-red 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
