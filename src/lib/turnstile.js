/**
 * Cloudflare Turnstile (CAPTCHA), off unless VITE_TURNSTILE_SITE_KEY is set.
 *
 * Usage at any call site that should be bot-protected:
 *
 *   const captchaToken = await getCaptchaToken();
 *   await supabase.auth.signUp({ email, password, options: { captchaToken } });
 *
 * With no site key this resolves to undefined immediately and nothing loads,
 * so call sites need no feature checks. With a key, a widget runs in
 * "interaction-only" mode: most people never see it, and it appears as a
 * small panel at the bottom of the screen only when Cloudflare wants a click.
 * Tokens are single-use, so ask for a fresh one for every request.
 *
 * Turning it on (all three are needed):
 *   1. VITE_TURNSTILE_SITE_KEY in the site environment (Vercel) + redeploy
 *   2. Supabase Dashboard → Authentication → Attack Protection → enable
 *      CAPTCHA (Turnstile) with the secret key
 *   3. supabase secrets set TURNSTILE_SECRET_KEY=... (concern / volunteer forms)
 */

const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TOKEN_TIMEOUT_MS = 90_000;

export function getTurnstileSiteKey() {
  return String(import.meta.env?.VITE_TURNSTILE_SITE_KEY || '').trim();
}

export function isTurnstileEnabled() {
  return Boolean(getTurnstileSiteKey());
}

let scriptPromise = null;

function loadTurnstile() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile needs a browser'));
  }
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = SCRIPT_SRC;
      el.async = true;
      el.defer = true;
      el.onload = () =>
        window.turnstile
          ? resolve(window.turnstile)
          : reject(new Error('Turnstile failed to initialise'));
      el.onerror = () => reject(new Error('Could not load the verification check'));
      document.head.appendChild(el);
    }).catch((err) => {
      scriptPromise = null; // allow a retry on the next request
      throw err;
    });
  }
  return scriptPromise;
}

function makeHost() {
  const host = document.createElement('div');
  host.setAttribute('data-tf-turnstile', '');
  // Fixed panel above modals; empty (and so invisible) unless interaction is needed
  host.style.cssText =
    'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;max-width:calc(100vw - 16px);';
  document.body.appendChild(host);
  return host;
}

/**
 * @returns {Promise<string|undefined>} a fresh single-use token, or undefined
 *   when Turnstile is not configured. Rejects with a user-readable Error when
 *   the check cannot be completed.
 */
export async function getCaptchaToken() {
  const sitekey = getTurnstileSiteKey();
  if (!sitekey) return undefined;

  let turnstile;
  try {
    turnstile = await loadTurnstile();
  } catch {
    const err = new Error(
      'Could not load the verification check. Disable content blockers for this site or try again.'
    );
    err.code = 'CAPTCHA_UNAVAILABLE';
    throw err;
  }

  return new Promise((resolve, reject) => {
    const host = makeHost();
    let widgetId = null;
    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      try {
        if (widgetId !== null) turnstile.remove(widgetId);
      } catch {
        /* already gone */
      }
      host.remove();
      fn(value);
    };
    const fail = (message) => {
      const err = new Error(message);
      err.code = 'CAPTCHA_FAILED';
      finish(reject, err);
    };
    const timer = window.setTimeout(
      () => fail('Verification timed out. Please try again.'),
      TOKEN_TIMEOUT_MS
    );
    try {
      widgetId = turnstile.render(host, {
        sitekey,
        theme: 'dark',
        appearance: 'interaction-only',
        callback: (token) => finish(resolve, token),
        'error-callback': () => {
          fail('Verification failed. Please try again.');
          return true; // handled
        },
        'timeout-callback': () => fail('Verification timed out. Please try again.'),
      });
    } catch {
      fail('Verification could not start. Please reload and try again.');
    }
  });
}
