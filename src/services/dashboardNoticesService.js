import { supabase } from '../lib/supabase';

function asUserError(error, fallback) {
  const err = new Error(error?.message || fallback);
  err.cause = error;
  return err;
}

function mapNotice(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind || 'notice',
    title: row.title || '',
    message: row.body || '',
    href: row.href || '',
    sourceId: row.source_id || null,
    createdAt: row.created_at,
    readAt: row.read_at || null,
    dismissedAt: row.dismissed_at || null,
  };
}

export const dashboardNoticesService = {
  async listMine({ limit = 30, includeDismissed = false } = {}) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return [];
    let q = supabase
      .from('dashboard_notices')
      .select(
        'id, user_id, kind, title, body, href, source_id, created_at, read_at, dismissed_at'
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!includeDismissed) q = q.is('dismissed_at', null);
    const { data, error } = await q;
    if (error) {
      if (/does not exist|schema cache|dashboard_notices/i.test(error.message || '')) {
        return [];
      }
      throw asUserError(error, 'Could not load notices.');
    }
    return (data || []).map(mapNotice).filter(Boolean);
  },

  async create({ userId, kind, title, body, href, sourceId }) {
    if (!userId) return null;
    const { data, error } = await supabase.rpc('notify_dashboard', {
      p_user_id: userId,
      p_kind: kind || 'notice',
      p_title: title || null,
      p_body: body || null,
      p_href: href || null,
      p_source_id: sourceId || null,
    });
    if (!error) return { id: data, ok: true };
    console.warn('[dashboardNotices] notify_dashboard', error.message);
    const { error: insertErr } = await supabase.from('dashboard_notices').insert({
      user_id: userId,
      kind: kind || 'notice',
      title: title || null,
      body: body || null,
      href: href || null,
      source_id: sourceId || null,
    });
    if (insertErr) {
      console.warn('[dashboardNotices] create', insertErr.message);
      return null;
    }
    return { ok: true };
  },

  async markRead(ids) {
    const list = (ids || []).filter(Boolean);
    if (!list.length) return;
    const { error } = await supabase
      .from('dashboard_notices')
      .update({ read_at: new Date().toISOString() })
      .in('id', list)
      .is('read_at', null);
    if (error) console.warn('[dashboardNotices] markRead', error.message);
  },

  async dismiss(ids) {
    const list = (ids || []).filter(Boolean);
    if (!list.length) return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('dashboard_notices')
      .update({ dismissed_at: now, read_at: now })
      .in('id', list)
      .is('dismissed_at', null);
    if (error) console.warn('[dashboardNotices] dismiss', error.message);
  },
};

export default dashboardNoticesService;
