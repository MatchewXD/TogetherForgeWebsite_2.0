# Supabase SQL scripts

Run these in the **Supabase SQL Editor** or via CLI (`supabase db query --linked -f …`) after linking a project.

Most scripts are **idempotent / safe to re-run**. Prefer the ordered list below for a **new staging** (or empty) project.

Edge Functions live in `../functions/`. Function env: `../.env` (see `../.env.example`). Isolation: `../../docs/STAGING_ISOLATION.md`.

---

## Troubleshooting: `relation "public.ideas" does not exist`

That error means **core tables were never created** — later scripts were run while bootstrap failed or was skipped.

1. **Stop** cascading commands.
2. Apply core schema in the **Supabase Dashboard → SQL Editor** (most reliable for multi-statement DDL):
   - Open staging project → SQL → paste/run all of `supabase_schema.sql` → Run.
3. Verify:
   ```sql
   select to_regclass('public.ideas'), to_regclass('public.profiles');
   -- both must be non-null
   ```
   Or: `supabase db query --linked -f supabase/sql/supabase_verify_core.sql`
4. Only then re-run the rest of the ordered list (or `scripts/apply-staging-sql.ps1`).

**Do not continue** past a failed `supabase_schema.sql`. CLI `db query --linked` sometimes returns 400 without creating tables; Dashboard SQL Editor is the fallback.

