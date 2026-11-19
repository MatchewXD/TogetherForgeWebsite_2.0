# Launch checklist

Written 2026-11-13, updated 2026-11-18. Everything on `main` is live on
togetherforge.net. This list is what only you can do: apply the database and
function changes, check the signed-in parts of the site, and confirm a few
account settings.

Work top to bottom. Sections 1 to 3 are the important ones; allow about 30 minutes.

---

## Where things stand (handoff, 2026-11-18)

**Task Map canvas: built, on a branch, not merged.**

- Branch `feature/task-map-canvas` (commit `4a6ebce`), pushed to GitHub. Not
  merged, not deployed. The local repo is currently checked out on this branch.
- What it is: the Task Map rebuilt as a pannable React Flow canvas with the same
  actions as the Board. Epics sit in wrapping rows; opening a card inserts its
  children directly under its row. Focus mode zooms to the opened branch, and a
  breadcrumb (plus Back, Esc, or tapping empty canvas) steps back up. Board
  filters highlight on the map instead of hiding. Phones get a compact filter
  bar, a peek bar and a bottom sheet. Rounds 1–4 of review are done and approved.
- Checked on staging as the moderator and signed out, desktop and phone.
  `npm run lint`, `npm test` (707) and `npm run build` pass.
- **Blocking the merge:** the normal (non-moderator) user browser test.
  - [ ] Add `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` for a normal staging
        account to `.env.staging` (gitignored).
  - [ ] Ask Claude to run the user test: on `/projects/tether/board` in Map
        view, claim a Small, update progress, open Submit for Review (don't
        submit), then return the claim so staging is as before.
  - [ ] Then merge `feature/task-map-canvas` into `main`. Pushing `main`
        deploys to production through Vercel.
- Review screenshots: `tmp/task-map-shots/` (`round1/` to `round4/`). Browser
  check scripts: `tmp/task-map-checks/`. Both are local only and gitignored.
  The scripts load `playwright-core` from an older Claude scratchpad folder; if
  that is gone, install `playwright-core` in a scratch folder and fix the path.
  They expect `npx vite --mode staging --port 5174` running.
- Not committed on purpose: `public/images/TF_Logo_Ideas_V2_With_Background.png`
  (untracked, unrelated to the Task Map). Decide whether it belongs anywhere.

**Everything else on this checklist** is unchanged unless ticked below.

---

## 1. Apply the security and scale changes to Supabase

- [x] **Done 2026-11-13:** applied to staging and production (both scripts ran,
      verify counts were 0). The steps below are kept for reference and for
      re-running; the SQL files are safe to re-run.

Nothing in this section is active until you run it. Until then, user emails are
still publicly readable through the API and the new rate limits, form
protection and error log are off.

Run both commands from the repo root (`E:\Coding\TFWebsite_2`) in PowerShell.
Each one applies three SQL files, checks the result, redeploys the edge
functions, and re-links the repo to production when it finishes.

### 1a. Staging first

- [ ] Run:
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/apply-hardening.ps1 -Target staging
  ```
- [ ] The "Verify" step printed `emails_left: 0` and `notes_left: 0`.
- [ ] Every "Deploy ..." step finished without an error and the last line says `Done: staging`.
- [ ] If your staging site is not on localhost, tell the functions its address
      (checkout and the billing portal refuse unknown sites):
  ```powershell
  supabase secrets set ALLOWED_ORIGINS=https://YOUR-STAGING-SITE --project-ref qoriotympchrtxhjcfux
  ```
- [ ] On the staging site: sign in, open your profile, and open the Moderator
      dashboard → Users. Emails should still show there for staff.

If any step fails, stop and send me the output. Do not run production.

### 1b. Production

- [ ] Run:
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/apply-hardening.ps1 -Target production
  ```
- [ ] "Verify" printed `emails_left: 0` and `notes_left: 0`, and the last line says `Done: production`.

What this changes on production, so nothing surprises you:

- `profiles.email` is emptied (addresses stay in Supabase Auth). Staff still see
  emails in the Moderator dashboard.
