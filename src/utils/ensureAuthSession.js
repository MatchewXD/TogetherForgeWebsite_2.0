/**
 * Make sure the Supabase client has a usable access token before RPCs
 * that call auth.uid() (votes, likes, etc.).
 */
import { supabase } from '../lib/supabase';

export function isAuthFailureError(error) {
  if (!error) return false;
  const raw = `${error.code || ''} ${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  return /SIGN_IN_REQUIRED|jwt expired|invalid jwt|bad_jwt|not authenticated|PGRST301/i.test(
    raw
  );
}

/**
 * @returns {Promise<object|null>} auth user or null
 */
function isLikelyJwt(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3 && parts[0].length > 8 && parts[1].length > 8;
}

export async function ensureAuthSession() {
  const { data: sessionData } = await supabase.auth.getSession();
  let session = sessionData?.session || null;
  const expMs = session?.expires_at ? Number(session.expires_at) * 1000 : 0;
  const stale =
    !isLikelyJwt(session?.access_token) ||
    (expMs > 0 && expMs - Date.now() < 90_000);

  if (stale) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data?.session) session = data.session;
  }

  if (session?.user) return session.user;

  const { data: userData } = await supabase.auth.getUser();
  return userData?.user || null;
}

async function postRpcWithToken(fnName, args, accessToken) {
  const base = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
  if (!base || !anon || !isLikelyJwt(accessToken)) {
    return {
      data: null,
      error: { message: 'SIGN_IN_REQUIRED', code: 'SIGN_IN_REQUIRED' },
    };
  }

  const headers = {
    apikey: anon,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  const res = await fetch(`${base}/rest/v1/rpc/${encodeURIComponent(fnName)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(args || {}),
  });
  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { message: text };
  }

  if (!res.ok) {
    return {
      data: null,
      error: {
        message: payload?.message || payload?.error || `Request failed (${res.status})`,
        code: payload?.code || String(res.status),
        details: payload?.details,
        hint: payload?.hint,
        status: res.status,
      },
    };
  }
  return { data: payload, error: null };
}

/**
 * Call a PostgREST RPC with the signed-in user's JWT (never the publishable
 * key). Retry once after a refresh if Auth reports an expired token.
 *
 * @param {string} fnName
 * @param {object} args
 * @returns {Promise<{ data: any, error: any, user: object|null }>}
 */
export async function rpcWithFreshAuth(fnName, args) {
  const user = await ensureAuthSession();
  if (!user) {
    return {
      data: null,
      error: { message: 'SIGN_IN_REQUIRED', code: 'SIGN_IN_REQUIRED' },
      user: null,
    };
  }

  const readToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || '';
  };

  let result = await postRpcWithToken(fnName, args, await readToken());
  if (result.error && isAuthFailureError(result.error)) {
    await supabase.auth.refreshSession();
    result = await postRpcWithToken(fnName, args, await readToken());
  }
  return { data: result.data, error: result.error, user };
}
