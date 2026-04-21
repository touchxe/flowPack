import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  // 라이트 전용 앱 — darkMode 비활성
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
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        /* ── shadcn 기본 (CSS 변수 연결) ── */
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        /* ══════════════════════════════════════════════
           Wellune 디자인 토큰 — CSS 변수 연결
           사용법: className="bg-brand-500 text-sb-text"
        ══════════════════════════════════════════════ */

        /* Brand Blue */
        brand: {
          "50":  "var(--brand-50)",
          "100": "var(--brand-100)",
          "200": "var(--brand-200)",
          "300": "var(--brand-300)",
          "400": "var(--brand-400)",
          "500": "var(--brand-500)",
          "600": "var(--brand-600)",
          "700": "var(--brand-700)",
          "800": "var(--brand-800)",
        },

        /* Sidebar 다크 네이비 */
        sb: {
          bg:     "var(--sb-bg)",
          hover:  "var(--sb-hover)",
          active: "var(--sb-active)",
          text:   "var(--sb-text)",
          muted:  "var(--sb-muted)",
          accent: "var(--sb-accent)",
        },

        /* 페이지 / 카드 배경 */
        page:   "var(--fp-page-bg)",
        canvas: "var(--fp-card-bg)",

        /* Wellune 텍스트 */
        wl: {
          primary:   "var(--fp-heading)",    /* #1A2332 */
          secondary: "var(--fp-secondary)",  /* #5A6A7A */
          muted:     "var(--fp-muted)",      /* #94A3B8 */
        },

        /* Wellune 보더 */
        "wl-border":        "var(--fp-border)",
        "wl-border-soft":   "var(--fp-border-soft)",
        "wl-border-strong": "var(--fp-border-strong)",

        /* 상태 색상 */
        status: {
          emergency: "var(--fp-emergency)",
          warning:   "var(--fp-warning)",
          success:   "var(--fp-success)",
          info:      "var(--fp-info)",
          inactive:  "var(--fp-inactive)",
        },

        /* 상태 배경 */
        "status-bg": {
          emergency: "var(--fp-emergency-bg)",
          warning:   "var(--fp-warning-bg)",
          success:   "var(--fp-success-bg)",
          info:      "var(--fp-info-bg)",
          inactive:  "var(--fp-inactive-bg)",
        },

        /* 차트 */
        chart: {
          blue:   "var(--chart-blue)",
          red:    "var(--chart-red)",
          green:  "var(--chart-green)",
          orange: "var(--chart-orange)",
          purple: "var(--chart-purple)",
          cyan:   "var(--chart-cyan)",
          gray:   "var(--chart-gray)",
        },

        /* ── FlowPack 전용 (레거시 fp.* 유지) ── */
        fp: {
          primary:          "var(--fp-primary)",
          "primary-hover":  "var(--fp-primary-hover)",
          "primary-dark":   "var(--fp-primary-dark)",
          "primary-subtle": "var(--fp-primary-subtle)",
          "primary-light":  "var(--fp-primary-light)",
          "primary-border": "var(--fp-primary-border)",
          blue:             "var(--fp-blue)",
          "blue-hover":     "var(--fp-blue-hover)",
          "blue-subtle":    "var(--fp-blue-subtle)",
          "blue-light":     "var(--fp-blue-light)",
          "blue-border":    "var(--fp-blue-border)",
          cyan:             "var(--fp-cyan)",
          "cyan-subtle":    "var(--fp-cyan-subtle)",
          indigo:           "var(--fp-indigo)",
          "indigo-subtle":  "var(--fp-indigo-subtle)",
          violet:           "var(--fp-violet)",
          "violet-subtle":  "var(--fp-violet-subtle)",
          heading:          "var(--fp-heading)",
          body:             "var(--fp-body)",
          secondary:        "var(--fp-secondary)",
          muted:            "var(--fp-muted)",
          border:           "var(--fp-border)",
          "border-soft":    "var(--fp-border-soft)",
          "border-strong":  "var(--fp-border-strong)",
          "section-bg":     "var(--fp-section-bg)",
          "page-bg":        "var(--fp-page-bg)",
          "card-bg":        "var(--fp-card-bg)",
          white:            "var(--fp-white)",
          success:          "var(--fp-success)",
          "success-bg":     "var(--fp-success-bg)",
          "success-text":   "var(--fp-success-text)",
          error:            "var(--fp-error)",
          "error-bg":       "var(--fp-error-bg)",
          warning:          "var(--fp-warning)",
          "warning-bg":     "var(--fp-warning-bg)",
          "warning-text":   "var(--fp-warning-text)",
          info:             "var(--fp-info)",
          "info-bg":        "var(--fp-info-bg)",
          "info-text":      "var(--fp-info-text)",
          emergency:        "var(--fp-emergency)",
          "emergency-bg":   "var(--fp-emergency-bg)",
          "emergency-text": "var(--fp-emergency-text)",
          inactive:         "var(--fp-inactive)",
          "inactive-bg":    "var(--fp-inactive-bg)",
          "inactive-text":  "var(--fp-inactive-text)",
        },
      },

      /* ── Box Shadow (Wellune 기준) ── */
      boxShadow: {
        card:       "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
        "fp-1":     "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
        "fp-2":     "0 4px 12px rgba(0,0,0,0.06)",
        "fp-3":     "0 8px 24px rgba(0,0,0,0.08)",
        "fp-4":     "0 20px 40px rgba(0,0,0,0.12)",
        glow:       "0 4px 14px rgba(59,130,246,0.30)",
      },

      /* ── Border Radius ── */
      borderRadius: {
        lg:   "var(--radius)",                   /* 10px */
        md:   "calc(var(--radius) - 2px)",       /* 8px */
        sm:   "calc(var(--radius) - 4px)",       /* 6px */
        xl:   "calc(var(--radius) + 2px)",       /* 12px */
        "2xl": "calc(var(--radius) + 6px)",      /* 16px */
        "fp-btn":  "var(--fp-radius-btn)",
        "fp-card": "var(--fp-radius-card)",
      },

      /* ── 폰트 ── */
      fontFamily: {
        sans: ["Pretendard Variable", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },

      /* ── 애니메이션 ── */
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-down": {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "fade-in":        "fade-in 0.2s ease-out",
        "slide-in-down":  "slide-in-down 0.15s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
