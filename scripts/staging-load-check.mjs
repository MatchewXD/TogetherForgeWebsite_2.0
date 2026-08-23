/**
 * Controlled staging load check. Read-mostly. Does not write votes/claims.
 *
 * Usage (from repo root):
 *   node scripts/staging-load-check.mjs
 *
 * Reads .env.staging. Aborts if the URL is not the staging project.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STAGING_REF = 'qoriotympchrtxhjcfux';
const PRODUCTION_REF = 'lbstantgrrrupzeasndg';
const CONCURRENCY = 8;
const PER_ENDPOINT = 24;
const WARMUP = 2;

function loadEnvFile(path) {
  const out = {};
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function pct(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

function summarize(samples) {
  const ok = samples.filter((s) => s.ok);
  const times = ok.map((s) => s.ms).sort((a, b) => a - b);
  const statuses = {};
  for (const s of samples) {
    const k = String(s.status);
    statuses[k] = (statuses[k] || 0) + 1;
  }
  return {
    n: samples.length,
    ok: ok.length,
    err: samples.length - ok.length,
    min: times[0] ?? null,
    p50: pct(times, 50),
    p95: pct(times, 95),
    p99: pct(times, 99),
    max: times[times.length - 1] ?? null,
    statuses,
    sampleError: samples.find((s) => !s.ok)?.bodySlice || null,
  };
}

async function timedFetch(url, init) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      ms: Date.now() - t0,
      bytes: text.length,
      bodySlice: text.slice(0, 160).replace(/\s+/g, ' '),
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - t0,
      bytes: 0,
      bodySlice: e?.message || String(e),
    };
  }
}

async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

const env = loadEnvFile(resolve(process.cwd(), '.env.staging'));
const base = String(env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const anon = String(env.VITE_SUPABASE_ANON_KEY || '');
if (!base || !anon) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.staging');
  process.exit(1);
}
if (base.includes(PRODUCTION_REF)) {
  console.error('Refusing to run: .env.staging points at production.');
  process.exit(1);
}
if (!base.includes(STAGING_REF)) {
  console.error(`Refusing to run: expected staging ref ${STAGING_REF}`);
  process.exit(1);
}

const rest = `${base}/rest/v1`;
const fn = `${base}/functions/v1`;
const auth = `${base}/auth/v1`;
const headers = {
  apikey: anon,
  Authorization: `Bearer ${anon}`,
  Accept: 'application/json',
};

async function discover() {
  const ideasRes = await fetch(
    `${rest}/ideas?select=id,status,votes,user_id,created_at&order=created_at.desc&limit=5`,
    { headers }
  );
  const ideas = ideasRes.ok ? await ideasRes.json() : [];
  const projectsRes = await fetch(
    `${rest}/projects?select=id,slug,phase,status&limit=5`,
    { headers }
  );
  const projects = projectsRes.ok ? await projectsRes.json() : [];
  const profilesRes = await fetch(
    `${rest}/profiles?select=id,username&limit=5`,
    { headers }
  );
  const profiles = profilesRes.ok ? await profilesRes.json() : [];
  return {
    ideaId: ideas?.[0]?.id ?? 7,
    projectId: projects?.[0]?.id || null,
    projectSlug: projects?.[0]?.slug || null,
    username: profiles?.[0]?.username || 'bot7',
    profileId: profiles?.[0]?.id || null,
    ideaCount: Array.isArray(ideas) ? ideas.length : 0,
    projectCount: Array.isArray(projects) ? projects.length : 0,
  };
}

function restGet(path) {
  return { name: `GET ${path}`, url: `${rest}${path}`, method: 'GET' };
}
function rpc(name, body = {}) {
  return {
    name: `RPC ${name}`,
    url: `${rest}/rpc/${name}`,
    method: 'POST',
    body,
  };
}
function edge(path, method = 'GET', body) {
  return {
    name: `${method} fn/${path}`,
    url: `${fn}/${path}`,
    method,
    body,
  };
}

const discovered = await discover();
const { ideaId, projectId, projectSlug, username, profileId } = discovered;

const endpoints = [
  restGet('/ideas?select=*&order=created_at.desc'),
  restGet(
    '/ideas?select=id,title,status,votes,votes_public,created_at,tags,category,user_id,summary&order=created_at.desc'
  ),
  restGet(`/ideas?id=eq.${encodeURIComponent(ideaId)}&select=*`),
  restGet('/comments?select=idea_id'),
  restGet(`/comments?idea_id=eq.${encodeURIComponent(ideaId)}&select=id,content,created_at,user_id,parent_id`),
  restGet('/projects?select=id,slug,title,phase,status,sort_order,created_at'),
  projectSlug
    ? restGet(`/projects?slug=eq.${encodeURIComponent(projectSlug)}&select=*`)
    : null,
  projectId
    ? restGet(`/tasks?project_id=eq.${encodeURIComponent(projectId)}&select=*&order=created_at.asc`)
    : restGet('/tasks?select=id,status,project_id&limit=20'),
  restGet(`/profiles?username=eq.${encodeURIComponent(username)}&select=id,username,avatar_url,bio,pinned_badge_key`),
  restGet(`/profiles?username=ilike.${encodeURIComponent(username)}&select=id,username`),
  restGet('/idea_tags?select=name,slug,status,usage_count&order=usage_count.desc'),
  restGet('/community_showcase_posts?status=eq.approved&select=id,title,status,likes,likes_public,created_at'),
  restGet('/votes?select=idea_id,user_id'),
  rpc('get_public_community_stats'),
  rpc('get_public_support_summary'),
  rpc('get_public_recent_donations', { p_limit: 8 }),
  rpc('get_ai_service_availability'),
  rpc('get_my_ai_token_balance'),
  rpc('list_forge_awards_for_targets', {
    p_target_type: 'idea',
    p_target_ids: [String(ideaId)],
  }),
  profileId ? rpc('get_public_user_badges', { p_user_id: profileId }) : null,
  profileId
    ? rpc('get_public_forge_marks_profile', { p_user_id: profileId })
    : null,
  rpc('debug_auth_context'),
  {
    name: 'GET auth/v1/user (anon)',
    url: `${auth}/user`,
    method: 'GET',
    extraHeaders: { Authorization: `Bearer ${anon}` },
  },
  edge('ai-token-status', 'GET'),
  edge('create-checkout', 'POST', { priceId: 'price_missing', fundType: 'studio' }),
  edge('create-token-checkout', 'POST', { packId: 'starter' }),
].filter(Boolean);

console.log(
  JSON.stringify(
    {
      target: base,
      concurrency: CONCURRENCY,
      perEndpoint: PER_ENDPOINT,
      discovered,
    },
    null,
    2
  )
);

const report = [];

for (const ep of endpoints) {
  const initBase = {
    method: ep.method,
    headers: {
      ...headers,
      ...(ep.method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
      ...(ep.extraHeaders || {}),
    },
    ...(ep.body != null ? { body: JSON.stringify(ep.body) } : {}),
  };
  for (let i = 0; i < WARMUP; i++) {
    await timedFetch(ep.url, initBase);
  }
  const jobs = Array.from({ length: PER_ENDPOINT }, () => ep);
  const samples = await runPool(jobs, CONCURRENCY, () => timedFetch(ep.url, initBase));
  const stats = summarize(samples);
  const bytes = samples.reduce((a, s) => a + (s.bytes || 0), 0);
  report.push({
    name: ep.name,
    ...stats,
    avgBytes: Math.round(bytes / samples.length),
  });
  const flag =
    stats.p95 != null && stats.p95 >= 800
      ? ' SLOW'
      : stats.err > 0 && !/401|400|403/.test(Object.keys(stats.statuses).join(','))
        ? ' ERR'
        : '';
  console.log(
    `${ep.name.padEnd(72)} p50=${String(stats.p50).padStart(4)} p95=${String(stats.p95).padStart(4)} max=${String(stats.max).padStart(4)} ok=${stats.ok}/${stats.n} ${JSON.stringify(stats.statuses)}${flag}`
  );
}

const slow = report.filter((r) => r.p95 != null && r.p95 >= 500);
const failed = report.filter((r) => r.err > 0);
console.log('\n--- summary ---');
console.log(JSON.stringify({ slow, failed: failed.map((f) => ({ name: f.name, statuses: f.statuses, sampleError: f.sampleError })) }, null, 2));
