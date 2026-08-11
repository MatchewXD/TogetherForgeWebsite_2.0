/**
 * Supabase Edge Function: get-billing-summary
 * Returns the signed-in user's Stripe payment methods with brand + last4.
 *
 * Deploy: supabase functions deploy get-billing-summary --no-verify-jwt
 */

// deno-lint-ignore-file
// @ts-nocheck
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const supabaseUrl =
  Deno.env.get('SUPABASE_URL') ?? Deno.env.get('SB_URL') ?? '';
const serviceKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SERVICE_ROLE_KEY') ??
  '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const META_USER_KEY = 'together_forge_user_id';

const stripe = new Stripe(stripeKey, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
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
  const client = createClient(supabaseUrl, anonKey || serviceKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

function customerOwnedByUser(customer, userId) {
  if (!customer || !userId) return false;
  const meta = customer.metadata || {};
  return (
    meta[META_USER_KEY] === userId ||
    meta.userId === userId ||
    meta.user_id === userId
  );
}

/**
 * Count attached card / link payment methods on a Stripe customer.
 */
async function countCustomerMethods(customerId) {
  let cards = 0;
  let links = 0;
  try {
    const listed = await stripe.customers.listPaymentMethods(customerId, {
      type: 'card',
      limit: 30,
    });
    cards = (listed.data || []).length;
  } catch {
    /* ignore */
  }
  try {
    const listed = await stripe.customers.listPaymentMethods(customerId, {
      type: 'link',
      limit: 10,
    });
    links = (listed.data || []).length;
  } catch {
    /* ignore */
  }
  return { cards, links };
}

/**
 * Pick the best Stripe customer for this TF user.
 * Prefer the one that actually has cards (not an older Link-only customer).
 */
async function resolveCustomerId(user) {
  const uid = user.id;
  const sb = admin();
  const candidateIds = [];
  const push = (id) => {
    if (id && !candidateIds.includes(id)) candidateIds.push(id);
  };

  try {
    const { data: subs } = await sb
      .from('stripe_subscriptions')
      .select('customer_id')
      .eq('user_id', uid)
      .not('customer_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(10);
    for (const row of subs || []) push(row.customer_id);
  } catch {
    /* ignore */
  }

  try {
    const { data: dons } = await sb
      .from('donations')
      .select('stripe_customer_id')
      .eq('user_id', uid)
      .not('stripe_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);
    for (const row of dons || []) push(row.stripe_customer_id);
  } catch {
    /* ignore */
  }

  for (const key of [META_USER_KEY, 'userId']) {
    try {
      const found = await stripe.customers.search({
        query: `metadata['${key}']:'${uid}'`,
        limit: 10,
      });
      for (const c of found?.data || []) push(c.id);
    } catch {
      /* search optional */
    }
  }

  const email = user.email ? String(user.email).toLowerCase() : '';
  if (email) {
    try {
      const listed = await stripe.customers.list({ email, limit: 20 });
      for (const c of listed.data || []) {
        if (customerOwnedByUser(c, uid)) push(c.id);
      }
      // Owned-by-metadata first; then any email match as weak candidates
      for (const c of listed.data || []) push(c.id);
    } catch {
      /* ignore */
    }
  }

  let bestId = null;
  let bestScore = -1;
  const scored = [];

  for (const id of candidateIds) {
    try {
      const c = await stripe.customers.retrieve(id);
      if (!c || c.deleted) continue;
      const { cards, links } = await countCustomerMethods(id);
      // Cards win hard over Link-only / empty customers
      const owned = customerOwnedByUser(c, uid) ? 5 : 0;
      const score = cards * 1000 + links * 10 + owned;
      scored.push({ id, cards, links, score, owned: owned > 0 });
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    } catch {
      /* stale id */
    }
  }

  console.log('[get-billing-summary] resolveCustomer', {
    uid,
    candidates: scored,
    picked: bestId,
  });

  // Attach last resolve diagnostics for the HTTP handler
  resolveCustomerId._lastDebug = {
    uid,
    candidates: scored,
    picked: bestId,
  };

  return bestId;
}

function asLast4(v) {
  if (v == null || v === '') return null;
  const s = String(v).replace(/\D/g, '');
  if (s.length >= 4) return s.slice(-4);
  if (s.length > 0) return s;
  return null;
}

/**
 * Normalize any Stripe card-like object into UI fields.
 */
function normalizeMethod(raw, defaultId) {
  if (!raw) return null;

  // Already-normalized from a prior step
  if (raw.last4 && (raw.brand || raw.type) && raw.id && !raw.object) {
    return {
      id: raw.id,
      type: raw.type || 'card',
      brand: raw.brand || 'card',
      last4: asLast4(raw.last4),
      expMonth: raw.expMonth ?? raw.exp_month ?? null,
      expYear: raw.expYear ?? raw.exp_year ?? null,
      isDefault: Boolean(defaultId && raw.id === defaultId),
      funding: raw.funding || null,
    };
  }

  const id = raw.id || null;
  if (!id) return null;

  let brand = 'card';
  let last4 = null;
  let expMonth = null;
  let expYear = null;
  let funding = null;
  let type = raw.type || raw.object || 'card';

  if (raw.card) {
    brand = raw.card.brand || brand;
    last4 = asLast4(raw.card.last4);
    expMonth = raw.card.exp_month ?? null;
    expYear = raw.card.exp_year ?? null;
    funding = raw.card.funding || null;
    type = 'card';
  } else if (raw.object === 'card' || (raw.last4 && (raw.brand || raw.exp_month))) {
    brand = raw.brand || brand;
    last4 = asLast4(raw.last4);
    expMonth = raw.exp_month ?? null;
    expYear = raw.exp_year ?? null;
    funding = raw.funding || null;
    type = 'card';
  } else if (raw.object === 'source' && raw.card) {
    brand = raw.card.brand || brand;
    last4 = asLast4(raw.card.last4);
    expMonth = raw.card.exp_month ?? null;
    expYear = raw.card.exp_year ?? null;
    funding = raw.card.funding || null;
    type = 'card';
  } else if (raw.us_bank_account) {
    brand = 'bank';
    last4 = asLast4(raw.us_bank_account.last4);
    type = 'us_bank_account';
  } else if (raw.payment_method_details?.card) {
    const c = raw.payment_method_details.card;
    brand = c.brand || brand;
    last4 = asLast4(c.last4);
    expMonth = c.exp_month ?? null;
    expYear = c.exp_year ?? null;
    funding = c.funding || null;
    type = 'card';
  } else if (raw.type === 'link') {
    brand = 'link';
    type = 'link';
    // Link may still have an underlying card display in some cases
    last4 = asLast4(raw.link?.permanent_token ? null : raw.card?.last4);
  }

  return {
    id,
    type,
    brand,
    last4,
    expMonth,
    expYear,
    isDefault: Boolean(defaultId && id === defaultId),
    funding,
  };
}

function isLinkMethod(m) {
  const t = String(m?.type || '').toLowerCase();
  const b = String(m?.brand || '').toLowerCase();
  return t === 'link' || b === 'link';
}

function cardFromStripeObject(obj) {
  if (!obj) return null;
  if (obj.card?.last4) return obj.card;
  if (obj.last4 && (obj.brand || obj.exp_month)) return obj;
  if (obj.payment_method_details?.card?.last4) {
    return obj.payment_method_details.card;
  }
  return null;
}

/**
 * True when a PaymentMethod is still attached to this customer.
 * Detached PMs have customer === null — must NOT treat null as attached
 * (that resurrected old charge cards as active methods).
 */
function isAttachedToCustomer(obj, customerId) {
  if (!obj || !customerId) return false;
  const cust =
    typeof obj.customer === 'string'
      ? obj.customer
      : obj.customer?.id || null;
  return cust === customerId;
}

/**
 * Map a Stripe PaymentMethod / Source into our UI shape.
 * Prefer the nested card object for last4 (always present on type=card).
 */
function mapAttachedMethod(pm, defaultId) {
  if (!pm?.id) return null;

  if (pm.type === 'card' || (pm.card && pm.type !== 'link')) {
    const card = pm.card || {};
    return {
      id: pm.id,
      type: 'card',
      brand: card.brand || pm.brand || 'card',
      last4: asLast4(card.last4 ?? pm.last4),
      expMonth: card.exp_month ?? pm.exp_month ?? null,
      expYear: card.exp_year ?? pm.exp_year ?? null,
      funding: card.funding || null,
      linkEmail: null,
      isDefault: Boolean(defaultId && pm.id === defaultId),
    };
  }

  if (pm.object === 'card') {
    return {
      id: pm.id,
      type: 'card',
      brand: pm.brand || 'card',
      last4: asLast4(pm.last4),
      expMonth: pm.exp_month ?? null,
      expYear: pm.exp_year ?? null,
      funding: pm.funding || null,
      linkEmail: null,
      isDefault: Boolean(defaultId && pm.id === defaultId),
    };
  }

  if (pm.type === 'link') {
    return {
      id: pm.id,
      type: 'link',
      brand: 'link',
      last4: asLast4(pm.card?.last4),
      expMonth: pm.card?.exp_month ?? null,
      expYear: pm.card?.exp_year ?? null,
      funding: null,
      linkEmail: pm.link?.email || null,
      isDefault: Boolean(defaultId && pm.id === defaultId),
    };
  }

  // Fallback generic normalize
  return normalizeMethod(pm, defaultId);
}

/**
 * Apply card brand/last4 onto an existing attached method row.
 */
function applyCardDigits(byId, pmId, card) {
  if (!pmId || !card?.last4 || !byId.has(pmId)) return false;
  const prev = byId.get(pmId);
  byId.set(pmId, {
    ...prev,
    type: 'card',
    brand: card.brand || (prev.brand !== 'link' ? prev.brand : 'card') || 'card',
    last4: asLast4(card.last4),
    expMonth: card.exp_month ?? prev.expMonth ?? null,
    expYear: card.exp_year ?? prev.expYear ?? null,
    funding: card.funding || prev.funding || null,
    linkEmail: prev.linkEmail || null,
  });
  return true;
}

/**
 * Collect currently attached payment methods.
 * Prefer type=card with last4. Link PMs are included when no cards exist;
 * last4 is filled from charges / setup intents / payment intents for those
 * same attached ids only (never resurrects detached cards).
 */
async function collectPaymentMethods(customerId) {
  const debug = {
    listedCards: [],
    listedLinks: [],
    setupIntentPms: [],
    chargePmIds: [],
    enrichHits: [],
  };

  const customer = await stripe.customers.retrieve(customerId, {
    expand: ['invoice_settings.default_payment_method', 'default_source'],
  });
  if (!customer || customer.deleted) {
    return { methods: [], defaultId: null, customerId: null, meta: {} };
  }

  let defaultId = null;
  const def = customer.invoice_settings?.default_payment_method;
  if (typeof def === 'string') defaultId = def;
  else if (def?.id) defaultId = def.id;

  const byId = new Map();
  const put = (pm) => {
    const m = mapAttachedMethod(pm, defaultId);
    if (!m?.id) return;
    const prev = byId.get(m.id);
    if (!prev) {
      byId.set(m.id, m);
      return;
    }
    // Prefer row that already has last4
    if (prev.last4 && !m.last4) return;
    byId.set(m.id, {
      ...prev,
      ...m,
      last4: m.last4 || prev.last4,
      brand: m.last4 ? m.brand : prev.brand || m.brand,
      expMonth: m.expMonth ?? prev.expMonth,
      expYear: m.expYear ?? prev.expYear,
      funding: m.funding || prev.funding,
    });
  };

  // 1) Real cards currently attached
  let rawCardCount = 0;
  try {
    const listed = await stripe.customers.listPaymentMethods(customerId, {
      type: 'card',
      limit: 30,
    });
    rawCardCount = (listed.data || []).length;
    for (const pm of listed.data || []) {
      debug.listedCards.push({
        id: pm.id,
        last4: pm.card?.last4 || null,
        brand: pm.card?.brand || null,
      });
      put(pm);
    }
  } catch (e) {
    console.warn('[get-billing-summary] list cards', e?.message);
  }

  // 2) Link wallets (always list — portal often saves cards as Link, not type=card)
  let rawLinkCount = 0;
  try {
    const links = await stripe.customers.listPaymentMethods(customerId, {
      type: 'link',
      limit: 20,
    });
    rawLinkCount = (links.data || []).length;
    for (const pm of links.data || []) {
      debug.listedLinks.push({
        id: pm.id,
        email: pm.link?.email || null,
      });
      put(pm);
    }
  } catch (e) {
    console.warn('[get-billing-summary] list link', e?.message);
  }

  // 3) Legacy card sources
  try {
    const sources = await stripe.customers.listSources(customerId, {
      object: 'card',
      limit: 20,
    });
    for (const s of sources.data || []) put(s);
  } catch {
    /* ignore */
  }

  try {
    const src = customer.default_source;
    if (src && typeof src === 'object' && (src.object === 'card' || src.last4)) {
      put(src);
    }
  } catch {
    /* ignore */
  }

  // Snapshot of ids that came from live list/sources only (authoritative set).
  // History may only ENRICH these — never introduce new detached PM ids.
  const liveAttachedIds = new Set(byId.keys());

  // 4) SetupIntents — enrich last4 on live attached methods only.
  //    Never add a PM whose customer is null (detached) even if SI succeeded.
  try {
    const setups = await stripe.setupIntents.list({
      customer: customerId,
      limit: 30,
    });
    for (const si of setups.data || []) {
      if (si.status !== 'succeeded' && si.status !== 'processing') continue;
      const pmId =
        typeof si.payment_method === 'string'
          ? si.payment_method
          : si.payment_method?.id;
      if (!pmId) continue;
      try {
        const full = await stripe.paymentMethods.retrieve(pmId);
        const custField =
          typeof full.customer === 'string'
            ? full.customer
            : full.customer?.id || null;
        const attached = isAttachedToCustomer(full, customerId);
        debug.setupIntentPms.push({
          setupIntentId: si.id,
          status: si.status,
          pmId,
          type: full.type,
          attached,
          customer: custField,
          brand: full.card?.brand || full.type || null,
          last4: full.card?.last4 || null,
        });
        if (!attached) continue;
        put(full);
        liveAttachedIds.add(pmId);
        if (full.card?.last4) {
          applyCardDigits(byId, pmId, full.card);
          debug.enrichHits.push(`setupIntent:${pmId}:${full.card.last4}`);
        }
      } catch (e) {
        debug.setupIntentPms.push({
          setupIntentId: si.id,
          pmId,
          error: e?.message || 'retrieve failed',
        });
      }
    }
  } catch (e) {
    console.warn('[get-billing-summary] setupIntents', e?.message);
  }

  // 5) Charges — ONLY enrich last4 for PMs already in the live attached set.
  //    Do not resurrect historical card PM ids from old donations (ghost rows).
  try {
    const charges = await stripe.charges.list({
      customer: customerId,
      limit: 30,
    });
    for (const ch of charges.data || []) {
      if (ch.status !== 'succeeded' && ch.paid !== true) continue;
      const pmId =
        typeof ch.payment_method === 'string'
          ? ch.payment_method
          : ch.payment_method?.id || null;
      const card =
        ch.payment_method_details?.card ||
        (ch.source && ch.source.object === 'card' ? ch.source : null);
      debug.chargePmIds.push({
        chargeId: ch.id,
        pmId,
        last4: card?.last4 || null,
        brand: card?.brand || null,
        inAttachedSet: pmId ? byId.has(pmId) : false,
      });
      if (!pmId || !card?.last4) continue;
      if (!byId.has(pmId)) continue; // detached / historical — ignore
      applyCardDigits(byId, pmId, card);
      debug.enrichHits.push(`charge:${pmId}:${card.last4}`);
    }
  } catch (e) {
    console.warn('[get-billing-summary] charges', e?.message);
  }

  // 6) PaymentIntents — same rule: enrich live attached only
  try {
    const pis = await stripe.paymentIntents.list({
      customer: customerId,
      limit: 20,
      expand: ['data.payment_method', 'data.latest_charge'],
    });
    for (const pi of pis.data || []) {
      if (pi.status !== 'succeeded') continue;
      const pmObj =
        typeof pi.payment_method === 'object' ? pi.payment_method : null;
      const pmId =
        (pmObj && pmObj.id) ||
        (typeof pi.payment_method === 'string' ? pi.payment_method : null);
      if (pmObj && isAttachedToCustomer(pmObj, customerId)) {
        put(pmObj);
        liveAttachedIds.add(pmObj.id);
        const c = cardFromStripeObject(pmObj);
        if (c?.last4) {
          applyCardDigits(byId, pmId, c);
          debug.enrichHits.push(`pi:${pmId}:${c.last4}`);
        }
      }
      const ch =
        typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
      if (pmId && ch?.payment_method_details?.card?.last4 && byId.has(pmId)) {
        applyCardDigits(byId, pmId, ch.payment_method_details.card);
        debug.enrichHits.push(
          `pi-charge:${pmId}:${ch.payment_method_details.card.last4}`
        );
      }
    }
  } catch (e) {
    console.warn('[get-billing-summary] paymentIntents', e?.message);
  }

  // Drop anything that is no longer in liveAttachedIds (safety net)
  for (const id of [...byId.keys()]) {
    if (!liveAttachedIds.has(id)) {
      // Still allow if we can prove attach via retrieve
      try {
        const full = await stripe.paymentMethods.retrieve(id);
        if (isAttachedToCustomer(full, customerId)) {
          liveAttachedIds.add(id);
          continue;
        }
      } catch {
        /* ignore */
      }
      byId.delete(id);
      debug.enrichHits.push(`dropped-detached:${id}`);
    }
  }

  // Default must still be in the attached set
  if (defaultId && !byId.has(defaultId)) {
    try {
      const full = await stripe.paymentMethods.retrieve(defaultId);
      if (isAttachedToCustomer(full, customerId)) {
        put(full);
      } else {
        defaultId = null;
      }
    } catch {
      defaultId = null;
    }
  }

  let methods = [...byId.values()].map((m) => ({
    ...m,
    last4: asLast4(m.last4),
    isDefault: Boolean(defaultId && m.id === defaultId),
  }));

  // Prefer rows with last4. Keep ALL such rows. If none, keep all Link rows
  // (do not collapse to a single Link — user may have multiple Link PMs).
  const withDigits = methods.filter((m) => m.last4);
  if (withDigits.length) {
    methods = withDigits;
  } else {
    methods = methods.filter(
      (m) => isLinkMethod(m) || m.type === 'card' || m.last4
    );
  }

  if (methods.length && !methods.some((m) => m.isDefault)) {
    const prefer = methods.find((m) => m.last4) || methods[0];
    if (prefer) prefer.isDefault = true;
  }

  methods.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    if (Boolean(a.last4) !== Boolean(b.last4)) return a.last4 ? -1 : 1;
    return 0;
  });

  const meta = {
    rawCardCount,
    rawLinkCount,
    returned: methods.length,
    brands: methods.map((m) => `${m.brand}:${m.last4 || 'none'}`),
    defaultId,
    // Safe diagnostics for browser console (no secrets)
    listedCards: debug.listedCards,
    listedLinks: debug.listedLinks,
    setupIntentPms: debug.setupIntentPms.slice(0, 15),
    chargePmIds: debug.chargePmIds.slice(0, 15),
    enrichHits: debug.enrichHits.slice(0, 20),
    note:
      rawCardCount === 0 && rawLinkCount > 0
        ? 'Only Link wallets are currently attached (no type=card). Ghost card rows from old charges are no longer included. last4 on Link only if a charge used that same Link PM id.'
        : null,
  };

  console.log('[get-billing-summary] result', { customerId, ...meta });

  return { methods, defaultId, customerId, meta };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!stripeKey) {
    return json({ error: 'Stripe is not configured on the server.' }, 500);
  }
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Database not configured.' }, 500);
  }

  try {
    const user = await userFromRequest(req);
    if (!user?.id) {
      return json({ error: 'Sign in to view payment methods.' }, 401);
    }

    const customerId = await resolveCustomerId(user);
    const resolveDebug = resolveCustomerId._lastDebug || null;
    if (!customerId) {
      return json({
        customerId: null,
        paymentMethods: [],
        defaultPaymentMethodId: null,
        message:
          'No Stripe customer on file yet. Complete a signed-in donation or subscription first, then add a card.',
        _meta: { resolve: resolveDebug },
      });
    }

    const { methods, defaultId, meta } =
      await collectPaymentMethods(customerId);

    return json({
      customerId,
      paymentMethods: methods,
      defaultPaymentMethodId:
        defaultId || methods.find((m) => m.isDefault)?.id || null,
      // Debug-friendly (safe — last4 only, no full PAN)
      _meta: {
        methodCount: methods.length,
        last4Found: methods.filter((m) => m.last4).map((m) => m.last4),
        resolve: resolveDebug,
        ...(meta || {}),
      },
    });
  } catch (err) {
    console.error('[get-billing-summary]', err?.message || err);
    return json(
      { error: err?.message || 'Could not load payment methods.' },
      500
    );
  }
});
