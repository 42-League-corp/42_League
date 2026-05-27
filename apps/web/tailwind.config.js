/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        xs: '420px',
      },
      colors: {
        'bg-0': '#0b0f17',
        'bg-1': '#111827',
        'bg-2': '#1a2233',
        'bg-3': '#243044',
        border: '#243044',
        teal: {
          DEFAULT: '#00d9dc',
          dim: '#00babc',
          deep: '#007577',
        },
        gold: '#ffb71b',
        red: '#ff3b5c',
        muted: '#6b7689',
        'muted-2': '#95a3b8',
        text: '#e6ecf5',
        'text-strong': '#ffffff',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      spacing: {
        'safe-t': 'env(safe-area-inset-top)',
        'safe-b': 'env(safe-area-inset-bottom)',
        'safe-l': 'env(safe-area-inset-left)',
        'safe-r': 'env(safe-area-inset-right)',
        // Hauteur de la tab bar mobile (incl. safe-area-bottom)
        'tabbar': 'calc(60px + env(safe-area-inset-bottom))',
        // Hauteur du header mobile (incl. safe-area-top)
        'mheader': 'calc(56px + env(safe-area-inset-top))',
      },
      minHeight: {
        dvh: '100dvh',
        svh: '100svh',
        lvh: '100lvh',
      },
      height: {
        dvh: '100dvh',
        svh: '100svh',
        lvh: '100lvh',
      },
      maxHeight: {
        dvh: '100dvh',
        svh: '100svh',
      },
      boxShadow: {
        'teal-glow': '0 0 16px rgba(0, 217, 220, 0.35)',
        'teal-glow-lg': '0 0 32px rgba(0, 217, 220, 0.45)',
        'gold-glow': '0 0 16px rgba(255, 183, 27, 0.35)',
        'red-glow': '0 0 16px rgba(255, 59, 92, 0.35)',
        'sheet': '0 -8px 32px rgba(0, 0, 0, 0.5), 0 -2px 8px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 12px 24px -8px rgba(0, 217, 220, 0.25)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pop: {
          '0%': { transform: 'scale(0.92)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'sheet-down': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'bead-pulse': {
          '0%': { transform: 'scale(0.85)', opacity: '0.4' },
          '60%': { transform: 'scale(1.12)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'send-away': {
          '0%':   { opacity: '1', transform: 'perspective(700px) rotateX(0deg) rotateY(0deg) translateY(0px) scale(1)' },
          '30%':  { opacity: '1', transform: 'perspective(700px) rotateX(3deg) rotateY(-6deg) translateY(-6px) scale(1.02)' },
          '100%': { opacity: '0', transform: 'perspective(700px) rotateX(-8deg) rotateY(14deg) translateY(-28px) scale(0.87)' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 16px rgba(0, 217, 220, 0.35)' },
          '50%': { boxShadow: '0 0 32px rgba(0, 217, 220, 0.55)' },
        },
        'tab-bounce': {
          '0%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-2px) scale(1.08)' },
          '100%': { transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 120ms ease-out',
        pop: 'pop 160ms ease-out',
        'slide-down': 'slide-down 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slide-up 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'sheet-up': 'sheet-up 280ms cubic-bezier(0.32, 0.72, 0, 1)',
        'sheet-down': 'sheet-down 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        'bead-pulse': 'bead-pulse 180ms ease-out',
        'send-away': 'send-away 280ms cubic-bezier(0.4, 0, 0.8, 0.6) forwards',
        spin: 'spin 0.7s linear infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'tab-bounce': 'tab-bounce 320ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [
    // Plugin custom : safe-area utilities (pt-safe, pb-safe, pl-safe, pr-safe, px-safe, py-safe).
    function ({ addUtilities }) {
      addUtilities({
        '.pt-safe': { paddingTop: 'env(safe-area-inset-top)' },
        '.pb-safe': { paddingBottom: 'env(safe-area-inset-bottom)' },
        '.pl-safe': { paddingLeft: 'env(safe-area-inset-left)' },
        '.pr-safe': { paddingRight: 'env(safe-area-inset-right)' },
        '.px-safe': {
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        },
        '.py-safe': {
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
        '.mt-safe': { marginTop: 'env(safe-area-inset-top)' },
        '.mb-safe': { marginBottom: 'env(safe-area-inset-bottom)' },
        '.top-safe': { top: 'env(safe-area-inset-top)' },
        '.bottom-safe': { bottom: 'env(safe-area-inset-bottom)' },
        '.h-screen-dvh': { height: '100dvh' },
        '.tap-transparent': { '-webkit-tap-highlight-color': 'transparent' },
        '.no-callout': { '-webkit-touch-callout': 'none' },
        '.no-zoom': { 'font-size': '16px' },
      });
    },
  ],
};
