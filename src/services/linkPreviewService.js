/**
 * Fetch Open Graph / link preview metadata for external URLs.
 * Uses Microlink's public API (CORS-friendly) with an in-memory cache.
 * Falls back gracefully when blocked or unavailable.
 */

const previewCache = new Map();

function safeHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return null;
  }
}

function normalizeImage(image) {
  if (!image) return null;
  if (typeof image === 'string') {
    const s = image.trim();
    return s || null;
  }
  if (typeof image === 'object' && image.url) {
    const s = String(image.url).trim();
    return s || null;
  }
  return null;
}

/**
 * @typedef {Object} LinkPreview
 * @property {string} url
 * @property {string|null} title
 * @property {string|null} description
 * @property {string|null} image
 * @property {string|null} siteName
 * @property {string|null} favicon
 * @property {string|null} hostname
 */

/**
 * @param {string} url
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<LinkPreview|null>}
 */
export async function fetchLinkPreview(url, opts = {}) {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw || !/^https?:\/\//i.test(raw)) return null;

  if (previewCache.has(raw)) {
    return previewCache.get(raw);
  }

  const pending = (async () => {
    const hostname = safeHostname(raw);
    try {
      const endpoint = new URL('https://api.microlink.io');
      endpoint.searchParams.set('url', raw);
      // Prefer metadata only (faster / lighter than screenshot)
      endpoint.searchParams.set('palette', 'false');
      endpoint.searchParams.set('audio', 'false');
      endpoint.searchParams.set('video', 'false');
      endpoint.searchParams.set('iframe', 'false');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);
      const onAbort = () => controller.abort();
      if (opts.signal) {
        if (opts.signal.aborted) {
          clearTimeout(timeoutId);
          return null;
        }
        opts.signal.addEventListener('abort', onAbort, { once: true });
      }

      let res;
      try {
        res = await fetch(endpoint.toString(), {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
      } finally {
        clearTimeout(timeoutId);
        if (opts.signal) {
          opts.signal.removeEventListener('abort', onAbort);
        }
      }

      if (!res.ok) {
        return {
          url: raw,
          title: null,
          description: null,
          image: null,
          siteName: hostname,
          favicon: null,
          hostname,
          _failed: true,
        };
      }

      const json = await res.json();
      const d = json?.data;
      if (!d || (json.status && json.status !== 'success')) {
        return {
          url: raw,
          title: null,
          description: null,
          image: null,
          siteName: hostname,
          favicon: null,
          hostname,
          _failed: true,
        };
      }

      return {
        url: typeof d.url === 'string' && d.url.trim() ? d.url.trim() : raw,
        title:
          typeof d.title === 'string' && d.title.trim() ? d.title.trim() : null,
        description:
          typeof d.description === 'string' && d.description.trim()
            ? d.description.trim()
            : null,
        image: normalizeImage(d.image),
        siteName:
          (typeof d.publisher === 'string' && d.publisher.trim()) ||
          hostname,
        favicon: normalizeImage(d.logo),
        hostname,
      };
    } catch {
      return {
        url: raw,
        title: null,
        description: null,
        image: null,
        siteName: hostname,
        favicon: null,
        hostname,
        _failed: true,
      };
    }
  })();

  previewCache.set(raw, pending);
  return pending;
}

export function linkHostname(url) {
  return safeHostname(url);
}
