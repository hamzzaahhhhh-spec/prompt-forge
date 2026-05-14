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
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-elevated": "var(--surface-elevated)",
        border: "var(--border)",
        "border-subtle": "var(--border-subtle)",
        accent: "var(--accent)",
        "accent-glow": "var(--accent-glow)",
        "accent-soft": "var(--accent-soft)",
        primary: "var(--accent)",
        text: "var(--text)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-secondary)",
        "score-high": "var(--score-high)",
        "score-mid": "var(--score-mid)",
        "score-low": "var(--score-low)",
      },
      spacing: {
        "section": "140px",
        "18": "72px",
        "22": "88px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
        mono: ["var(--font-jetbrains)", "JetBrains Mono", "monospace"],
      },
      fontSize: {
        "hero": ["clamp(64px, 8vw, 140px)", { lineHeight: "0.95", letterSpacing: "-0.04em", fontWeight: "800" }],
        "heading": ["clamp(36px, 5vw, 64px)", { lineHeight: "1.1", letterSpacing: "-0.03em", fontWeight: "600" }],
        "body": ["17px", { lineHeight: "1.75", fontWeight: "400" }],
      },
      borderRadius: {
        "card": "var(--card-radius)",
        "btn": "var(--btn-radius)",
      },
      boxShadow: {
        soft: "0 20px 80px rgba(0, 0, 0, 0.45)",
        "card": "0 24px 80px rgba(0, 0, 0, 0.4)",
        "card-hover": "0 32px 100px rgba(0, 0, 0, 0.55)",
        "glow": "0 0 40px var(--accent-glow)",
        "glow-lg": "0 0 80px var(--accent-glow), 0 0 160px rgba(124, 58, 237, 0.08)",
      },
      animation: {
        "loading-shimmer": "shimmer 1.4s ease-in-out infinite",
        "ken-burns": "kenBurns 30s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
