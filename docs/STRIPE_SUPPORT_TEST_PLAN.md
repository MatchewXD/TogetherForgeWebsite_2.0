# Stripe Support – test plan

## Prerequisites

1. Run SQL: `supabase/sql/supabase_donations_stripe.sql` in Supabase.
2. Deploy Edge Functions:
   - `supabase functions deploy create-checkout --no-verify-jwt`
   - `supabase functions deploy stripe-webhook --no-verify-jwt`
3. Secrets (Supabase project):
   - `STRIPE_SECRET_KEY` (test: `sk_test_...`)
   - `STRIPE_WEBHOOK_SECRET` (`whsec_...` from Stripe CLI or Dashboard)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (usually auto for functions)
4. Client `.env.local`:
   ```
   VITE_STRIPE_CHECKOUT_API_URL=https://<project>.supabase.co/functions/v1/create-checkout
   ```
5. Stripe CLI (local webhooks):
   ```
   stripe listen --forward-to https://<project>.supabase.co/functions/v1/stripe-webhook
   ```
   Or Dashboard webhook to the same URL with events:
   - `checkout.session.completed`
   - `invoice.paid`
   - `charge.refunded`

## Automated tests

```bash
npm test -- --run src/__tests__/supportService.test.js src/__tests__/donationsService.test.js
```

Covers amount validation, config detection, local ledger, and public summary RPC mapping.

## Manual flows

### A. Studio one-time (happy path)

1. Open `/support`, pick **One-time**, tier **$5** or custom.
2. Complete Stripe Checkout with test card `4242 4242 4242 4242`.
3. Expect redirect to `/support?checkout=success&session_id=cs_...`.
4. Success banner visible.
5. Webhook inserts row in `donations` (`fund_type=studio`, `amount_cents`, `stripe_session_id`).
6. `/transparency` shows updated **Total support** (via `get_public_support_summary`).

### B. Studio monthly

1. Toggle **Monthly**, choose tier, checkout with `4242…`.
2. Session mode `subscription`; metadata includes `fundType=studio`.
3. First payment via `checkout.session.completed`.
4. Later renewals via `invoice.paid` (skip duplicate `subscription_create` if already recorded).

### C. Cancel

1. Start checkout, click back / cancel.
2. Land on `/support?checkout=cancel`.
3. Info banner; no `donations` row.

### D. Card decline

1. Use `4000 0000 0000 0002`.
2. Stay on Stripe with error; no success redirect; no webhook completed payment.

### E. Runway fund separation

1. `/support-runway` checkout with `fundType=runway`.
2. Donation row has `fund_type=runway`.
3. Transparency studio total **does not** include runway cents.

### F. Security checks

- Client bundle has **no** `sk_` secret.
- Direct insert into `donations` as anon should fail (RLS).
- Webhook without valid signature returns 400.
- Amounts under $1 or over $10k rejected by `create-checkout`.

### G. Payment Links fallback

1. Unset API URL; set `VITE_STRIPE_PAYMENT_LINKS` JSON.
2. Tier keys e.g. `supporter_once`, `custom_once`, `runway_once`.
3. Click support; redirect to Payment Link (recording still needs webhook or Dashboard sync).

## Logging

- Client: `[support]` console on start / errors.
- Edge: `[create-checkout]`, `[stripe-webhook]` logs in Supabase Functions dashboard.

## Trust / product notes

- Support is **not** tax-deductible; stated on `/support`.
- Transparency shows **anonymized aggregates only**.
- LocalStorage notes are demo-only when RPC is unavailable.
