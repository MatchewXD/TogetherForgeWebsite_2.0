# =============================================================================
# Apply supabase/sql scripts to the LINKED Supabase project (fail-fast).
# Usage (from repo root):
#   supabase link --project-ref YOUR_STAGING_REF
#   powershell -ExecutionPolicy Bypass -File scripts/apply-staging-sql.ps1
#
# Resume after a failure (skip already-applied files through that path):
#   powershell -ExecutionPolicy Bypass -File scripts/apply-staging-sql.ps1 `
#     -StartAfter "supabase/sql/supabase_ideas_project_id.sql"
#
# Requires: Supabase CLI with `db query --linked -f`
# =============================================================================

param(
  [string]$StartAfter = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Invoke-SqlFile([string]$RelPath) {
  $full = Join-Path $Root $RelPath
  if (-not (Test-Path $full)) {
    throw "Missing file: $RelPath"
  }
  Write-Host ""
  Write-Host "==> $RelPath" -ForegroundColor Cyan
  & supabase db query --linked -f $RelPath
  if ($LASTEXITCODE -ne 0) {
    throw "FAILED: $RelPath (exit $LASTEXITCODE). Fix this file before continuing."
  }
}

Write-Host "Applying SQL to LINKED project (confirm this is STAGING, not production)." -ForegroundColor Yellow
Write-Host "Project ref check: supabase projects list / dashboard" -ForegroundColor DarkYellow

$runCore = -not $StartAfter
if ($runCore) {
  Invoke-SqlFile "supabase/sql/supabase_schema.sql"
  Invoke-SqlFile "supabase/sql/supabase_verify_core.sql"
} else {
  Write-Host "Resume mode: skipping core schema/verify (already applied)." -ForegroundColor DarkYellow
}

$ordered = @(
  # 1. Core extensions + ideas
  "supabase/sql/supabase_moderation.sql",
  "supabase/sql/supabase_profiles_api_grants.sql",
  "supabase/sql/supabase_profiles_banner.sql",
  "supabase/sql/supabase_public_profile_support.sql",
  "supabase/sql/supabase_votes_rls.sql",
  "supabase/sql/supabase_ideas_guided.sql",
  "supabase/sql/supabase_ideas_project_id.sql",
  "supabase/sql/supabase_idea_parent.sql",
  "supabase/sql/supabase_idea_tags.sql",
  "supabase/sql/supabase_ideas_insert_rls.sql",
  "supabase/sql/supabase_ideas_table_grants.sql",

  # 2. Tasks first (is_project_staff), then idea images storage that uses it
  "supabase/sql/supabase_tasks_schema.sql",
  "supabase/sql/supabase_projects_public_grants.sql",
  "supabase/sql/supabase_ideas_image.sql",
  "supabase/sql/supabase_projects_completion.sql",
  "supabase/sql/supabase_projects_release_meta.sql",
  "supabase/sql/supabase_project_github.sql",
  "supabase/sql/supabase_task_hierarchy.sql",
  "supabase/sql/supabase_claim_anti_hoarding.sql",
  "supabase/sql/supabase_claim_auto_release.sql",
  "supabase/sql/supabase_task_claim_hierarchy_rules.sql",
  "supabase/sql/supabase_task_review_workflow.sql",
  "supabase/sql/supabase_parent_ready_for_review.sql",
  "supabase/sql/supabase_task_anti_abuse.sql",
  "supabase/sql/supabase_identity_gate_github.sql",
  "supabase/sql/supabase_task_dependencies.sql",
  "supabase/sql/supabase_task_scope_requests.sql",
  "supabase/sql/supabase_helpers_join_dedupe.sql",
  "supabase/sql/supabase_join_request_no_dupes.sql",
  "supabase/sql/supabase_task_staff_only.sql",
  "supabase/sql/supabase_task_board_scope.sql",

  # 3. Community
  "supabase/sql/supabase_project_contributions.sql",
  "supabase/sql/supabase_contributions_memorial.sql",
  "supabase/sql/supabase_official_videos.sql",
  "supabase/sql/supabase_community_showcase.sql",
  "supabase/sql/supabase_community_showcase_likes.sql",
  "supabase/sql/supabase_founders_thoughts.sql",
  "supabase/sql/supabase_platform_suggestions.sql",
  "supabase/sql/supabase_bug_reports.sql",
  "supabase/sql/supabase_require_auth_to_post.sql",
  "supabase/sql/supabase_page_content.sql",

  # 4. Payments
  "supabase/sql/supabase_donations_stripe.sql",
  "supabase/sql/supabase_stripe_subscriptions.sql",
  "supabase/sql/supabase_donations_public_feed.sql",
  "supabase/sql/supabase_billing_account.sql",
  "supabase/sql/supabase_billing_grants.sql",
  "supabase/sql/supabase_billing_table_grants.sql",
  "supabase/sql/supabase_subscription_renewal_credit.sql",
  "supabase/sql/supabase_donation_project_attribution.sql",
  "supabase/sql/supabase_forge_marks.sql",
  "supabase/sql/supabase_forge_marks_awards.sql",

  # 5. Badges + MFA + legal acceptance + AI tokens
  "supabase/sql/supabase_badges.sql",
  "supabase/sql/supabase_badges_recognition.sql",
  "supabase/sql/supabase_mfa_recovery_codes.sql",
  "supabase/sql/supabase_legal_acceptance.sql",
  "supabase/sql/supabase_ai_tokens.sql",
  "supabase/sql/supabase_ai_tokens_scale_50k.sql",
  "supabase/sql/supabase_ai_token_pack_grants.sql",
  "supabase/sql/supabase_ai_platform_enable_staging.sql",
  "supabase/sql/supabase_volunteer_applications.sql",
  "supabase/sql/supabase_concern_reports.sql",
  "supabase/sql/supabase_role_management.sql"
)

# Resume: skip files until AFTER StartAfter (that file is treated as already done)
$pastResume = -not [bool]$StartAfter
if ($StartAfter) {
  $normalized = ($StartAfter -replace '\\', '/').Trim()
  Write-Host "Resuming after (exclusive): $normalized" -ForegroundColor DarkYellow
}

foreach ($f in $ordered) {
  if (-not $pastResume) {
    $fn = ($f -replace '\\', '/')
    if ($fn -eq $normalized -or $fn.EndsWith($normalized) -or $normalized.EndsWith($fn)) {
      $pastResume = $true
      Write-Host "Skip (already applied): $f" -ForegroundColor DarkGray
      continue
    }
    Write-Host "Skip (before resume): $f" -ForegroundColor DarkGray
    continue
  }
  Invoke-SqlFile $f
}

if (-not $pastResume) {
  throw "StartAfter path not found in ordered list: $StartAfter"
}

Write-Host ""
Write-Host "All required SQL files applied successfully." -ForegroundColor Green
Write-Host "Optional: supabase db query --linked -f supabase/sql/supabase_task_limit_bypass.sql"