Fail-fast helper (after `supabase link` to **staging**):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/apply-staging-sql.ps1
```

## Greenfield apply order (staging / new project)

Run **top to bottom**. Skip the “skip / optional” section unless you need those features.

**Gate:** after step 1 (`supabase_schema.sql`), confirm `ideas` + `profiles` exist before anything else.

### 1. Core + profiles + ideas foundation

1. `supabase_schema.sql` — ideas, profiles shell, donations shell, base RLS  
2. `supabase_moderation.sql` — `profiles.role`, `is_staff()`, content reports  
3. `supabase_profiles_api_grants.sql` — grants so anon/authenticated can read profiles (username check)  
4. `supabase_profiles_banner.sql` — banner_url + avatar/banner storage policies  
5. `supabase_public_profile_support.sql` — GitHub field, donation-total opt-in, public support RPC  
6. `supabase_votes_rls.sql` — idea votes RLS + unique index  
6b. `supabase_anti_abuse.sql` — rate limits, delayed public vote/like counts, spam checks  
7. `supabase_ideas_guided.sql` — guided fields + status  
8. `supabase_ideas_project_id.sql` — `ideas.project_id`  
9. `supabase_idea_parent.sql` — related ideas parent link  
10. `supabase_idea_tags.sql` — tag catalog + RPCs  
11. `supabase_ideas_insert_rls.sql` — authenticated owner-only idea insert  
11b. `supabase_ideas_table_grants.sql` — SELECT/UPDATE grants for drafts (required after insert-only RLS)  

### 2. Projects / tasks / claims (+ idea images after staff helper)

11. `supabase_tasks_schema.sql` — projects, tasks, claims, activity, `is_project_staff()`  
11b. `supabase_project_tether_slug.sql` — public slug Prototype Systems → `tether`  
11c. `supabase_projects_public_grants.sql` — projects/tasks SELECT grants + donation project_id backfill  
11d. `supabase_billing_table_grants.sql` — service_role INSERT/UPDATE on donations + subscriptions (webhook/sync)  
12. `supabase_ideas_image.sql` — idea image + storage (needs `is_project_staff`)  
13. `supabase_projects_completion.sql` — summary, completed_at, completion links  
14. `supabase_projects_release_meta.sql` — `release_meta` JSON for released games  
15. `supabase_project_github.sql` — per-project GitHub URL / contribution meta  
16. `supabase_task_hierarchy.sql` — parent_task_id, nesting rules  
17. `supabase_claim_anti_hoarding.sql` — claim caps, cooldown, join requests  
18. `supabase_claim_auto_release.sql` — idle 14d + hard max 30d release  
19. `supabase_task_claim_hierarchy_rules.sql` — claim leaf Medium/Small only  
20. `supabase_task_review_workflow.sql` — submit for review / accept / reject  
21. `supabase_parent_ready_for_review.sql` — parent → InReview when children done  
22. `supabase_task_anti_abuse.sql` — trust, velocity, identity gate, fake-work  
23. `supabase_identity_gate_github.sql` — GitHub counts for identity gate  
24. `supabase_task_dependencies.sql` — blocked-by edges  
25. `supabase_task_scope_requests.sql` — “scope larger than expected”  
26. `supabase_helpers_join_dedupe.sql` — approve join → helper append  
27. `supabase_join_request_no_dupes.sql` — no duplicate join requests  
27b. `supabase_task_staff_only.sql` — Staff Only flag; volunteers can view, only staff can claim  
27c. `supabase_task_board_scope.sql` — Staging vs Public board; staff-only staging; publish Epic/Medium  
27d. `supabase_open_questions.sql` — staff-initiated Open Questions; community Suggestions (support, reply, staff Adopt / close note)  

### 3. Contributions + media + community

28. `supabase_project_contributions.sql` — public credits table  
29. `supabase_contributions_memorial.sql` — permanent ledger + triggers  
30. `supabase_official_videos.sql` — Official Media library  
31. `supabase_community_showcase.sql` — showcase posts + moderation RLS  
32. `supabase_community_showcase_likes.sql` — showcase likes  
33. `supabase_founders_thoughts.sql` — Founders Thoughts + likes  
34. `supabase_platform_suggestions.sql` — platform/site suggestions  
35. `supabase_bug_reports.sql` — bug tracker + screenshots bucket  
36. `supabase_require_auth_to_post.sql` — auth-only inserts (ideas/showcase/bugs)  
37. `supabase_page_content.sql` — editable Early/Mid/Late hub copy  

### 4. Payments / billing

38. `supabase_donations_stripe.sql` — Stripe donation columns + summary RPC  
39. `supabase_stripe_subscriptions.sql` — webhook events + subscription rows  
40. `supabase_donations_public_feed.sql` — MRR + recent public feed RPCs  
40b. `supabase_kofi_runway.sql` — Ko-fi personal runway payments + coverage settings  
40c. `supabase_kofi_runway_stack.sql` — runway totals from Ko-fi ledger only; optional PayPal net  
41. `supabase_billing_account.sql` — My Plan / Billing RPCs + own-row RLS  
42. `supabase_subscription_renewal_credit.sql` — subscription credit identity columns  
43. `supabase_donation_project_attribution.sql` — attach studio donations to active project  
43b. `supabase_forge_marks.sql` — Forge Marks balances, award ledger, donation grant trigger  
43c. `supabase_forge_marks_awards.sql` — Spark/Hammer/Anvil/Masterwork placement on posts  
43d. `supabase_studio_published_expenses.sql` — Transparency published LLC expense report (Relay Operating; not a bank feed)  

### 5. Badges + MFA + legal acceptance + AI tokens

44. `supabase_badges.sql` — `user_badges`, pin, sync RPCs, triggers  
44b. `supabase_badges_recognition.sql` — Starter / Impact / Giving / Collaboration families  
44c. `supabase_concern_reports.sql` — private Report a concern inbox  
44d. `supabase_role_management.sql` — Founder role, Founder-only `set_user_role()`, role change audit  
45. `supabase_mfa_recovery_codes.sql` — hashed MFA recovery codes (Edge Function only)  
46. `supabase_legal_acceptance.sql` — `profiles` Terms + Community Guidelines version columns  
46b. `supabase_payments_policy_acceptance.sql` — `profiles` Payments and refunds policy version columns  
47. `supabase_ai_tokens.sql` — AI token balances, immutable ledger, purchases, generation log, caps  
47b. `supabase_ai_token_ledger_security_invoker.sql` — ledger user view SECURITY INVOKER + safe column grants  
48. `supabase_ai_tokens_scale_50k.sql` — one-time migrate legacy pack sizes (250/700/1600 → 250k/600k/1.25M)  
48b. `supabase_ai_token_pack_grants.sql` — canonical pack grants + top-up under-credited purchases  

### After apply (optional cleanup)

```sql
-- Only useful after real users exist; empty staging is a no-op
-- Re-run after supabase_badges_recognition.sql so existing users get new families
select public.backfill_all_user_badges();
```

---

## Skip / do not run for a normal staging bootstrap

| File | Why |
|------|-----|
| `supabase_claim_limit.sql` | **Superseded** by `supabase_claim_anti_hoarding.sql` (older claim_task body). |
| `supabase_bug_reports_MINIMAL.sql` | **Fallback only** if full `supabase_bug_reports.sql` fails. Prefer the full file. |
| `supabase_mechanic_demos.sql` | **Optional / future** Mechanic Lab storage. Not needed for current site MVP. |
| `supabase_task_limit_bypass.sql` | **Optional.** Staff/test-account bypass for claim/submit limits (dev/internal testing). Skip on production; optional on staging. |

`supabase_ideas_insert_rls.sql` and `supabase_require_auth_to_post.sql` both tighten idea inserts; running **both** is fine (idempotent). Keep both so either path alone still works.

---

## CLI: ordered apply (after linking staging)

From the **repo root**, with the staging project linked:

```bash
supabase link --project-ref YOUR_STAGING_PROJECT_REF
```

Then run (PowerShell-friendly; stop if one fails):

```bash
# 1. Core + ideas
supabase db query --linked -f supabase/sql/supabase_schema.sql
supabase db query --linked -f supabase/sql/supabase_moderation.sql
supabase db query --linked -f supabase/sql/supabase_profiles_banner.sql
supabase db query --linked -f supabase/sql/supabase_public_profile_support.sql
supabase db query --linked -f supabase/sql/supabase_votes_rls.sql
supabase db query --linked -f supabase/sql/supabase_ideas_guided.sql
supabase db query --linked -f supabase/sql/supabase_ideas_project_id.sql
supabase db query --linked -f supabase/sql/supabase_idea_parent.sql
supabase db query --linked -f supabase/sql/supabase_idea_tags.sql
supabase db query --linked -f supabase/sql/supabase_ideas_insert_rls.sql

