# Supabase SQL scripts

Run these in the **Supabase SQL Editor** (or via CLI migrations) as needed.

| File | Purpose |
|------|---------|
| `supabase_schema.sql` | Base schema (ideas, profiles, donations shell, RLS starters) |
| `supabase_tasks_schema.sql` | Projects, tasks, claims, activity |
| `supabase_task_hierarchy.sql` | `parent_task_id`, max 3 nesting levels, parent progress rollup |
| `supabase_task_claim_hierarchy_rules.sql` | Claim only Medium/Small leaves; progress requires active claim |
| `supabase_helpers_join_dedupe.sql` | Approve join → append helper to claim (deduped) |
| `supabase_join_request_no_dupes.sql` | Block second join request on same claim/task |
| `supabase_bug_reports.sql` | Public bug tracker + screenshots bucket RLS |
| `supabase_ideas_guided.sql` | Guided idea fields + workflow status |
| `supabase_ideas_project_id.sql` | Link ideas to projects |
| `supabase_votes_rls.sql` | Idea votes RLS + unique index |
| `supabase_claim_limit.sql` | Active task claim cap (superseded by anti-hoarding) |
| `supabase_claim_anti_hoarding.sql` | Claim limits, cooldown, auto-release, join requests |
| `supabase_moderation.sql` | Staff moderation + content reports |
| `supabase_founders_thoughts.sql` | Founders Thoughts + likes |
| `supabase_donations_stripe.sql` | Stripe donation columns + summary RPC |
| `supabase_donations_public_feed.sql` | MRR + recent public donation feed RPCs |
| `supabase_stripe_subscriptions.sql` | Webhook event log + subscription rows (for MRR) |
| `supabase_mechanic_demos.sql` | Future Mechanic Lab tables |

Edge Functions live in `../functions/`. Function env: `../.env` (see `../.env.example`).
