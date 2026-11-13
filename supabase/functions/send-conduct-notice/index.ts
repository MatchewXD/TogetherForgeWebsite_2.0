/**
 * Email a Conduct notice and sync the Auth ban for a user.
 * Staff JWT required. Reply-To: conduct@togetherforge.net
 *
 * POST JSON: { noticeId?, targetUserId? }
 *
 * The Auth ban is derived from conduct_account_state (banned_at /
 * suspended_until), which only the conduct review RPC writes. A legacy
 * `authAction` field in the body is ignored.
 * Deploy: supabase functions deploy send-conduct-notice --no-verify-jwt
 */

// deno-lint-ignore-file
// @ts-nocheck
import { adminClient, jsonResponse, userFromRequest, corsHeaders } from '../_shared/edgeAuth.ts';
import { withCors } from '../_shared/origins.ts';

const CONDUCT_REPLY = 'conduct@togetherforge.net';

const SENIOR_ROLES = new Set(['founder', 'admin']);
const STAFF_ROLES = new Set(['founder', 'admin', 'moderator', 'project_lead']);

/**
 * Role hierarchy for enforcement: nobody acts on themselves, only a Founder
 * acts on a Founder, and only Founder / Admin act on other staff.
 * @returns {Promise<string|null>} error message, or null when allowed
 */
async function staffTargetBlock(admin, actorRole, actorId, targetUserId) {
  if (targetUserId === actorId) {
    return 'You cannot apply enforcement to your own account.';
  }
  const { data: target } = await admin
    .from('profiles')
    .select('role')
    .eq('id', targetUserId)
    .maybeSingle();
  const targetRole = String(target?.role || 'user');
  if (targetRole === 'founder' && actorRole !== 'founder') {
    return 'Only a Founder can apply enforcement to a Founder.';
  }
  if (STAFF_ROLES.has(targetRole) && !SENIOR_ROLES.has(actorRole)) {
    return 'Only a Founder or Admin can apply enforcement to staff.';
  }
  return null;
}

Deno.serve(withCors(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const user = await userFromRequest(req);
  if (!user) return jsonResponse({ error: 'Sign in required' }, 401);

  const admin = adminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const role = String(profile?.role || 'user');
  const staff =
    role === 'moderator' ||
    role === 'founder' ||
    role === 'admin' ||
    role === 'project_lead';
  if (!staff) return jsonResponse({ error: 'Staff only' }, 403);

  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const noticeId = body.noticeId || null;
  const targetUserId = body.targetUserId ? String(body.targetUserId) : null;

  // Sync the Auth ban with conduct_account_state. The requested action in the
  // body is NOT trusted: the only way to change that state is the audited
  // conduct review RPC, so a staff session cannot ban or unban arbitrary users
  // by calling this function directly.
  if (targetUserId) {
    const blocked = await staffTargetBlock(admin, role, user.id, targetUserId);
    if (blocked) return jsonResponse({ error: blocked }, 403);
    try {
      const { data: state } = await admin
        .from('conduct_account_state')
        .select('banned_at, suspended_until')
        .eq('user_id', targetUserId)
        .maybeSingle();
      if (state) {
        const untilMs = state.suspended_until
          ? new Date(state.suspended_until).getTime() - Date.now()
          : 0;
        let banDuration = 'none';
        if (state.banned_at) {
          banDuration = '876000h';
        } else if (untilMs > 0) {
          banDuration = `${Math.max(1, Math.ceil(untilMs / 3_600_000))}h`;
        }
        const { error: banErr } = await admin.auth.admin.updateUserById(
          targetUserId,
          { ban_duration: banDuration }
        );
        if (banErr) {
          console.error('[send-conduct-notice] auth', banErr.message);
        } else {
          console.log(
            JSON.stringify({
              tag: 'TF_CONDUCT_AUTH_SYNC',
              actor: user.id,
              target: targetUserId,
              banDuration,
            })
          );
        }
      }
    } catch (e) {
      console.error('[send-conduct-notice] auth', e?.message || e);
    }
  }

  if (!noticeId) {
    return jsonResponse({ ok: true, emailed: false });
  }

  const { data: notice, error: noticeErr } = await admin
    .from('conduct_notices')
    .select('id, user_id, body, case_id')
    .eq('id', noticeId)
    .maybeSingle();
  if (noticeErr || !notice) {
    return jsonResponse({ ok: false, error: 'Notice not found' }, 404);
  }

  const { data: caseRow } = notice.case_id
    ? await admin
        .from('conduct_cases')
        .select('case_code')
        .eq('id', notice.case_id)
        .maybeSingle()
    : { data: null };

  const { data: authUser } = await admin.auth.admin.getUserById(notice.user_id);
  const to = authUser?.user?.email;
  if (!to) {
    return jsonResponse({ ok: true, emailed: false, reason: 'no_email' });
  }

  const resendKey = String(Deno.env.get('RESEND_API_KEY') || '').trim();
  const fromAddr = String(
    Deno.env.get('CONDUCT_FROM_EMAIL') ||
      Deno.env.get('REPORTS_FROM_EMAIL') ||
      'Together Forge <hello@togetherforge.net>'
  ).trim();
  if (!resendKey) {
    console.warn('[send-conduct-notice] RESEND_API_KEY missing');
    return jsonResponse({ ok: true, emailed: false, reason: 'no_resend' });
  }

  const caseCode = caseRow?.case_code || '';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddr,
      to: [to],
      reply_to: CONDUCT_REPLY,
      subject: caseCode
        ? `Together Forge notice (${caseCode})`
        : 'Together Forge notice',
      text: String(notice.body || ''),
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error('[send-conduct-notice] resend', res.status, errBody.slice(0, 400));
    return jsonResponse({ ok: false, error: 'Could not send email' }, 502);
  }

  await admin
    .from('conduct_notices')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', noticeId);
  return jsonResponse({ ok: true, emailed: true });
}));
