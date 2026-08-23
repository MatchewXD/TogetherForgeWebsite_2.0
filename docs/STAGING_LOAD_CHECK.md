# Staging load check (soft-launch readiness)

Date: 2026-08-23  
Target: Together Forge Staging (`qoriotympchrtxhjcfux`, us-west-2, ACTIVE_HEALTHY)  
Production (`lbstantgrrrupzeasndg`) was **not** touched (INACTIVE / paused).  
Method: read-mostly REST + RPC, modest concurrency. No vote/claim/write storms.  
Script (reusable): `node scripts/staging-load-check.mjs` (reads `.env.staging`, aborts if the URL is not staging).

Dataset on staging is still tiny: 7 ideas, 8 profiles, 10 tasks, 3 projects, 1 comment, 10 votes, 12 donations. Latency here is **API/compute overhead**, not disk I/O.

---

## What was tested

| Path | How | Result |
|------|-----|--------|
| Ideas list (`select=*` + `order=created_at.desc`) | 8 concurrent × 24 | 200, p50 61ms, p95 148ms |
| Ideas list (narrow columns) | same | 200, p50 48ms, p95 67ms |
| Idea detail (`id=eq.7`) | same | 200, p50 44ms, p95 83ms |
| Comments (all `idea_id`, and by idea) | same | 200, p50 42–47ms |
| Projects list + slug lookup | same | 200, p50 43–47ms |
| Tasks for a project | same | 200, p50 44ms, p95 51ms |
| Public profile (`username=eq` and `ilike`) | same | 200, p50 46–47ms |
| Idea tags, showcase approved feed, votes | same | 200 |
| `get_public_community_stats` | same | 200, p50 46ms |
| `get_public_support_summary` | same | 200, p50 47ms |
| `get_public_recent_donations(limit_n, p_fund_type)` | one-shot | 200, ~202ms |
| `list_forge_awards_for_targets` (idea 7) | 8×24 | 200, p50 51ms |
| `get_public_user_badges` / `get_public_forge_marks_profile` | 8×24 | 200, p50 45–47ms |
| `get_ai_service_availability` | 8×24 | 200, p50 46ms |
| `GET functions/v1/ai-token-status` | 8×24 | 200, **p50 348ms, p95 572ms, max 3988ms** |
| `get_my_ai_token_balance` as anon | 8×24 | 401 (expected) |
| `GET auth/v1/user` as anon | 8×24 | 401 (expected) |
| `POST create-checkout` (no amount) | 8×24 | 400 “Minimum amount is $1.00” |
| `POST create-token-checkout` as anon | 8×24 | 401 “Sign in required…” |
| `get_my_claim_quota` as anon | one-shot | 200, `signed_in: false` |
| Mixed page burst (ideas list + detail + home + project + profile) | 12 concurrent × 6 waves, 222 req in 1.15s (~193 rps) | all 200; p50 ~90–110ms, p95 ~490–546ms |

Claiming / status writes were **not** hammered (would pollute staging boards). Indexes and RPCs for claims exist (`claim_task(p_task_id uuid)`, `get_my_claim_quota()`). `task_claims` is empty on staging.

---

## Slow or problematic paths

### 1. Ideas listing shape (main hard-launch risk)

`ideasService.getIdeasListing()` today:

1. `SELECT * FROM ideas ORDER BY created_at DESC` (whole table)
2. `SELECT idea_id FROM comments` (whole comments table, counted in JS)
3. Profile `IN (...)` for creators
4. Optional parent-idea round trip

Filters (tags, category, **Adopted by Together Forge**, sort, search) run **in the browser**. Fine at 7 ideas. This will not stay fine at hundreds/thousands of ideas: payload size, PostgREST row cap (default 1000), and client CPU.

Narrow `select=` was ~2× faster than `select=*` even at 7 rows (p95 67ms vs 148ms).

### 2. Edge Function cold start: `ai-token-status`

Only endpoint with a slow tail: p95 572ms, one call at **3988ms**. Direct RPC `get_ai_service_availability` is ~46ms. The extra cost is the Edge runtime, not SQL.

### 3. Burst p95 ~500ms at ~193 rps

No errors, no idle-in-transaction. Staging `max_connections` is **60**; after the burst, ~22 sessions were open (idle, not locked). Tail latency is pool/compute queueing on a small instance, not missing indexes on this dataset.

