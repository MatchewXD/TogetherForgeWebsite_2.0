/**
 * Circular HUD gauge - SVG ring with percentage fill.
 * Dark track + cyan/purple/gold accent. Readable center value.
 */

const TONE_STROKE = {
  cyan: '#00f9ff',
  purple: '#c084fc',
  magenta: '#c026d3',
  gold: '#f0b429',
  success: '#22ff88',
};

const TONE_TEXT = {
  cyan: 'text-neon-cyan',
  purple: 'text-neon-purple',
  magenta: 'text-neon-magenta',
  gold: 'text-semantic-achievement',
  success: 'text-semantic-success',
};

const GaugeRing = ({
  value = 0,
  max = 100,
  size = 128,
  stroke = 8,
  label = '',
  sublabel = '',
  displayValue,
  tone = 'cyan',
  className = '',
}) => {
  // Prefer value as 0–100 percent when max is 100; otherwise value/max.
  const raw = Number(value);
  const maxN = Number(max);
  const safeMax = Number.isFinite(maxN) && maxN > 0 ? maxN : 100;
  const safeRaw = Number.isFinite(raw) ? raw : 0;
  const pct =
    safeMax === 100
      ? Math.min(100, Math.max(0, safeRaw))
      : Math.min(100, Math.max(0, (safeRaw / safeMax) * 100));

  const dim = Number.isFinite(Number(size)) ? Number(size) : 128;
  const sw = Number.isFinite(Number(stroke)) ? Number(stroke) : 8;
  const r = Math.max(1, (dim - sw) / 2);
  const c = 2 * Math.PI * r;
  const offset = Number.isFinite(c) ? c - (pct / 100) * c : 0;
  const strokeColor = TONE_STROKE[tone] || TONE_STROKE.cyan;
  const textClass = TONE_TEXT[tone] || TONE_TEXT.cyan;
  const centerLabel =
    displayValue != null && displayValue !== ''
      ? String(displayValue)
      : `${Math.round(pct)}%`;

  return (
    <div
      className={`flex flex-col items-center text-center ${className}`}
      role="img"
      aria-label={`${label}: ${centerLabel}`}
    >
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg
          width={dim}
          height={dim}
          viewBox={`0 0 ${dim} ${dim}`}
          className="tf-gauge-svg -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            fill="none"
            stroke="#1f1f2e"
            strokeWidth={sw}
          />
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            fill="none"
            stroke={strokeColor}
            strokeWidth={sw}
            strokeLinecap="butt"
            className="tf-gauge-ring"
            style={{
              strokeDasharray: `${c} ${c}`,
              strokeDashoffset: offset,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
          <span
            className={`text-xl sm:text-2xl font-bold tabular-nums leading-none ${textClass}`}
          >
            {centerLabel}
          </span>
        </div>
      </div>
      {label && (
        <div className="mt-3 text-[10px] sm:text-xs font-sans font-semibold uppercase tracking-[0.16em] text-text-muted">
          {label}
        </div>
      )}
      {sublabel && (
        <div className="mt-0.5 text-[10px] text-text-secondary/80 tabular-nums">
          {sublabel}
        </div>
      )}
    </div>
  );
};

export default GaugeRing;
