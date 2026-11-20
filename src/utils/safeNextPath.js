/**
 * Validate a `?next=` value before redirecting after sign-in.
 *
 * Only same-site paths are allowed ("/dashboard", "/report-bug?x=1").
 * Rejects absolute URLs, protocol-relative "//host", backslash tricks
 * ("/\\host" is read as "//host" by browsers) and control characters.
 *
 * @param {unknown} raw
 * @returns {string|null} the path, or null when it is not safe
 */
export function safeNextPath(raw) {
  const s = String(raw ?? '').trim();
  if (!s.startsWith('/') || s.startsWith('//')) return null;
  if (s.includes('\\') || s.includes('://')) return null;
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return null;
  }
  return s;
}
