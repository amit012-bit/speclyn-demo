import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Speclyn design tokens — see docs/SPECLYN_DESIGN_SPEC.md §2.1
        // Backgrounds & borders
        background: "#0F1117",
        surface: "#1A1D27",
        elevated: "#232734", // dark-theme elevation = lighter surface
        border: "#2D3748", // decorative dividers only
        "border-strong": "#6B7280", // borders that alone identify a control
        // Text
        foreground: "#F9FAFB", // headings, button labels, key figures
        body: "#E5E7EB", // long-form prose
        muted: "#9CA3AF", // labels, metadata, placeholders (full opacity)
        faint: "#6B7280", // disabled text ONLY
        // Brand / interactive
        primary: "#3B82F6", // icons, borders, accents, large text
        "primary-strong": "#2563EB", // the ONLY filled-button background
        "primary-bright": "#60A5FA", // links, focus rings, ICD chips
        // Semantic
        success: "#10B981",
        "success-bright": "#34D399", // success TEXT on dark; revenue number
        warning: "#F59E0B",
        "warning-bright": "#FBBF24", // warning TEXT on dark
        danger: "#EF4444",
        "danger-bright": "#F87171", // error TEXT, Recording/LIVE labels
        "danger-strong": "#DC2626", // Stop Encounter filled button
        info: "#38BDF8", // HCC opportunity accents
      },
      fontFamily: {
        sans: ["var(--font-inter)", ...defaultTheme.fontFamily.sans],
        mono: ["var(--font-jetbrains-mono)", ...defaultTheme.fontFamily.mono],
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
        "skeleton-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
      },
      animation: {
        wave: "wave 1.1s ease-in-out infinite",
        blink: "blink 1s step-end infinite",
        "pulse-red": "pulse-red 1.4s ease-in-out infinite",
        "skeleton-pulse": "skeleton-pulse 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
