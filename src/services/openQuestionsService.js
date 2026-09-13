/**
 * Staff-initiated Open Questions on a project hub.
 * Community posts Suggestions (support + replies). Staff may Adopt or close with a note.
 */

import { supabase } from '../lib/supabase';
import {
  canonicalProjectSlug,
  isStudioStageKey,
  resolveLinkDisplayName,
} from '../utils/ideaStatus';
import { loadRelatedProjectOptions } from '../utils/relatedToOptions';

export const OPEN_QUESTION_TITLE_MIN = 8;
export const OPEN_QUESTION_TITLE_MAX = 160;
export const OPEN_QUESTION_BODY_MAX = 2000;
export const OPEN_QUESTION_PROMPT_MIN = 8;
export const OPEN_QUESTION_PROMPT_MAX = 2000;
export const OPEN_QUESTION_CONDITION_MAX = 1500;
export const OPEN_QUESTION_REPLY_MIN = 2;
export const OPEN_QUESTION_REPLY_MAX = 2000;
export const OPEN_QUESTION_CLOSE_NOTE_MIN = 8;
export const OPEN_QUESTION_CLOSE_NOTE_MAX = 500;
export const OPEN_QUESTION_HIDE_NOTE_MIN = 8;
export const OPEN_QUESTION_HIDE_NOTE_MAX = 500;
export const QUESTION_IMAGE_BUCKET = 'question-images';
export const QUESTION_IMAGE_MAX = 3;
export const QUESTION_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const QUESTION_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

function asUserError(error, fallback) {
  const msg = error?.message || fallback;
  const err = new Error(msg);
  err.cause = error;
  return err;
}

const QUESTION_SELECT =
  'id, project_id, related_to, created_by, title, body, prompt, status, selected_reply_id, close_note, closed_at, closed_by, closes_at, image_urls, created_at, updated_at';
const QUESTION_SELECT_NO_PROMPT =
  'id, project_id, related_to, created_by, title, body, status, selected_reply_id, close_note, closed_at, closed_by, closes_at, image_urls, created_at, updated_at';
const QUESTION_SELECT_NO_CLOSE =
  'id, project_id, related_to, created_by, title, body, status, selected_reply_id, closed_at, closed_by, closes_at, image_urls, created_at, updated_at';
const QUESTION_SELECT_NO_RELATED =
  'id, project_id, created_by, title, body, prompt, status, selected_reply_id, close_note, closed_at, closed_by, created_at, updated_at';
const QUESTION_SELECT_NO_MEDIA =
  'id, project_id, related_to, created_by, title, body, prompt, status, selected_reply_id, close_note, closed_at, closed_by, created_at, updated_at';
const REPLY_SELECT =
  'id, question_id, parent_id, user_id, body, image_urls, hidden_at, hidden_by, hidden_note, created_at';
const REPLY_SELECT_MIN =
  'id, question_id, parent_id, user_id, body, created_at';

function isMissingCloseNote(error) {
  return /close_note/i.test(error?.message || '');
}

function isMissingPrompt(error) {
  return /\bprompt\b/i.test(error?.message || '');
}

function isMissingRelatedTo(error) {
  return /related_to/i.test(error?.message || '');
}

function isMissingMedia(error) {
  return /image_urls|closes_at|hidden_at|hidden_note/i.test(error?.message || '');
}

