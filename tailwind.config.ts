import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0F",
        surface: "#111118",
        border: "rgba(255,255,255,0.06)",
        primary: "#7C6EF8",
        accent: "#3ECFCF",
        text: "#F0EFF8",
        "text-muted": "#7A798A",
        "score-high": "#22D3A5",
        "score-mid": "#F59E0B",
        "score-low": "#EF4444",
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        7: "28px",
        8: "32px",
        10: "40px",
        12: "48px",
        14: "56px",
        16: "64px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      boxShadow: {
        soft: "0 20px 80px rgba(0, 0, 0, 0.45)",
      },
      animation: {
        "loading-shimmer": "loadingShimmer 1.2s linear infinite",
        mesh: "meshShift 20s ease-in-out infinite",
      },
      keyframes: {
        loadingShimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        meshShift: {
          "0%": { transform: "translate3d(0%, 0%, 0) scale(1)" },
          "50%": { transform: "translate3d(-1%, 1%, 0) scale(1.02)" },
          "100%": { transform: "translate3d(0%, 0%, 0) scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
