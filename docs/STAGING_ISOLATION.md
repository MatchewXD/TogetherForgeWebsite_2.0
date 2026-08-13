# Staging isolation

Lightweight rules so a staging environment cannot affect production users or real money.

This is **config and process** only — not a multi-env deployment platform.

---

## Isolation model

| Environment | Supabase | Stripe | Webhook |
|-------------|----------|--------|---------|
| **Local / dev** | Local CLI **or** a personal/dev project | **Test** keys (`pk_test_` / `sk_test_`) | Stripe CLI or test endpoint |
| **Staging** | **Separate** Supabase project | **Test** keys only | **Test** webhook → staging function URL |
| **Production** | Main Supabase project | **Live** keys (`pk_live_` / `sk_live_`) | **Live** webhook → production function URL |

```
Staging  →  staging Supabase project  +  Stripe TEST  +  test webhook
Production → main Supabase project   +  Stripe LIVE  +  live webhook
```

They must not share database rows, service-role keys, or Stripe mode.

---

## Critical rules (plain language)

1. **Staging never uses live Stripe.** No `sk_live_`, no `pk_live_`, no live webhook secret on staging.
2. **Staging never uses the production Supabase project.** Different project URL, anon key, and service_role.
3. **Production service_role never leaves production.** Do not paste it into local, staging, CI for another env, or client env.
4. **Client (`VITE_*`) never gets secrets.** No `sk_`, no `whsec_`, no service_role, no MFA pepper in Vite env.
5. **Webhooks are per environment.** A test webhook must point at the staging function URL; live webhook at production only.
6. **Edge Function secrets are per project.** When you `supabase secrets set`, confirm you are linked to the intended project ref.
7. **Test data stays in test land.** Staging donations/subscriptions are Stripe test objects; they must not write to the production DB (they won’t if rule 2 is followed).
8. **When in doubt, check the key prefix.**  
   - `pk_test_` / `sk_test_` → safe for local/staging  
   - `pk_live_` / `sk_live_` → production only  
   - Wrong prefix in the wrong place = stop and fix before deploying.

---

## Env file map

| File | Purpose |
|------|---------|
| `.env.example` | Local/dev **client** template → copy to `.env.local` |
| `.env.staging.example` | Staging **client** template |
| `.env.production.example` | Production **client** template |
| `supabase/.env.example` | Local **Edge Function** secrets → copy to `supabase/.env` |
| `supabase/.env.staging.example` | Staging secrets checklist (set on staging project) |
| `supabase/.env.production.example` | Production secrets checklist (set on production project) |

Real secret files (`.env.local`, `supabase/.env`, host dashboards) are gitignored or never committed.

---

## What you still create outside the repo

Not automated here (on purpose):

- A second Supabase project for staging  
- Stripe Live mode / live keys  
- Hosting or CI that injects the right file per deploy  

When those exist, wire each deploy to the matching example’s variables only.

---

## Quick checklist before a staging deploy

- [ ] `VITE_SUPABASE_URL` is the **staging** project  
- [ ] `VITE_STRIPE_PUBLISHABLE_KEY` starts with `pk_test_`  
- [ ] Staging function secrets: `STRIPE_SECRET_KEY` starts with `sk_test_`  
- [ ] Staging webhook secret matches the **test** endpoint for the staging URL  
- [ ] No production service_role anywhere in staging config  

## Quick checklist before a production deploy

- [ ] Client points at the **main** Supabase project  
- [ ] Publishable key is `pk_live_`  
- [ ] Function secret is `sk_live_`  
- [ ] Live webhook points only at production `stripe-webhook`  
- [ ] Staging still on test keys / separate project  

---

## Related docs

- `docs/STRIPE_LOCAL_SETUP.md` — local Stripe + Edge Function wiring  
- `docs/STRIPE_WEBHOOK_DEPLOY.md` — webhook function deploy steps  
