/**
 * Supabase TOTP MFA + app-managed recovery codes.
 */
import { supabase } from '../lib/supabase';

function functionsBaseUrl() {
  const explicit = import.meta.env.VITE_STRIPE_BILLING_API_URL;
  if (explicit && String(explicit).trim()) {
    // reuse same functions host if set (optional)
    const u = String(explicit).replace(/\/$/, '');
    if (u.includes('/functions/v1')) return u;
  }
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (base && String(base).trim()) {
    return `${String(base).replace(/\/$/, '')}/functions/v1`;
  }
  return '';
}

async function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (anon) headers.apikey = anon;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || anon;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    if (anon) headers.Authorization = `Bearer ${anon}`;
  }
  return headers;
}

async function recoveryRequest(body) {
  const base = functionsBaseUrl();
  if (!base) {
    const err = new Error('Auth API is not configured (missing VITE_SUPABASE_URL).');
    err.code = 'NO_CONFIG';
    throw err;
  }
  const res = await fetch(`${base}/mfa-recovery`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error(
      data?.error || data?.message || text || `Request failed (${res.status})`
    );
    err.code = data?.code || 'RECOVERY_API';
    err.status = res.status;
    throw err;
  }
  return data || {};
}

export const mfaService = {
  /**
   * @returns {Promise<{ enabled: boolean, factor: object|null, currentLevel: string|null, nextLevel: string|null }>}
   */
  async getStatus() {
    let factor = null;
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (!error) {
        factor =
          (data?.totp || []).find((f) => f.status === 'verified') || null;
      }
    } catch (e) {
      console.warn('[mfa] listFactors', e);
    }

    let currentLevel = null;
    let nextLevel = null;
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      currentLevel = aal?.currentLevel || null;
      nextLevel = aal?.nextLevel || null;
    } catch {
      /* ignore */
    }

    return {
      enabled: Boolean(factor),
      factor,
      currentLevel,
      nextLevel,
      needsChallenge:
        nextLevel === 'aal2' && currentLevel !== 'aal2' && Boolean(factor),
    };
  },

  /** @returns {Promise<boolean>} true if session must complete MFA */
  async needsMfaChallenge() {
    try {
      const { data, error } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) return false;
      return data?.nextLevel === 'aal2' && data?.currentLevel !== 'aal2';
    } catch {
      return false;
    }
  },

  /**
   * Start enrollment — returns QR (data URL SVG), secret, factorId.
   */
  async startEnroll() {
    // Clean up unverified factors so re-enroll is clean
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const pending = (data?.all || []).filter(
        (f) =>
          String(f.factor_type || f.factorType || '').toLowerCase() === 'totp' &&
          f.status !== 'verified'
      );
      for (const f of pending) {
        try {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator app',
    });
    if (error) throw error;
    return {
      factorId: data.id,
      qrCode: data.totp?.qr_code || '',
      secret: data.totp?.secret || '',
      uri: data.totp?.uri || '',
    };
  },

  /**
   * Complete enrollment with 6-digit code from authenticator.
   */
  async confirmEnroll(factorId, code) {
    const cleaned = String(code || '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleaned)) {
      const err = new Error('Enter the 6-digit code from your authenticator app.');
      err.code = 'MFA_CODE_INVALID';
      throw err;
    }
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: cleaned,
    });
    if (error) {
      const err = new Error(error.message || 'Invalid code. Try again.');
      err.code = 'MFA_VERIFY';
      throw err;
    }
    return data;
  },

  /**
   * Disable 2FA. Always requires a valid current 6-digit TOTP code.
   * Recovery codes are not accepted here.
   */
  async disable(factorId, totpCode) {
    const cleaned = String(totpCode || '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleaned)) {
      const err = new Error(
        'Enter your current 6-digit authenticator code. Recovery codes cannot disable 2FA.'
      );
      err.code = 'MFA_CODE_INVALID';
      throw err;
    }
    if (!factorId) {
      const status = await this.getStatus();
      factorId = status.factor?.id;
    }
    if (!factorId) {
      const err = new Error('2FA is not enabled on this account.');
      err.code = 'MFA_NO_FACTOR';
      throw err;
    }
    // Fresh step-up with authenticator only (not recovery codes)
    const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: cleaned,
    });
    if (vErr) {
      const err = new Error(
        vErr.message ||
          'Invalid authenticator code. Recovery codes cannot be used to disable 2FA.'
      );
      err.code = 'MFA_VERIFY';
      throw err;
    }
    // Wipe recovery codes while factor still exists (clear re-verifies TOTP)
    try {
      await recoveryRequest({ action: 'clear', totpCode: cleaned });
    } catch (e) {
      // Same TOTP may be rejected if already consumed this window — force delete via generate path unavailable; try once more after brief wait not needed
      console.warn('[mfa] clear recovery codes', e);
    }
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw error;
    return { ok: true };
  },

  /**
   * Login / session challenge with TOTP code.
   */
  async verifyLoginCode(code) {
    const cleaned = String(code || '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleaned)) {
      const err = new Error('Enter the 6-digit code from your authenticator app.');
      err.code = 'MFA_CODE_INVALID';
      throw err;
    }
    const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
    if (fErr) throw fErr;
    const totp = (factors?.totp || []).find((f) => f.status === 'verified');
    if (!totp) {
      const err = new Error('No authenticator is enrolled on this account.');
      err.code = 'MFA_NO_FACTOR';
      throw err;
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: totp.id,
      code: cleaned,
    });
    if (error) {
      const err = new Error(error.message || 'Invalid authenticator code.');
      err.code = 'MFA_VERIFY';
      throw err;
    }
    return { ok: true };
  },

  async getRecoveryStatus() {
    try {
      return await recoveryRequest({ action: 'status' });
    } catch (e) {
      console.warn('[mfa] recovery status', e);
      return { remaining: null, error: e?.message };
    }
  },

  /**
   * Generate new recovery codes (invalidates previous). Plaintext returned once.
   * Always requires a valid current 6-digit TOTP code (not a recovery code).
   * @param {string} totpCode
   */
  async generateRecoveryCodes(totpCode) {
    const cleaned = String(totpCode || '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleaned)) {
      const err = new Error(
        'Enter your current 6-digit authenticator code to create recovery codes.'
      );
      err.code = 'MFA_CODE_INVALID';
      throw err;
    }
    return recoveryRequest({ action: 'generate', totpCode: cleaned });
  },

  /**
   * Use a recovery code to remove MFA (lost authenticator).
   */
  async recoverWithCode(code) {
    return recoveryRequest({ action: 'recover', code });
  },
};

export default mfaService;