export function parseImageUrls(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((u) => String(u || '').trim())
    .filter((u) => /^https?:\/\//i.test(u))
    .slice(0, QUESTION_IMAGE_MAX);
}

export function isQuestionAccepting(question, now = Date.now()) {
  if (!question) return false;
  const status = question.status || (question.isOpen === false ? 'closed' : 'open');
  if (status === 'closed') return false;
  const closes = question.closes_at || question.closesAt;
  if (closes && new Date(closes).getTime() <= now) return false;
  return true;
}

export function questionCloseLabel(question, now = Date.now()) {
  const closes = question?.closesAt || question?.closes_at;
  if (!closes) return '';
  const ms = new Date(closes).getTime() - now;
  if (!Number.isFinite(ms)) return '';
  if (!isQuestionAccepting(question, now)) {
    try {
      return `Closed ${new Date(question.closedAt || closes).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}`;
    } catch {
      return 'Closed';
    }
  }
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'Less than a minute left';
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

/** Stages + no-project. Fake sprint rows (Core Features Sprint, Stability & Polish) are not listed. */
export const QUESTION_RELATED_PHASES = [
  { id: '', label: 'No project' },
  { id: 'early', label: 'Early Game' },
  { id: 'mid', label: 'Mid Game' },
  { id: 'late', label: 'Late Game' },
];

const RETIRED_QUESTION_SLUGS = {
  'core-features': 'mid',
  'polish-playtests': 'late',
};

export function normalizeQuestionScope(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === 'none') return '';
  const lower = raw.toLowerCase();
  if (RETIRED_QUESTION_SLUGS[lower]) return RETIRED_QUESTION_SLUGS[lower];
  if (isStudioStageKey(lower)) {
    if (lower.startsWith('early')) return 'early';
    if (lower.startsWith('mid')) return 'mid';
    if (lower.startsWith('late')) return 'late';
  }
  return canonicalProjectSlug(raw) || raw;
}

export function questionScopeLabel(relatedTo, project) {
  const key = normalizeQuestionScope(relatedTo || project?.slug || '');
  if (!key) return 'No project';
  return resolveLinkDisplayName(key, project?.title) || project?.title || key;
}

export function emptyQuestionPrompt() {
  return {
    context: '',
    questionDetail: '',
    shouldFit: '',
    shouldNotFit: '',
    additional: '',
  };
}

export function parseQuestionPrompt(row) {
  const raw = row?.prompt;
  const fromJson =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
  if (fromJson) {
    return {
      context: String(fromJson.context || '').trim(),
      questionDetail: String(
        fromJson.questionDetail || fromJson.question_detail || ''
      ).trim(),
      shouldFit: String(
        fromJson.shouldFit || fromJson.should_fit || ''
      ).trim(),
      shouldNotFit: String(
        fromJson.shouldNotFit || fromJson.should_not_fit || ''
      ).trim(),
      additional: String(
        fromJson.additional || fromJson.additionalInfo || ''
      ).trim(),
    };
  }
  return {
    ...emptyQuestionPrompt(),
    context: String(row?.body || '').trim(),
  };
}

export function flattenQuestionPrompt(prompt) {
  const p = prompt || emptyQuestionPrompt();
  return [
    p.context,
    p.questionDetail,
    p.shouldFit,
    p.shouldNotFit,
    p.additional,
  ]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join('\n\n');
}

export function hasStructuredPrompt(prompt) {
  if (!prompt) return false;
  return Boolean(
    prompt.questionDetail ||
      prompt.shouldFit ||
      prompt.shouldNotFit ||
      prompt.additional
  );
}

function assertPromptFields(prompt) {
  const p = prompt || emptyQuestionPrompt();
  const required = [
    ['context', 'Context', OPEN_QUESTION_PROMPT_MAX],
    ['questionDetail', 'The Question', OPEN_QUESTION_PROMPT_MAX],
    ['shouldFit', 'What the idea should be', OPEN_QUESTION_CONDITION_MAX],
    ['shouldNotFit', 'What the idea should not be', OPEN_QUESTION_CONDITION_MAX],
  ];
  for (const [key, label, max] of required) {
    const value = String(p[key] || '').trim();
    if (value.length < OPEN_QUESTION_PROMPT_MIN) {
      throw new Error(
        `${label} needs at least ${OPEN_QUESTION_PROMPT_MIN} characters.`
      );
    }
    if (value.length > max) {
      throw new Error(`${label} is too long.`);
    }
  }
  const extra = String(p.additional || '').trim();
  if (extra.length > OPEN_QUESTION_PROMPT_MAX) {
    throw new Error('Additional info is too long.');
  }
  return {
    context: String(p.context || '').trim(),
    questionDetail: String(p.questionDetail || '').trim(),
    shouldFit: String(p.shouldFit || '').trim(),
    shouldNotFit: String(p.shouldNotFit || '').trim(),
    additional: extra,
  };
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
    images: parseImageUrls(row.image_urls),
    hidden: Boolean(row.hidden_at),
    hiddenAt: row.hidden_at || null,
    hiddenNote: String(row.hidden_note || '').trim(),
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

  const childrenByParent = new Map();
  for (const r of replies) {
    if (!r.parentId) continue;
    if (!childrenByParent.has(r.parentId)) childrenByParent.set(r.parentId, []);
    childrenByParent.get(r.parentId).push(r);
  }

  const nestComments = (parentId) => {
    const kids = (childrenByParent.get(parentId) || []).slice().sort(
      (x, y) => new Date(x.createdAt) - new Date(y.createdAt)
    );
    return kids.map((k) => ({
      ...k,
      replies: nestComments(k.id),
    }));
  };

  const countComments = (nodes) =>
    (nodes || []).reduce(
      (n, node) => n + 1 + countComments(node.replies),
      0
    );

  const suggestions = replies
    .filter((r) => !r.parentId)
    .map((a) => {
      const comments = nestComments(a.id);
      return {
        ...a,
        replies: comments,
        replyCount: countComments(comments),
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
  const ordered = adoptedId
    ? sortSuggestions(suggestions, 'votes', adoptedId)
    : suggestions;

  const author = mapProfile(profileMap[question.created_by] || null);
  const nestedReplyCount = suggestions.reduce((n, a) => n + a.replyCount, 0);
  const supportTotal = suggestions.reduce(
    (n, a) => n + (Number(a.supportCount) || 0),
    0
  );

  return {
    id: question.id,
    projectId: question.project_id,
    createdBy: question.created_by,
    title: question.title || '',
    body: question.body || '',
    prompt: parseQuestionPrompt(question),
    preview:
      parseQuestionPrompt(question).context ||
      String(question.body || '').trim(),
    status: isQuestionAccepting(question) ? 'open' : 'closed',
    adoptedReplyId: adoptedId,
    selectedReplyId: adoptedId,
    pickedReplyId: adoptedId,
    closeNote: question.close_note || '',
    closedAt: question.closed_at || null,
    closesAt: question.closes_at || null,
    images: parseImageUrls(question.image_urls),
    closedBy: question.closed_by || null,
    createdAt: question.created_at,
    updatedAt: question.updated_at,
    author,
    relatedTo: normalizeQuestionScope(
      question.related_to || question.projects?.slug
    ),
    project: projectFromRow(question),
    suggestions: ordered,
    suggestionCount: suggestions.length,
    nestedReplyCount,
    supportTotal,
    topRanked,
    adoptedSuggestion,
    pickedSuggestion: adoptedSuggestion,
    isOpen: isQuestionAccepting(question),
  };
}

function projectFromRow(question) {
  const nested = Array.isArray(question?.projects)
    ? question.projects[0]
    : question?.projects;
  const related = normalizeQuestionScope(
    question?.related_to || nested?.slug || question?.project?.slug || ''
  );
  const title = questionScopeLabel(related, nested || question?.project);
  if (!related && !question?.project_id && !nested) {
    return { id: null, slug: '', title: 'No project', relatedTo: '' };
  }
  return {
    id: nested?.id || question.project_id || related || null,
    slug: related || nested?.slug || null,
    title,
    relatedTo: related,
  };
}

export const QUESTION_SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'answers', label: 'Most Answers' },
  { value: 'votes', label: 'Most Voted' },
  { value: 'discussed', label: 'Most Discussed' },
  { value: 'title', label: 'Title A–Z' },
];

export const QUESTION_STATUS_FILTERS = [
  { value: 'all', label: 'All questions' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'adopted', label: 'Picked' },
];

export const ANSWER_SORTS = [
  { value: 'votes', label: 'Most Voted' },
  { value: 'newest', label: 'Newest' },
  { value: 'comments', label: 'Most Comments' },
];

export function questionPath(questionId) {
  return `/questions/${questionId}`;
}

export function answerPath(questionId, answerId) {
  return `/questions/${questionId}/answers/${answerId}`;
}

export function questionsListPath({ project, sort, status, q } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (sort && sort !== 'newest') params.set('sort', sort);
  if (status && status !== 'all') params.set('status', status);
  if (project) params.set('project', project);
  const qs = params.toString();
  return qs ? `/questions?${qs}` : '/questions';
}

export function matchesQuestionSearch(question, search) {
  const needle = String(search || '')
    .trim()
    .toLowerCase();
  if (!needle) return true;
  const answerText = (question?.suggestions || [])
    .map((s) => s.body)
    .filter(Boolean)
    .join(' ');
  const hay = [
    question?.title,
    question?.body,
    question?.prompt?.context,
    question?.prompt?.questionDetail,
    question?.prompt?.shouldFit,
    question?.prompt?.shouldNotFit,
    question?.prompt?.additional,
    question?.author?.username,
    question?.project?.title,
    question?.project?.slug,
    answerText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}

export function filterQuestions(
  list,
  { search = '', status = 'all', projectKey = '' } = {}
) {
  const key = String(projectKey || '')
    .trim()
    .toLowerCase();
  return (list || []).filter((q) => {
    if (!matchesQuestionSearch(q, search)) return false;
    if (status === 'open' && !q.isOpen) return false;
    if (status === 'closed' && q.isOpen) return false;
    if (
      (status === 'adopted' || status === 'picked') &&
      !q.adoptedSuggestion &&
      !q.pickedSuggestion
    ) {
      return false;
    }
    if (key) {
      const scope = normalizeQuestionScope(
        q.relatedTo || q.project?.relatedTo || q.project?.slug || ''
      );
      const pid = String(q.projectId || q.project?.id || '').toLowerCase();
      const slug = String(q.project?.slug || '').toLowerCase();
      if (key === 'none') {
        if (scope || pid) return false;
      } else if (pid !== key && slug !== key && scope !== key) {
        return false;
      }
    }
    return true;
  });
}

export function sortQuestions(list, mode = 'newest') {
  const rows = (list || []).slice();
  const byNewest = (a, b) =>
    new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0);
  if (mode === 'answers') {
    return rows.sort(
      (a, b) => (b.suggestionCount || 0) - (a.suggestionCount || 0) || byNewest(a, b)
    );
  }
  if (mode === 'votes') {
    return rows.sort(
      (a, b) => (b.supportTotal || 0) - (a.supportTotal || 0) || byNewest(a, b)
    );
  }
  if (mode === 'discussed') {
    return rows.sort(
      (a, b) =>
        (b.nestedReplyCount || 0) - (a.nestedReplyCount || 0) || byNewest(a, b)
    );
  }
  if (mode === 'title') {
    return rows.sort((a, b) =>
      String(a.title || '').localeCompare(String(b.title || ''), undefined, {
        sensitivity: 'base',
      })
    );
  }
  return rows.sort(byNewest);
}

export function filterSuggestions(list, { search = '', votedOnly = false } = {}) {
  const needle = String(search || '')
    .trim()
    .toLowerCase();
  return (list || []).filter((s) => {
    if (votedOnly && !s.supportedByMe) return false;
    if (!needle) return true;
    const hay = [s.body, s.author?.username]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(needle);
  });
}

export function sortSuggestions(list, mode = 'votes', pickedId = null) {
  const rows = (list || []).slice();
  if (mode === 'newest') {
    rows.sort(
      (a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)
    );
  } else if (mode === 'comments') {
    rows.sort(
      (a, b) =>
        (Number(b?.replyCount) || 0) - (Number(a?.replyCount) || 0) ||
        new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0)
    );
  } else {
    rows.sort(compareSuggestions);
  }
  if (!pickedId) return rows;
  return rows.sort((a, b) => {
    const ap = a.id === pickedId ? 0 : 1;
    const bp = b.id === pickedId ? 0 : 1;
    return ap - bp;
  });
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

function throwIfQuestionsMissing(error, fallback) {
  if (
    /does not exist|schema cache|could not find the table/i.test(
      error?.message || ''
    )
  ) {
    const err = new Error(
      'Open Questions are not set up yet. Run supabase/sql/supabase_open_questions.sql in Supabase.'
    );
    err.code = 'OPEN_QUESTIONS_MISSING';
    throw err;
  }
  throw asUserError(error, fallback);
}

async function loadQuestionRows({ projectId = null, questionId = null } = {}) {
  try {
    await supabase.rpc('close_expired_open_questions');
  } catch {
    /* listing still treats overdue questions as closed */
  }
  const withProject = `${QUESTION_SELECT}, projects(id, slug, title)`;
  const withProjectNoPrompt = `${QUESTION_SELECT_NO_PROMPT}, projects(id, slug, title)`;
  const withProjectNoClose = `${QUESTION_SELECT_NO_CLOSE}, projects(id, slug, title)`;

  const applyFilters = (qb) => {
    let next = qb;
    if (projectId) next = next.eq('project_id', projectId);
    if (questionId) next = next.eq('id', questionId);
    return next.order('created_at', { ascending: false });
  };

  const run = (select) => {
    const qb = applyFilters(
      supabase.from('open_questions').select(select)
    );
    return questionId ? qb.maybeSingle() : qb;
  };

  let result = await run(withProject);
  if (result.error && isMissingMedia(result.error)) {
    result = await run(`${QUESTION_SELECT_NO_MEDIA}, projects(id, slug, title)`);
  }
  if (result.error && isMissingRelatedTo(result.error)) {
    result = await run(`${QUESTION_SELECT_NO_RELATED}, projects(id, slug, title)`);
  }
  if (result.error && isMissingPrompt(result.error)) {
    result = await run(withProjectNoPrompt);
  }
  if (result.error && isMissingCloseNote(result.error)) {
    result = await run(withProjectNoClose);
  }
  if (
    result.error &&
    /projects|relationship|embed/i.test(result.error.message || '')
  ) {
    result = await run(QUESTION_SELECT);
    if (result.error && isMissingPrompt(result.error)) {
      result = await run(QUESTION_SELECT_NO_PROMPT);
    }
    if (result.error && isMissingCloseNote(result.error)) {
      result = await run(QUESTION_SELECT_NO_CLOSE);
    }
  }

  if (result.error) {
    throwIfQuestionsMissing(result.error, 'Could not load open questions.');
  }

  const rows = questionId
    ? result.data
      ? [result.data]
      : []
    : result.data || [];

  const needsProject = rows.some((r) => r.project_id && !r.projects);
  if (needsProject) {
    const ids = [...new Set(rows.map((r) => r.project_id).filter(Boolean))];
    if (ids.length) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, slug, title')
        .in('id', ids);
      const map = {};
      for (const p of projects || []) map[p.id] = p;
      for (const r of rows) {
        if (!r.projects && map[r.project_id]) r.projects = map[r.project_id];
      }
    }
  }

  return rows;
}

async function hydrateQuestions(list, viewerUserId = null) {
  if (!list.length) return [];

  const qids = list.map((q) => q.id);
  let replyRes = await supabase
    .from('open_question_replies')
    .select(REPLY_SELECT)
    .in('question_id', qids)
    .order('created_at', { ascending: true });
  if (replyRes.error && isMissingMedia(replyRes.error)) {
    replyRes = await supabase
      .from('open_question_replies')
      .select(REPLY_SELECT_MIN)
      .in('question_id', qids)
      .order('created_at', { ascending: true });
  }
  if (replyRes.error) throw asUserError(replyRes.error, 'Could not load suggestions.');
  const replies = replyRes.data;

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
}

export const openQuestionsService = {
  async listForProject(projectId, { viewerUserId = null } = {}) {
    if (!projectId) return [];
    const list = await loadQuestionRows({ projectId });
    return hydrateQuestions(list, viewerUserId);
  },

  async listAll({ viewerUserId = null } = {}) {
    const list = await loadQuestionRows();
    return hydrateQuestions(list, viewerUserId);
  },

  async getById(questionId, { viewerUserId = null } = {}) {
    if (!questionId) return null;
    const list = await loadQuestionRows({ questionId });
    if (!list.length) return null;
    const [view] = await hydrateQuestions(list, viewerUserId);
    return view || null;
  },

  async listProjects() {
    const projects = await loadRelatedProjectOptions();
    return (projects || []).map((p) => ({
      id: p.id,
      slug: p.id,
      title: p.label,
      label: p.label,
    }));
  },

  async listScopes() {
    const projects = await this.listProjects();
    return {
      phases: QUESTION_RELATED_PHASES,
      projects: projects.map((p) => ({ id: p.slug || p.id, label: p.title })),
    };
  },

  async createQuestion(projectId, { title, body, prompt, relatedTo, imageUrls, closesAt } = {}, userId) {
    if (!userId) throw new Error('Sign in to ask a question.');
    const t = String(title || '').trim();
    if (t.length < OPEN_QUESTION_TITLE_MIN) {
      throw new Error(
        `Title needs at least ${OPEN_QUESTION_TITLE_MIN} characters.`
      );
    }
    if (t.length > OPEN_QUESTION_TITLE_MAX) {
      throw new Error(`Title must be ${OPEN_QUESTION_TITLE_MAX} characters or less.`);
    }
    const promptRow = prompt
      ? assertPromptFields(prompt)
      : emptyQuestionPrompt();
    const b = String(body || flattenQuestionPrompt(promptRow) || '')
      .trim()
      .slice(0, OPEN_QUESTION_BODY_MAX);
    const scope = normalizeQuestionScope(
      relatedTo != null ? relatedTo : projectId
    );
    let resolvedProjectId = null;
    if (scope && !isStudioStageKey(scope)) {
      const lookup = isUuid(scope) ? scope : null;
      let q = supabase.from('projects').select('id, slug');
      q = lookup ? q.eq('id', lookup) : q.eq('slug', scope);
      const { data: projectRow } = await q.maybeSingle();
      resolvedProjectId =
        projectRow?.id || (isUuid(projectId) ? projectId : null);
    }
    let closes = null;
    if (closesAt) {
      const ms = new Date(closesAt).getTime();
      if (Number.isFinite(ms)) closes = new Date(ms).toISOString();
    }
    const row = {
      project_id: resolvedProjectId,
      related_to: scope || null,
      created_by: userId,
      title: t,
      body: b || null,
      prompt: prompt ? promptRow : null,
      status: 'open',
      image_urls: parseImageUrls(imageUrls),
      closes_at: closes,
    };
    let { data, error } = await supabase
      .from('open_questions')
      .insert([row])
      .select(QUESTION_SELECT)
      .single();
    if (error && isMissingMedia(error)) {
      const { image_urls: _iu, closes_at: _ca, ...withoutMedia } = row;
      const retryMedia = await supabase
        .from('open_questions')
        .insert([withoutMedia])
        .select(QUESTION_SELECT_NO_RELATED)
        .single();
      data = retryMedia.data;
      error = retryMedia.error;
    }
    if (error && isMissingRelatedTo(error)) {
      const { related_to: _omitRelated, ...withoutRelated } = row;
      const retryRelated = await supabase
        .from('open_questions')
        .insert([withoutRelated])
        .select(QUESTION_SELECT_NO_RELATED)
        .single();
      data = retryRelated.data;
      error = retryRelated.error;
    }
    if (error && isMissingPrompt(error)) {
      const { prompt: _omit, ...withoutPrompt } = row;
      const retry = await supabase
        .from('open_questions')
        .insert([withoutPrompt])
        .select(QUESTION_SELECT_NO_PROMPT)
        .single();
      data = retry.data;
      error = retry.error;
    }
    if (error && isMissingCloseNote(error)) {
      const { prompt: _omit, ...withoutPrompt } = row;
      const retry = await supabase
        .from('open_questions')
        .insert([withoutPrompt])
        .select(QUESTION_SELECT_NO_CLOSE)
        .single();
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      if (isMissingPrompt(error)) {
        throw new Error(
          'Open Question prompts are not set up yet. Run supabase/sql/supabase_open_questions_prompt.sql in Supabase.'
        );
      }
      throw asUserError(error, 'Could not create the question.');
    }
    return assembleQuestion(data, [], await loadProfileMap([userId]), [], userId);
  },

  async updateQuestion(questionId, { title, body, prompt, imageUrls, closesAt } = {}) {
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
    let promptRow = null;
    if (prompt !== undefined) {
      promptRow = prompt ? assertPromptFields(prompt) : emptyQuestionPrompt();
      patch.prompt = prompt ? promptRow : null;
    }
    if (body !== undefined || promptRow) {
      const b = String(
        body !== undefined ? body : flattenQuestionPrompt(promptRow)
      )
        .trim()
        .slice(0, OPEN_QUESTION_BODY_MAX);
      patch.body = b || null;
    }
    if (imageUrls !== undefined) {
      patch.image_urls = parseImageUrls(imageUrls);
    }
    if (closesAt !== undefined) {
      if (!closesAt) patch.closes_at = null;
      else {
        const ms = new Date(closesAt).getTime();
        if (!Number.isFinite(ms)) throw new Error('Close time is not valid.');
        patch.closes_at = new Date(ms).toISOString();
      }
    }
    if (!Object.keys(patch).length) return null;
    let { data, error } = await supabase
      .from('open_questions')
      .update(patch)
      .eq('id', questionId)
      .select(QUESTION_SELECT)
      .single();
    if (error && isMissingPrompt(error)) {
      const { prompt: _omit, ...withoutPrompt } = patch;
      const retry = await supabase
        .from('open_questions')
        .update(withoutPrompt)
        .eq('id', questionId)
        .select(QUESTION_SELECT_NO_PROMPT)
        .single();
      data = retry.data;
      error = retry.error;
    }
    if (error && isMissingCloseNote(error)) {
      const { prompt: _omit, ...withoutPrompt } = patch;
      const retry = await supabase
        .from('open_questions')
        .update(withoutPrompt)
        .eq('id', questionId)
        .select(QUESTION_SELECT_NO_CLOSE)
        .single();
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      if (isMissingPrompt(error)) {
        throw new Error(
          'Open Question prompts are not set up yet. Run supabase/sql/supabase_open_questions_prompt.sql in Supabase.'
        );
      }
      throw asUserError(error, 'Could not update the question.');
    }
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
    if (!questionId || !replyId) throw new Error('Pick an answer.');
    const { data, error } = await supabase
      .from('open_questions')
      .update({ selected_reply_id: replyId })
      .eq('id', questionId)
      .select('id, selected_reply_id, status')
      .single();
    if (error) throw asUserError(error, 'Could not pick that answer.');
    return data;
  },

  pickSuggestion(questionId, replyId) {
    return this.adoptSuggestion(questionId, replyId);
  },

  async hideReply(replyId, hidden = true, note = '') {
    if (!replyId) throw new Error('Reply not found.');
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const text = String(note || '').trim();
    if (hidden) {
      if (text.length < OPEN_QUESTION_HIDE_NOTE_MIN) {
        throw new Error(
          `Add a short note (at least ${OPEN_QUESTION_HIDE_NOTE_MIN} characters) so the author knows why.`
        );
      }
      if (text.length > OPEN_QUESTION_HIDE_NOTE_MAX) {
        throw new Error('That note is too long.');
      }
    }
    const patch = hidden
      ? {
          hidden_at: new Date().toISOString(),
          hidden_by: user?.id || null,
          hidden_note: text,
        }
      : { hidden_at: null, hidden_by: null, hidden_note: null };
    const { data, error } = await supabase
      .from('open_question_replies')
      .update(patch)
      .eq('id', replyId)
      .select('id, hidden_at, hidden_note')
      .single();
    if (error) throw asUserError(error, 'Could not update that reply.');
    return data;
  },

  async listMyHiddenReplyNotices({ limit = 20 } = {}) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return [];
    const selectWithNote =
      'id, question_id, body, hidden_at, hidden_note';
    const selectMin = 'id, question_id, body, hidden_at';
    let { data, error } = await supabase
      .from('open_question_replies')
      .select(selectWithNote)
      .eq('user_id', user.id)
      .not('hidden_at', 'is', null)
      .order('hidden_at', { ascending: false })
      .limit(limit);
    if (error && /hidden_note/i.test(error.message || '')) {
      const retry = await supabase
        .from('open_question_replies')
        .select(selectMin)
        .eq('user_id', user.id)
        .not('hidden_at', 'is', null)
        .order('hidden_at', { ascending: false })
        .limit(limit);
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      console.warn('[openQuestions] hidden notices', error.message);
      return [];
    }
    const rows = data || [];
    const qids = [...new Set(rows.map((r) => r.question_id).filter(Boolean))];
    const titles = {};
    if (qids.length) {
      const { data: questions } = await supabase
        .from('open_questions')
        .select('id, title')
        .in('id', qids);
      for (const q of questions || []) titles[q.id] = q.title;
    }
    return rows.map((row) => {
      const note = String(row.hidden_note || '').trim();
      return {
        id: `oqhide:${row.id}`,
        replyId: row.id,
        questionId: row.question_id,
        href: `/questions/${row.question_id}/answers/${row.id}`,
        title: titles[row.question_id] || 'Open Question',
        message:
          note ||
          'Staff hid this reply as off-brief. Open the post to read the note.',
        createdAt: row.hidden_at,
        kind: 'oqhide',
      };
    });
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

  async postReply({ questionId, userId, body, parentId = null, imageUrls = [] }) {
    if (!userId) throw new Error('Sign in to reply.');
    const text = String(body || '').trim();
    if (text.length < OPEN_QUESTION_REPLY_MIN) {
      throw new Error('Write a bit more before posting.');
    }
    if (text.length > OPEN_QUESTION_REPLY_MAX) {
      throw new Error('That reply is too long.');
    }
    let { data, error } = await supabase
      .from('open_question_replies')
      .insert([
        {
          question_id: questionId,
          user_id: userId,
          body: text,
          parent_id: parentId || null,
          image_urls: parentId ? [] : parseImageUrls(imageUrls),
        },
      ])
      .select(REPLY_SELECT)
      .single();
    if (error && isMissingMedia(error)) {
      const retry = await supabase
        .from('open_question_replies')
        .insert([
          {
            question_id: questionId,
            user_id: userId,
            body: text,
            parent_id: parentId || null,
          },
        ])
        .select(REPLY_SELECT_MIN)
        .single();
      data = retry.data;
      error = retry.error;
    }
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

  async uploadQuestionImage(file, userId) {
    if (!file) return null;
    if (!userId) throw new Error('Sign in to upload an image.');
    if (!QUESTION_IMAGE_TYPES.includes(file.type)) {
      throw new Error('Image must be JPEG, PNG, WebP, or GIF.');
    }
    if (file.size > QUESTION_IMAGE_MAX_BYTES) {
      throw new Error('Image must be under 5MB.');
    }
    const ext =
      (file.name && file.name.split('.').pop()?.toLowerCase()) ||
      (file.type === 'image/png' ? 'png' : 'jpg');
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)
      ? ext
      : 'jpg';
    const path = `${userId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}.${safeExt}`;
    const { error: upErr } = await supabase.storage
      .from(QUESTION_IMAGE_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });
    if (upErr) {
      if (/bucket|not found|does not exist/i.test(upErr.message || '')) {
        throw new Error(
          'Image storage is not set up. Run supabase/sql/supabase_open_questions_media.sql.'
        );
      }
      throw upErr;
    }
    const { data } = supabase.storage
      .from(QUESTION_IMAGE_BUCKET)
      .getPublicUrl(path);
    return data?.publicUrl || null;
  },

  async uploadQuestionImages(files, userId) {
    const urls = [];
    for (const file of files || []) {
      const url = await this.uploadQuestionImage(file, userId);
      if (url) urls.push(url);
    }
    return urls;
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
