import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./emails/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "ignite-black": "#0A0A0A",
        "ignite-red": "#E11D2E",
        "ignite-red-hover": "#C7162A",
        "ignite-white": "#FFFFFF",
        "ignite-ink": "#111418",
        "ignite-muted": "#5B6169",
        "ignite-line": "#E6E7EA",
        "ignite-cream": "#F7F5F0",
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: [
          "clamp(2.75rem, 6vw + 1rem, 5.5rem)",
          { lineHeight: "1.02", letterSpacing: "-0.03em", fontWeight: "700" },
        ],
        h1: [
          "clamp(2rem, 3vw + 1rem, 3.25rem)",
          { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" },
        ],
        h2: [
          "clamp(1.5rem, 2vw + 0.75rem, 2.25rem)",
          { lineHeight: "1.15", letterSpacing: "-0.015em", fontWeight: "600" },
        ],
        h3: ["1.25rem", { lineHeight: "1.3", fontWeight: "600" }],
        eyebrow: [
          "0.75rem",
          { lineHeight: "1.2", letterSpacing: "0.12em", fontWeight: "600" },
        ],
        lead: ["1.125rem", { lineHeight: "1.6" }],
        body: ["1rem", { lineHeight: "1.65" }],
        small: ["0.875rem", { lineHeight: "1.5" }],
      },
      maxWidth: {
        container: "72rem",
      },
      spacing: {
        section: "clamp(4rem, 8vw, 8rem)",
      },
    },
  },
  plugins: [],
};

export default config;