# 2. Tasks (is_project_staff) then idea images
supabase db query --linked -f supabase/sql/supabase_tasks_schema.sql
supabase db query --linked -f supabase/sql/supabase_ideas_image.sql
supabase db query --linked -f supabase/sql/supabase_projects_completion.sql
supabase db query --linked -f supabase/sql/supabase_projects_release_meta.sql
supabase db query --linked -f supabase/sql/supabase_project_github.sql
supabase db query --linked -f supabase/sql/supabase_task_hierarchy.sql
supabase db query --linked -f supabase/sql/supabase_claim_anti_hoarding.sql
supabase db query --linked -f supabase/sql/supabase_claim_auto_release.sql
supabase db query --linked -f supabase/sql/supabase_task_claim_hierarchy_rules.sql
supabase db query --linked -f supabase/sql/supabase_task_review_workflow.sql
supabase db query --linked -f supabase/sql/supabase_parent_ready_for_review.sql
supabase db query --linked -f supabase/sql/supabase_task_anti_abuse.sql
supabase db query --linked -f supabase/sql/supabase_identity_gate_github.sql
supabase db query --linked -f supabase/sql/supabase_task_dependencies.sql
supabase db query --linked -f supabase/sql/supabase_task_scope_requests.sql
supabase db query --linked -f supabase/sql/supabase_helpers_join_dedupe.sql
supabase db query --linked -f supabase/sql/supabase_join_request_no_dupes.sql
supabase db query --linked -f supabase/sql/supabase_task_staff_only.sql
supabase db query --linked -f supabase/sql/supabase_task_board_scope.sql

