/**
 * Client-held MFA "remember this device" token.
 * The server stores only a SHA-256 hash. Token lives in localStorage for 30 days.
 */

export const MFA_TRUST_DAYS = 30;
export const MFA_TRUST_STORAGE_KEY = 'tf_mfa_trusted_device';

export async function hashMfaDeviceToken(token) {
  const raw = String(token || '');
  if (!raw) return '';
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function createMfaDeviceToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function readStoredMfaDevice(userId) {
  if (!userId || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(MFA_TRUST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || String(parsed.userId) !== String(userId)) return null;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(MFA_TRUST_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function storeMfaDevice(userId, token, expiresAt) {
  if (!userId || !token || typeof localStorage === 'undefined') return;
  localStorage.setItem(
    MFA_TRUST_STORAGE_KEY,
    JSON.stringify({
      userId: String(userId),
      token: String(token),
      expiresAt: expiresAt || null,
    })
  );
}

export function clearStoredMfaDevice() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(MFA_TRUST_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
