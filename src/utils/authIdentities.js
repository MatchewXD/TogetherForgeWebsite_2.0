/**
 * Helpers for Supabase Auth identities (email verification + SSO linking).
 * Used by Connected Accounts UI, OAuth sign-in, and the Task Board identity gate.
 *
 * SSO edge cases (Google / Discord / GitHub):
 * - Same verified email → Supabase auto-links on sign-in; we surface a confirmation.
 * - Provider already on another TF user → block with a clear error (no takeover).
 * - Provider already on this user → friendly “already linked” (not an error).
 * - Different emails → no auto-link; sign in with existing method, then Link manually.
 */

/** Providers that satisfy the Task Board identity gate (verified email + one of these). */
export const SSO_PROVIDERS = ['discord', 'google', 'github'];

export const SSO_PROVIDER_LABELS = {
  google: 'Google',
  discord: 'Discord',
  github: 'GitHub',
};

const OAUTH_INTENT_KEY = 'tf_oauth_intent';

/** How recently an identity must have been created to count as “just linked”. */
const RECENT_IDENTITY_MS = 5 * 60 * 1000;

/**
 * @param {string} [provider]
 * @returns {string}
 */
export function providerDisplayName(provider) {
  const p = String(provider || '').toLowerCase();
  return SSO_PROVIDER_LABELS[p] || (p ? p.charAt(0).toUpperCase() + p.slice(1) : 'provider');
}

/**
 * @param {object|null|undefined} user - Supabase user from getUser/getSession
 * @returns {string[]} lowercased provider names
 */
export function listUserProviders(user) {
  if (!user) return [];
  const fromIdentities = (Array.isArray(user.identities) ? user.identities : [])
    .map((i) => String(i?.provider || '').toLowerCase())
    .filter(Boolean);
  const fromMeta = []
    .concat(user.app_metadata?.providers || [])
    .concat(user.app_metadata?.provider ? [user.app_metadata.provider] : [])
    .map((p) => String(p || '').toLowerCase())
    .filter(Boolean);
  return [...new Set([...fromIdentities, ...fromMeta])];
}

/**
 * @param {object|null|undefined} user
 * @param {string} provider e.g. 'discord' | 'google' | 'github' | 'email'
 */
export function userHasProvider(user, provider) {
  const p = String(provider || '').toLowerCase();
  return listUserProviders(user).includes(p);
}

export function isEmailVerified(user) {
  if (!user) return false;
  return Boolean(user.email_confirmed_at || user.confirmed_at);
}

export function hasSsoLinked(user) {
  return SSO_PROVIDERS.some((p) => userHasProvider(user, p));
}

/**
 * Find a UserIdentity object for unlinkIdentity().
 * Prefers identities array on the user; falls back to getUserIdentities results.
 * @param {object|null|undefined} user
 * @param {string} provider
 * @param {Array} [identityList] optional from auth.getUserIdentities()
 */
export function findIdentity(user, provider, identityList) {
  const p = String(provider || '').toLowerCase();
  const list = Array.isArray(identityList)
    ? identityList
    : Array.isArray(user?.identities)
      ? user.identities
      : [];
  return list.find((i) => String(i?.provider || '').toLowerCase() === p) || null;
}

/**
 * Whether unlinking this provider would leave the user with no sign-in method.
 * Supabase usually blocks unlinking the last identity; we mirror that in UI.
 */
export function canUnlinkProvider(user, provider, identityList) {
  if (!userHasProvider(user, provider) && !findIdentity(user, provider, identityList)) {
    return false;
  }
  const list = Array.isArray(identityList)
    ? identityList
    : Array.isArray(user?.identities)
      ? user.identities
      : [];
  // Prefer actual identity rows when available
  if (list.length > 0) {
    return list.length > 1;
  }
  // Fallback: allow unlink of SSO if email provider is present or email exists
  const providers = listUserProviders(user);
  if (providers.length > 1) return true;
  if (providers.includes('email') || user?.email) return true;
  return false;
}

