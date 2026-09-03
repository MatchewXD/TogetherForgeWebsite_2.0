/**
 * Email a Conduct notice and optionally ban/suspend the Auth user.
 * Staff JWT required. Reply-To: conduct@togetherforge.net
 *
 * POST JSON: { noticeId?, authAction?, targetUserId? }
 * Deploy: supabase functions deploy send-conduct-notice --no-verify-jwt
 */

// deno-lint-ignore-file
// @ts-nocheck
import { adminClient, jsonResponse, userFromRequest, corsHeaders } from '../_shared/edgeAuth.ts';

const CONDUCT_REPLY = 'conduct@togetherforge.net';

Deno.serve(async (req) => {
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
  const authAction = String(body.authAction || '');
  const targetUserId = body.targetUserId || null;

  if (authAction && targetUserId) {
    try {
      if (authAction === 'ban') {
        await admin.auth.admin.updateUserById(targetUserId, {
          ban_duration: '876000h',
        });
      } else if (authAction.startsWith('suspend:')) {
        const days = Math.max(1, Number(authAction.slice('suspend:'.length)) || 7);
        await admin.auth.admin.updateUserById(targetUserId, {
          ban_duration: `${days * 24}h`,
        });
      } else if (authAction === 'unban') {
        await admin.auth.admin.updateUserById(targetUserId, {
          ban_duration: 'none',
        });
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
});