# 3. Community / content
supabase db query --linked -f supabase/sql/supabase_project_contributions.sql
supabase db query --linked -f supabase/sql/supabase_contributions_memorial.sql
supabase db query --linked -f supabase/sql/supabase_official_videos.sql
supabase db query --linked -f supabase/sql/supabase_community_showcase.sql
supabase db query --linked -f supabase/sql/supabase_community_showcase_likes.sql
supabase db query --linked -f supabase/sql/supabase_founders_thoughts.sql
supabase db query --linked -f supabase/sql/supabase_platform_suggestions.sql
supabase db query --linked -f supabase/sql/supabase_bug_reports.sql
supabase db query --linked -f supabase/sql/supabase_require_auth_to_post.sql
supabase db query --linked -f supabase/sql/supabase_page_content.sql

# 4. Payments
supabase db query --linked -f supabase/sql/supabase_donations_stripe.sql
supabase db query --linked -f supabase/sql/supabase_stripe_subscriptions.sql
supabase db query --linked -f supabase/sql/supabase_donations_public_feed.sql
supabase db query --linked -f supabase/sql/supabase_billing_account.sql
supabase db query --linked -f supabase/sql/supabase_subscription_renewal_credit.sql
supabase db query --linked -f supabase/sql/supabase_donation_project_attribution.sql
supabase db query --linked -f supabase/sql/supabase_forge_marks.sql
supabase db query --linked -f supabase/sql/supabase_forge_marks_awards.sql
supabase db query --linked -f supabase/sql/supabase_studio_published_expenses.sql

