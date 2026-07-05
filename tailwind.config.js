/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cyber-bg': '#05050a',
        'cyber-surface': '#0a0a12',
        'cyber-card': '#11111a',
        'neon-cyan': '#00f9ff',
        'neon-magenta': '#ff00aa',
        'neon-purple': '#c084fc',
        'text-primary': '#e0e7ff',
        'text-secondary': '#94a3b8',
        'text-muted': '#64748b',
      },
      fontFamily: {
        'mono': ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        'display': ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'neon-cyan': '0 0 5px #00f9ff, 0 0 20px #00f9ff',
        'neon-magenta': '0 0 5px #ff00aa, 0 0 20px #ff00aa',
        'neon-glow': '0 0 10px rgba(0, 249, 255, 0.3), 0 10px 30px rgba(0, 0, 0, 0.6)',
      },
      animation: {
        'pulse-neon': 'pulse-neon 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scanline': 'scanline 4s linear infinite',
        'flicker': 'flicker 3s linear infinite',
        'grid-move': 'grid-move 20s linear infinite',
      },
      keyframes: {
        'pulse-neon': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'scanline': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(400%)' },
        },
        'flicker': {
          '0%, 19%, 21%, 23%, 25%, 54%, 56%, 100%': { opacity: '1' },
          '20%, 24%, 55%': { opacity: '0.4' },
        },
        'grid-move': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '40px 40px' },
        },
      },
    },
  },
  plugins: [],
}
