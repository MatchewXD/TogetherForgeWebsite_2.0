/**
 * Staff-authored Devlogs & announcements on a project hub.
 */

import { supabase } from '../lib/supabase';

export const UPDATE_TITLE_MIN = 8;
export const UPDATE_TITLE_MAX = 120;
export const UPDATE_BODY_MIN = 8;
export const UPDATE_BODY_MAX = 2000;
export const UPDATE_DEVLOG_BODY_MAX = 8000;

export const UPDATE_CATEGORIES = [
  'Devlog',
  'Announcement',
  'Process',
  'Art',
  'Audio',
  'Build',
];

export function bodyMaxForCategory(category) {
  return category === 'Devlog' ? UPDATE_DEVLOG_BODY_MAX : UPDATE_BODY_MAX;
}

export function mapUpdateRow(row) {
  if (!row) return null;
  const profile = Array.isArray(row.profiles)
    ? row.profiles[0]
    : row.profiles || null;
  return {
    id: row.id,
    projectId: row.project_id,
    createdBy: row.created_by,
    category: row.category || 'Announcement',
    title: row.title || '',
    body: row.body || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      username: profile?.username || null,
      avatarUrl: profile?.avatar_url || profile?.avatarUrl || null,
    },
  };
}

export function validateUpdate({ title, body, category }) {
  const t = String(title || '').trim();
  const b = String(body || '').trim();
  const cat = UPDATE_CATEGORIES.includes(category) ? category : '';
  if (!cat) throw new Error('Pick a category.');
  if (t.length < UPDATE_TITLE_MIN) {
    throw new Error(`Title needs at least ${UPDATE_TITLE_MIN} characters.`);
  }
  if (t.length > UPDATE_TITLE_MAX) {
    throw new Error(`Title must be ${UPDATE_TITLE_MAX} characters or less.`);
  }
  if (b.length < UPDATE_BODY_MIN) {
    throw new Error(`Write at least ${UPDATE_BODY_MIN} characters.`);
  }
  const max = bodyMaxForCategory(cat);
  if (b.length > max) {
    throw new Error(
      cat === 'Devlog'
        ? `Devlog description must be ${max} characters or less.`
        : `Description must be ${max} characters or less.`
    );
  }
  return { title: t, body: b, category: cat };
}

const SELECT_PLAIN =
  'id, project_id, created_by, category, title, body, created_at, updated_at';

function asUserError(error, fallback) {
  const err = new Error(error?.message || fallback);
  err.cause = error;
  return err;
}

function throwIfMissing(error, fallback) {
  if (
    /does not exist|schema cache|could not find the table/i.test(
      error?.message || ''
    )
  ) {
    const err = new Error(
      'Project updates are not set up yet. Run supabase/sql/supabase_project_updates.sql in Supabase.'
    );
    err.code = 'PROJECT_UPDATES_MISSING';
    throw err;
  }
  throw asUserError(error, fallback);
}

export const projectUpdatesService = {
  async listForProject(projectId) {
    if (!projectId) return [];
    // project_updates.created_by references auth.users, not profiles, so
    // PostgREST cannot embed the author. Load authors in a second query.
    const { data, error } = await supabase
      .from('project_updates')
      .select(SELECT_PLAIN)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throwIfMissing(error, 'Could not load updates.');

    const authorIds = [
      ...new Set((data || []).map((row) => row.created_by).filter(Boolean)),
    ];
    const authors = new Map();
    if (authorIds.length) {
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', authorIds);
      if (profErr) {
        console.warn('[projectUpdates] authors', profErr.message);
      }
      for (const p of profiles || []) authors.set(p.id, p);
    }

    return (data || [])
      .map((row) =>
        mapUpdateRow({ ...row, profiles: authors.get(row.created_by) || null })
      )
      .filter(Boolean);
  },

  async create(projectId, payload, userId) {
    if (!userId) throw new Error('Sign in to post an update.');
    if (!projectId) throw new Error('Project is required.');
    const next = validateUpdate(payload);
    const { data, error } = await supabase
      .from('project_updates')
      .insert([
        {
          project_id: projectId,
          created_by: userId,
          category: next.category,
          title: next.title,
          body: next.body,
        },
      ])
      .select(SELECT_PLAIN)
      .single();
    if (error) throwIfMissing(error, 'Could not post the update.');
    return mapUpdateRow(data);
  },

  async update(updateId, payload) {
    if (!updateId) throw new Error('Update not found.');
    const next = validateUpdate(payload);
    const { data, error } = await supabase
      .from('project_updates')
      .update({
        category: next.category,
        title: next.title,
        body: next.body,
      })
      .eq('id', updateId)
      .select(SELECT_PLAIN)
      .single();
    if (error) throwIfMissing(error, 'Could not save the update.');
    return mapUpdateRow(data);
  },

  async remove(updateId) {
    if (!updateId) throw new Error('Update not found.');
    const { error } = await supabase
      .from('project_updates')
      .delete()
      .eq('id', updateId);
    if (error) throwIfMissing(error, 'Could not delete the update.');
    return { id: updateId };
  },
};

export default projectUpdatesService;