- Members can no longer edit their own role, moderation status or task-limit
  bypass through the API.
- Checkout and the billing portal only return people to togetherforge.net.
- Function CORS is limited to togetherforge.net and localhost.
- Founder Runway requests to Stripe checkout are refused by the function. Your
  site already sends runway to Ko-fi, so nothing visible should change.
- Concern reports and volunteer applications can only be submitted through
  their functions, not written straight to the database.
- Draft ideas are readable only by their author and staff.
- The traffic heartbeat is cheaper under load, and rate limits are stored in
  the database.

---

## 2. Check production after the script (about 10 minutes)

Do these on togetherforge.net, signed in as yourself.

- [ ] Sign out and sign back in.
- [ ] Open your Account page. Your profile loads and saving a small edit works.
- [ ] Moderator dashboard → **Users**: the list loads, and searching part of a
      member's email finds them (cards show name, role and ID, not email).
- [ ] Moderator dashboard → **Site errors** (new tab): it loads and says no
      errors, or lists some. It should not say "not set up".
- [ ] Moderator dashboard: click through every other tab once. These were moved
      into separate files and I could not open them without a staff login.
- [ ] Submit a test concern report at `/report-a-concern`. It should succeed and
      appear under Moderator → Concerns.
- [ ] Submit a test volunteer application from Get Involved. It should appear
      under Moderator → Volunteers.
- [ ] Start a support checkout at `/donate`, reach the Stripe page, then cancel.
      You should land back on togetherforge.net.
- [ ] Account → Billing → open the billing portal and come back.

## 3. Check the task board while signed in (about 5 minutes)

The board code was split into smaller files and the Task Map was added. I
tested everything an anonymous visitor can do; these need your login.

- [ ] Open `/projects/tether/board`. Claim a task, then return it.
- [ ] Switch to **Map**, open an Epic, open a task, click **Open full task**,
      and claim it from that dialog. Return it afterwards.
- [ ] Open the staff task form (create or edit a task) and cancel.
- [ ] Open the Staging board at `/projects/tether/board/staging`.
- [ ] Open `/projects/tether` and check the updates section shows author names.

---

## 4. Before you go public

I cannot see these from the code. Each one can break launch day on its own.

- [ ] **Supabase plan.** Dashboard → Organization → Billing. The free tier's
      bandwidth and compute will not survive tens of thousands of visitors in a
      day. Pro is the minimum; consider a larger compute size for launch week.
- [ ] **Vercel plan.** A first visit transfers about 1.2 MB. At launch volume
      that is tens of gigabytes a day, which can use up a Hobby plan's monthly
      allowance within days. Hobby also does not permit commercial use.
- [ ] **Sign-up emails.** Supabase → Authentication → Emails → SMTP Settings.
      Confirm a custom SMTP provider (for example Resend) is set. The built-in
      sender allows only a handful of emails per hour, so sign-ups would stall.
- [ ] **Auth rate limits.** Supabase → Authentication → Rate Limits. Raise the
      sign-up, sign-in and email limits for launch day.
- [x] **Privacy page.** Add a line that the site records browser type and page
      path when an error occurs, kept for 30 days, with no account or IP address.
      Done in commit `69ef707` (live).

## 5. Turn on CAPTCHA (optional, about 15 minutes)

It is built and switched off. Do the steps in this order; if step 2 or 3 goes
on before step 1 is deployed, sign-in and the two forms will be refused.

- [ ] Cloudflare dashboard → Turnstile → add a widget for `togetherforge.net`
      (Managed mode). Copy the site key and the secret key.
- [ ] 1. Vercel → Project → Settings → Environment Variables: add
      `VITE_TURNSTILE_SITE_KEY` with the site key, then redeploy.
- [ ] 2. Supabase → Authentication → Attack Protection: enable CAPTCHA, choose
      Turnstile, paste the secret key.
