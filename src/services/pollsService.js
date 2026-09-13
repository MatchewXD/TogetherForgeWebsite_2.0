/**
 * Staff-directed polls. Members pick one option.
 * Votes inform staff. They do not lock Tether, StyleLock, or any task.
 * No comments, write-ins, multi-vote, ranked choice, or weighted votes.
 */

import { supabase } from '../lib/supabase';
import { arePollsEnabled } from '../constants/pollsEnabled';

export const POLL_TITLE_MIN = 4;
export const POLL_TITLE_MAX = 120;
export const POLL_CONTEXT_MAX = 500;
export const POLL_STAFF_NOTE_MAX = 200;
export const POLL_OPTION_NAME_MAX = 48;
export const POLL_OPTION_DESC_MAX = 160;
export const POLL_OPTION_MIN = 2;
export const POLL_OPTION_MAX = 8;

export const POLL_STATUSES = ['draft', 'live', 'closed'];
export const POLL_PROJECT_TAGS = [
  { value: '', label: 'No tag' },
  { value: 'tether', label: 'Tether' },
  { value: 'studio', label: 'Studio' },
  { value: 'other', label: 'Other' },
];

export const POLL_INFORM_COPY =
  'Votes inform staff. They do not lock the work.';

export const POLL_EMPTY_LIVE =
  'No live polls. Staff will post one when there is a short list to pick from.';

function asUserError(error, fallback) {
  const msg = error?.message || fallback;
  const err = new Error(msg);
  err.cause = error;
  return err;
}

function missingPollsSchema(error) {
  return /polls|schema cache|does not exist/i.test(error?.message || '');
}

export function emptyPollOption() {
  return { name: '', description: '' };
}

export function emptyPollOptions() {
  return [emptyPollOption(), emptyPollOption()];
}

export function projectTagLabel(tag) {
  const found = POLL_PROJECT_TAGS.find((t) => t.value === tag);
  return found?.label || '';
}

export function pollPath(pollId) {
  return `/polls/${pollId}`;
}

export function pollManagePath(pollId) {
  const params = new URLSearchParams({ tab: 'polls' });
  if (pollId) params.set('poll', pollId);
  return `/moderator?${params.toString()}`;
}

export function isPollLive(poll) {
  if (!poll || poll.status !== 'live') return false;
  if (poll.closesAt && new Date(poll.closesAt).getTime() <= Date.now()) {
    return false;
  }
  return true;
}

export function pollVoteTotal(poll) {
  return (poll?.options || []).reduce(
    (sum, o) => sum + (Number(o.voteCount) || 0),
    0
  );
}

export function optionPercent(option, total) {
  const count = Number(option?.voteCount) || 0;
  const n = Number(total) || 0;
  if (n <= 0) return 0;
  return Math.round((count / n) * 100);
}

