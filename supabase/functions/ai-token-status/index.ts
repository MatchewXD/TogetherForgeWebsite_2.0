/**
 * AI token balance + platform availability (user-safe).
 * Never returns API cost, margins, or provider secrets.
 *
 * GET or POST (auth optional for platform availability; balance needs JWT)
 *
 * Deploy: supabase functions deploy ai-token-status --no-verify-jwt
 */

// deno-lint-ignore-file
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';
import { enforceRateLimit, RATE_LIMITS } from '../_shared/rateLimit.ts';
import { AI_TOKEN_PACKS } from '../_shared/aiTokenPacks.ts';
import {
  AI_SERVICES_DISABLED_MESSAGE,
  getAiServiceAvailability,
} from '../_shared/aiTokenEconomy.ts';
import { getAiProvider } from '../_shared/aiProvider.ts';

const supabaseUrl =
  Deno.env.get('SUPABASE_URL') ?? Deno.env.get('SB_URL') ?? '';
const serviceKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SERVICE_ROLE_KEY') ??
  '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function admin() {
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function userFromRequest(req) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token || !supabaseUrl) return null;
  if (anonKey && token === anonKey) return null;
  if (serviceKey && token === serviceKey) return null;
  const client = createClient(supabaseUrl, anonKey || serviceKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Database not configured.' }, 500);
  }

  try {
    const authUser = await userFromRequest(req);
    const userId = authUser?.id ? String(authUser.id) : null;

    const limited = enforceRateLimit(req, {
      ...RATE_LIMITS.aiTokenStatus,
      userId,
      cors,
    });
    if (limited) return limited;

    const sb = admin();
    const availability = await getAiServiceAvailability(sb);

    const packs = AI_TOKEN_PACKS.map((p) => ({
      id: p.id,
      label: p.label,
      priceCents: p.priceCents,
      tokens: p.tokens,
    }));

    // Provider configured? (boolean only — no keys)
    // Do NOT expose per-action base costs here (no pre-run token pricing).
    let providerReady = false;
    try {
      const p = getAiProvider();
      providerReady = Boolean(p?.configured ?? true);
      // GrokProvider exposes configured; interface may not
      if (typeof p?.configured === 'boolean') providerReady = p.configured;
      else providerReady = Boolean(Deno.env.get('XAI_API_KEY') || Deno.env.get('GROK_API_KEY'));
    } catch {
      providerReady = false;
    }

    let balance = null;
    let lifetime = null;
    if (userId) {
      await sb.rpc('ensure_ai_token_balance', { p_user_id: userId });
      const { data: bal } = await sb
        .from('ai_token_balances')
        .select(
          'balance, lifetime_purchased, lifetime_spent, lifetime_awarded, updated_at'
        )
        .eq('user_id', userId)
        .maybeSingle();
      balance = Number(bal?.balance) || 0;
      lifetime = {
        purchased: Number(bal?.lifetime_purchased) || 0,
        spent: Number(bal?.lifetime_spent) || 0,
        awarded: Number(bal?.lifetime_awarded) || 0,
        updatedAt: bal?.updated_at || null,
      };
    }

    // platformEnabled = kill-switch + spend caps only (must not mix with API key)
    // servicesEnabled = platform + provider key (generation endpoints also re-check)
    const platformEnabled = availability.enabled === true;
    const servicesEnabled = platformEnabled && providerReady;
    let message = null;
    let reason = null;
    if (!platformEnabled) {
      reason = availability.reason || 'disabled';
      message = availability.message || AI_SERVICES_DISABLED_MESSAGE;
    } else if (!providerReady) {
      // Do NOT use the usage-limits string — that confuses operators
      reason = 'provider_not_configured';
      message =
        'AI provider is not configured on this environment (set XAI_API_KEY). Token purchases still work.';
    }

    return json({
      balance,
      lifetime,
      signedIn: Boolean(userId),
      servicesEnabled,
      /** Platform caps / kill-switch only (ignores missing API key) */
      platformEnabled,
      providerReady,
      disabledReason: platformEnabled ? (providerReady ? null : reason) : reason,
      /** Only set when platform is off — UI uses this for the red/amber banner */
      disabledMessage: platformEnabled ? null : message,
      providerMessage: platformEnabled && !providerReady ? message : null,
      packs,
      /** Pack scale: 50,000 tokens per $1 */
      tokensPerUsd: 50_000,
      caps: {
        userHourlyRequestCap: availability.user_hourly_request_cap,
        userDailyRequestCap: availability.user_daily_request_cap,
      },
    });
  } catch (err) {
    console.error('[ai-token-status]', err?.message || err);
    return json({ error: err?.message || 'Status failed' }, 500);
  }
});
