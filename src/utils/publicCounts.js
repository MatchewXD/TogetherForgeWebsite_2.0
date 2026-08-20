/** Public vote/like totals stay exact below this; then delayed / lightly bucketed. */
export const PUBLIC_COUNT_LIVE_BELOW = 10;

export function optimisticPublicCount(prevCount, turningOn) {
  const n = Math.max(0, Number(prevCount) || 0);
  if (n >= PUBLIC_COUNT_LIVE_BELOW) return n;
  return Math.max(0, n + (turningOn ? 1 : -1));
}

/**
 * After the server responds: use the live public figure while still low,
 * otherwise keep the displayed delayed number.
 */
export function reconcilePublicCount(prevCount, serverCount) {
  const prev = Math.max(0, Number(prevCount) || 0);
  const server = Number(serverCount);
  if (!Number.isFinite(server)) return prev;
  if (server < PUBLIC_COUNT_LIVE_BELOW || prev < PUBLIC_COUNT_LIVE_BELOW) {
    return Math.max(0, server);
  }
  return prev;
}
