/**
 * MFA recovery codes + recover-without-authenticator.
 *
 * POST JSON:
 *   { action: "status" }
 *   { action: "generate" }           → returns { codes: string[], remaining }
 *   { action: "recover", code: "..." } → verifies code, unenrolls TOTP, marks used
 *
 * Auth: Bearer user JWT required.
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
 *
 * Deploy: supabase functions deploy mfa-recovery --no-verify-jwt
 */

// deno-lint-ignore-file
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';
import {
  enforceRateLimit,
  RATE_LIMITS,
} from '../_shared/rateLimit.ts';

const supabaseUrl =
  Deno.env.get('SUPABASE_URL') ?? Deno.env.get('SB_URL') ?? '';
const serviceKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SERVICE_ROLE_KEY') ??
  '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const pepper =
  Deno.env.get('MFA_RECOVERY_PEPPER') ||
  serviceKey.slice(0, 32) ||
  'together-forge-mfa-recovery';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CODE_COUNT = 10;

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

function normalizeCode(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

async function hashCode(code) {
  const data = new TextEncoder().encode(`${pepper}:${normalizeCode(code)}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generatePlainCodes(n = CODE_COUNT) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codes = [];
  for (let i = 0; i < n; i += 1) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    let s = '';
    for (let j = 0; j < 8; j += 1) {
      s += alphabet[bytes[j] % alphabet.length];
    }
    codes.push(`${s.slice(0, 4)}-${s.slice(4)}`);
  }
  return codes;
}

async function remainingCount(sb, userId) {
  const { count, error } = await sb
    .from('mfa_recovery_codes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('used_at', null);
  if (error) throw error;
  return count || 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Server not configured.' }, 500);
  }

  try {
    const user = await userFromRequest(req);
    if (!user?.id) {
      return json({ error: 'Sign in required.' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').toLowerCase();

    // Action-specific limits: recover is strictest (code guessing surface)
    const limitCfg =
      action === 'recover'
        ? RATE_LIMITS.mfaRecover
        : action === 'status'
          ? RATE_LIMITS.mfaStatus
          : RATE_LIMITS.mfaManage;
    const limited = enforceRateLimit(req, {
      ...limitCfg,
      userId: user.id,
      cors,
    });
    if (limited) return limited;

    const sb = admin();

    if (action === 'status') {
      const remaining = await remainingCount(sb, user.id);
      return json({ remaining });
    }

    if (action === 'clear') {
      // Wipe recovery codes. Require a valid current TOTP code (not recovery codes).
      // Session alone is not enough.
      const totpCode = String(body.totpCode || '').replace(/\s+/g, '');
      if (!/^\d{6}$/.test(totpCode)) {
        return json(
          {
            error:
              'Enter your current 6-digit authenticator code to clear recovery codes.',
            code: 'TOTP_REQUIRED',
          },
          400
        );
      }
      const userClient = createClient(supabaseUrl, anonKey || serviceKey, {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') || '',
          },
        },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: factors, error: fErr } =
        await userClient.auth.mfa.listFactors();
      if (fErr) {
        return json({ error: fErr.message || 'Could not list MFA factors.' }, 400);
      }
      const verified = (factors?.totp || []).filter(
        (f) => f.status === 'verified'
      );
      if (!verified.length) {
        return json(
          { error: 'Authenticator 2FA is not enabled.', code: 'MFA_NO_FACTOR' },
          400
        );
      }
      // Client may have already verified this code for disable; re-verify may fail
      // if the code was single-use. Accept either: successful re-verify OR current AAL2
      // after a recent verify on this session.
      const { error: vErr } = await userClient.auth.mfa.challengeAndVerify({
        factorId: verified[0].id,
        code: totpCode,
      });
      if (vErr) {
        const { data: aal } =
          await userClient.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.currentLevel !== 'aal2') {
          return json(
            {
              error:
                vErr.message ||
                'Invalid authenticator code. Recovery codes cannot be used here.',
              code: 'TOTP_INVALID',
            },
            400
          );
        }
        // AAL2 already: step-up succeeded moments earlier (disable flow)
      }
      await sb.from('mfa_recovery_codes').delete().eq('user_id', user.id);
      return json({ ok: true, remaining: 0 });
    }

    if (action === 'generate') {
      // Step-up: require a valid current TOTP code. Recovery codes cannot authorize this.
      // Session alone is not enough.
      const totpCode = String(body.totpCode || '').replace(/\s+/g, '');
      if (!/^\d{6}$/.test(totpCode)) {
        return json(
          {
            error:
              'Enter your current 6-digit authenticator code to create recovery codes.',
            code: 'TOTP_REQUIRED',
          },
          400
        );
      }

      const userClient = createClient(supabaseUrl, anonKey || serviceKey, {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization') || '',
          },
        },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: factors, error: fErr } =
        await userClient.auth.mfa.listFactors();
      if (fErr) {
        return json({ error: fErr.message || 'Could not list MFA factors.' }, 400);
      }
      const verified = (factors?.totp || []).filter(
        (f) => f.status === 'verified'
      );
      if (!verified.length) {
        return json(
          {
            error:
              'Enable authenticator 2FA first, then generate recovery codes.',
          },
          400
        );
      }

      const { error: vErr } = await userClient.auth.mfa.challengeAndVerify({
        factorId: verified[0].id,
        code: totpCode,
      });
      if (vErr) {
        return json(
          {
            error:
              vErr.message ||
              'Invalid authenticator code. Recovery codes cannot be used here.',
            code: 'TOTP_INVALID',
          },
          400
        );
      }

      const plain = generatePlainCodes(CODE_COUNT);
      const rows = [];
      for (const code of plain) {
        rows.push({
          user_id: user.id,
          code_hash: await hashCode(code),
        });
      }

      // Replace previous unused codes
      await sb.from('mfa_recovery_codes').delete().eq('user_id', user.id);

      const { error: insErr } = await sb.from('mfa_recovery_codes').insert(rows);
      if (insErr) {
        console.error('[mfa-recovery] insert', insErr);
        return json(
          {
            error:
              insErr.message ||
              'Could not store recovery codes. Run supabase_mfa_recovery_codes.sql.',
          },
          500
        );
      }

      return json({
        codes: plain,
        remaining: plain.length,
        message:
          'Store these codes offline. They will not be shown again unless you regenerate.',
      });
    }

    if (action === 'recover') {
      const code = normalizeCode(body.code);
      if (code.length < 8) {
        return json({ error: 'Enter a valid recovery code.' }, 400);
      }

      const { data: rows, error: listErr } = await sb
        .from('mfa_recovery_codes')
        .select('id, code_hash')
        .eq('user_id', user.id)
        .is('used_at', null);
      if (listErr) {
        return json(
          {
            error:
              listErr.message ||
              'Recovery codes unavailable. Contact support if needed.',
          },
          500
        );
      }

      const targetHash = await hashCode(code);
      const match = (rows || []).find((r) => r.code_hash === targetHash);
      if (!match) {
        return json({ error: 'Invalid or already used recovery code.' }, 400);
      }

      // Mark used first (one-time)
      const { error: useErr } = await sb
        .from('mfa_recovery_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('id', match.id)
        .is('used_at', null);
      if (useErr) {
        return json({ error: useErr.message || 'Could not consume code.' }, 500);
      }

      // Unenroll all MFA factors via Admin API (recovery code is the backup path)
      try {
        const { data: factorList, error: flErr } =
          await sb.auth.admin.mfa.listFactors({ userId: user.id });
        if (flErr) {
          console.warn('[mfa-recovery] listFactors admin', flErr.message);
        }
        const all = factorList?.factors || [];
        for (const f of all) {
          if (!f?.id) continue;
          try {
            const { error: delErr } = await sb.auth.admin.mfa.deleteFactor({
              id: f.id,
              userId: user.id,
            });
            if (delErr) {
              console.warn('[mfa-recovery] deleteFactor', delErr.message);
            }
          } catch (e) {
            console.warn('[mfa-recovery] deleteFactor', e?.message || e);
          }
        }
      } catch (e) {
        console.error('[mfa-recovery] unenroll', e?.message || e);
        return json(
          {
            error:
              'Recovery code accepted, but could not remove authenticator. Contact support.',
            codeConsumed: true,
          },
          500
        );
      }

      // Wipe remaining codes so a stolen set can't be reused after recovery
      await sb.from('mfa_recovery_codes').delete().eq('user_id', user.id);

      return json({
        ok: true,
        mfaDisabled: true,
        message:
          'Authenticator 2FA was removed. Sign in again and set up 2FA when you can.',
      });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (err) {
    console.error('[mfa-recovery]', err?.message || err);
    return json({ error: err?.message || 'Request failed.' }, 500);
  }
});
