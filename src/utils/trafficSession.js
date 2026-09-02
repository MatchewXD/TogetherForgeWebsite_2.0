/**
 * Short-lived anonymous browsing session for first-party traffic.
 * Shared across tabs via localStorage; idle timeout avoids a cross-day identity.
 */

import {
  TRAFFIC_SESSION_AT_KEY,
  TRAFFIC_SESSION_IDLE_MS,
  TRAFFIC_SESSION_KEY,
} from '../constants/traffic';

function randomSessionKey() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '');
    }
  } catch {
    /* fall through */
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function isValidKey(raw) {
  return /^[A-Za-z0-9_-]{16,64}$/.test(String(raw || ''));
}

export function getTrafficSessionKey(now = Date.now()) {
  if (typeof localStorage === 'undefined') return randomSessionKey();
  try {
    const stored = localStorage.getItem(TRAFFIC_SESSION_KEY);
    const at = Number(localStorage.getItem(TRAFFIC_SESSION_AT_KEY) || 0);
    const fresh =
      isValidKey(stored) &&
      Number.isFinite(at) &&
      now - at >= 0 &&
      now - at < TRAFFIC_SESSION_IDLE_MS;
    if (fresh) {
      localStorage.setItem(TRAFFIC_SESSION_AT_KEY, String(now));
      return stored;
    }
    const key = randomSessionKey();
    localStorage.setItem(TRAFFIC_SESSION_KEY, key);
    localStorage.setItem(TRAFFIC_SESSION_AT_KEY, String(now));
    return key;
  } catch {
    return randomSessionKey();
  }
}
