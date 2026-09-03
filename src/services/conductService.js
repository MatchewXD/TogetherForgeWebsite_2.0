/**
 * Staff Conduct cases, member reports, and the target user's own notices.
 * Tables/RPCs: supabase/sql/supabase_conduct.sql
 */

import { supabase } from '../lib/supabase';
import { asUserError, isMissingRpcError } from '../utils/abuseErrors';
import {
  CONDUCT_EMAIL,
  buildConductNotice,
  conductContentLabel,
  conductReasonById,
  isFirstDeclineReason,
  shouldBlockFirstStrike,
} from '../constants/conduct';

const MISSING_SQL =
  'Conduct is not installed yet. Run supabase/sql/supabase_conduct.sql in the Supabase SQL Editor.';

function isMissingTable(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || error.details || '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /does not exist|schema cache|could not find the table/i.test(msg)
  );
}

export function isConductMissing(error) {
  return isMissingTable(error) || isMissingRpcError(error);
}

function conductError(error, fallback) {
  const raw = String(error?.message || error?.details || error?.hint || '');
  if (isConductMissing(error)) {
    const err = new Error(MISSING_SQL);
    err.code = 'MISSING_SQL';
    err.cause = error;
    return err;
  }
  if (/STAFF_ONLY/i.test(raw)) {
    return new Error('Only staff and moderators can do that.');
  }
  if (/FIRST_OFF_BRIEF_NO_STRIKE/i.test(raw)) {
    return new Error(
      'A first off-brief miss is a content action, not a strike. Cite the document, or record why you are skipping the ladder.'
    );
  }
  if (/CONDUCT_RESTRICTED/i.test(raw)) {
    return new Error(
      'This account cannot do that right now. Check Account → Notices for details.'
    );
  }
  if (
    /SIGN_IN_REQUIRED|Pick a reason|Pick what|too long|Case not found|cannot open a conduct/i.test(
      raw
    )
  ) {
    return new Error(raw.replace(/^ERROR:\s*/i, '').split('\n')[0]);
  }
  return asUserError(error, fallback);
}

function mapCase(row) {
  if (!row) return null;
  const target = row.target || row.profiles || null;
  const reporter = row.reporter || null;
  const project = row.project || null;
  return {
    id: row.id,
    caseCode: row.case_code,
    targetUserId: row.target_user_id,
    targetUsername: target?.username || null,
    targetAvatarUrl: target?.avatar_url || null,
    projectId: row.project_id,
    projectTitle: project?.title || null,
    projectSlug: project?.slug || null,
    contentType: row.content_type,
    contentId: row.content_id,
    contentPath: row.content_path,
    source: row.source,
    reasonCode: row.reason_code,
    details: row.details || null,
    reporterId: row.reporter_id || null,
    reporterUsername: reporter?.username || null,
    status: row.status,
    citedDocument: row.cited_document || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
  };
}

const CASE_SELECT = `
  id, case_code, target_user_id, project_id, content_type, content_id,
  content_path, source, reason_code, details, reporter_id, status,
  cited_document, created_at, updated_at, closed_at,
  target:target_user_id ( id, username, avatar_url ),
  reporter:reporter_id ( username ),
  project:project_id ( id, title, slug )
`;

export async function submitConductReport(input) {
  try {
    const { data, error } = await supabase.rpc('submit_conduct_report', {
      p_content_type: input.contentType,
      p_content_id: input.contentId || null,
      p_target_user_id: input.targetUserId || null,
      p_project_id: input.projectId || null,
      p_content_path: input.contentPath || null,
      p_reason_code: input.reasonCode,
      p_details: input.details || null,
    });
    if (error) throw error;
    return data;
  } catch (error) {
    throw conductError(error, 'Could not send the report.');
  }
}

export async function openConductCase(input) {
  try {
    const { data, error } = await supabase.rpc('open_conduct_case', {
      p_target_user_id: input.targetUserId,
      p_content_type: input.contentType || 'user',
      p_content_id: input.contentId || null,
      p_project_id: input.projectId || null,
      p_content_path: input.contentPath || null,
      p_reason_code: input.reasonCode || 'other_coc',
      p_details: input.details || null,
      p_cited_document: input.citedDocument || null,
    });
    if (error) throw error;
    return data;
  } catch (error) {
    throw conductError(error, 'Could not open a conduct case.');
  }
}