- [ ] 3. Protect the two forms:
  ```powershell
  supabase secrets set TURNSTILE_SECRET_KEY=YOUR_SECRET_KEY --project-ref lbstantgrrrupzeasndg
  ```
- [ ] Sign out and back in, and submit one concern report, to confirm both still work.

---

## 6. Decisions I left for you

Tell me which you want and I will do them.

- [ ] **Delete unused files?** The 4 to 6 MB source PNGs that already have WebP
      versions, and the eight finished Tether task-tree data files with their
      scripts and tests.
- [ ] **Magenta accent.** It sits at about 4.2:1 contrast against the 4.5:1
      standard (the "Sign in" button and some headings). Lighten it slightly, or keep it.
- [ ] **Task Map as the default view?** Board is the default now. Worth
      deciding after the Task Map branch is merged.
- [x] **Should board filters apply to the Map?** Decided: they highlight on the
      Map (matching paths in colour, the rest greyed) on the Task Map branch.
      "Top-level / All tasks" stays Board-only.
- [ ] **Map progress numbers.** The Map counts every finished task under an
      Epic; the task dialog counts direct children only. Pick one.
- [ ] **Trim the task board download.** The board fetches the whole task list on
      each visit. Reducing it changes how the board loads, so I want you
      available to test claiming afterwards.
- [ ] **Do not set `MFA_RECOVERY_PEPPER`** now. Changing it would invalidate
      recovery codes members have already saved.

---

## Watchdog alerts (Discord)

Installed on production 2026-11-13 (`supabase/sql/supabase_watchdog.sql`). Every
5 minutes it checks the database and posts to the private Discord channel when:

- site errors spike (25+ in 10 minutes, or 8+ visitors hit errors),
- sign-up or password emails fail (Resend limit, SMTP or Supabase email limit),
- database connections reach 75% of the limit,
- a query has been stuck for 5+ minutes,
- the database passes 6 GB,
- another scheduled database job fails.

It alerts once, repeats hourly while the problem continues, and posts
"Resolved" when it clears. A daily check-in arrives at 16:00 UTC (8 am Pacific);
if that stops, the watchdog itself is not running. Staging has it installed but
muted.

It runs inside the database, so it cannot tell you the whole site or database
is down. For that:

- [ ] Sign up for a free uptime monitor (UptimeRobot or Better Stack) and
      monitor `https://togetherforge.net` and
      `https://lbstantgrrrupzeasndg.supabase.co/auth/v1/health?apikey=<anon key>`
      (the public `VITE_SUPABASE_ANON_KEY` from `.env.local`; without it the
      check returns 401), with alerts to your phone or email.
- [ ] Vercel → Settings → Billing → Spend Management: set a budget and turn on
      notifications.
- [ ] Resend, after upgrading: turn on its usage notifications if offered.

Useful commands in the Supabase SQL editor:

```sql
select public.watchdog_test();                 -- send a test message
select public.watchdog_run();                  -- run the checks now
update public.watchdog_settings set enabled = false;  -- mute
update public.watchdog_settings set db_connection_pct = 80;  -- change a threshold
```

## If something goes wrong

- **A page looks broken after a deploy:** Vercel → Deployments → pick the
  previous deployment → Promote to Production.
- **Checkout says it must return to the Together Forge site:** the site you are
  on is not in `ALLOWED_ORIGINS` (see 1a).
- **Sign-in or a form says "Verification failed":** a CAPTCHA key is set in one
  place but not the others (see section 5), or remove `TURNSTILE_SECRET_KEY`.
- **Anything in section 1 fails:** send me the script output. The SQL files are
  safe to re-run.
- **Pause new task claims** (for example, a burst of junk claims on launch day).
  Members cannot claim; staff still can; existing claims are untouched. The
  pause turns on the next time anyone tries to claim.
  ```powershell
  supabase secrets set ENABLE_CLAIMS=false --project-ref lbstantgrrrupzeasndg
  ```
  To reopen claims:
  ```powershell
  supabase secrets unset ENABLE_CLAIMS --project-ref lbstantgrrrupzeasndg
  ```
