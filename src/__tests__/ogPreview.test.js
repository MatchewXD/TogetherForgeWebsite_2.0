import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_IMAGE,
  escapeHtml,
  ideaMeta,
  projectMeta,
  renderOgHtml,
  safeImage,
  summarize,
} from '../../api/_lib/ogHtml.js';

describe('share preview HTML', () => {
  it('escapes user text everywhere it is placed', () => {
    const html = renderOgHtml({
      title: '"><script>alert(1)</script>',
      description: `it's <b>bold</b> & "quoted"`,
      path: '/ideas/7',
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('og:url" content="https://togetherforge.net/ideas/7"');
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  it('falls back to the site description and image', () => {
    const html = renderOgHtml({ path: '/' });
    expect(html).toContain(`og:image" content="${DEFAULT_IMAGE}"`);
    expect(html).toContain(DEFAULT_DESCRIPTION);
    expect(html).toContain('<title>Together Forge</title>');
  });

  it('only accepts absolute https images', () => {
    expect(safeImage('https://x.supabase.co/storage/a.png')).toBe(
      'https://x.supabase.co/storage/a.png'
    );
    expect(safeImage('http://insecure.example/a.png')).toBe(DEFAULT_IMAGE);
    expect(safeImage('javascript:alert(1)')).toBe(DEFAULT_IMAGE);
    expect(safeImage('https://x.example/a.png" onerror="x')).toBe(DEFAULT_IMAGE);
    expect(safeImage(null)).toBe(DEFAULT_IMAGE);
  });

  it('summarizes long markdown text at a word boundary', () => {
    const s = summarize(`# Heading\n\n**Bold** text with a [link](https://x.example) ${'word '.repeat(80)}`);
    expect(s.length).toBeLessThanOrEqual(200);
    expect(s.endsWith('…')).toBe(true);
    expect(s).toContain('Bold text with a link');
    expect(s).not.toMatch(/[#*]/);
  });

  it('builds idea previews and hides drafts', () => {
    expect(
      ideaMeta({ title: 'Bastion', summary: 'Hold the line', image_url: 'https://i/x.png', status: 'Proposed' }, '7')
    ).toEqual({ title: 'Bastion', description: 'Hold the line', image: 'https://i/x.png', path: '/ideas/7' });
    expect(ideaMeta({ title: 'Secret', status: 'Draft' }, '8')).toEqual({
      title: 'Ideas',
      path: '/ideas/8',
      type: 'website',
    });
    expect(ideaMeta(null, '9').title).toBe('Ideas');
  });

  it('builds project previews', () => {
    expect(projectMeta({ title: 'Tether', description: 'Crew game' }, 'tether')).toEqual({
      title: 'Tether',
      description: 'Crew game',
      path: '/projects/tether',
    });
    expect(projectMeta(null, 'early').title).toBe('Projects');
  });
});

describe('og function', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function load() {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://proj.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    return import('../../api/og.js');
  }
  const run = async (mod, url) => {
    const headers = {};
    let body = '';
    const res = {
      statusCode: 0,
      setHeader: (k, v) => (headers[k] = v),
      end: (b) => (body = b),
    };
    await mod.default({ url }, res);
    return { status: res.statusCode, headers, body };
  };

  it('serves an idea preview from the public row', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ title: 'Bastion', summary: 'Hold the line', status: 'Proposed' }]))
    );
    vi.stubGlobal('fetch', fetchMock);
    const out = await run(await load(), '/api/og?type=idea&id=7');
    expect(out.status).toBe(200);
    expect(out.headers['Content-Type']).toMatch(/text\/html/);
    expect(out.headers['Cache-Control']).toMatch(/s-maxage=600/);
    expect(out.body).toContain('og:title" content="Bastion | Together Forge"');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://proj.supabase.co/rest/v1/ideas?select=title,summary,description,problem_statement,image_url,status&id=eq.7&limit=1'
    );
  });

  it('never passes unvalidated input to the database', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const mod = await load();
    for (const url of [
      '/api/og?type=idea&id=7;drop',
      '/api/og?type=idea&id=1&id=eq.2',
      '/api/og?type=project&slug=../secrets',
      '/api/og?type=project&slug=a%26select%3D*',
      '/api/og?type=other',
    ]) {
      const out = await run(mod, url);
      expect(out.status).toBe(200);
      expect(out.body).toContain('og:title');
    }
    // "id=1&id=eq.2" resolves to the first value "1": one safe lookup, nothing else
    expect(fetchMock.mock.calls.every(([u]) => /id=eq\.\d+&limit=1$/.test(u))).toBe(true);
  });

  it('falls back to the generic card when the database fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const out = await run(await load(), '/api/og?type=project&slug=tether');
    expect(out.status).toBe(200);
    expect(out.body).toContain('og:title" content="Projects | Together Forge"');
  });
});

describe('vercel.json crawler rewrites', () => {
  const vercel = JSON.parse(
    readFileSync(resolve(__dirname, '../../vercel.json'), 'utf8')
  );
  const rewrites = vercel.rewrites;

  it('routes crawlers before the SPA catch-all', () => {
    const idea = rewrites.findIndex((r) => r.destination.startsWith('/api/og?type=idea'));
    const project = rewrites.findIndex((r) => r.destination.startsWith('/api/og?type=project'));
    const spa = rewrites.findIndex((r) => r.destination === '/index.html');
    expect(idea).toBeGreaterThanOrEqual(0);
    expect(project).toBeGreaterThanOrEqual(0);
    expect(idea).toBeLessThan(spa);
    expect(project).toBeLessThan(spa);
  });

  it('only matches link-preview crawlers, not browsers', () => {
    const rule = rewrites.find((r) => r.destination.startsWith('/api/og?type=idea'));
    const re = new RegExp(`^${rule.has[0].value}$`);
    expect(rule.has[0]).toMatchObject({ type: 'header', key: 'user-agent' });
    for (const ua of [
      'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
      'Twitterbot/1.0',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
      'WhatsApp/2.23.20.0',
      'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
      'TelegramBot (like TwitterBot)',
    ]) {
      expect(re.test(ua), ua).toBe(true);
    }
    for (const ua of [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    ]) {
      expect(re.test(ua), ua).toBe(false);
    }
  });
});