export async function listConductCases({
  status = 'open',
  targetUserId = null,
  limit = 80,
} = {}) {
  try {
    let req = supabase
      .from('conduct_cases')
      .select(CASE_SELECT)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (status === 'queue') {
      req = req.in('status', ['open', 'needs_info', 'disputed']);
    } else if (status && status !== 'all') {
      req = req.eq('status', status);
    }
    if (targetUserId) req = req.eq('target_user_id', targetUserId);
    const { data, error } = await req;
    if (error) throw error;
    return (data || []).map(mapCase).filter(Boolean);
  } catch (error) {
    throw conductError(error, 'Could not load conduct cases.');
  }
}

export async function getConductCase(id) {
  try {
    const { data, error } = await supabase
      .from('conduct_cases')
      .select(CASE_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const mapped = mapCase(data);
    const [notes, audit, account] = await Promise.all([
      supabase
        .from('conduct_notes')
        .select('id, body, created_at, author_id, author:author_id ( username )')
        .eq('case_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('conduct_audit')
        .select(
          'id, action, reason_code, payload, created_at, actor_id, actor:actor_id ( username )'
        )
        .eq('case_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('conduct_account_state')
        .select(
          'strike_count, last_cite_reason, last_cite_at, last_strike_at, noisy_reporter, linked_accounts_note, restrict_claims_until, restrict_ideas_until, restrict_comments_until, restrict_showcase_until, restrict_claims_permanent, restrict_ideas_permanent, restrict_comments_permanent, restrict_showcase_permanent, suspended_until, banned_at'
        )
        .eq('user_id', mapped.targetUserId)
        .maybeSingle(),
    ]);
    mapped.notes = (notes.data || []).map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.created_at,
      authorUsername: n.author?.username || null,
    }));
    mapped.audit = (audit.data || []).map((a) => ({
      id: a.id,
      action: a.action,
      reasonCode: a.reason_code,
      payload: a.payload,
      createdAt: a.created_at,
      actorUsername: a.actor?.username || null,
    }));
    mapped.account = account.data
      ? {
          strikeCount: Number(account.data.strike_count) || 0,
          lastCiteReason: account.data.last_cite_reason,
          lastCiteAt: account.data.last_cite_at,
          lastStrikeAt: account.data.last_strike_at,
          noisyReporter: Boolean(account.data.noisy_reporter),
          linkedAccountsNote: account.data.linked_accounts_note || '',
          restrictClaimsUntil: account.data.restrict_claims_until,
          restrictIdeasUntil: account.data.restrict_ideas_until,
          restrictCommentsUntil: account.data.restrict_comments_until,
          restrictShowcaseUntil: account.data.restrict_showcase_until,
          restrictClaimsPermanent: Boolean(account.data.restrict_claims_permanent),
          restrictIdeasPermanent: Boolean(account.data.restrict_ideas_permanent),
          restrictCommentsPermanent: Boolean(
            account.data.restrict_comments_permanent
          ),
          restrictShowcasePermanent: Boolean(
            account.data.restrict_showcase_permanent
          ),
          suspendedUntil: account.data.suspended_until,
          bannedAt: account.data.banned_at,
        }
      : { strikeCount: 0 };
    mapped.priorNotice = Boolean(
      mapped.account.lastCiteAt || mapped.account.strikeCount
    );
    return mapped;
  } catch (error) {
    throw conductError(error, 'Could not load the case.');
  }
}

export async function listAccountConductHistory(userId) {
  return listConductCases({ status: 'all', targetUserId: userId, limit: 100 });
}

export function previewConductNotice(caseRow, { addedStrike, firstDecline } = {}) {
  return buildConductNotice({
    contentLabel: conductContentLabel(caseRow.contentType).toLowerCase(),
    projectName: caseRow.projectTitle || '',
    documentName: caseRow.citedDocument || 'the Code of Conduct',
    caseCode: caseRow.caseCode,
    addedStrike: Boolean(addedStrike),
    strikeCount:
      (Number(caseRow.account?.strikeCount) || 0) + (addedStrike ? 1 : 0),
    firstDecline: Boolean(firstDecline),
  });
}