### 4. High sequential-scan *counts* (not current slowness)

`pg_stat_user_tables` (lifetime on this project):

- `profiles`: 9058 seq scans / 8 live rows — `get_public_community_stats` does `count(*)` on profiles
- `comments`: 664 seq scans / **0 index scans** — listing does `select idea_id` with no `WHERE`
- `projects`, `tasks`, `ideas`: many seq scans; expected while tables fit in one page

These scans are cheap today. They become the first thing that hurts if row counts grow 100× without query changes.

### 5. Support recent-donations RPC is deployed

First probe used the wrong argument name (`p_limit`) and got PostgREST `PGRST202`. The live signature is `get_public_recent_donations(limit_n integer, p_fund_type text)`. The app already uses those names. Not a production bug.

Auth/checkout denials above are **correct** fail-closed behavior, not defects.

---

## Indexes (live on staging)

**Present and appropriate**

- `ideas`: `status`, `project_id`, `user_id`, `parent_idea_id`, `public_id`, GIN `guided_data`
- `comments`: `idea_id`, `parent_id`, `user_id`
- `votes`: `(idea_id, user_id)` unique, plus idea/user
- `profiles`: unique `username`, unique `lower(username)`, `id`, pinned badge
- `projects`: unique `slug`, `(phase, status)`
- `tasks`: `project_id`, `status`, parent/hierarchy
- `task_claims`: task, user, status, one-open-claim unique
- `forge_awards`: `(target_type, target_id)`, giver/receiver
- `user_badges`: `(user_id, badge_key)`
- `donations`: status, fund, user, project, stripe ids
- `idea_tags`: slug unique, `lower(name)`, status, usage
- Showcase public feed / moderation queue indexes
- AI token ledger by user/created

**Missing (optional until volume grows)**

```sql
-- Ideas hub default sort
create index if not exists idx_ideas_created_at_desc
  on public.ideas (created_at desc);

-- Public listing: skip drafts without a seq scan later
create index if not exists idx_ideas_public_created
  on public.ideas (created_at desc)
  where coalesce(status, 'Proposed') is distinct from 'Draft';

-- Adopted filter if it moves server-side
create index if not exists idx_ideas_status_created
  on public.ideas (status, created_at desc);

-- Community stats COUNT(*)
-- (optional; a 30–60s cached RPC is better than another index)
```

Do **not** add these yet unless listing is moved server-side; they will not change current p50.

---

## Recommended work before hard launch

Priority order:

1. **Server-side ideas listing** — paginate; `select` only list columns; filter status/tags/adopted/sort in SQL or a single RPC. Keep client filter only as a fallback.
2. **Comment counts** — replace `select idea_id` + JS tally with `select idea_id, count(*)` (group) or a denormalized `comment_count` (same pattern as `votes`).
3. **Cache Home stats** — `get_public_community_stats` is four `count(*)`s. A 30–60s result (or materialized counts) will keep Home cheap when `profiles`/`ideas` grow.
4. **Warm or slim `ai-token-status`** — avoid a cold Edge Function on every Idea AI panel mount; reuse `get_ai_service_availability` + `get_my_ai_token_balance` when the edge tail is unacceptable, or keep the function warm.
5. **Add `idx_ideas_created_at_desc` (and the partial public index)** when listing is paginated.
6. **Watch connections** — 60 max on this project size. Use the Supabase pooler for the app; don’t open a new client per request in Edge Functions.
7. **Re-run this script** after data is closer to launch volume (hundreds of ideas/comments), not only on 7 rows.

Not blocking for soft launch: claim-path write load, extra donation indexes, tag GIN on `ideas.tags` (tags are filtered in JS today; a `text[]`/join table would be needed for server-side tag match).

---

## Soft launch vs hard launch

**Soft launch: yes, current staging setup looks ready.** Public reads succeed, p50 is ~45–60ms on REST, auth/checkout fail closed, awards/badges/marks/support/stats/tasks/projects/profiles all responded 200 under 8-way repeats. No lock pile-up, no timeout, no connection exhaustion. The vote RPC path was already fixed separately.

**Hard launch: not yet on listing architecture.** The ideas hub will not scale by “more indexes alone” while it downloads every idea and every comment id. Do items 1–4 above, then repeat a load check with a realistic row count. Edge Function tail (AI token status) should be treated as a UX issue (spinner / stale cache), not a DB issue.
