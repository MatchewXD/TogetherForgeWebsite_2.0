# Manual Test Checklist

Walk through before a release or after major auth / billing / contribution changes.  
Use **staging** (separate Supabase project + Stripe **Test** mode) unless a step says otherwise.

**Environment**

- [ ] App points at **staging** (`VITE_SUPABASE_URL` host matches staging project)
- [ ] Stripe **Test** mode; webhook endpoint is staging only  
  `https://<STAGING_REF>.supabase.co/functions/v1/stripe-webhook`
- [ ] Production webhook is **not** receiving these Test events (or is disabled in Test mode)

---

## Authentication & Account

- [ ] **Sign up** with email/password → confirm email if required → land in app with session
- [ ] **Sign in** with email/password
- [ ] **Password reset** → email link → set new password → sign in with new password
- [ ] **OAuth** (Google / Discord / GitHub as enabled on this project) → sign-in succeeds
- [ ] Choose / confirm **username** when prompted; public `/u/<username>` loads
- [ ] **Enable 2FA** (TOTP) on Account security → save recovery codes somewhere safe
- [ ] **Sign out** fully
- [ ] **Sign in** with password → enter authenticator **6-digit code** → session works
- [ ] Account security page shows **2FA enabled** (and recovery code status if shown)
- [ ] **Recovery codes**: use one code to get past MFA (or regenerate flow) → codes remaining updates
- [ ] **Disable 2FA** (if product allows) with step-up verification → status shows off

---

## Payments & Billing (Stripe Test / staging)

*Use a test card (e.g. `4242…`). Stay signed in with a username for named credit tests.*

### One-time donation

- [ ] Donate once (any tier or custom ≥ $1)
- [ ] Return to success URL without errors
- [ ] **Transaction History** shows the one-time payment
- [ ] Support page **totals** / recent list update (webhook may lag a few seconds; refresh)
- [ ] **Named credit**: choose public credit → name (not “Anonymous Supporter”) on thank-you / feed
- [ ] **Anonymous**: choose anonymous → shows as anonymous supporter (no public name)

### Subscription

- [ ] Start a **monthly** plan
- [ ] **My Plan** shows correct tier, amount, status **Active**
- [ ] **My Subscriptions** / active list includes the new `sub_…`
- [ ] **Transaction History** shows a subscription charge
- [ ] **Cancel** from My Plan → status **Canceling** (or equivalent); access until period end
- [ ] **Renew** (undo cancel) if offered → back to Active
- [ ] **Refresh from Stripe** (if available) matches Dashboard after a change
- [ ] Open **Stripe Customer Portal** → return to Account without app errors

### Isolation check (required)

- [ ] Note session / sub ids from the tests above
- [ ] Open **production** site (or production Supabase SQL) → same payment/sub **does not** appear
- [ ] Staging-only webhook: no Test deliveries writing to production project

---

## Core Contribution Flows

- [ ] **Submit Idea** (signed in) → appears for you (draft/publish path you use)
- [ ] Guest cannot create an idea as another user (RLS / auth gate)
- [ ] **Claim** a claimable task → claim shows as yours
- [ ] **Release / return** claim → task available again
- [ ] Hitting **claim limits** (or cooldown) shows a clear error, not a silent fail
- [ ] **Community Showcase** submit → pending (or expected status) for your account
- [ ] **Moderator** (test staff account): approve/reject showcase or update a bug status if reachable

---

## General / Polish

- [ ] Home, Projects, Ideas, Donate, Account load on **desktop** without console errors
- [ ] Same key routes at ~**375px** width (layout usable, no critical overflow)
- [ ] Empty states (no plan, no history, empty board) are readable
- [ ] Failed checkout / network error messages are understandable
- [ ] **Sign out** clears session; protected actions require sign-in again

---

## Quick smoke (5 minutes)

If time is short, at least:

1. Sign in (email or OAuth)  
2. One-time **and** monthly Test donation while signed in  
3. Confirm My Plan + history on **staging**  
4. Confirm **not** on production  
5. Submit an idea or claim a task  
6. Sign out  

---

## Notes

- Edge Functions used: `create-checkout`, `stripe-webhook`, `sync-checkout`, `manage-subscription`, billing portal/summary as applicable  
- After Checkout, `session_id=cs_…` on the return URL helps attach the payment to the account  
- Webhook failures → check Stripe **Recent deliveries** and Supabase **Edge Function logs** (`TF_STRIPE_WEBHOOK`)  
- Automated unit tests: `npm test` (does not replace this checklist)