export async function applyConductReview(caseRow, form) {
  const actions = form.actions || [];
  if (!actions.length) {
    throw new Error('Choose at least one outcome.');
  }
  if (
    actions.includes('strike') &&
    shouldBlockFirstStrike({
      reasonId: caseRow.reasonCode,
      priorNotice: caseRow.priorNotice,
      skipReason: form.skipLadderReason,
    })
  ) {
    throw new Error(
      'A first off-brief miss is a content action, not a strike. Cite the document, or record why you are skipping the ladder.'
    );
  }

  const payload = [];
  for (const type of actions) {
    if (type === 'restrict') {
      payload.push({
        type: 'restrict',
        claims: Boolean(form.restrictClaims),
        ideas: Boolean(form.restrictIdeas),
        comments: Boolean(form.restrictComments),
        showcase: Boolean(form.restrictShowcase),
        days: Number(form.restrictDays) || 14,
        permanent: Boolean(form.restrictPermanent),
      });
    } else if (type === 'suspend') {
      payload.push({ type: 'suspend', days: Number(form.suspendDays) || 7 });
    } else if (type === 'lift_strike') {
      payload.push({ type: 'lift_strike', reason: form.liftReason || '' });
    } else {
      payload.push({ type });
    }
  }

  const addedStrike = actions.includes('strike');
  const firstDecline =
    isFirstDeclineReason(caseRow.reasonCode) &&
    !caseRow.priorNotice &&
    !addedStrike;
  const notifyFinal = Boolean(form.notify);

  const noticeBody = notifyFinal
    ? form.noticeBody ||
      previewConductNotice(
        { ...caseRow, citedDocument: form.citedDocument || caseRow.citedDocument },
        { addedStrike, firstDecline }
      )
    : null;

  try {
    const { data, error } = await supabase.rpc('apply_conduct_review', {
      p_case_id: caseRow.id,
      p_actions: payload,
      p_status: form.status || null,
      p_cited_document: form.citedDocument ?? null,
      p_staff_note: form.staffNote || null,
      p_notice_body: noticeBody,
      p_notify: notifyFinal,
      p_skip_ladder_reason: form.skipLadderReason || null,
    });
    if (error) throw error;

    if (data?.noticeId || data?.authAction) {
      try {
        await supabase.functions.invoke('send-conduct-notice', {
          body: {
            noticeId: data.noticeId || null,
            authAction: data.authAction || null,
            targetUserId: data.targetUserId || caseRow.targetUserId,
          },
        });
      } catch (mailErr) {
        console.warn('[conduct] notice email', mailErr);
      }
    }
    return data;
  } catch (error) {
    throw conductError(error, 'Could not apply the review.');
  }
}

export async function addConductNote(caseId, body) {
  try {
    const { data, error } = await supabase.rpc('add_conduct_note', {
      p_case_id: caseId,
      p_body: body,
    });
    if (error) throw error;
    return data;
  } catch (error) {
    throw conductError(error, 'Could not save the note.');
  }
}

export async function setNoisyReporter(userId, noisy) {
  try {
    const { data, error } = await supabase.rpc('set_conduct_noisy_reporter', {
      p_user_id: userId,
      p_noisy: Boolean(noisy),
    });
    if (error) throw error;
    return data;
  } catch (error) {
    throw conductError(error, 'Could not update reporter flag.');
  }
}

export async function setLinkedAccountsNote(userId, note) {
  try {
    const { data, error } = await supabase.rpc('set_conduct_linked_accounts', {
      p_user_id: userId,
      p_note: note || '',
    });
    if (error) throw error;
    return data;
  } catch (error) {
    throw conductError(error, 'Could not save the private file note.');
  }
}

export async function getMyConductFile() {
  try {
    const { data, error } = await supabase.rpc('get_my_conduct_file');
    if (error) throw error;
    return data || { strikeCount: 0, notices: [], caseIds: [] };
  } catch (error) {
    if (isConductMissing(error)) {
      return { strikeCount: 0, notices: [], caseIds: [], missing: true };
    }
    throw conductError(error, 'Could not load notices.');
  }
}

export async function markNoticeRead(id) {
  try {
    await supabase.rpc('mark_conduct_notice_read', { p_id: id });
  } catch (error) {
    throw conductError(error, 'Could not mark the notice read.');
  }
}

export { CONDUCT_EMAIL, conductReasonById };
