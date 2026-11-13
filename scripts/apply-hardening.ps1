# =============================================================================
# Apply the security hardening to one Supabase project:
#   1. supabase/sql/supabase_profiles_hardening.sql
#   2. Redeploy the browser-facing Edge Functions already deployed there
#
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File scripts/apply-hardening.ps1 -Target staging
#   powershell -ExecutionPolicy Bypass -File scripts/apply-hardening.ps1 -Target production
#
# Run staging first. The repo is re-linked to production when the script ends,
# whichever target was chosen. Webhooks (stripe-webhook, kofi-webhook) are not
# redeployed: they did not change.
# =============================================================================

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("staging", "production")]
  [string]$Target,
  [switch]$SqlOnly,
  [switch]$FunctionsOnly
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$Refs = @{
  staging    = "qoriotympchrtxhjcfux"
  production = "lbstantgrrrupzeasndg"
}
$Ref = $Refs[$Target]

# Functions currently deployed on both projects (all with verify_jwt = false)
$Functions = @(
  "create-checkout",
  "create-token-checkout",
  "create-billing-portal",
  "manage-subscription",
  "get-billing-summary",
  "sync-checkout",
  "ai-token-status",
  "idea-structure",
  "idea-gap-fill",
  "mfa-recovery",
  "submit-concern-report",
  "submit-volunteer-application"
)
if ($Target -eq "production") {
  # Only deployed on production today
  $Functions += "send-conduct-notice"
}

function Invoke-Step([string]$Label, [scriptblock]$Action) {
  Write-Host ""
  Write-Host "==> $Label" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "FAILED: $Label (exit $LASTEXITCODE)"
  }
}

Write-Host "Target: $Target ($Ref)" -ForegroundColor Yellow

try {
  if (-not $FunctionsOnly) {
    Invoke-Step "Link $Target" { supabase link --project-ref $Ref }
    Invoke-Step "Apply supabase_profiles_hardening.sql" {
      supabase db query --linked -f supabase/sql/supabase_profiles_hardening.sql
    }
    Invoke-Step "Verify (both counts must be 0)" {
      supabase db query --linked "select (select count(*) from public.profiles where email is not null) as emails_left, (select count(*) from public.profiles where moderation_note is not null) as notes_left"
    }
  }

  if (-not $SqlOnly) {
    foreach ($fn in $Functions) {
      Invoke-Step "Deploy $fn" {
        supabase functions deploy $fn --project-ref $Ref --no-verify-jwt --use-api
      }
    }
  }
}
finally {
  Write-Host ""
  Write-Host "==> Re-link repo to production" -ForegroundColor Cyan
  supabase link --project-ref $Refs["production"]
}

Write-Host ""
Write-Host "Done: $Target" -ForegroundColor Green
if ($Target -eq "staging") {
  Write-Host "If the staging site is not served from localhost, set its origin:" -ForegroundColor DarkYellow
  Write-Host "  supabase secrets set ALLOWED_ORIGINS=https://your-staging-site --project-ref $Ref" -ForegroundColor DarkYellow
}
