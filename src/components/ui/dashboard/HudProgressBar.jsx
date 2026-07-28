/**
 * Angular HUD progress bar for category breakdowns.
 */

const HudProgressBar = ({
  label,
  pct = 0,
  valueLabel = '',
  desc = '',
  tone = 'cyan',
  className = '',
}) => {
  const width = Math.min(100, Math.max(0, Number(pct) || 0));
  const fill =
    tone === 'gold'
      ? 'from-semantic-achievement/70 to-semantic-achievement'
      : tone === 'purple'
        ? 'from-neon-purple/60 to-neon-purple'
        : tone === 'magenta'
          ? 'from-neon-magenta/60 to-neon-magenta'
          : tone === 'success'
            ? 'from-semantic-success/60 to-semantic-success'
            : 'from-neon-cyan/50 to-neon-cyan';

  return (
    <div className={`tf-hud-bar ${className}`}>
      <div className="flex justify-between items-baseline gap-3 mb-1.5">
        <span className="text-sm font-medium text-white min-w-0 truncate">
          {label}
        </span>
        <span className="text-xs font-sans font-semibold tabular-nums text-neon-cyan shrink-0 tracking-wide">
          {valueLabel || `${Math.round(width)}%`}
        </span>
      </div>
      <div className="tf-hud-bar-track h-2 w-full bg-cyber-surface/90 border border-cyber-border/80 overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${fill} transition-[width] duration-500 ease-out`}
          style={{ width: `${width}%` }}
        />
      </div>
      {desc && (
        <p className="text-[11px] sm:text-xs text-text-muted mt-1.5 leading-relaxed">
          {desc}
        </p>
      )}
    </div>
  );
};

export default HudProgressBar;
