/**
 * Map server abuse / rate-limit errors to safe user-facing copy.
 * Never forward raw Postgres / PostgREST details.
 */

const RATE_LIMIT_COPY =
  "You're doing that too quickly. Please wait a moment and try again.";
const DUPLICATE_COPY =
  'That looks the same as something you just submitted. Please change it or wait a bit.';
const SIGN_IN_COPY = 'You must be signed in to do that.';
const GENERIC_COPY = 'Something went wrong. Please try again.';

export function isMissingRpcError(error) {
  if (!error) return false;
  const msg = String(error.message || error.details || error.hint || '');
  const code = String(error.code || '');
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    /could not find the function|does not exist|schema cache/i.test(msg)
  );
}

export function humanizeAbuseError(error, fallback = GENERIC_COPY) {
  if (!error) return fallback;
  const raw = String(
    error.message || error.details || error.hint || error || ''
  );
  if (/RATE_LIMITED|too many|rate limit/i.test(raw)) return RATE_LIMIT_COPY;
  if (/DUPLICATE_CONTENT|already submitted something very similar/i.test(raw)) {
    return DUPLICATE_COPY;
  }
  if (/jwt expired|invalid jwt|bad_jwt|PGRST301/i.test(raw)) {
    return 'Your session expired. Please sign in again.';
  }
  if (/SIGN_IN_REQUIRED|signed in|not authenticated/i.test(raw)) {
    return SIGN_IN_COPY;
  }
  if (
    /permission denied|42501|rls|row-level|violates row-level/i.test(raw)
  ) {
    return 'You do not have permission to do that.';
  }
  if (/invalid idea|not found/i.test(raw)) {
    return 'That item could not be found.';
  }
  return fallback;
}

export function asUserError(error, fallback = GENERIC_COPY) {
  const err = new Error(humanizeAbuseError(error, fallback));
  err.cause = error;
  return err;
}
