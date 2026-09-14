/**
 * Claim a task. Checks ENABLE_CLAIMS before calling public.claim_task.
 * Staff may claim while the flag is off. Existing In Progress claims are not touched.
 *
 * POST JSON: { taskId }
 * Auth: Authorization: Bearer <user access token>
 *
 * Secrets: ENABLE_CLAIMS (unset = on)
 */

// deno-lint-ignore-file
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';
import {
  adminClient,
  anonKey,
  corsHeaders,
  jsonResponse,
  supabaseUrl,
  userFromRequest,
} from '../_shared/edgeAuth.ts';
import {
  areClaimsEnabled,
  CLAIMS_PAUSED_CODE,
  CLAIMS_PAUSED_ERROR,
} from '../_shared/claimsEnabled.ts';

const STAFF_ROLES = new Set([
  'founder',
  'admin',
  'moderator',
  'project_lead',
]);

async function isStaffUser(userId) {
  if (!userId) return false;
  try {
    const admin = adminClient();
    const { data } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    const role = String(data?.role || '').trim();
    return STAFF_ROLES.has(role);
  } catch {
    return false;
  }
}

async function syncClaimsKillSwitch(paused) {
  try {
    const admin = adminClient();
    await admin.from('app_kill_switches').upsert({
      name: 'claims',
      paused: Boolean(paused),
      updated_at: new Date().toISOString(),
    });
  } catch {
    /* table may not exist yet */
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const user = await userFromRequest(req);
  if (!user?.id) {
    return jsonResponse({ error: 'You must be signed in to claim a task' }, 401);
  }

  const enabled = areClaimsEnabled();
  await syncClaimsKillSwitch(!enabled);
  const staff = await isStaffUser(user.id);
  if (!enabled && !staff) {
    return jsonResponse(
      { error: CLAIMS_PAUSED_ERROR, code: CLAIMS_PAUSED_CODE },
      403
    );
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  const taskId = String(body?.taskId || '').trim();
  if (!taskId) {
    return jsonResponse({ error: 'taskId is required' }, 400);
  }

  const auth = req.headers.get('Authorization') || '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.rpc('claim_task', {
    p_task_id: taskId,
  });
  if (error) {
    return jsonResponse(
      { error: error.message || 'Could not claim that task', code: 'CLAIM_FAILED' },
      400
    );
  }
  return jsonResponse({ data });
});
