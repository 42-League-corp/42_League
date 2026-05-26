/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
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
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'teal-glow': '0 0 16px rgba(0, 217, 220, 0.35)',
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
      },
      animation: {
        'fade-in': 'fade-in 120ms ease-out',
        pop: 'pop 160ms ease-out',
        'slide-down': 'slide-down 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'bead-pulse': 'bead-pulse 180ms ease-out',
        'send-away': 'send-away 280ms cubic-bezier(0.4, 0, 0.8, 0.6) forwards',
        spin: 'spin 0.7s linear infinite',
      },
    },
  },
  plugins: [],
};
