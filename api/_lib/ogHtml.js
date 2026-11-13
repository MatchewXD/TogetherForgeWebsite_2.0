/**
 * Share-preview HTML for link unfurlers (Discord, X, Slack, ...).
 * Pure helpers: no network, no Vercel APIs, so they are unit tested.
 */

export const SITE_URL = 'https://togetherforge.net';
export const SITE_NAME = 'Together Forge';
export const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;
export const DEFAULT_DESCRIPTION =
  'Together Forge is a community-supported indie game studio building cooperative games in the open. Share ideas, claim real work, and see how support is used.';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Collapse whitespace / markdown noise and cut at a word boundary. */
export function summarize(text, max = 200) {
  const clean = String(text ?? '')
    .replace(/[#*_`>~]+/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Only absolute https images are safe to hand to unfurlers. */
export function safeImage(url) {
  const s = String(url ?? '').trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(s) ? s : DEFAULT_IMAGE;
}

/**
 * @param {{ title?: string, description?: string, image?: string, path?: string, type?: string }} meta
 */
export function renderOgHtml(meta = {}) {
  const title = meta.title ? `${meta.title} | ${SITE_NAME}` : SITE_NAME;
  const description = summarize(meta.description) || DEFAULT_DESCRIPTION;
  const image = safeImage(meta.image);
  const path = String(meta.path || '/').startsWith('/') ? meta.path || '/' : '/';
  const url = `${SITE_URL}${path}`;
  const e = escapeHtml;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${e(title)}</title>
    <meta name="description" content="${e(description)}" />
    <link rel="canonical" href="${e(url)}" />
    <meta property="og:type" content="${e(meta.type || 'article')}" />
    <meta property="og:site_name" content="${e(SITE_NAME)}" />
    <meta property="og:title" content="${e(title)}" />
    <meta property="og:description" content="${e(description)}" />
    <meta property="og:url" content="${e(url)}" />
    <meta property="og:image" content="${e(image)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${e(title)}" />
    <meta name="twitter:description" content="${e(description)}" />
    <meta name="twitter:image" content="${e(image)}" />
  </head>
  <body>
    <h1>${e(title)}</h1>
    <p>${e(description)}</p>
    <p><a href="${e(url)}">Open on ${e(SITE_NAME)}</a></p>
  </body>
</html>
`;
}

/** Idea row → preview meta. Drafts never get a specific preview. */
export function ideaMeta(row, id) {
  const path = `/ideas/${id}`;
  if (!row || String(row.status || '').toLowerCase() === 'draft') {
    return { title: 'Ideas', path, type: 'website' };
  }
  return {
    title: row.title || 'Idea',
    description: row.summary || row.description || row.problem_statement || '',
    image: row.image_url,
    path,
  };
}

/** Project row → preview meta. */
export function projectMeta(row, slug) {
  const path = `/projects/${slug}`;
  if (!row) return { title: 'Projects', path, type: 'website' };
  return {
    title: row.title || 'Project',
    description: row.summary || row.description || '',
    path,
  };
}
