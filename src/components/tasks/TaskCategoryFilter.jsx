import {
  TASK_CATEGORIES,
  normalizeTaskCategoryKey,
  getTaskCategoryStyle,
} from '../../constants/taskCategories';

/**
 * Category chips for the task board ("All categories", Code, Art, ...).
 * Used in the board header and above the Task Map; both share one filter.
 *
 * @param {{ selected: string[], onToggle: (cat: string) => void, onClear: () => void, size?: 'md'|'sm', children?: import('react').ReactNode }} props
 *   children: extra chips appended to the same group (e.g. Unclaimed only)
 */
export default function TaskCategoryFilter({
  selected,
  onToggle,
  onClear,
  size = 'md',
  label = 'Task board filters',
  children,
}) {
  // 'touch': compact chips that are still 44px tall on phones
  const pad =
    size === 'touch'
      ? 'min-h-11 sm:min-h-0 px-3 py-1'
      : size === 'sm'
        ? 'px-2.5 py-1'
        : 'px-3 py-1.5';
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        onClick={onClear}
        className={`inline-flex items-center rounded-full border ${pad} text-xs font-semibold tracking-wide transition-colors ${
          selected.length === 0
            ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/50'
            : 'bg-transparent text-text-muted border-cyber-border hover:border-cyber-border hover:text-text-secondary'
        }`}
        aria-pressed={selected.length === 0}
      >
        All categories
      </button>
      {TASK_CATEGORIES.map((cat) => {
        const active = selected.some(
          (c) => normalizeTaskCategoryKey(c) === normalizeTaskCategoryKey(cat)
        );
        const style = getTaskCategoryStyle(cat);
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onToggle(cat)}
            className={`inline-flex items-center gap-1.5 rounded-full border ${pad} text-xs font-semibold tracking-wide transition-colors ${
              active
                ? `${style.badge} ring-1 ${style.ring}`
                : 'bg-cyber-surface/40 text-text-muted border-cyber-border/80 hover:text-text-secondary hover:border-cyber-border'
            }`}
            aria-pressed={active}
            title={active ? `Remove ${cat} filter` : `Show ${cat} tasks`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                active ? style.swatch : 'bg-text-muted/50'
              }`}
              aria-hidden
            />
            {cat}
          </button>
        );
      })}
      {children}
    </div>
  );
}
