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
                'cyber-border': '#1f1f2e',

                'neon-cyan': '#00f9ff',
                'neon-magenta': '#c026d3',
                'neon-purple': '#c084fc',
                'neon-green': '#22ff88',  

                'text-primary': '#e0e7ff',
                'text-secondary': '#94a3b8',
                'text-muted': '#64748b',
                'text-accent': '#00f9ff',
            },
            fontFamily: {
                mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
                display: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
                heading: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
            },
            boxShadow: {
                'neon-cyan': '0 0 5px #00f9ff, 0 0 20px #00f9ff',
                'neon-magenta': '0 0 5px #c026d3, 0 0 20px #c026d3',
                'neon-glow': '0 0 10px rgba(0, 249, 255, 0.3), 0 10px 30px rgba(0, 0, 0, 0.6)',
                'neon-purple': '0 0 5px #c084fc, 0 0 15px #c084fc',
            },
            backgroundImage: {
                'cyber-grid': 'linear-gradient(to right, #1f1f2e 1px, transparent 1px), linear-gradient(to bottom, #1f1f2e 1px, transparent 1px)',
            }
        },
    },
    plugins: [],
}