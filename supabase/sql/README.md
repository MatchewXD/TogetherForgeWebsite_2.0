# Supabase SQL scripts

Run these in the **Supabase SQL Editor** (or via CLI migrations) as needed.

| File | Purpose |
|------|---------|
| `supabase_schema.sql` | Base schema (ideas, profiles, donations shell, RLS starters) |
| `supabase_profiles_banner.sql` | profiles.banner_url + avatars storage policies for banner uploads |
| `supabase_tasks_schema.sql` | Projects, tasks, claims, activity |
| `supabase_projects_completion.sql` | Project summary, completed_at, completion_links (Early + Released Games) |
| `supabase_projects_release_meta.sql` | Optional release_meta JSON for Released Game Detail (media, platforms, ratings) |
| `supabase_official_videos.sql` | Official Media library (`official_videos`) + RLS + demo seed for /media |
| `supabase_community_showcase.sql` | Community Showcase posts + pending queue + staff moderation RLS |
| `supabase_require_auth_to_post.sql` | Block guest inserts for showcase + bugs (signed-in only) |
| `supabase_community_showcase_likes.sql` | Showcase post likes (per-user) + denormalized likes count |
| `supabase_project_contributions.sql` | Public credits per project (Contributors pages + future Released Games) |
| `supabase_contributions_memorial.sql` | Permanent credits ledger (creates table if needed) + auto-record task/showcase |
| `supabase_donation_project_attribution.sql` | Attach studio donations to active In Development project; public credit RPC |
| `supabase_task_hierarchy.sql` | `parent_task_id`, max 3 nesting levels, parent progress rollup |
| `supabase_task_claim_hierarchy_rules.sql` | Claim only Medium/Small leaves; progress requires active claim |
| `supabase_helpers_join_dedupe.sql` | Approve join → append helper to claim (deduped) |
| `supabase_join_request_no_dupes.sql` | Block second join request on same claim/task |
| `supabase_bug_reports.sql` | Public bug tracker + screenshots bucket RLS |
| `supabase_ideas_guided.sql` | Guided idea fields + workflow status |
| `supabase_ideas_project_id.sql` | Link ideas to projects |
| `supabase_ideas_image.sql` | Optional idea image_url + idea-images storage bucket |
| `supabase_idea_tags.sql` | Hybrid idea tags catalog (curated + suggested, promote at 9 uses / staff approve), admin RPCs |
| `supabase_idea_parent.sql` | Related ideas: `parent_idea_id` adjacency list, one-level deep for v1, ready for deeper trees later |
| `supabase_platform_suggestions.sql` | Minimal platform/site suggestions (submit + list + staff status/hide) |
| `supabase_subscription_renewal_credit.sql` | Optional credit fields on stripe_subscriptions for monthly renewal recognition cards |
| `supabase_billing_account.sql` | Account My Plan + Billing: payment_kind, user subscription RPCs, own-row RLS |
| `supabase_votes_rls.sql` | Idea votes RLS + unique index |
| `supabase_claim_limit.sql` | Active task claim cap (superseded by anti-hoarding) |
| `supabase_claim_anti_hoarding.sql` | Claim limits, cooldown, auto-release, join requests |
| `supabase_claim_auto_release.sql` | Dual auto-release: 14d idle (last_activity) + 30d hard max; staff `run_claim_auto_release` |
| `supabase_task_review_workflow.sql` | Submit for review + lead accept/reject (blocks self-complete) |
| `supabase_task_anti_abuse.sql` | Progressive trust, submit velocity, identity gate, fake-work restrict + audit |
| `supabase_task_limit_bypass.sql` | Staff/test-account bypass for claim/submit rate limits (dev & internal testing) |
| `supabase_project_github.sql` | Per-project `github_url` + `contribution_meta` for Task Board → GitHub workflow |
| `supabase_public_profile_support.sql` | Profile GitHub field, show_donation_total opt-in, public support RPC |
| `supabase_badges.sql` | Badge grants (`user_badges`), pin on profiles, sync RPCs, task/donation/sub triggers; then `select backfill_all_user_badges();` |
| `supabase_identity_gate_github.sql` | Accept GitHub as identity-gate SSO (with Discord / Google) |
| `supabase_task_dependencies.sql` | Task “Blocked by” edges, locked until blockers Completed, staff override + claim gate |
| `supabase_moderation.sql` | Staff moderation + content reports |
| `supabase_founders_thoughts.sql` | Founders Thoughts + likes |
| `supabase_donations_stripe.sql` | Stripe donation columns + summary RPC |
| `supabase_donations_public_feed.sql` | MRR + recent public donation feed RPCs |
| `supabase_stripe_subscriptions.sql` | Webhook event log + subscription rows (for MRR) |
| `supabase_mechanic_demos.sql` | Future Mechanic Lab tables |

Edge Functions live in `../functions/`. Function env: `../.env` (see `../.env.example`).
