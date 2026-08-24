/**
 * Staff-initiated Open Questions on a project hub.
 * Community posts Suggestions (support + replies). Staff may Adopt or close with a note.
 */

import { supabase } from '../lib/supabase';

export const OPEN_QUESTION_TITLE_MIN = 8;
export const OPEN_QUESTION_TITLE_MAX = 160;
export const OPEN_QUESTION_BODY_MAX = 2000;
export const OPEN_QUESTION_REPLY_MIN = 2;
export const OPEN_QUESTION_REPLY_MAX = 2000;
export const OPEN_QUESTION_CLOSE_NOTE_MIN = 8;
export const OPEN_QUESTION_CLOSE_NOTE_MAX = 500;

function asUserError(error, fallback) {
  const msg = error?.message || fallback;
  const err = new Error(msg);
  err.cause = error;
  return err;
}

function mapProfile(row) {
  if (!row) {
    return {
      id: null,
      username: 'Member',
      avatar_url: null,
      avatarUrl: null,
      pinnedBadgeKey: null,
      pinned_badge_key: null,
    };
  }
  const username = row.username || 'Member';
  const avatar = row.avatar_url || row.avatarUrl || null;
  const pin = row.pinned_badge_key || row.pinnedBadgeKey || null;
  return {
    id: row.id || null,
    username,
    avatar_url: avatar,
    avatarUrl: avatar,
    pinnedBadgeKey: pin,
    pinned_badge_key: pin,
  };
}

export function mapReplyRow(row, profileMap = {}) {
  if (!row) return null;
  const profile = mapProfile(profileMap[row.user_id] || null);
  return {
    id: row.id,
    questionId: row.question_id,
    parentId: row.parent_id || null,
    userId: row.user_id,
    body: row.body || '',
    createdAt: row.created_at,
    author: profile,
  };
}

/** Rank: most supports, then most replies, then earliest. */
export function compareSuggestions(a, b) {
  const sc = (Number(b?.supportCount) || 0) - (Number(a?.supportCount) || 0);
  if (sc !== 0) return sc;
  const rc = (Number(b?.replyCount) || 0) - (Number(a?.replyCount) || 0);
  if (rc !== 0) return rc;
  return new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0);
}

export function assembleQuestion(
  question,
  replyRows = [],
  profileMap = {},
  supportRows = [],
  viewerUserId = null
) {
  if (!question) return null;
  const replies = (replyRows || [])
    .map((r) => mapReplyRow(r, profileMap))
    .filter(Boolean);

  const supportCountByReply = new Map();
  const supportedByViewer = new Set();
  for (const s of supportRows || []) {
    const rid = s.reply_id || s.replyId;
    if (!rid) continue;
    supportCountByReply.set(rid, (supportCountByReply.get(rid) || 0) + 1);
    if (viewerUserId && String(s.user_id || s.userId) === String(viewerUserId)) {
      supportedByViewer.add(rid);
    }
  }

  const suggestionsRaw = replies.filter((r) => !r.parentId);

  const childrenByParent = new Map();
  for (const r of replies) {
    if (!r.parentId) continue;
    if (!childrenByParent.has(r.parentId)) childrenByParent.set(r.parentId, []);
    childrenByParent.get(r.parentId).push(r);
  }

  const suggestions = suggestionsRaw
    .map((a) => {
      const children = (childrenByParent.get(a.id) || []).sort(
        (x, y) => new Date(x.createdAt) - new Date(y.createdAt)
      );
      return {
        ...a,
        replies: children,
        replyCount: children.length,
        supportCount: supportCountByReply.get(a.id) || 0,
        supportedByMe: supportedByViewer.has(a.id),
      };
    })
    .sort(compareSuggestions)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  const topRanked = suggestions[0] || null;

  const adoptedId = question.selected_reply_id || null;
  const adoptedSuggestion =
    suggestions.find((a) => a.id === adoptedId) || null;

  const author = mapProfile(profileMap[question.created_by] || null);

  return {
    id: question.id,
    projectId: question.project_id,
    createdBy: question.created_by,
    title: question.title || '',
    body: question.body || '',
    status: question.status === 'closed' ? 'closed' : 'open',
    adoptedReplyId: adoptedId,
    selectedReplyId: adoptedId,
    closeNote: question.close_note || '',
    closedAt: question.closed_at || null,
    closedBy: question.closed_by || null,
    createdAt: question.created_at,
    updatedAt: question.updated_at,
    author,
    suggestions,
    suggestionCount: suggestions.length,
    nestedReplyCount: suggestions.reduce((n, a) => n + a.replyCount, 0),
    topRanked,
    adoptedSuggestion,
    isOpen: question.status !== 'closed',
  };
}

