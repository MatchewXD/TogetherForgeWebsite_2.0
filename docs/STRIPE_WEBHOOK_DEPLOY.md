# Deploy `stripe-webhook` Edge Function

## What it does

1. Verifies `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET`
2. Handles:
   - `checkout.session.completed` → insert/update `donations`
   - `invoice.paid` → recurring payments (skips first invoice if already recorded)
   - `invoice.payment_failed` → mark the subscription `past_due` (My Plan)
   - `payment_intent.payment_failed` → failed Checkout / invoice PI (pending token packs)
   - `customer.subscription.created|updated|deleted` → upsert `stripe_subscriptions`
   - `charge.refunded` → mark donation `status = refunded`
3. Returns **200** `{ received: true }` so Stripe stops retrying after success

## 1. Database

In Supabase SQL Editor, run (in order if not already applied):

1. `supabase/sql/supabase_donations_stripe.sql`
2. `supabase/sql/supabase_donations_public_feed.sql`
3. `supabase/sql/supabase_stripe_subscriptions.sql` (event log + subscriptions)
4. `supabase/sql/supabase_billing_account.sql` (My Plan RPCs + `user_id` on subscriptions)
5. `supabase/sql/supabase_billing_grants.sql` (API grants for Account billing)

## Why My Plan / history can be empty

Account → **My Plan**, **Active Monthly Subscriptions**, and **Transaction History** only show rows where **`user_id` = signed-in user**.

That `user_id` is written by **`stripe-webhook`** from Checkout session metadata / `client_reference_id` / Stripe Customer metadata (set when **create-checkout** sees a valid user JWT).

| Symptom | Likely cause |
|---------|----------------|
| Thank-you feed shows “Anonymous Supporter” only | Local optimistic card, or donation without public name |
| My Plan empty after test sub | Webhook not on **this** project, wrong `whsec_`, or checkout had **no JWT** so `user_id` is null |
| Stripe Dashboard shows paid sub | Money charged; DB link missing until webhook writes `user_id` |

### Account sync after Checkout (recommended)

Deploy **`sync-checkout`** so the browser can attach `session_id` to the signed-in user on return from Stripe (My Plan / history):

```bash
supabase functions deploy sync-checkout --no-verify-jwt
```

The donate success page and My Plan call this automatically when `session_id=cs_…` is present.

### Quick checks (SQL Editor, staging)

```sql
-- Recent donations (webhook alive?)
select id, user_id, amount_cents, interval, status, stripe_subscription_id, created_at
from donations order by created_at desc limit 10;

-- Subscriptions linked to accounts?
select id, user_id, status, amount_cents, customer_id, updated_at
from stripe_subscriptions order by updated_at desc nulls last limit 10;

-- Webhook events received?
select id, type, processed_at from stripe_webhook_events
order by processed_at desc limit 20;
```

If `donations` / `stripe_subscriptions` are empty → deploy webhook + Stripe endpoint for **staging** URL.  
If rows exist but `user_id` is null → checkout was not attached to the signed-in user; redeploy **create-checkout** + **stripe-webhook**, subscribe again while signed in.

## 2. Set secrets (hosted project)

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF

supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to hosted Edge Functions.

**Never** put `sk_` or `whsec_` in `VITE_*` client env.

## 3. Deploy the function

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

`--no-verify-jwt` is required so Stripe can POST without a Supabase user JWT.

## 4. Full webhook URL for Stripe

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
```

### How to get `YOUR_PROJECT_REF`

| Method | How |
|--------|-----|
| Dashboard | Project Settings → General → **Reference ID** |
| Project URL | From `https://abcdefghijklmnop.supabase.co` → ref is `abcdefghijklmnop` |
| CLI | `supabase projects list` or `supabase status` (linked project) |

Example:

```
https://abcdefghijklmnop.supabase.co/functions/v1/stripe-webhook
```

## 5. Register endpoint in Stripe

1. [Stripe Dashboard](https://dashboard.stripe.com) → **Developers** → **Webhooks**
2. **Add endpoint**
3. Endpoint URL: the full URL above
4. Select events:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - (optional) `charge.refunded`
5. Create → copy **Signing secret** (`whsec_...`) → set as `STRIPE_WEBHOOK_SECRET`

Use **Test mode** while developing.

### Critical: one Stripe account → multiple Supabase projects

If **production** and **staging** both have webhooks on the same Stripe **Test** account, every event is sent to **both**.

Example from a real delivery:

| Status | URL |
|--------|-----|
| **200** | `https://lbstant….supabase.co/functions/v1/stripe-webhook` (**production**) |
| **500** | `https://qoriot….supabase.co/functions/v1/stripe-webhook` (**staging**) |

If the app uses **staging** `VITE_SUPABASE_URL` but only **production** returns 200, My Plan stays empty/wrong on staging while data may land on production.

**While developing staging:**

1. Prefer **only the staging webhook** enabled for Test mode, **or**
2. Disable/delete the production Test webhook temporarily, **or**
3. Use a separate Stripe account for staging.

Always open a delivery and confirm the URL host matches the Supabase project your browser uses.

## 6. Local testing with Stripe CLI

```bash
# Terminal A - local Supabase + function
supabase start
supabase functions serve stripe-webhook --env-file supabase/.env --no-verify-jwt

# Terminal B - forward Stripe events
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

Put in `supabase/.env`:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # printed by `stripe listen`
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=...     # from `supabase status`
```

Complete a test Checkout; CLI should show `200` and function logs `donation recorded`.

## 7. Verify

```sql
select amount_cents, interval, fund_type, status, created_at
from donations
order by created_at desc
limit 10;

select * from stripe_subscriptions order by updated_at desc limit 10;
```

Support page totals / recent list read via RPCs after these rows exist.