# 5. Badges + MFA
supabase db query --linked -f supabase/sql/supabase_badges.sql
supabase db query --linked -f supabase/sql/supabase_badges_recognition.sql
supabase db query --linked -f supabase/sql/supabase_mfa_recovery_codes.sql
supabase db query --linked -f supabase/sql/supabase_legal_acceptance.sql
supabase db query --linked -f supabase/sql/supabase_payments_policy_acceptance.sql
supabase db query --linked -f supabase/sql/supabase_ai_tokens.sql
supabase db query --linked -f supabase/sql/supabase_ai_token_ledger_security_invoker.sql
supabase db query --linked -f supabase/sql/supabase_ai_tokens_scale_50k.sql
supabase db query --linked -f supabase/sql/supabase_ai_token_pack_grants.sql
```

**Optional on staging only:**

```bash
supabase db query --linked -f supabase/sql/supabase_task_limit_bypass.sql
# supabase db query --linked -f supabase/sql/supabase_mechanic_demos.sql
```

> CLI note: current Supabase CLI uses `supabase db query --linked -f <file>`, not `db execute`.  
> Confirm `supabase projects list` / link target before running so you do not hit production.

---

## Catalog (alphabetical purpose list)

| File | Purpose |
|------|---------|
| `supabase_schema.sql` | Base schema (ideas, profiles, donations shell, RLS starters) |
| `supabase_profiles_banner.sql` | profiles.banner_url + avatars storage policies for banner uploads |
| `supabase_tasks_schema.sql` | Projects, tasks, claims, activity |
| `supabase_projects_completion.sql` | Project summary, completed_at, completion_links |
| `supabase_projects_release_meta.sql` | release_meta JSON for Released Game Detail |
| `supabase_official_videos.sql` | Official Media library + RLS |
| `supabase_community_showcase.sql` | Community Showcase posts + moderation RLS |
| `supabase_require_auth_to_post.sql` | Auth-only inserts for showcase + bugs + ideas |
| `supabase_ideas_insert_rls.sql` | Ideas insert: `user_id = auth.uid()` |
| `supabase_community_showcase_likes.sql` | Showcase likes |
| `supabase_project_contributions.sql` | Public credits per project |
| `supabase_contributions_memorial.sql` | Permanent credits ledger + triggers |
| `supabase_donation_project_attribution.sql` | Studio donations → active project |
| `supabase_forge_marks.sql` | Forge Marks balances, award ledger, donation grants |
| `supabase_forge_marks_awards.sql` | Spark/Hammer/Anvil/Masterwork placement on posts |
| `supabase_task_hierarchy.sql` | parent_task_id, max 3 levels |
| `supabase_task_claim_hierarchy_rules.sql` | Claim leaf Medium/Small only |
| `supabase_helpers_join_dedupe.sql` | Join approve → helper append |
| `supabase_join_request_no_dupes.sql` | Block duplicate join requests |
| `supabase_bug_reports.sql` | Bug tracker + screenshots bucket |
| `supabase_bug_reports_MINIMAL.sql` | Fallback only if full bug script fails |
| `supabase_ideas_guided.sql` | Guided idea fields + status |
| `supabase_ideas_project_id.sql` | Link ideas to projects |
| `supabase_ideas_image.sql` | Idea image_url + storage |
| `supabase_idea_tags.sql` | Hybrid idea tags catalog |
| `supabase_idea_parent.sql` | Related ideas parent link |
| `supabase_platform_suggestions.sql` | Platform/site suggestions |
| `supabase_subscription_renewal_credit.sql` | Subscription credit fields |
| `supabase_billing_account.sql` | My Plan + Billing RPCs |
| `supabase_votes_rls.sql` | Idea votes RLS |
| `supabase_anti_abuse.sql` | Rate limits + delayed public counts |
| `supabase_decision_logs.sql` | Staff-managed Transparency decision logs |
| `supabase_studio_published_expenses.sql` | Published LLC operating expenses (Transparency; Relay Operating only) |
| `supabase_claim_limit.sql` | **Superseded** by anti-hoarding |
| `supabase_claim_anti_hoarding.sql` | Claim limits, cooldown, join requests |
| `supabase_claim_auto_release.sql` | Idle + hard-max auto-release |
| `supabase_task_review_workflow.sql` | Submit for review workflow |
| `supabase_task_anti_abuse.sql` | Progressive trust + identity gate |
| `supabase_task_limit_bypass.sql` | Optional staff/test claim limit bypass |
| `supabase_project_github.sql` | Project GitHub URL / meta |
| `supabase_public_profile_support.sql` | Public profile GitHub + support total |
| `supabase_badges.sql` | Badges + pin + sync |
| `supabase_badges_recognition.sql` | Starter / Impact / Giving / Collaboration auto-grants |
| `supabase_mfa_recovery_codes.sql` | MFA recovery codes table |
| `supabase_legal_acceptance.sql` | Terms + Guidelines acceptance columns on profiles |
| `supabase_payments_policy_acceptance.sql` | Payments and refunds policy acceptance columns on profiles |
| `supabase_ai_tokens.sql` | AI token balance, ledger, packs purchases, spend caps |
| `supabase_ai_token_ledger_security_invoker.sql` | Ledger user view as SECURITY INVOKER; no cost-column grants |
| `supabase_ai_tokens_scale_50k.sql` | Migrate old pack token amounts to 50k/$1 scale |
| `supabase_ai_token_pack_grants.sql` | Canonical pack grants + top-up under-credited purchases |
| `supabase_identity_gate_github.sql` | GitHub for identity gate |
| `supabase_task_dependencies.sql` | Task blocked-by edges |
| `supabase_task_staff_only.sql` | Staff Only tasks (viewable by all, claimable by staff) |
| `supabase_task_board_scope.sql` | Staging vs Public task boards + publish RPC |
| `supabase_project_tether_slug.sql` | Rename public project slug to `tether` |
| `supabase_open_questions.sql` | Staff Open Questions; community Suggestions with support, rank, Adopt, close note |
| `supabase_task_scope_requests.sql` | Scope help requests |
| `supabase_parent_ready_for_review.sql` | Parent ready when children complete |
| `supabase_page_content.sql` | Phase hub editable content |
| `supabase_moderation.sql` | Staff roles + content reports |
| `supabase_role_management.sql` | Founder role + Role Management RPC / audit log |
| `supabase_founders_thoughts.sql` | Founders Thoughts + likes |
| `supabase_donations_stripe.sql` | Stripe donation columns + summary |
| `supabase_donations_public_feed.sql` | MRR + recent feed RPCs |
| `supabase_kofi_runway.sql` | Ko-fi personal runway payments + months-of-coverage setting |
| `supabase_stripe_subscriptions.sql` | Webhook log + subscriptions |
| `supabase_mechanic_demos.sql` | Optional future Mechanic Lab tables |
