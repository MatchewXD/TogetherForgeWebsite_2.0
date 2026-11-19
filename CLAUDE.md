# CLAUDE.md

Guidance for Claude Code (and other agents) working in this repo.

## What this is

The website for **Together Forge**, a community-funded indie game studio, live at
[togetherforge.net](https://togetherforge.net). It is the studio's community hub: public project
task boards people can claim work from (the active project is **Tether**), the Ideas board, the
**Get Involved** page (volunteer applications, ways to help), Open Questions, Polls, Showcase,
profiles/badges/Forge Marks, support/donations, and a public Transparency hub. Staff tools live in
the Moderator dashboard. See `README.md` for the product overview.

## Stack

- **Client:** React 19 single-page app, Vite 8, React Router 7, Tailwind CSS 3 (+ PostCSS/autoprefixer),
  framer-motion, lucide-react, react-markdown. Plain **JavaScript/JSX** (no TypeScript in `src/`).
  ES modules (`"type": "module"`).
- **Backend:** Supabase (Postgres + RLS, Auth incl. OAuth and MFA, Storage, Realtime, Edge Functions
  written in Deno TypeScript).
- **Payments:** Stripe (checkout, subscriptions, billing portal, webhooks) and a Ko-fi webhook for
  the Founder Runway.
- **Hosting:** Vercel (`vercel.json`, the `api/` serverless function, `VERCEL_GIT_COMMIT_SHA` in
  `vite.config.js`). `public/_headers` mirrors the same headers for Netlify/Cloudflare Pages.
- **Tests:** Vitest 4 + jsdom + Testing Library. **Lint:** oxlint (`.oxlintrc.json`).
- CI: `.github/workflows/ci.yml` on Node 22.

## Commands

All defined in `package.json` (scripts) or `.github/workflows/ci.yml`. Run from the repo root.

| Command | What it does | Source |
|---|---|---|
| `npm install` / `npm ci` | Install dependencies | README / CI |
| `npm run dev` | Vite dev server against the Supabase in `.env.local` | package.json |
| `npm run dev:staging` | Dev server in `staging` mode (uses `.env.staging`) | package.json |
| `npm run build` | Production build to `dist/` | package.json |
| `npm run build:staging` | Build in staging mode | package.json |
| `npm run preview` | Serve `dist/` with production security headers | package.json |
| `npm run lint` | oxlint | package.json |
| `npm test` | Vitest in watch mode | package.json |
| `npx vitest run` | Vitest single run (what CI uses) | ci.yml |

**Verification commands** (the CI job, run all three before handing work back):

1. `npm run lint`
2. `npx vitest run`
3. `npm run build`

Tests do not need `.env.local`: `vite.config.js` sets placeholder `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` for tests, and tests mock network calls.

Other repo tooling (not part of verification):

- `node scripts/staging-load-check.mjs`: read-mostly load probe against **staging only** (reads
  `.env.staging`, aborts if the URL is not staging). See `docs/STAGING_LOAD_CHECK.md`.
- `scripts/apply-staging-sql.ps1`: applies `supabase/sql` in order to the **linked** Supabase project.
- `scripts/apply-hardening.ps1 -Target staging|production`: applies hardening SQL and redeploys
  browser-facing Edge Functions. Staging first.
- `scripts/generate-tether-*-sql.mjs`: generate the Tether task-tree SQL from `src/data/tetherTaskTree*.js`.

These touch real Supabase projects. Never run them unless the task explicitly asks.

## Layout

```
src/
  main.jsx, App.jsx        app entry; routes (pages are lazy-loaded via lib/lazyPage.js)
  pages/                   one file per route; big pages split into pages/workspace/ (project
                           task board) and pages/moderator/ (staff dashboard tabs)
  components/              UI by feature (tasks/, ideas/, account/, support/, ui/ shared kit, ...)
  services/                all Supabase access (ideasService, tasksService, ...); tasks logic is
                           split under services/tasks/ (claims, review, rules, selects, ...)
  constants/               feature flags (*Enabled.js) and fixed copy/config
  utils/                   pure helpers (most have unit tests)
  hooks/, context/         shared React hooks and providers
  data/                    static/demo data, Tether task-tree definitions
  content/legal/           Terms, Privacy, Guidelines, Payments text
  lib/                     supabase client, error reporter, Turnstile, lazy page loader
  __tests__/               all unit/component tests (*.test.js / *.test.jsx)
api/og.js                  Vercel function: share-preview HTML for crawlers (see vercel.json rewrites)
supabase/
  sql/                     hand-applied, idempotent SQL scripts (schema, RLS, RPCs, data fixes);
                           apply order and troubleshooting in supabase/sql/README.md
  functions/               Edge Functions (claim-task, create-checkout, stripe-webhook, kofi-webhook,
                           submit-volunteer-application, submit-concern-report, idea-* AI tools, ...)
  functions/_shared/       shared Edge code (origin allowlist, auth, rate limiting, Turnstile, ...)
docs/                      staging isolation, Stripe setup/deploy, manual QA checklist, load check
public/                    static assets (images in .png + .webp), boot.js, _headers
security-headers.mjs       single source for CSP/security headers (dev, preview)
```

Loose root files (`TF_Guide.txt`, `Tether_Task_Breakdown_v0.6.txt`, `Vera.txt`, `body.txt`,
`build_tree.bat`) are notes, not part of the build. `.github/copilot-instructions.md` holds an old
schema snapshot and is out of date; trust `supabase/sql` instead.

## Supabase

- **Client:** `src/lib/supabase.js` creates the one shared client from `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`. Its custom fetch makes sure PostgREST/Functions/Storage calls carry the
  user's JWT (not the anon key), so `auth.uid()` works in RPCs. Don't create other clients in `src/`.
- **Access goes through `src/services/*`.** Pages and components call services, not `supabase` directly.
- **Tables** (main ones): `profiles`, `ideas`, `comments`, `votes`, `idea_tags`, `projects`, `tasks`,
  `task_claims`, `task_dependencies`, `task_suggestions`, `task_scope_requests`, `open_questions`,
  `polls`/`poll_options`/`poll_votes`, `volunteer_applications`, `donations`, `forge_awards`,
  `forge_mark_ledger`, `user_badges`, `ai_token_*`, `conduct_*`, `traffic_*`, `edge_rate_limits`,
  `client_error_log`. Definitions are in `supabase/sql/*.sql`; there is no migrations folder and no
  local schema tooling in the repo.
- **Row Level Security:** tables are created with RLS enabled in their SQL scripts; anon/authenticated get only the grants
  they need, and privileged writes go through `security definer` RPCs or Edge Functions using the
  service role (e.g. task claims via `claim-task`, Get Involved / concern forms via their functions).
  Staff checks use `is_staff()` / `is_project_staff()`. When adding a table: enable RLS, write
  policies, add explicit grants, and keep it in an idempotent SQL file.
- **Applying SQL:** scripts are run by hand (SQL Editor or `supabase db query --linked -f ...`),
  **staging first, then production**. Don't apply SQL to any project yourself unless asked.
- **Environments:** local/dev, staging (separate Supabase project + Stripe test keys) and production
  (main project + Stripe live keys) must never share keys or data. Read `docs/STAGING_ISOLATION.md`
  before touching env, payments or deploy config.

### Env vars and secrets

- Client env (only `VITE_*`, all public): templates `.env.example` (copy to `.env.local`),
  `.env.staging.example`, `.env.production.example`.
- Edge Function secrets: `supabase/.env.example` (copy to `supabase/.env` for local functions);
  hosted projects use `supabase secrets set`. Checklists: `supabase/.env.staging.example`,
  `supabase/.env.production.example`.
- Feature flags: `VITE_ENABLE_DONATIONS`, `VITE_ENABLE_RUNWAY`, `VITE_ENABLE_POLLS`,
  `VITE_ENABLE_CLAIMS`, `VITE_TURNSTILE_SITE_KEY` (client) mirrored by `ENABLE_*` / `TURNSTILE_SECRET_KEY`
  on the Edge side. Parsing lives in `src/constants/*Enabled.js` and `supabase/functions/_shared/`.
- **Never commit secrets.** `.env`, `.env.local`, `.env.staging`, `.env.production`, `supabase/.env*`
  are gitignored; don't read them into commits, logs or notes. Never put `sk_*`, `whsec_*`, the
  service_role key or any other secret in a `VITE_*` variable (it ships to the browser).

## Deployment

- The site is a static Vite build on Vercel. `vercel.json` sets security headers, cache headers,
  the `/projects/prototype-systems` redirect, crawler rewrites to `/api/og`, and the SPA fallback to
  `index.html`. How deploys are triggered is not documented in the repo; don't deploy unless asked.
- Edge Functions deploy with the Supabase CLI, e.g. `supabase functions deploy <name> --no-verify-jwt`
  (see `docs/STRIPE_WEBHOOK_DEPLOY.md` and `scripts/apply-hardening.ps1`). Origins allowed to call
  them are in `supabase/functions/_shared/origins.ts` plus `ALLOWED_ORIGINS`.
- Security headers must stay in sync across `security-headers.mjs`, `vercel.json` and
  `public/_headers`; `src/__tests__/securityHeaders.test.js` enforces this. If you add a third-party
  host (script, iframe, API), update all three.
- Before release or after auth/billing changes, use `docs/MANUAL_TEST_CHECKLIST.md`.

## Coding conventions

- Follow existing style: 2-space indent, single quotes, semicolons in `src/`, function components
  and hooks, Tailwind utility classes (theme in `tailwind.config.js`).
- New route pages are added in `App.jsx` with `lazyPage(() => import(...))`.
- Keep Supabase calls in a service; keep pure logic in `utils/` or `constants/` so it can be unit
  tested. Add tests in `src/__tests__/` (`describe`/`it` from vitest, mock the service or
  `../lib/supabase`), named after the module (`fooService.test.js`, `Component.test.jsx`).
- Feature flags follow the `*Enabled.js` pattern: parse env, default safely, test the parsing.
- Edge Functions: reuse `_shared/` helpers (origin check, auth, rate limit, Turnstile) rather than
  re-implementing them; fail closed.
- SQL files: idempotent (`create ... if not exists`, `create or replace`), comment the purpose at the
  top, note "run on staging first".
- Images: ship `.webp` alongside `.png` in `public/images/`.
- User-facing copy is plain, calm and specific.
- Commit messages: a short imperative sentence (e.g. "Hide completed tasks on the Task Map by
  default"), no type prefixes.

## Performance-sensitive areas (heavy launch traffic expected)

- **Every visitor:** `TrafficBeacon` calls the `record_traffic_heartbeat` RPC every 40s
  (`src/constants/traffic.js`). Keep it cheap; `supabase_scale_prep.sql` already throttled it.
- **Realtime fan-out:** `Navbar.jsx` subscribes to `postgres_changes` on the whole `profiles` table
  (no filter) and filters rows in the browser, so every connected client receives every profile
  change. `UserNoticesContext.jsx` uses a per-user channel. Prefer filtered channels for new code.
- **Ideas listing:** `GameIdeas` uses the paginated `ideasService.getIdeasListingPage`. The older
  `getIdeasListing()` (all ideas plus all comment ids, counted in JS) is still used by
  `contributorsService.js` and will grow with the tables.
- **Home stats:** `get_public_community_stats` runs several `count(*)`s per call and is not cached.
- **Edge Function cold starts:** `ai-token-status` showed multi-second tails in the staging load
  check; don't put Edge calls on the critical render path.
- **Connections:** the staging project allows 60 Postgres connections; don't open a new Supabase
  client per request in Edge Functions.
- Rate limits for Edge Functions are durable (`edge_rate_limits`, `_shared/rateLimit.ts`).
- Static caching is set in `vercel.json` (`/assets` immutable, `/images` 1 day + SWR). Route pages
  are code-split; `lazyPage` reloads once if a chunk is missing after a deploy.
- Background: `docs/STAGING_LOAD_CHECK.md` (findings and recommended pre-launch work).
