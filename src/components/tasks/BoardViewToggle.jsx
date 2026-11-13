import { Columns3, Network } from 'lucide-react';

const OPTIONS = [
  { id: 'board', label: 'Board', hint: 'Columns by status', icon: Columns3 },
  { id: 'map', label: 'Map', hint: 'Branching diagram', icon: Network },
];

/**
 * Switch between the column board and the Task Map.
 * @param {{ view: 'board'|'map', onChange: (view: 'board'|'map') => void }} props
 */
export default function BoardViewToggle({ view, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        id="board-view-label"
        className="font-mono text-[10px] uppercase tracking-widest text-text-muted"
      >
        View
      </span>
      <div
        role="group"
        aria-labelledby="board-view-label"
        className="inline-flex overflow-hidden rounded-lg border border-cyber-border"
      >
        {OPTIONS.map((opt) => {
          const active = view === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active}
              title={opt.hint}
              onClick={() => onChange(opt.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? 'bg-neon-cyan/15 text-neon-cyan'
                  : 'bg-cyber-surface/60 text-text-secondary hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
