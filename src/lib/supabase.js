import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables are not set. Please configure .env.local'
  );
}

function isLikelyJwt(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3 && parts[0].length > 8 && parts[1].length > 8;
}

function projectRefFromUrl(url) {
  try {
    return new URL(url).hostname.split('.')[0] || '';
  } catch {
    return '';
  }
}

/** Read the persisted user access token if the in-memory session is missing it. */
function readStoredAccessToken(url) {
  if (typeof localStorage === 'undefined') return null;
  const ref = projectRefFromUrl(url);
  if (!ref) return null;
  try {
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const token =
      parsed?.access_token ||
      parsed?.currentSession?.access_token ||
      parsed?.session?.access_token ||
      null;
    return isLikelyJwt(token) ? token : null;
  } catch {
    return null;
  }
}

function requestUrl(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return String(input?.url || '');
}

function isDataApiRequest(input) {
  return /\/rest\/v1\b|\/functions\/v1\b|\/storage\/v1\b/.test(
    requestUrl(input)
  );
}

/**
 * Never send the publishable/anon key as Bearer on PostgREST — then
 * auth.uid() is null and vote/like RPCs raise SIGN_IN_REQUIRED.
 * Leave Auth API requests unchanged (they use the publishable key).
 */
async function fetchWithUserJwt(input, init) {
  if (!isDataApiRequest(input)) {
    return fetch(input, init);
  }
  const headers = new Headers(init?.headers || {});
  const existing = String(headers.get('Authorization') || '').replace(
    /^Bearer\s+/i,
    ''
  );
  if (!isLikelyJwt(existing)) {
    const stored = readStoredAccessToken(supabaseUrl);
    if (isLikelyJwt(stored)) {
      headers.set('Authorization', `Bearer ${stored}`);
    } else {
      headers.delete('Authorization');
    }
  }
  return fetch(input, { ...init, headers });
}

// Avoid hard crash if env is missing during boot (UI can still render)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: fetchWithUserJwt,
    },
  }
);