/** Redirect target after OAuth link completes. */
export function linkedAccountsRedirectUrl(
  origin = typeof window !== 'undefined' ? window.location.origin : '',
  provider = ''
) {
  const base = `${origin}/account/linked`;
  const q = new URLSearchParams({ linked: '1' });
  if (provider) q.set('provider', String(provider).toLowerCase());
  return `${base}?${q.toString()}`;
}

/**
 * Redirect after OAuth sign-in / sign-up from the public auth entry page.
 * Lands on Dashboard; Account still gates username when needed.
 */
export function authSignInRedirectUrl(
  origin = typeof window !== 'undefined' ? window.location.origin : '',
  provider = ''
) {
  const q = new URLSearchParams({ sso: '1' });
  if (provider) q.set('provider', String(provider).toLowerCase());
  return `${origin}/dashboard?${q.toString()}`;
}

// ─── OAuth intent (survives provider redirect) ───────────────────────────────

/**
 * Remember which OAuth flow the user started (sign-in vs manual link).
 * @param {{ intent: 'signin'|'link', provider: string }} payload
 */
export function stashOAuthIntent(payload) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const provider = String(payload?.provider || '').toLowerCase();
    const intent = payload?.intent === 'link' ? 'link' : 'signin';
    if (!provider) return;
    sessionStorage.setItem(
      OAUTH_INTENT_KEY,
      JSON.stringify({ intent, provider, at: Date.now() })
    );
  } catch {
    /* private mode / denied */
  }
}

/**
 * Read and clear pending OAuth intent (if any, and not stale).
 * @param {number} [maxAgeMs]
 * @returns {{ intent: 'signin'|'link', provider: string, at: number }|null}
 */
export function consumeOAuthIntent(maxAgeMs = 30 * 60 * 1000) {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(OAUTH_INTENT_KEY);
    sessionStorage.removeItem(OAUTH_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const provider = String(parsed?.provider || '').toLowerCase();
    const intent = parsed?.intent === 'link' ? 'link' : 'signin';
    const at = Number(parsed?.at) || 0;
    if (!provider) return null;
    if (at && Date.now() - at > maxAgeMs) return null;
    return { intent, provider, at };
  } catch {
    return null;
  }
}

