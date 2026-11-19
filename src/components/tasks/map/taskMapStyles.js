/** Task Map colours per task state. Every colour also has a text label. */
export const STATE_STYLES = {
  open: {
    label: 'Open',
    dot: 'bg-neon-cyan',
    bar: 'bg-neon-cyan',
    border: 'border-neon-cyan/45',
    text: 'text-neon-cyan',
    stroke: 'rgb(var(--tf-neon-cyan) / 0.6)',
    mini: 'rgb(var(--tf-neon-cyan) / 0.75)',
  },
  active: {
    label: 'In progress',
    dot: 'bg-neon-magenta',
    bar: 'bg-neon-magenta',
    border: 'border-neon-magenta/55',
    text: 'text-fuchsia-400',
    stroke: 'rgb(var(--tf-neon-magenta) / 0.65)',
    mini: 'rgb(var(--tf-neon-magenta) / 0.8)',
  },
  review: {
    label: 'In review',
    dot: 'bg-semantic-warning',
    bar: 'bg-semantic-warning',
    border: 'border-semantic-warning/55',
    text: 'text-semantic-warning',
    stroke: 'rgb(var(--tf-semantic-warning) / 0.65)',
    mini: 'rgb(var(--tf-semantic-warning) / 0.8)',
  },
  done: {
    label: 'Done',
    dot: 'bg-semantic-success',
    bar: 'bg-semantic-success',
    border: 'border-semantic-success/45',
    text: 'text-semantic-success',
    stroke: 'rgb(var(--tf-semantic-success) / 0.55)',
    mini: 'rgb(var(--tf-semantic-success) / 0.7)',
  },
  locked: {
    label: 'Blocked',
    dot: 'bg-white/40',
    bar: 'bg-white/40',
    border: 'border-white/25',
    text: 'text-text-secondary',
    stroke: 'rgb(255 255 255 / 0.3)',
    mini: 'rgb(255 255 255 / 0.35)',
  },
};

export const LEGEND = ['open', 'active', 'review', 'done', 'locked'];

/** Greyed-out look for nodes and edges outside the highlighted category. */
export const DIM_STROKE = 'rgb(255 255 255 / 0.12)';
export const DIM_MINI = 'rgb(255 255 255 / 0.12)';

export function plainText(text, max = 320) {
  const clean = String(text || '')
    .replace(/[#*_`>~]+/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}
