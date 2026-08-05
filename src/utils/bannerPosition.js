/**
 * Profile banner framing via CSS object-position.
 * Stored as "X% Y%" (e.g. "50% 20%") so tall/wide images can be panned.
 */

export const DEFAULT_BANNER_POSITION = { x: 50, y: 50 };

/**
 * @param {string|null|undefined} raw
 * @returns {{ x: number, y: number }}
 */
export function parseBannerPosition(raw) {
  if (raw == null || typeof raw !== 'string') {
    return { ...DEFAULT_BANNER_POSITION };
  }
  const m = raw
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%$/);
  if (!m) return { ...DEFAULT_BANNER_POSITION };
  return {
    x: clampPct(Number(m[1])),
    y: clampPct(Number(m[2])),
  };
}

/**
 * @param {{ x?: number, y?: number }|null|undefined} pos
 * @returns {string}
 */
export function formatBannerPosition(pos) {
  const x = clampPct(pos?.x ?? 50);
  const y = clampPct(pos?.y ?? 50);
  return `${round1(x)}% ${round1(y)}%`;
}

/**
 * CSS object-position value
 * @param {{ x?: number, y?: number }|string|null|undefined} pos
 */
export function bannerObjectPosition(pos) {
  if (typeof pos === 'string') {
    return formatBannerPosition(parseBannerPosition(pos));
  }
  return formatBannerPosition(pos || DEFAULT_BANNER_POSITION);
}

function clampPct(n) {
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, n));
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
