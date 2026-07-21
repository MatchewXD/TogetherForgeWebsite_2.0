# Local Stripe Checkout (Vite + Supabase Edge Function)

## Security rules

| Variable | Where | Prefix |
|----------|--------|--------|
| `STRIPE_SECRET_KEY` (`sk_test_...`) | **Edge Function only** (`supabase/.env`) | **Never** `VITE_` |
| `STRIPE_PRODUCT_ID` (`prod_...`) | Edge Function (optional) | Not `VITE_` (or optional public `VITE_STRIPE_PRODUCT_ID`) |
| `VITE_STRIPE_PUBLISHABLE_KEY` (`pk_test_...`) | Client optional | OK with `VITE_` (not needed for redirect Checkout) |
| `VITE_SUPABASE_URL` | Client | Required |
| `VITE_SUPABASE_ANON_KEY` | Client | Required |

If `STRIPE_SECRET_KEY` is in `.env.local` with a **`VITE_`** prefix, remove it immediately. Vite would ship it to the browser.

## 1. Client env (`.env.local`)

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<your local anon key>

# Optional: only the publishable key is safe in Vite
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Optional override; otherwise client uses {VITE_SUPABASE_URL}/functions/v1/create-checkout
# VITE_STRIPE_CHECKOUT_API_URL=http://127.0.0.1:54321/functions/v1/create-checkout

# Optional product id passed from client (or set on the function as STRIPE_PRODUCT_ID)
VITE_STRIPE_PRODUCT_ID=prod_UvB5nILGYFdPln
```

## 2. Edge Function env (`supabase/.env`)

Create `supabase/.env` (gitignored in most setups; do not commit secrets):

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRODUCT_ID=prod_UvB5nILGYFdPln
```

## 3. Serve the function

```bash
# From project root, with local Supabase already running:
npx supabase functions serve create-checkout --env-file supabase/.env
```

Keep this terminal open. Logs show `[create-checkout] creating session`.

## 4. Run the Vite app

```bash
npm run dev
```

Open `http://localhost:5173/support` and use a tier button, or use:

```jsx
import StripeCheckoutButton from './components/support/StripeCheckoutButton';

<StripeCheckoutButton amountDollars={5} interval="once" />
```

## 5. Test card

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Any future expiry, any CVC

After pay: redirect to  
`http://localhost:5173/support?checkout=success&session_id=cs_test_...`

Cancel:  
`http://localhost:5173/support?checkout=cancel`

## Flow diagram

```
[React button]
    |  POST amountCents, successUrl, cancelUrl
    |  Authorization: Bearer <anon key>
    v
[Edge Function create-checkout]  <-- STRIPE_SECRET_KEY only here
    |  stripe.checkout.sessions.create(...)
    v
{ url: "https://checkout.stripe.com/..." }
    |
    v
window.location = url  -->  Stripe hosted page  -->  success/cancel URLs
```

## Alternative: small Node/Express backend

If you do not want Edge Functions, a minimal Express route works the same way:

```js
// server only — never import this into Vite
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.post('/api/create-checkout', async (req, res) => {
  const { amountCents, successUrl, cancelUrl } = req.body;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: successUrl + '&session_id={CHECKOUT_SESSION_ID}',
    cancel_url: cancelUrl,
    line_items: [{
      price_data: {
        currency: 'usd',
        unit_amount: amountCents,
        product: process.env.STRIPE_PRODUCT_ID, // prod_UvB5nILGYFdPln
      },
      quantity: 1,
    }],
  });
  res.json({ url: session.url });
});
```

Client would set `VITE_STRIPE_CHECKOUT_API_URL=http://localhost:3001/api/create-checkout`.

Prefer Supabase Edge Functions in this project so secrets stay with Supabase.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Stripe is not configured on the server` | `STRIPE_SECRET_KEY` missing in function env |
| Network / Failed to fetch | Function not served; wrong port; CORS |
| 401 from functions | Send `Authorization` + `apikey` with anon key (client does this) |
| Invalid product | Product id must exist in same Stripe mode (test vs live) |
| Secret in browser bundle | Search built JS for `sk_`; remove any `VITE_STRIPE_SECRET` |
