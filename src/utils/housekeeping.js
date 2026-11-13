/**
 * Throttle for best-effort "housekeeping" calls that the client triggers
 * while reading a page (auto-release sweeps, closing expired questions, ...).
 *
 * These are safe to skip: the server stays correct without them. Running
 * one on every page view turns each visitor into a database write, so each
 * browser runs a given job at most once per interval.
 */

const PREFIX = 'tf_hk_';
const memory = new Map();

function readLast(key) {
  const mem = memory.get(key) || 0;
  try {
    const stored = Number(localStorage.getItem(PREFIX + key)) || 0;
    return Math.max(mem, stored);
  } catch {
    return mem;
  }
}

/**
 * Returns true (and records the run) when `key` has not run in this browser
 * within `minIntervalMs`. Returns false otherwise.
 *
 * @param {string} key
 * @param {number} minIntervalMs
 * @param {number} [now]
 */
export function claimHousekeepingRun(key, minIntervalMs, now = Date.now()) {
  const last = readLast(key);
  // A timestamp from the future (clock change) must not block forever
  if (last && last <= now && now - last < minIntervalMs) return false;
  memory.set(key, now);
  try {
    localStorage.setItem(PREFIX + key, String(now));
  } catch {
    /* storage unavailable: in-memory throttle still applies */
  }
  return true;
}

/** Test helper. */
export function resetHousekeepingForTests() {
  memory.clear();
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}
