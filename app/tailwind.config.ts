import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        /* ─── shadcn 기본 컬러 (유지) ─────────────── */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        /* ─── FlowPack 전용 (fp.*) ─────────────────
         * 사용 예: className="bg-fp-blue text-white"
         *          className="border-fp-border-soft"
         *          className="text-fp-heading"
         * ─────────────────────────────────────────── */
        fp: {
          /* Primary (brand alias — brand 변수 변경 시 자동 반영) */
          primary:          "var(--fp-primary)",
          "primary-hover":  "var(--fp-primary-hover)",
          "primary-dark":   "var(--fp-primary-dark)",
          "primary-subtle": "var(--fp-primary-subtle)",
          "primary-light":  "var(--fp-primary-light)",
          "primary-border": "var(--fp-primary-border)",
          /* 하위 호환용 (blue alias) */
          blue:             "var(--fp-blue)",
          "blue-hover":     "var(--fp-blue-hover)",
          "blue-subtle":    "var(--fp-blue-subtle)",
          "blue-light":     "var(--fp-blue-light)",
          "blue-border":    "var(--fp-blue-border)",
          /* Brand Accent */
          indigo:           "var(--fp-indigo)",
          "indigo-subtle":  "var(--fp-indigo-subtle)",
          violet:           "var(--fp-violet)",
          "violet-subtle":  "var(--fp-violet-subtle)",
          /* Gray System */
          heading:          "var(--fp-heading)",
          body:             "var(--fp-body)",
          secondary:        "var(--fp-secondary)",
          muted:            "var(--fp-muted)",
          border:           "var(--fp-border)",
          "border-soft":    "var(--fp-border-soft)",
          "section-bg":     "var(--fp-section-bg)",
          white:            "var(--fp-white)",
          /* Semantic Status */
          success:          "var(--fp-success)",
          "success-bg":     "var(--fp-success-bg)",
          error:            "var(--fp-error)",
          "error-bg":       "var(--fp-error-bg)",
          warning:          "var(--fp-warning)",
          "warning-bg":     "var(--fp-warning-bg)",
          info:             "var(--fp-info)",
          "info-bg":        "var(--fp-info-bg)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: [
          "Pretendard Variable",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "monospace"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
