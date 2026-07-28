/** @type {import('tailwindcss').Config} */
/**
 * Colors use CSS variables from the Forge design system (:root).
 * Channel form enables opacity modifiers: text-neon-cyan/40, bg-forge-gold/20, etc.
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'cyber-bg': 'rgb(var(--tf-cyber-bg) / <alpha-value>)',
        'cyber-surface': 'rgb(var(--tf-cyber-surface) / <alpha-value>)',
        'cyber-card': 'rgb(var(--tf-cyber-card) / <alpha-value>)',
        'cyber-border': 'rgb(var(--tf-cyber-border) / <alpha-value>)',

        'neon-cyan': 'rgb(var(--tf-neon-cyan) / <alpha-value>)',
        'neon-magenta': 'rgb(var(--tf-neon-magenta) / <alpha-value>)',
        'neon-purple': 'rgb(var(--tf-neon-purple) / <alpha-value>)',
        'neon-green': 'rgb(var(--tf-neon-green) / <alpha-value>)',

        'warning-amber': 'rgb(var(--tf-warning-amber) / <alpha-value>)',
        'danger-red': 'rgb(var(--tf-danger-red) / <alpha-value>)',
        'forge-gold': 'rgb(var(--tf-forge-gold) / <alpha-value>)',

        /* Role colors - remapped per theme (classic ≈ cyan/magenta; forge = green/amber/red/gold) */
        'semantic-success': 'rgb(var(--tf-semantic-success) / <alpha-value>)',
        'semantic-warning': 'rgb(var(--tf-semantic-warning) / <alpha-value>)',
        'semantic-danger': 'rgb(var(--tf-semantic-danger) / <alpha-value>)',
        'semantic-achievement':
          'rgb(var(--tf-semantic-achievement) / <alpha-value>)',

        'text-primary': 'rgb(var(--tf-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--tf-text-secondary) / <alpha-value>)',
        'text-muted': 'rgb(var(--tf-text-muted) / <alpha-value>)',
        'text-accent': 'rgb(var(--tf-text-accent) / <alpha-value>)',
      },
      fontFamily: {
        /* Primary site face - industrial / forge */
        sans: [
          '"League Spartan"',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        display: [
          '"League Spartan"',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        heading: [
          '"League Spartan"',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        /*
         * Historical UI chrome used font-mono for HUD labels / nav.
         * Mapped to League Spartan so labels stay on-brand; true mono via font-code.
         */
        mono: [
          '"League Spartan"',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
        code: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        'neon-cyan':
          '0 0 5px rgb(var(--tf-neon-cyan) / 1), 0 0 20px rgb(var(--tf-neon-cyan) / 0.8)',
        'neon-magenta':
          '0 0 5px rgb(var(--tf-neon-magenta) / 1), 0 0 20px rgb(var(--tf-neon-magenta) / 0.8)',
        'neon-glow':
          '0 0 10px rgb(var(--tf-neon-cyan) / 0.3), 0 10px 30px rgba(0, 0, 0, 0.6)',
        'neon-purple':
          '0 0 5px rgb(var(--tf-neon-purple) / 1), 0 0 15px rgb(var(--tf-neon-purple) / 0.8)',
        'forge-gold':
          '0 0 5px rgb(var(--tf-forge-gold) / 1), 0 0 15px rgb(var(--tf-forge-gold) / 0.5)',
      },
      backgroundImage: {
        'cyber-grid':
          'linear-gradient(to right, rgb(var(--tf-cyber-border) / 1) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--tf-cyber-border) / 1) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};
