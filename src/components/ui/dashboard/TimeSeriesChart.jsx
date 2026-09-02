/**
 * Staff time-series chart. Pure SVG — no analytics vendor, no chart library.
 */

function formatDefaultTick(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const TimeSeriesChart = ({
  points = [],
  height = 180,
  tone = 'cyan',
  emptyLabel = 'No traffic in this range yet',
  quietLabel = 'Quiet range — recorded activity is at zero.',
  formatTick = formatDefaultTick,
  valueSuffix = '',
  className = '',
}) => {
  const series = (Array.isArray(points) ? points : [])
    .map((p) => ({
      t: p?.t || null,
      v: Number(p?.v),
    }))
    .filter((p) => p.t && Number.isFinite(p.v) && p.v >= 0);

  if (series.length < 2) {
    return (
      <div
        className={`flex items-center justify-center h-44 border border-dashed border-cyber-border/70 bg-cyber-surface/30 px-4 text-center text-sm text-text-muted ${className}`}
      >
        {emptyLabel}
      </div>
    );
  }

  const max = Math.max(1, ...series.map((p) => p.v));
  const allZero = series.every((p) => p.v === 0);
  const width = 640;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const xy = series.map((p, i) => {
    const x = padL + (i / (series.length - 1)) * innerW;
    const y = padT + innerH - (p.v / max) * innerH;
    return { ...p, x, y };
  });

  const lineD = xy
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaD = `${lineD} L ${xy[xy.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${xy[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  const stroke = tone === 'purple' ? '#c084fc' : '#00f9ff';
  const fill =
    tone === 'purple' ? 'rgba(192, 132, 252, 0.14)' : 'rgba(0, 249, 255, 0.14)';

  const yTicks = [...new Set([0, Math.round(max / 2), max])];
  const xCount = Math.min(5, series.length);
  const xTicks = [];
  for (let i = 0; i < xCount; i += 1) {
    const idx =
      xCount === 1
        ? 0
        : Math.round((i / (xCount - 1)) * (series.length - 1));
    xTicks.push(xy[idx]);
  }

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label="Traffic over time"
      >
        {yTicks.map((tick) => {
          const y = padT + innerH - (tick / max) * innerH;
          return (
            <g key={`y-${tick}`}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke="#1f1f2e"
                strokeWidth="1"
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                fill="#8b8b9a"
                fontSize="10"
                fontFamily="ui-monospace, monospace"
              >
                {tick}
                {valueSuffix}
              </text>
            </g>
          );
        })}
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
        {xTicks.map((p, i) => (
          <text
            key={`x-${p.t}-${i}`}
            x={p.x}
            y={height - 8}
            textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
            fill="#8b8b9a"
            fontSize="10"
            fontFamily="ui-monospace, monospace"
          >
            {formatTick(p.t)}
          </text>
        ))}
      </svg>
      {allZero ? (
        <p className="text-xs text-text-muted mt-2">{quietLabel}</p>
      ) : null}
    </div>
  );
};

export default TimeSeriesChart;
