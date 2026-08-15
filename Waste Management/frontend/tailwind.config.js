/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens resolve to CSS variables so light and true-AMOLED
        // dark share one component layer (plan §9).
        surface: 'rgb(var(--surface) / <alpha-value>)',
        elevated: 'rgb(var(--elevated) / <alpha-value>)',
        sunken: 'rgb(var(--sunken) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        faint: 'rgb(var(--faint) / <alpha-value>)',
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          soft: 'rgb(var(--brand-soft) / <alpha-value>)',
          ink: 'rgb(var(--brand-ink) / <alpha-value>)',
        },
        warn: 'rgb(var(--warn) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)',
        ok: 'rgb(var(--ok) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Fluid type — one scale that works from a 360px phone to a 1440px desk.
        'fluid-xs': 'clamp(0.7rem, 0.68rem + 0.1vw, 0.75rem)',
        'fluid-sm': 'clamp(0.8rem, 0.77rem + 0.15vw, 0.875rem)',
        'fluid-base': 'clamp(0.9rem, 0.86rem + 0.2vw, 1rem)',
        'fluid-lg': 'clamp(1.05rem, 0.98rem + 0.35vw, 1.25rem)',
        'fluid-xl': 'clamp(1.25rem, 1.1rem + 0.7vw, 1.75rem)',
        'fluid-2xl': 'clamp(1.6rem, 1.3rem + 1.4vw, 2.5rem)',
        'fluid-3xl': 'clamp(2rem, 1.4rem + 2.8vw, 4rem)',
      },
      spacing: {
        // Safe-area insets so the installed PWA clears the notch and home bar.
        'safe-t': 'env(safe-area-inset-top)',
        'safe-b': 'env(safe-area-inset-bottom)',
        touch: '44px', // minimum touch target
      },
      borderRadius: { xl: '0.9rem', '2xl': '1.25rem', '3xl': '1.75rem' },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -12px rgb(0 0 0 / 0.12)',
        lift: '0 2px 8px rgb(0 0 0 / 0.06), 0 20px 48px -20px rgb(0 0 0 / 0.24)',
        glow: '0 0 0 1px rgb(var(--brand) / 0.25), 0 8px 32px -8px rgb(var(--brand) / 0.4)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in': { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in': 'slide-in 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
        'sheet-up': 'sheet-up 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.24, 0, 0.38, 1) infinite',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