export function remainingLabel(closesAt, now = Date.now()) {
  if (!closesAt) return '';
  const ms = new Date(closesAt).getTime() - now;
  if (!Number.isFinite(ms)) return '';
  if (ms <= 0) return 'Closed';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'Less than a minute left';
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

export function formatPollWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function comparePolls(a, b) {
  const liveA = a?.status === 'live' ? 0 : 1;
  const liveB = b?.status === 'live' ? 0 : 1;
  if (liveA !== liveB) return liveA - liveB;
  const ta = Date.parse(a?.openedAt || a?.createdAt || '') || 0;
  const tb = Date.parse(b?.openedAt || b?.createdAt || '') || 0;
  return tb - ta;
}

function normalizeTag(tag) {
  const v = String(tag || '').trim().toLowerCase();
  if (!v) return null;
  if (v === 'tether' || v === 'studio' || v === 'other') return v;
  throw new Error('Project tag must be Tether, Studio, or Other.');
}

function assertOptions(options) {
  const list = (options || [])
    .map((o) => ({
      name: String(o?.name || '').trim(),
      description: String(o?.description || '').trim(),
    }))
    .filter((o) => o.name || o.description);
  if (list.length < POLL_OPTION_MIN) {
    throw new Error(`A poll needs at least ${POLL_OPTION_MIN} options.`);
  }
  if (list.length > POLL_OPTION_MAX) {
    throw new Error(`A poll can have at most ${POLL_OPTION_MAX} options.`);
  }
  for (const o of list) {
    if (!o.name) throw new Error('Each option needs a short name.');
    if (o.name.length > POLL_OPTION_NAME_MAX) {
      throw new Error('Option names are too long.');
    }
    if (!o.description) {
      throw new Error('Each option needs one sentence.');
    }
    if (o.description.length > POLL_OPTION_DESC_MAX) {
      throw new Error('Option sentences are too long.');
    }
  }
  return list;
}

function assertPollFields({ title, context, staffNote, closesAt }) {
  const t = String(title || '').trim();
  if (t.length < POLL_TITLE_MIN) {
    throw new Error(`Title needs at least ${POLL_TITLE_MIN} characters.`);
  }
  if (t.length > POLL_TITLE_MAX) throw new Error('Title is too long.');
  const ctx = String(context || '').trim();
  if (ctx.length > POLL_CONTEXT_MAX) throw new Error('Context is too long.');
  const note = String(staffNote || '').trim();
  if (note.length > POLL_STAFF_NOTE_MAX) {
    throw new Error('Staff note is too long.');
  }
  let closes = null;
  if (closesAt) {
    const ms = new Date(closesAt).getTime();
    if (!Number.isFinite(ms)) throw new Error('Close time is not valid.');
    closes = new Date(ms).toISOString();
  }
  return { title: t, context: ctx, staffNote: note, closesAt: closes };
}

function mapOption(row) {
  if (!row) return null;
  return {
    id: row.id,
    pollId: row.poll_id,
    sortOrder: row.sort_order,
    name: row.name || '',
    description: row.description || '',
    voteCount: Number(row.vote_count) || 0,
  };
}

function mapPoll(row, options = [], myOptionId = null, opener = null) {
  if (!row) return null;
  const opts = (options || []).map(mapOption).filter(Boolean);
  opts.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const status = row.status;
  const effectiveLive = status === 'live' && isPollLive({
    status,
    closesAt: row.closes_at,
  });
  return {
    id: row.id,
    createdBy: row.created_by,
    openedBy: row.opened_by,
    closedBy: row.closed_by,
    title: row.title || '',
    context: row.context || '',
    projectTag: row.project_tag || null,
    status,
    effectiveStatus: effectiveLive ? 'live' : status === 'draft' ? 'draft' : 'closed',
    closesAt: row.closes_at || null,
    openedAt: row.opened_at || null,
    closedAt: row.closed_at || null,
    staffNote: row.staff_note || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    options: opts,
    optionCount: opts.length,
    voteTotal: opts.reduce((s, o) => s + (o.voteCount || 0), 0),
    myOptionId: myOptionId || null,
    openerName: opener?.username || null,
    isLive: effectiveLive,
    isClosed: !effectiveLive && status !== 'draft',
    isDraft: status === 'draft',
  };
}

async function loadOptions(pollIds) {
  if (!pollIds.length) return [];
  const { data, error } = await supabase
    .from('poll_options')
    .select('id, poll_id, sort_order, name, description, vote_count')
    .in('poll_id', pollIds)
    .order('sort_order', { ascending: true });
  if (error) throw asUserError(error, 'Could not load poll options.');
  return data || [];
}

async function loadMyVotes(pollIds, userId) {
  if (!userId || !pollIds.length) return [];
  const { data, error } = await supabase
    .from('poll_votes')
    .select('poll_id, option_id')
    .in('poll_id', pollIds)
    .eq('user_id', userId);
  if (error) {
    if (/permission|rls|policy/i.test(error.message || '')) return [];
    throw asUserError(error, 'Could not load your vote.');
  }
  return data || [];
}

async function loadOpeners(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', ids);
  if (error) return {};
  return Object.fromEntries((data || []).map((p) => [p.id, p]));
}

async function assemble(rows, viewerUserId) {
  const list = rows || [];
  const ids = list.map((r) => r.id);
  const [options, votes, openers] = await Promise.all([
    loadOptions(ids),
    loadMyVotes(ids, viewerUserId),
    loadOpeners(list.map((r) => r.opened_by)),
  ]);
  const optionsByPoll = new Map();
  for (const o of options) {
    const arr = optionsByPoll.get(o.poll_id) || [];
    arr.push(o);
    optionsByPoll.set(o.poll_id, arr);
  }
  const myByPoll = new Map(
    (votes || []).map((v) => [v.poll_id, v.option_id])
  );
  return list.map((row) =>
    mapPoll(
      row,
      optionsByPoll.get(row.id) || [],
      myByPoll.get(row.id) || null,
      openers[row.opened_by] || null
    )
  );
}

export const pollsService = {
  areEnabled: arePollsEnabled,

  async closeExpired() {
    try {
      await supabase.rpc('close_expired_polls');
    } catch {
      /* listing still treats overdue live polls as closed */
    }
  },

  async listPublic({ viewerUserId } = {}) {
    await this.closeExpired();
    const { data, error } = await supabase
      .from('polls')
      .select(
        'id, created_by, opened_by, closed_by, title, context, project_tag, status, closes_at, opened_at, closed_at, staff_note, created_at, updated_at'
      )
      .in('status', ['live', 'closed'])
      .order('created_at', { ascending: false });
    if (error) {
      if (missingPollsSchema(error)) return [];
      throw asUserError(error, 'Could not load polls.');
    }
    const polls = await assemble(data || [], viewerUserId);
    return polls.sort(comparePolls);
  },

  async listAll({ viewerUserId } = {}) {
    await this.closeExpired();
    const { data, error } = await supabase
      .from('polls')
      .select(
        'id, created_by, opened_by, closed_by, title, context, project_tag, status, closes_at, opened_at, closed_at, staff_note, created_at, updated_at'
      )
      .order('created_at', { ascending: false });
    if (error) {
      if (missingPollsSchema(error)) return [];
      throw asUserError(error, 'Could not load polls.');
    }
    const polls = await assemble(data || [], viewerUserId);
    return polls.sort(comparePolls);
  },

  async getById(pollId, { viewerUserId } = {}) {
    if (!pollId) return null;
    await this.closeExpired();
    const { data, error } = await supabase
      .from('polls')
      .select(
        'id, created_by, opened_by, closed_by, title, context, project_tag, status, closes_at, opened_at, closed_at, staff_note, created_at, updated_at'
      )
      .eq('id', pollId)
      .maybeSingle();
    if (error) {
      if (missingPollsSchema(error)) return null;
      throw asUserError(error, 'Could not load poll.');
    }
    if (!data) return null;
    const [poll] = await assemble([data], viewerUserId);
    return poll || null;
  },

  async create({ title, context, projectTag, closesAt, options, publish }, userId) {
    if (!userId) throw new Error('Sign in to create a poll.');
    const fields = assertPollFields({ title, context, closesAt });
    const opts = assertOptions(options);
    const tag = normalizeTag(projectTag);
    const { data, error } = await supabase
      .from('polls')
      .insert({
        created_by: userId,
        title: fields.title,
        context: fields.context || null,
        project_tag: tag,
        closes_at: fields.closesAt,
        status: 'draft',
      })
      .select('id')
      .single();
    if (error) throw asUserError(error, 'Could not create poll.');
    const pollId = data.id;
    try {
      await this.replaceOptions(pollId, opts);
      if (publish) {
        await this.open(pollId);
      }
    } catch (err) {
      await supabase.from('polls').delete().eq('id', pollId);
      throw err;
    }
    return this.getById(pollId, { viewerUserId: userId });
  },

  async replaceOptions(pollId, options) {
    const opts = assertOptions(options);
    const { error: delError } = await supabase
      .from('poll_options')
      .delete()
      .eq('poll_id', pollId);
    if (delError) throw asUserError(delError, 'Could not update options.');
    const { error } = await supabase.from('poll_options').insert(
      opts.map((o, i) => ({
        poll_id: pollId,
        sort_order: i,
        name: o.name,
        description: o.description,
      }))
    );
    if (error) throw asUserError(error, 'Could not save options.');
  },

  async update(pollId, { title, context, projectTag, closesAt, options, staffNote }) {
    if (!pollId) throw new Error('Poll not found.');
    const current = await this.getById(pollId);
    if (!current) throw new Error('Poll not found.');
    const fields = assertPollFields({
      title: title ?? current.title,
      context: context ?? current.context,
      staffNote: staffNote ?? current.staffNote,
      closesAt: closesAt === undefined ? current.closesAt : closesAt,
    });
    const tag =
      projectTag === undefined ? current.projectTag : normalizeTag(projectTag);
    const patch = {
      title: fields.title,
      context: fields.context || null,
      project_tag: tag,
      closes_at: fields.closesAt,
    };
    if (current.isClosed || current.status === 'closed') {
      patch.staff_note = fields.staffNote || null;
    }
    const { error } = await supabase.from('polls').update(patch).eq('id', pollId);
    if (error) throw asUserError(error, 'Could not update poll.');
    if (current.isDraft && options) {
      await this.replaceOptions(pollId, options);
    }
    return this.getById(pollId);
  },

  async open(pollId) {
    const { error } = await supabase
      .from('polls')
      .update({ status: 'live' })
      .eq('id', pollId)
      .eq('status', 'draft');
    if (error) throw asUserError(error, 'Could not open poll.');
    return this.getById(pollId);
  },

  async close(pollId, { staffNote } = {}) {
    const fields = assertPollFields({
      title: 'Closed poll',
      context: '',
      staffNote,
    });
    const patch = {
      status: 'closed',
      closed_at: new Date().toISOString(),
    };
    const { data: auth } = await supabase.auth.getUser();
    if (auth?.user?.id) patch.closed_by = auth.user.id;
    if (fields.staffNote) patch.staff_note = fields.staffNote;
    const { error } = await supabase
      .from('polls')
      .update(patch)
      .eq('id', pollId)
      .eq('status', 'live');
    if (error) throw asUserError(error, 'Could not close poll.');
    return this.getById(pollId);
  },

  async setStaffNote(pollId, staffNote) {
    const note = String(staffNote || '').trim();
    if (note.length > POLL_STAFF_NOTE_MAX) {
      throw new Error('Staff note is too long.');
    }
    const { error } = await supabase
      .from('polls')
      .update({ staff_note: note || null })
      .eq('id', pollId);
    if (error) throw asUserError(error, 'Could not save staff note.');
    return this.getById(pollId);
  },

  async remove(pollId) {
    const { error } = await supabase.from('polls').delete().eq('id', pollId);
    if (error) throw asUserError(error, 'Could not delete poll.');
    return true;
  },

  async vote(pollId, optionId, userId) {
    if (!arePollsEnabled()) {
      throw new Error('Polls are not open on this build.');
    }
    if (!userId) throw new Error('Sign in to vote.');
    if (!pollId || !optionId) throw new Error('Pick an option.');
    const { error } = await supabase.from('poll_votes').upsert(
      {
        poll_id: pollId,
        option_id: optionId,
        user_id: userId,
      },
      { onConflict: 'poll_id,user_id' }
    );
    if (error) throw asUserError(error, 'Could not save your vote.');
    return this.getById(pollId, { viewerUserId: userId });
  },
};

export default pollsService;
