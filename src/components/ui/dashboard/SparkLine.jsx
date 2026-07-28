/**
 * Minimal line / area spark graph for funding trends.
 * Pure SVG - no chart library.
 *
 * @param {number[]} values - y series (oldest → newest)
 * @param {string} [tone]
 */

const SparkLine = ({
  values = [],
  width = 320,
  height = 96,
  tone = 'cyan',
  className = '',
  emptyLabel = 'No trend data yet',
}) => {
  const series = (Array.isArray(values) ? values : []).map((v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  });
  const hasData = series.length >= 2 && series.some((v) => v > 0);

  if (!hasData) {
    return (
      <div
        className={`flex items-center justify-center h-24 border border-dashed border-cyber-border/60 bg-cyber-surface/30 text-xs text-text-muted tracking-wide ${className}`}
      >
        {emptyLabel}
      </div>
    );
  }

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = Math.max(max - min, 1);
  const padX = 4;
  const padY = 8;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = series.map((v, i) => {
    const x = padX + (i / (series.length - 1)) * innerW;
    const y = padY + innerH - ((v - min) / span) * innerH;
    return [x, y];
  });

  const lineD = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');
  const areaD = `${lineD} L ${points[points.length - 1][0].toFixed(1)} ${(height - padY).toFixed(1)} L ${points[0][0].toFixed(1)} ${(height - padY).toFixed(1)} Z`;

  // Hardcoded hex - no CSS vars in SVG attrs (safer across browsers)
  const stroke =
    tone === 'gold' ? '#f0b429' : tone === 'purple' ? '#c084fc' : '#00f9ff';
  const fill =
    tone === 'gold'
      ? 'rgba(240, 180, 41, 0.12)'
      : tone === 'purple'
        ? 'rgba(192, 132, 252, 0.12)'
        : 'rgba(0, 249, 255, 0.12)';
  const gridStroke = '#1f1f2e';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`w-full h-auto ${className}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Funding trend"
    >
      {/* Soft grid */}
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={padX}
          x2={width - padX}
          y1={padY + innerH * t}
          y2={padY + innerH * t}
          stroke={gridStroke}
          strokeOpacity="0.85"
          strokeWidth="1"
        />
      ))}
      <path d={areaD} fill={fill} />
      <path
        d={lineD}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* End dot */}
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r="3.5"
        fill={stroke}
      />
    </svg>
  );
};

export default SparkLine;
