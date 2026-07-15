/**
 * Character counter for limited inputs.
 * Shows used/max and remaining when the user is near the limit.
 */
const CharCount = ({ value = '', max, className = '' }) => {
  if (!max || max <= 0) return null;
  const len = String(value ?? '').length;
  const remaining = Math.max(0, max - len);
  const nearLimit = remaining <= Math.min(50, Math.floor(max * 0.15));
  const atLimit = remaining === 0;

  return (
    <p
      className={`text-xs font-mono mt-1 tabular-nums ${
        atLimit
          ? 'text-red-400'
          : nearLimit
            ? 'text-amber-300'
            : 'text-text-muted'
      } ${className}`}
    >
      {len}/{max}
      <span className="text-text-muted/80">
        {' '}
        ({remaining} remaining)
      </span>
    </p>
  );
};

export default CharCount;
