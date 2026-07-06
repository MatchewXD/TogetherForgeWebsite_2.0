# Together Forge — Consolidated Project Plan

Last updated: 2026-07-05 (derived from ROADMAP.md and repo state)

Overview
- Single consolidated, actionable plan for the Together Forge website based on the existing ROADMAP.md and current codebase.
- This file is intended to be the canonical source for implementation tasks, priorities, and next steps. Older planning files will be left in-place unless you confirm archival or deletion.

Primary Goals
- Implement and stabilize the Game Ideas system (submit, edit, view, threaded comments).
- Finish core site pages (Home, About, Projects, How It Works, Support, Transparency Hub).
- Harden Supabase integrations (schema migrations, RLS policies) and verify persistence for new idea fields.
- Add community features (profiles, tasks/volunteer board, project hub) in Phase 2.

Assumptions
- Client is a React + Vite SPA that uses supabase-js to interact directly with Postgres via Supabase.
- .env.local contains VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for local testing.
- The codebase already contains an updated IdeaSubmit and IdeaEdit implementation (dynamic lists, tag dedupe, delete flow). DB migrations/policies may still be pending.

Top Priorities (short term)
1. Confirm and apply DB migrations
   - Ensure the ideas table contains: features (jsonb), enemies (jsonb), additional_notes (jsonb), progression_type, progression_details, economy_resource, economy_trading, has_main_story, story_overview, has_endgame, endgame_details.
   - Run ALTER TABLE statements in supabase_schema.sql if not yet applied.
2. Audit & tighten RLS policies
   - Insert/update/delete policies for ideas: owners can update/delete only their rows; public can select.
   - Verify policies allow the client to write the new columns and that inserts/updates return helpful error messages when blocked.
3. Verify client persistence
   - Submit a new idea and edit an existing idea locally; confirm all new fields persist and render in IdeaDetail.
4. UX polish and validation
   - Add visible counters/limits on long fields (title/summary/description/features list counts, enemies, notes).
   - Add server-side validation or DB constraints if required (lengths/array sizes) to prevent mismatches.

Phase 2 (mid-term)
- Profiles and public profile viewing (RLS-protected editing).
- Contribution badges and volunteer task board (internal launch first).
- Threaded discussions / forums linked to ideas.
- Sorting and voting systems with decay-weighting for popularity ranking.

Deliverables & Acceptance Criteria
- Ideas: submit/edit/delete works for owners; all structured fields persist; IdeaDetail shows them correctly.
- RLS: policies applied for ideas and other protected tables; unauthorized writes fail with explicit supabase error.
- UX: User-facing counters and inline confirmations (no browser confirm) present and accessible.

Action Items (next 7 days)
1. Developer: Run supabase_schema.sql in Supabase and confirm all suggested columns exist. (1 day)
2. Developer: Run manual tests — submit, edit, delete idea flows, inspect network responses for Supabase errors. (1 day)
3. Developer: Add UI counters and validation messages for long text and list limits. (2 days)
4. Developer: Create or adjust RLS policies for owner-only updates/deletes and test. (1 day)
5. Optional: Add server-side constraints or migration to enforce array sizes/lengths. (2 days)

Archival policy for plan files
- I will not delete or modify any existing planning files unless you explicitly confirm archival or deletion.
- Recommended: move old plan files to docs/archive/ rather than permanent deletion so history is preserved.

If you'd like me to archive or remove old planning files now, reply with "Archive plans" or "Delete plans" and I will proceed.
