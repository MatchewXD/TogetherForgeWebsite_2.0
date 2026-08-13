/**
 * Lightweight cross-component profile updates (navbar avatar, etc.).
 * Realtime is optional and may be off on staging — this always works same-tab.
 */

export const PROFILE_UPDATED_EVENT = 'tf-profile-updated';

/**
 * @param {{
 *   userId: string,
 *   avatarUrl?: string|null,
 *   username?: string|null,
 * }} detail
 */
export function emitProfileUpdated(detail) {
  if (typeof window === 'undefined' || !detail?.userId) return;
  try {
    window.dispatchEvent(
      new CustomEvent(PROFILE_UPDATED_EVENT, {
        detail: {
          userId: String(detail.userId),
          avatarUrl:
            detail.avatarUrl !== undefined ? detail.avatarUrl : undefined,
          username:
            detail.username !== undefined ? detail.username : undefined,
        },
      })
    );
  } catch {
    /* ignore */
  }
}

/**
 * @param {(detail: { userId: string, avatarUrl?: string|null, username?: string|null }) => void} handler
 * @returns {() => void} unsubscribe
 */
export function onProfileUpdated(handler) {
  if (typeof window === 'undefined') return () => {};
  const listener = (e) => {
    handler(e?.detail || {});
  };
  window.addEventListener(PROFILE_UPDATED_EVENT, listener);
  return () => window.removeEventListener(PROFILE_UPDATED_EVENT, listener);
}
