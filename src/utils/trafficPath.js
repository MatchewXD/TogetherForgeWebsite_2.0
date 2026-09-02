/**
 * First-party traffic path helpers. No query strings (tokens, emails).
 */

export function sanitizeTrafficPath(raw) {
  let p = String(raw || '');
  try {
    p = decodeURIComponent(p);
  } catch {
    /* keep raw */
  }
  p = p.split('#')[0].split('?')[0].trim();
  if (!p) return '/';
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  p = p.slice(0, 200);
  if (/^\/(javascript|data|file|https?):/i.test(p)) return '/';
  p = p.replace(/[^\w.~/%:@+\-]/g, '');
  if (!p.startsWith('/')) p = `/${p}`;
  return p || '/';
}

/** Exclude the Traffic tab itself from presence so staff viewing it do not inflate Active now. */
export function isModeratorTrafficTab(pathname, search = '') {
  const path = sanitizeTrafficPath(pathname);
  if (path !== '/moderator') return false;
  const q = String(search || '');
  const params = new URLSearchParams(
    q.startsWith('?') ? q.slice(1) : q
  );
  return params.get('tab') === 'traffic';
}