/** Peek without clearing (tests / rare re-reads). */
export function peekOAuthIntent() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(OAUTH_INTENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── Callback URL parsing ────────────────────────────────────────────────────

/**
 * Collect auth-related params from query string and hash fragment.
 * Supabase may put error/session data in either place depending on flow.
 * @param {string} [href]
 * @returns {Record<string, string>}
 */
export function parseAuthCallbackParams(href) {
  const out = {};
  try {
    const url =
      typeof href === 'string'
        ? new URL(href, 'http://localhost')
        : typeof window !== 'undefined'
          ? new URL(window.location.href)
          : null;
    if (!url) return out;

    url.searchParams.forEach((v, k) => {
      out[k] = v;
    });

    const hash = (url.hash || '').replace(/^#/, '');
    if (hash) {
      const hp = new URLSearchParams(hash);
      hp.forEach((v, k) => {
        if (out[k] == null || out[k] === '') out[k] = v;
      });
    }
  } catch {
    /* ignore */
  }
  return out;
}

/**
 * Strip OAuth / SSO noise from the current URL without a navigation reload.
 * Keeps unrelated query params.
 * @param {string} [href]
 * @returns {string|null} cleaned path+search+hash, or null if nothing changed
 */
export function cleanAuthCallbackUrl(href) {
  try {
    const url =
      typeof href === 'string'
        ? new URL(href, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
        : new URL(window.location.href);

    const drop = [
      'error',
      'error_code',
      'error_description',
      'error_uri',
      'sso',
      'linked',
      'provider',
      'code',
      'state',
      // leftover implicit tokens if any
      'access_token',
      'refresh_token',
      'expires_in',
      'token_type',
      'type',
    ];
    let changed = false;
    for (const k of drop) {
      if (url.searchParams.has(k)) {
        url.searchParams.delete(k);
        changed = true;
      }
    }
    if (url.hash && /error|access_token|provider|linked|sso/i.test(url.hash)) {
      url.hash = '';
      changed = true;
    }
    if (!changed) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

// ─── Human-readable messages ─────────────────────────────────────────────────

export function formatIdentityAlreadyLinkedToOtherError(provider) {
  return `This ${providerDisplayName(provider)} account is already linked to a different Together Forge account.`;
}

export function formatAutoLinkedSuccess(provider) {
  return `We linked your ${providerDisplayName(provider)} account to your existing Together Forge account.`;
}

export function formatAlreadyLinkedToSelf(provider) {
  return `Your ${providerDisplayName(provider)} account is already linked to this Together Forge account.`;
}

export function formatManualLinkSuccess(provider) {
  return `${providerDisplayName(provider)} linked successfully. You can use it to sign in next time.`;
}

export function formatDifferentEmailHint() {
  return 'If this provider uses a different email than your existing account, sign in with your current method first, then link it under Account → Linked Accounts.';
}

/**
 * Whether an identity looks newly attached (auto-link or first-time OAuth).
 * @param {object|null|undefined} identity
 * @param {number} [now]
 * @param {number} [windowMs]
 */
export function isRecentlyCreatedIdentity(
  identity,
  now = Date.now(),
  windowMs = RECENT_IDENTITY_MS
) {
  const t = Date.parse(identity?.created_at || '');
  if (!Number.isFinite(t)) return false;
  const age = now - t;
  return age >= 0 && age < windowMs;
}

/**
 * True when the user has more than one distinct auth identity/provider.
 * Used to detect auto-link onto an existing account vs brand-new OAuth user.
 * @param {object|null|undefined} user
 * @param {Array} [identityList]
 */
export function userHasMultipleIdentities(user, identityList) {
  const list = Array.isArray(identityList)
    ? identityList
    : Array.isArray(user?.identities)
      ? user.identities
      : [];
  if (list.length > 1) return true;
  const providers = listUserProviders(user);
  return providers.filter((p) => p !== 'anonymous').length > 1;
}

/**
 * Map raw Supabase / OAuth errors to clear copy for Google / Discord / GitHub.
 * @param {string|Error|{message?: string, code?: string, error_code?: string, error_description?: string}|null|undefined} err
 * @param {string} [provider]
 * @returns {string}
 */
export function humanizeAuthIdentityError(err, provider = '') {
  const label = providerDisplayName(provider);
  const code = String(
    err?.code || err?.error_code || err?.error || ''
  ).toLowerCase();
  const raw = String(
    err?.error_description ||
      err?.message ||
      (typeof err === 'string' ? err : '') ||
      ''
  );
  const msg = raw.toLowerCase();
  const combined = `${code} ${msg}`;

  // Same identity already on this user (check before generic "already linked")
  if (
    /already linked to (this|your)|already connected to (this|your)|identity already linked to the user|already linked to (the )?current user/i.test(
      combined
    )
  ) {
    return formatAlreadyLinkedToSelf(provider);
  }

  // Provider already tied to a different TF user
  if (
    code === 'identity_already_exists' ||
    /identity.*already.*(linked|exists)|already linked to (another|a different|other)|identity is already associated|already linked to a user/i.test(
      combined
    )
  ) {
    return formatIdentityAlreadyLinkedToOtherError(provider);
  }

  if (/manual.?linking|linking is not enabled|manual linking is disabled/i.test(combined)) {
    return `Linking ${label} is not enabled on the server yet. Ask a Project Lead to enable Manual Linking under Authentication → Providers.`;
  }

  if (
    /provider is not enabled|unsupported provider|validation_failed.*provider/i.test(
      combined
    )
  ) {
    return `${label} sign-in is not enabled yet. Ask a Project Lead to enable it under Authentication → Providers.`;
  }

  if (/oauth.*cancelled|access_denied|user denied|user cancelled/i.test(combined)) {
    return `${label} sign-in was cancelled. You can try again when ready.`;
  }

  if (/email.*not.*confirm|email_not_confirmed/i.test(combined)) {
    return 'That email is not verified yet. Verify your existing account email, then try again — or link the provider from Account Settings after signing in.';
  }

  if (raw && raw.trim()) {
    // Prefer decoded description over opaque codes
    try {
      return decodeURIComponent(raw.replace(/\+/g, ' '));
    } catch {
      return raw;
    }
  }

  return provider
    ? `Could not complete ${label} sign-in. Please try again.`
    : 'Could not complete sign-in. Please try again.';
}

/**
 * After a successful SSO return, decide what status message (if any) to show.
 *
 * @param {object|null|undefined} user
 * @param {{ intent?: string, provider?: string }|null} intent
 * @param {Record<string, string>} [params] from parseAuthCallbackParams
 * @param {Array} [identityList]
 * @returns {{ kind: 'success'|'info'|null, message: string|null, provider: string|null }}
 */
export function describeSsoReturnOutcome(user, intent, params = {}, identityList) {
  const provider = String(
    params.provider || intent?.provider || ''
  ).toLowerCase();
  const flow = intent?.intent === 'link' ? 'link' : 'signin';

  if (!user) {
    return { kind: null, message: null, provider: provider || null };
  }

  if (flow === 'link' || params.linked === '1') {
    if (provider && userHasProvider(user, provider)) {
      return {
        kind: 'success',
        message: formatManualLinkSuccess(provider),
        provider,
      };
    }
    if (params.linked === '1') {
      return {
        kind: 'success',
        message:
          'Account linked successfully. You can claim and submit tasks once email is verified.',
        provider: provider || null,
      };
    }
  }

  // Sign-in / sign-up path (sso=1 or intent signin)
  if (params.sso === '1' || flow === 'signin' || intent?.provider) {
    if (!provider) {
      return { kind: null, message: null, provider: null };
    }

    const identity = findIdentity(user, provider, identityList);
    const hasProvider = Boolean(identity) || userHasProvider(user, provider);
    if (!hasProvider) {
      return { kind: null, message: null, provider };
    }

    const multi = userHasMultipleIdentities(user, identityList);
    const recent = identity ? isRecentlyCreatedIdentity(identity) : false;

    // Auto-link: existing account gained this provider just now
    if (multi && recent) {
      return {
        kind: 'success',
        message: formatAutoLinkedSuccess(provider),
        provider,
      };
    }

    // Returning user with that provider already (normal sign-in) — no toast needed
    // Brand-new OAuth-only user — also quiet
    return { kind: null, message: null, provider };
  }

  return { kind: null, message: null, provider: provider || null };
}

/**
 * High-level: read URL + intent, produce UI message and cleaned path.
 * Call once after landing from OAuth (signed-in or not).
 *
 * @param {{
 *   user?: object|null,
 *   identityList?: Array,
 *   href?: string,
 *   consumeIntent?: boolean,
 * }} [opts]
 * @returns {{
 *   ok: boolean,
 *   message: string|null,
 *   provider: string|null,
 *   cleanPath: string|null,
 *   params: Record<string, string>,
 *   intent: object|null,
 * }}
 */
export function resolveOAuthReturnState(opts = {}) {
  const {
    user = null,
    identityList,
    href,
    consumeIntent = true,
  } = opts;

  const params = parseAuthCallbackParams(href);
  const intent = consumeIntent ? consumeOAuthIntent() : peekOAuthIntent();
  const provider = String(
    params.provider || intent?.provider || ''
  ).toLowerCase();
  const cleanPath = cleanAuthCallbackUrl(href);

  // OAuth error in callback (e.g. identity already linked during linkIdentity)
  if (params.error || params.error_code || params.error_description) {
    const message = humanizeAuthIdentityError(
      {
        code: params.error_code || params.error,
        message: params.error_description || params.error,
        error_description: params.error_description,
      },
      provider
    );
    return {
      ok: false,
      message,
      provider: provider || null,
      cleanPath,
      params,
      intent,
    };
  }

  const outcome = describeSsoReturnOutcome(user, intent, params, identityList);
  return {
    ok: true,
    message: outcome.message,
    provider: outcome.provider,
    cleanPath,
    params,
    intent,
  };
}
