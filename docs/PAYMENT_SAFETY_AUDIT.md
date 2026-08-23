# Payment systems safety audit

Date: 2026-08-23  
Scope: Stripe keys, webhook signatures, secret leakage, donation gate  
Method: repo scan (tracked files, env templates, Edge Functions, client). No production secret values were read from hosted dashboards. No code was changed.

---

## 1. Stripe keys

### Committed / client-exposed secret keys

**None found.** Tracked files contain only placeholders (`sk_test_...`, `sk_live_...`, `whsec_...`). Git does not track `.env`, `.env.local`, `.env.staging`, `.env.production`, or `supabase/.env*`. A search of tracked JS/TS/MD/examples and the current `dist/` bundle found no `sk_test_51…`, `sk_live_…`, or real `whsec_` values.

Client (`VITE_*`) is only allowed to hold **publishable** keys:

| Variable | Role | Browser? |
|----------|------|----------|
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_` / `pk_live_` | Yes (intended) |
| `VITE_STRIPE_CHECKOUT_API_URL` | public function URL | Yes |
| `VITE_STRIPE_PAYMENT_LINKS` | public Payment Link URLs | Yes |
| `VITE_ENABLE_DONATIONS` | checkout gate | Yes |
| `STRIPE_SECRET_KEY` | `sk_test_` / `sk_live_` | **No** — Edge Function env only |
| `STRIPE_WEBHOOK_SECRET` | `whsec_` | **No** — webhook function only |
| `SUPABASE_SERVICE_ROLE_KEY` | DB admin | **No** — Edge Functions (auto on hosted) |

`src/` never references `STRIPE_SECRET_KEY` as a value; comments and a couple of **user-visible error strings** name the env var (see §3).

### Where secrets actually live

| Secret | Intended store |
|--------|----------------|
| `STRIPE_SECRET_KEY` | Hosted: `supabase secrets set` on that project. Local: gitignored `supabase/.env` |
| `STRIPE_WEBHOOK_SECRET` | Same (per Stripe endpoint / CLI listen secret) |
| `SUPABASE_SERVICE_ROLE_KEY` | Injected on hosted Edge Functions; never in Vite env |
| Publishable `pk_` | Host/CI `VITE_` env; gitignored `.env.local` / `.env.staging` |

**Local hygiene (not a git leak):** gitignored `.env.staging` currently holds a real `sk_test_` and `whsec_` **in the same file as `VITE_` client vars**. Vite only ships `VITE_` to the browser, so this is not a bundle leak. It is still a footgun: do not prefix those keys with `VITE_`, and prefer keeping `sk_` / `whsec_` only in `supabase/.env` + hosted secrets.

---

## 2. Webhook security

Handler: `supabase/functions/stripe-webhook/index.ts`

Verified in source:

1. Requires `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` from `Deno.env` (not hardcoded).
2. Rejects missing `stripe-signature` with **400** `{ error: 'Missing stripe-signature' }` **before** parsing the body as an event.
3. Verifies with `stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret)` (raw body, not JSON). Invalid signatures → **400** `{ error: 'Invalid signature' }`.
4. Only then switches on `event.type`.
5. Deploy is documented as `--no-verify-jwt` so Stripe (which has no Supabase JWT) can call it; **authentication is the Stripe signature**, not a JWT. That is the correct model.

Invalid/missing signatures do **not** write donations.

**Follow-ups (not current holes):**

- There is no `supabase/functions/stripe-webhook/config.toml` with `verify_jwt = false`. A deploy **without** `--no-verify-jwt` would 401 Stripe (fail closed), not skip signature checks. Still worth adding the same config MFA recovery already has so deploys stay consistent.
- Webhook is **not** behind `ENABLE_DONATIONS`. That is correct: existing subscriptions must still record `invoice.paid` while new Checkout is paused.

---

## 3. Secret leakage (logs and client errors)

**No path returns the secret key or webhook secret to the browser.**

Server logs (`TF_STRIPE_WEBHOOK`, create-checkout) record session ids, amounts, user ids, Stripe customer/subscription ids — operational PII, not card numbers or `sk_`. Signature failures log Stripe’s error **message**, which is typically “No signatures found matching the expected signature,” not the `whsec_`.

**Client-facing issues (hard-launch polish, not secret dumps):**

| Location | What the user can see |
|----------|------------------------|
| `create-checkout` / `create-token-checkout` catch | `error: err.message` (Stripe SDK). A bad/live-mismatched key often looks like `Invalid API Key provided: sk_live_…` (redacted, but prefix + env hint). |
| `manage-subscription`, `sync-checkout`, `get-billing-summary` | Same `err.message` pattern |
| `supportService.js` | Forwards API `error` to `Error`; fallback copy mentions `STRIPE_SECRET_KEY` |
| `StripeCheckoutButton.jsx` | “run create-checkout with STRIPE_SECRET_KEY” if misconfigured |

Paused-gate copy is clean: *“Payment processing is temporarily unavailable while business banking is being set up.”*

`sync-checkout` returns `{ ok, sessionId, donationId, subscription: { id, status, amount_cents, user_id } }` — not the expanded Stripe customer object. Good.

---

## 4. Donation / payment gate

Client: `src/constants/donationsEnabled.js` (`VITE_ENABLE_DONATIONS`)  
Server: `supabase/functions/_shared/donationsEnabled.ts` (`ENABLE_DONATIONS`)

| Env | Explicit flag in examples | Unset default |
|-----|---------------------------|---------------|
| Production | `VITE_ENABLE_DONATIONS=false`, `ENABLE_DONATIONS=false` | Off for `pk_live_` / `sk_live_` / missing key |
| Staging / local | flags `true` | On for `pk_test_` / `sk_test_` |

Covered in unit tests (`src/__tests__/donationsEnabled.test.js`, checkout tests).

When off:

- Client: Support / Runway / token pack UI shows `PaymentsComingSoon`; `startStripeCheckout` / `startTokenPackCheckout` **do not call** Stripe.
- Edge: `create-checkout` and `create-token-checkout` return **503** `{ error: DONATIONS_PAUSED_ERROR, code: DONATIONS_PAUSED_CODE }` **before** creating a session.

**What the gate does not stop**

- Stripe **already-open subscriptions** still renew (Stripe charges; webhook should record).
- Billing portal / `manage-subscription` stay available so people can cancel (not gated). That is the right split.

To stop **all** live charges, pause or cancel live subscriptions in the Stripe Dashboard — the env gate is “no new Checkout,” not “freeze Stripe.”

---

## 5. Overall readiness

### Soft launch — **safe**

- No `sk_` / `whsec_` in git or the client bundle.
- Only `pk_` is meant for the browser.
- Webhook verifies `Stripe-Signature` and rejects missing/invalid signatures.
- Production checkout is dual-gated (`false` flag + live-key default off) and returns 503 if someone hits the function anyway.
- Existing-sub management is still possible via Account → My Plan.

### Before hard launch (when live checkout is turned back on)

1. **Restore the production live-mode webhook** to `https://<prod-ref>.supabase.co/functions/v1/stripe-webhook` with the **live** `whsec_`, and confirm deliveries are 2xx. Until then, live renewals (if any) will not write to the production DB. Keep Test-mode endpoints from pointing at production (see `docs/STRIPE_WEBHOOK_DEPLOY.md`).
2. Set **both** `ENABLE_DONATIONS=true` (prod function secrets) and `VITE_ENABLE_DONATIONS=true` (prod client) only after banking is ready; verify a **test-mode** checkout on staging first, then a small live checkout.
3. Sanitize Edge Function 500s (generic “Checkout failed”) so Stripe `err.message` never reaches the UI. Clean the two client strings that mention `STRIPE_SECRET_KEY`.
4. Add `stripe-webhook/config.toml` `verify_jwt = false` so hosted deploys do not depend on remembering the CLI flag.
5. Keep `sk_` / `whsec_` out of Vite env files; rotate the local test secret if `.env.staging` was ever copied off-machine.

No committed secret was found, so nothing was changed in this audit.