async function loadProfileMap(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, pinned_badge_key')
    .in('id', ids);
  if (error) {
    console.warn('[openQuestionsService] profiles', error.message);
    return {};
  }
  const map = {};
  for (const row of data || []) map[row.id] = row;
  return map;
}

export const openQuestionsService = {
  async listForProject(projectId, { viewerUserId = null } = {}) {
    if (!projectId) return [];
    const questionSelect =
      'id, project_id, created_by, title, body, status, selected_reply_id, close_note, closed_at, closed_by, created_at, updated_at';
    let { data: questions, error: qErr } = await supabase
      .from('open_questions')
      .select(questionSelect)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (qErr && /close_note/i.test(qErr.message || '')) {
      const retry = await supabase
        .from('open_questions')
        .select(
          'id, project_id, created_by, title, body, status, selected_reply_id, closed_at, closed_by, created_at, updated_at'
        )
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      questions = retry.data;
      qErr = retry.error;
    }

    if (qErr) {
      if (
        /does not exist|schema cache|could not find the table/i.test(
          qErr.message || ''
        )
      ) {
        const err = new Error(
          'Open Questions are not set up yet. Run supabase/sql/supabase_open_questions.sql in Supabase.'
        );
        err.code = 'OPEN_QUESTIONS_MISSING';
        throw err;
      }
      throw asUserError(qErr, 'Could not load open questions.');
    }

    const list = questions || [];
    if (!list.length) return [];

    const qids = list.map((q) => q.id);
    const { data: replies, error: rErr } = await supabase
      .from('open_question_replies')
      .select('id, question_id, parent_id, user_id, body, created_at')
      .in('question_id', qids)
      .order('created_at', { ascending: true });

    if (rErr) throw asUserError(rErr, 'Could not load suggestions.');

    const replyRows = replies || [];
    const suggestionIds = replyRows
      .filter((r) => !r.parent_id)
      .map((r) => r.id);

    let supportRows = [];
    if (suggestionIds.length) {
      const { data: supports, error: sErr } = await supabase
        .from('open_question_supports')
        .select('reply_id, user_id')
        .in('reply_id', suggestionIds);
      if (
        sErr &&
        !/does not exist|schema cache|could not find the table/i.test(
          sErr.message || ''
        )
      ) {
        throw asUserError(sErr, 'Could not load supports.');
      }
      supportRows = supports || [];
    }

    const userIds = [
      ...list.map((q) => q.created_by),
      ...replyRows.map((r) => r.user_id),
    ];
    const profileMap = await loadProfileMap(userIds);
    const byQuestion = new Map();
    for (const r of replyRows) {
      if (!byQuestion.has(r.question_id)) byQuestion.set(r.question_id, []);
      byQuestion.get(r.question_id).push(r);
    }

    return list.map((q) =>
      assembleQuestion(
        q,
        byQuestion.get(q.id) || [],
        profileMap,
        supportRows,
        viewerUserId
      )
    );
  },

  async createQuestion(projectId, { title, body }, userId) {
    if (!userId) throw new Error('Sign in to ask a question.');
    const t = String(title || '').trim();
    const b = String(body || '').trim();
    if (t.length < OPEN_QUESTION_TITLE_MIN) {
      throw new Error(
        `Title needs at least ${OPEN_QUESTION_TITLE_MIN} characters.`
      );
    }
    if (t.length > OPEN_QUESTION_TITLE_MAX) {
      throw new Error(`Title must be ${OPEN_QUESTION_TITLE_MAX} characters or less.`);
    }
    if (b.length > OPEN_QUESTION_BODY_MAX) {
      throw new Error('Question details are too long.');
    }
    const { data, error } = await supabase
      .from('open_questions')
      .insert([
        {
          project_id: projectId,
          created_by: userId,
          title: t,
          body: b || null,
          status: 'open',
        },
      ])
      .select(
        'id, project_id, created_by, title, body, status, selected_reply_id, close_note, closed_at, closed_by, created_at, updated_at'
      )
      .single();
    if (error) throw asUserError(error, 'Could not create the question.');
    return assembleQuestion(data, [], await loadProfileMap([userId]), [], userId);
  },

  async updateQuestion(questionId, { title, body }) {
    const patch = {};
    if (title !== undefined) {
      const t = String(title || '').trim();
      if (t.length < OPEN_QUESTION_TITLE_MIN) {
        throw new Error(
          `Title needs at least ${OPEN_QUESTION_TITLE_MIN} characters.`
        );
      }
      patch.title = t;
    }
    if (body !== undefined) {
      const b = String(body || '').trim();
      if (b.length > OPEN_QUESTION_BODY_MAX) {
        throw new Error('Question details are too long.');
      }
      patch.body = b || null;
    }
    if (!Object.keys(patch).length) return null;
    const { data, error } = await supabase
      .from('open_questions')
      .update(patch)
      .eq('id', questionId)
      .select(
        'id, project_id, created_by, title, body, status, selected_reply_id, close_note, closed_at, closed_by, created_at, updated_at'
      )
      .single();
    if (error) throw asUserError(error, 'Could not update the question.');
    return data;
  },

  async deleteQuestion(questionId) {
    const { error } = await supabase
      .from('open_questions')
      .delete()
      .eq('id', questionId);
    if (error) throw asUserError(error, 'Could not delete the question.');
    return { id: questionId };
  },

  async adoptSuggestion(questionId, replyId) {
    if (!questionId || !replyId) throw new Error('Pick a suggestion to adopt.');
    const { data, error } = await supabase
      .from('open_questions')
      .update({ selected_reply_id: replyId })
      .eq('id', questionId)
      .select('id, selected_reply_id, status')
      .single();
    if (error) throw asUserError(error, 'Could not adopt that suggestion.');
    return data;
  },

  async closeQuestion(questionId, { note, adoptedReplyId } = {}) {
    const text = String(note || '').trim();
    if (text.length < OPEN_QUESTION_CLOSE_NOTE_MIN) {
      throw new Error(
        `Add a short note (at least ${OPEN_QUESTION_CLOSE_NOTE_MIN} characters) explaining the final choice.`
      );
    }
    if (text.length > OPEN_QUESTION_CLOSE_NOTE_MAX) {
      throw new Error('That close note is too long.');
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const patch = {
      status: 'closed',
      close_note: text,
      closed_at: new Date().toISOString(),
      closed_by: user?.id || null,
    };
    if (adoptedReplyId) patch.selected_reply_id = adoptedReplyId;
    const { data, error } = await supabase
      .from('open_questions')
      .update(patch)
      .eq('id', questionId)
      .select('id, status, selected_reply_id, close_note, closed_at')
      .single();
    if (error) {
      if (/close_note/i.test(error.message || '')) {
        throw new Error(
          'Close notes are not set up yet. Re-run supabase/sql/supabase_open_questions.sql in Supabase.'
        );
      }
      throw asUserError(error, 'Could not close the question.');
    }
    return data;
  },

  async toggleSupport(replyId, userId) {
    if (!userId) throw new Error('Sign in to support a suggestion.');
    if (!replyId) throw new Error('Suggestion not found.');
    const { data: existing, error: lookErr } = await supabase
      .from('open_question_supports')
      .select('reply_id')
      .eq('reply_id', replyId)
      .eq('user_id', userId)
      .maybeSingle();
    if (
      lookErr &&
      /does not exist|schema cache|could not find the table/i.test(
        lookErr.message || ''
      )
    ) {
      throw new Error(
        'Suggestion supports are not set up yet. Re-run supabase/sql/supabase_open_questions.sql in Supabase.'
      );
    }
    if (lookErr) throw asUserError(lookErr, 'Could not update support.');
    if (existing) {
      const { error } = await supabase
        .from('open_question_supports')
        .delete()
        .eq('reply_id', replyId)
        .eq('user_id', userId);
      if (error) throw asUserError(error, 'Could not remove support.');
      return { supported: false };
    }
    const { error } = await supabase.from('open_question_supports').insert([
      { reply_id: replyId, user_id: userId },
    ]);
    if (error) {
      if (/closed/i.test(error.message || '')) {
        throw new Error('This question is closed.');
      }
      throw asUserError(error, 'Could not support that suggestion.');
    }
    return { supported: true };
  },

  async postReply({ questionId, userId, body, parentId = null }) {
    if (!userId) throw new Error('Sign in to reply.');
    const text = String(body || '').trim();
    if (text.length < OPEN_QUESTION_REPLY_MIN) {
      throw new Error('Write a bit more before posting.');
    }
    if (text.length > OPEN_QUESTION_REPLY_MAX) {
      throw new Error('That reply is too long.');
    }
    const { data, error } = await supabase
      .from('open_question_replies')
      .insert([
        {
          question_id: questionId,
          user_id: userId,
          body: text,
          parent_id: parentId || null,
        },
      ])
      .select('id, question_id, parent_id, user_id, body, created_at')
      .single();
    if (error) {
      const msg = error.message || '';
      if (/closed/i.test(msg)) {
        throw new Error('This question is closed.');
      }
      throw asUserError(error, 'Could not post that reply.');
    }
    const profileMap = await loadProfileMap([userId]);
    return mapReplyRow(data, profileMap);
  },

  async deleteReply(replyId) {
    const { error } = await supabase
      .from('open_question_replies')
      .delete()
      .eq('id', replyId);
    if (error) throw asUserError(error, 'Could not delete that reply.');
    return { id: replyId };
  },
};

export default openQuestionsService;
