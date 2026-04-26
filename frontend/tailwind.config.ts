import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#EEF6FC",
          100: "#D4E8F5",
          200: "#B8D6EA",
          300: "#95C1DF",
          500: "#2E5F8A",
          700: "#1B3358",
          900: "#0D1B2A",
        },
        warm: {
          50: "#FDF6ED",
          300: "#E8B87A",
          700: "#A0622B",
          900: "#5C3D1E",
        },
        accent: {
          gold: "var(--accent-gold)",
        },
        brand: {
          ink: "var(--brand-ink)",
          "ink-strong": "var(--brand-ink-strong)",
        },
      },
      fontFamily: {
        display: ['"Noto Serif SC"', "SimSun", "serif"],
        body: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', "sans-serif"],
        poem: ['"Noto Serif SC"', "serif"],
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        typing: {
          "0%": { width: "0%" },
          "100%": { width: "100%" },
        },
        caretBlink: {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
      },
      animation: {
        "fade-up": "fadeUp 420ms ease-out",
        typing: "typing 1.6s steps(40, end)",
        "caret-blink": "caretBlink 1s step-end infinite",
      },
      boxShadow: {
        ink: "0 8px 32px rgba(13, 27, 42, 0.12)",
      },
      backgroundImage: {
        "paper-grain":
          "radial-gradient(circle at 25% 25%, rgba(13,27,42,0.035) 0.6px, transparent 0.6px)",
      },
      backgroundSize: {
        grain: "8px 8px",
      },
    },
  },
  plugins: [],
};

export default config;
