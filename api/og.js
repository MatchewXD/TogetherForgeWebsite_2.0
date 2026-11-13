/**
 * Vercel Function: share previews for a single idea or project.
 *
 * The site is a single-page app, so link unfurlers (Discord, X, Slack, ...)
 * only ever saw the generic site card. vercel.json sends those crawlers here
 * for /ideas/:id and /projects/:slug; everyone else still gets the app.
 *
 * Reads public rows with the anon key (same access as any visitor). Any
 * failure falls back to the generic card, never an error page.
 */

import { ideaMeta, projectMeta, renderOgHtml } from './_lib/ogHtml.js';

const SUPABASE_URL = (
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  ''
).replace(/\/+$/, '');
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

async function fetchRow(table, query) {
  if (!SUPABASE_URL || !ANON_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}&limit=1`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

export async function resolveMeta(params) {
  const type = params.get('type');
  if (type === 'idea') {
    const id = params.get('id') || '';
    if (!/^\d{1,12}$/.test(id)) return ideaMeta(null, 'unknown');
    const row = await fetchRow(
      'ideas',
      `select=title,summary,description,problem_statement,image_url,status&id=eq.${id}`
    ).catch(() => null);
    return ideaMeta(row, id);
  }
  if (type === 'project') {
    const slug = (params.get('slug') || '').toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) return projectMeta(null, 'unknown');
    const row = await fetchRow(
      'projects',
      `select=title,summary,description&slug=eq.${slug}`
    ).catch(() => null);
    return projectMeta(row, slug);
  }
  return { path: '/', type: 'website' };
}

export default async function handler(req, res) {
  let meta = { path: '/', type: 'website' };
  try {
    const params = new URL(req.url || '/', 'http://localhost').searchParams;
    meta = await resolveMeta(params);
  } catch {
    /* generic card */
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Unfurlers re-fetch often; let the CDN answer most of them
  res.setHeader(
    'Cache-Control',
    'public, max-age=0, s-maxage=600, stale-while-revalidate=86400'
  );
  res.end(renderOgHtml(meta));
}
