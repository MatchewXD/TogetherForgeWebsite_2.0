# Deploy `stripe-webhook` Edge Function

## What it does

1. Verifies `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET`
2. Handles:
   - `checkout.session.completed` → insert/update `donations`
   - `invoice.paid` → recurring payments (skips first invoice if already recorded)
   - `customer.subscription.created|updated|deleted` → upsert `stripe_subscriptions`
   - `charge.refunded` → mark donation `status = refunded`
3. Returns **200** `{ received: true }` so Stripe stops retrying after success

## 1. Database

In Supabase SQL Editor, run (in order if not already applied):

1. `supabase/sql/supabase_donations_stripe.sql`
2. `supabase/sql/supabase_donations_public_feed.sql`
3. `supabase/sql/supabase_stripe_subscriptions.sql` (event log + subscriptions)

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
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - (optional) `charge.refunded`
5. Create → copy **Signing secret** (`whsec_...`) → set as `STRIPE_WEBHOOK_SECRET`

Use **Test mode** while developing.

## 6. Local testing with Stripe CLI

```bash
# Terminal A — local Supabase + function
supabase start
supabase functions serve stripe-webhook --env-file supabase/.env --no-verify-jwt

# Terminal B — forward Stripe events
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
