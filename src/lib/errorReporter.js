/**
 * Reports browser-side errors to Supabase (public.log_client_error) so staff
 * can see what is breaking for visitors (Moderator → Site errors).
 *
 * Deliberately conservative: de-duplicated and capped per page session,
 * never throws, never blocks rendering, and silent when the SQL
 * (supabase/sql/supabase_launch_prep.sql) has not been applied.
 * No user ids are sent; the server only notes whether a session was signed in.
 */

/* global __BUILD_ID__ -- injected by vite.config.js (define) */
import { supabase } from './supabase';
import { getTrafficSessionKey } from '../utils/trafficSession';
import { sanitizeTrafficPath } from '../utils/trafficPath';

const MAX_REPORTS_PER_PAGE_SESSION = 5;
const seen = new Set();
let sent = 0;
let installed = false;

/** Noise that is not a site bug (extensions, benign browser quirks). */
const IGNORE = [
  /^Script error\.?$/i,
  /ResizeObserver loop/i,
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /safari-(web-)?extension:\/\//i,
  /AbortError/i,
  /The user aborted a request/i,
  /Load failed$/i, // Safari: navigation cancelled a fetch
];

const BUILD_ID =
  typeof __BUILD_ID__ !== 'undefined' && __BUILD_ID__ ? __BUILD_ID__ : 'dev';

export function describeError(error) {
  if (!error) return { message: '', stack: '' };
  if (typeof error === 'string') return { message: error, stack: '' };
  const name = error.name && error.name !== 'Error' ? `${error.name}: ` : '';
  const message = `${name}${error.message || String(error)}`;
  return { message, stack: typeof error.stack === 'string' ? error.stack : '' };
}

export function shouldIgnoreError(message, stack = '') {
  if (!message) return true;
  // Test separately: several patterns anchor to the end of the message
  return IGNORE.some((re) => re.test(message) || re.test(stack));
}

/**
 * @param {'render'|'error'|'unhandledrejection'|'chunk'} kind
 * @param {unknown} error
 * @param {{ componentStack?: string }} [extra]
 * @returns {Promise<boolean>} true when a report was sent
 */
export async function reportClientError(kind, error, extra = {}) {
  try {
    const { message, stack } = describeError(error);
    if (shouldIgnoreError(message, stack)) return false;
    const key = `${kind}|${message}`;
    if (seen.has(key) || sent >= MAX_REPORTS_PER_PAGE_SESSION) return false;
    seen.add(key);
    sent += 1;

    const fullStack = [stack, extra.componentStack].filter(Boolean).join('\n');
    const { error: rpcError } = await supabase.rpc('log_client_error', {
      p_kind: kind,
      p_message: message.slice(0, 500),
      p_stack: fullStack.slice(0, 4000) || null,
      p_path: sanitizeTrafficPath(window.location.pathname),
      p_build: BUILD_ID,
      p_user_agent: (navigator.userAgent || '').slice(0, 300),
      p_session_key: getTrafficSessionKey(),
    });
    return !rpcError;
  } catch {
    return false;
  }
}

/** Global handlers for errors outside React's render tree. Idempotent. */
export function installGlobalErrorReporting() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (event) => {
    // Resource load failures (img, script) arrive here with no error object
    if (!event?.error && !event?.message) return;
    void reportClientError('error', event.error || event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    void reportClientError('unhandledrejection', event?.reason);
  });
}

/** Test helper. */
export function resetErrorReporterForTests() {
  seen.clear();
  sent = 0;
  installed = false;
}
