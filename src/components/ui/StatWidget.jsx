/**
 * Compact stat tile.
 * @param {'default'|'success'|'live'|'muted'} [tone]
 */
const StatWidget = ({
  label,
  value,
  suffix = '',
  icon,
  tone = 'default',
  className = '',
}) => {
  const valueTone = {
    default: 'text-neon-cyan',
    success: 'text-semantic-success',
    live: 'text-neon-cyan',
    muted: 'text-text-secondary',
    achievement: 'text-semantic-achievement',
    warning: 'text-semantic-warning',
  };

  return (
    <div
      className={`cyber-card cyber-card-subtle p-5 text-center ${className}`}
    >
      {icon && <div className="text-3xl mb-3 opacity-75">{icon}</div>}
      <div
        className={`text-4xl font-mono font-bold mb-1 ${valueTone[tone] || valueTone.default}`}
      >
        {value}
        {suffix}
      </div>
      <div className="text-sm uppercase tracking-widest text-text-muted font-mono">
        {label}
      </div>
    </div>
  );
};

export default StatWidget;
