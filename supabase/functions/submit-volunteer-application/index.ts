/**
 * Private volunteer application intake (Get Involved).
 * Inserts into volunteer_applications and optionally notifies Discord.
 *
 * POST JSON body (see validate below)
 * Deploy: supabase functions deploy submit-volunteer-application --no-verify-jwt
 * Optional secret: DISCORD_VOLUNTEER_WEBHOOK_URL
 */

// deno-lint-ignore-file
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';
import { enforceRateLimit } from '../_shared/rateLimit.ts';

const supabaseUrl =
  Deno.env.get('SUPABASE_URL') ?? Deno.env.get('SB_URL') ?? '';
const serviceKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SERVICE_ROLE_KEY') ??
  '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const webhookUrl = String(
  Deno.env.get('DISCORD_VOLUNTEER_WEBHOOK_URL') || ''
).trim();

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Local rate limit bucket (reuse checkout-like limits)
const VOLUNTEER_LIMIT = {
  limit: 8,
  windowMs: 15 * 60 * 1000,
  bucket: 'volunteer-application',
  message: 'Too many applications. Please wait a bit and try again.',
};

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
  if (anonKey && token === anonKey) return null;
  if (serviceKey && token === serviceKey) return null;
  const client = createClient(supabaseUrl, anonKey || serviceKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

function clean(s, max) {
  return String(s || '')
    .trim()
    .slice(0, max);
}

function validate(body) {
  const handle = clean(body.handle || body.name, 80);
  const email = clean(body.email, 254);
  const discord = clean(body.discordUsername || body.discord_username, 64);
  const description = clean(body.description, 4000);
  const timeCommitment = clean(body.timeCommitment || body.time_commitment, 80);
  const portfolioUrl = clean(body.portfolioUrl || body.portfolio_url, 500);
  const skillOther = clean(body.skillOther || body.skill_other, 200);
  const roleId = clean(body.roleId || body.role_id, 64);
  const openNeedId = clean(body.openNeedId || body.open_need_id, 64);
  const openNeedTitle = clean(
    body.openNeedTitle || body.open_need_title,
    160
  );
  let applicationType = clean(
    body.applicationType || body.application_type,
    40
  ).toLowerCase();
  if (
    !['skill_offer', 'moderation_role', 'open_need'].includes(applicationType)
  ) {
    applicationType = roleId
      ? 'moderation_role'
      : openNeedId
        ? 'open_need'
        : 'skill_offer';
  }

  let skillAreas = body.skillAreas || body.skill_areas || [];
  if (!Array.isArray(skillAreas)) skillAreas = [];
  skillAreas = skillAreas
    .map((s) => clean(s, 40))
    .filter(Boolean)
    .slice(0, 12);

  if (!handle) return { error: 'Please enter a name or preferred handle.' };
  if (!email && !discord) {
    return { error: 'Provide a Discord username and/or email so we can reach you.' };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'That email does not look valid.' };
  }
  if (!description || description.length < 10) {
    return { error: 'Please add a short description (at least a sentence).' };
  }
  if (applicationType === 'moderation_role' && !roleId) {
    return { error: 'Choose a Community & Moderation role.' };
  }
  if (
    applicationType === 'skill_offer' &&
    skillAreas.length === 0 &&
    !skillOther
  ) {
    return { error: 'Pick at least one skill area, or describe Other.' };
  }

  return {
    row: {
      application_type: applicationType,
      handle,
      email: email || null,
      discord_username: discord || null,
      skill_areas: skillAreas,
      skill_other: skillOther || null,
      role_id: roleId || null,
      open_need_id: openNeedId || null,
      description,
      time_commitment: timeCommitment || null,
      portfolio_url: portfolioUrl || null,
      status: 'new',
    },
    openNeedTitle: openNeedTitle || null,
  };
}

async function notifyDiscord(row) {
  if (!webhookUrl || !webhookUrl.startsWith('https://')) return;
  const skills = (row.skill_areas || []).join(', ') || '(none)';
  const content = [
    `**New volunteer application** (${row.application_type})`,
    `Handle: ${row.handle}`,
    row.email ? `Email: ${row.email}` : null,
    row.discord_username ? `Discord: ${row.discord_username}` : null,
    row.role_id ? `Role: ${row.role_id}` : null,
    row.open_need_title
      ? `Open need: ${row.open_need_title}`
      : row.open_need_id
        ? `Open need id: ${row.open_need_id}`
        : null,
    `Skills: ${skills}${row.skill_other ? ` / Other: ${row.skill_other}` : ''}`,
    row.time_commitment ? `Time: ${row.time_commitment}` : null,
    row.portfolio_url ? `Portfolio: ${row.portfolio_url}` : null,
    '',
    row.description.slice(0, 1500),
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content.slice(0, 1900),
        allowed_mentions: { parse: [] },
      }),
    });
  } catch (e) {
    console.warn('[submit-volunteer] discord webhook', e?.message || e);
  }
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
    const limited = enforceRateLimit(req, {
      ...VOLUNTEER_LIMIT,
      userId: user?.id || null,
      cors,
    });
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const v = validate(body);
    if (v.error) return json({ error: v.error }, 400);

    const row = {
      ...v.row,
      user_id: user?.id || null,
    };
    const openNeedTitle = v.openNeedTitle || null;

    const sb = admin();
    const { data, error } = await sb
      .from('volunteer_applications')
      .insert(row)
      .select('id, created_at')
      .maybeSingle();

    if (error) {
      console.error('[submit-volunteer] insert', error.message);
      // Table missing: still try Discord so staff see it
      if (/relation|does not exist|schema cache/i.test(error.message || '')) {
        await notifyDiscord({ ...row, open_need_title: openNeedTitle });
        return json({
          ok: true,
          warning:
            'Saved to staff notify only. Apply supabase_volunteer_applications.sql for full queue storage.',
        });
      }
      return json({ error: 'Could not save application. Try again later.' }, 500);
    }

    await notifyDiscord({
      ...row,
      id: data?.id,
      open_need_title: openNeedTitle,
    });

    return json({
      ok: true,
      id: data?.id || null,
      createdAt: data?.created_at || null,
    });
  } catch (e) {
    console.error('[submit-volunteer]', e?.message || e);
    return json({ error: e?.message || 'Submit failed.' }, 500);
  }
});
