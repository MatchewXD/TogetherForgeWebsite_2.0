/**
 * Staff Conduct: reports, cases, notices, strikes, restrictions.
 * Public profiles and Contributor lists never show this data.
 */

export const CONDUCT_EMAIL = 'conduct@togetherforge.net';
export const CONDUCT_STRIKE_RESTRICT_DAYS = 14;

export const CONDUCT_REASONS = [
  {
    id: 'off_brief',
    label: 'Off-brief / does not match project documents',
    firstDeclineNoStrike: true,
  },
  {
    id: 'political_branding',
    label:
      'Real-world political slogans, parties, campaigns, or movement branding in project content',
    firstDeclineNoStrike: true,
  },
  {
    id: 'harassment',
    label: 'Harassment or threats',
    firstDeclineNoStrike: false,
  },
  {
    id: 'brigading',
    label: 'Brigading or coordinated pressure',
    firstDeclineNoStrike: false,
  },
  {
    id: 'spam',
    label: 'Spam or scams',
    firstDeclineNoStrike: false,
  },
  {
    id: 'impersonation',
    label: 'Impersonation',
    firstDeclineNoStrike: false,
  },
  {
    id: 'other_coc',
    label: 'Other Code of Conduct violation',
    firstDeclineNoStrike: false,
  },
];

export const CONDUCT_REASON_IDS = CONDUCT_REASONS.map((r) => r.id);

export function conductReasonById(id) {
  return CONDUCT_REASONS.find((r) => r.id === id) || CONDUCT_REASONS[CONDUCT_REASONS.length - 1];
}

export function isFirstDeclineReason(id) {
  return Boolean(conductReasonById(id)?.firstDeclineNoStrike);
}

export const CONDUCT_CONTENT_TYPES = [
  { id: 'task', label: 'Task submission' },
  { id: 'task_comment', label: 'Task comment' },
  { id: 'idea', label: 'Idea' },
  { id: 'idea_comment', label: 'Idea comment' },
  { id: 'showcase', label: 'Showcase / media' },
  { id: 'profile', label: 'Profile or display name' },
  { id: 'user', label: 'User conduct' },
];

export function conductContentLabel(id) {
  return CONDUCT_CONTENT_TYPES.find((t) => t.id === id)?.label || 'content';
}

export const CONDUCT_STATUSES = [
  { id: 'open', label: 'Open' },
  { id: 'needs_info', label: 'Needs more info' },
  { id: 'action_taken', label: 'Action taken' },
  { id: 'dismissed', label: 'Dismissed' },
  { id: 'disputed', label: 'Disputed' },
  { id: 'closed', label: 'Closed' },
];

export const CONDUCT_OPEN_STATUSES = ['open', 'needs_info', 'disputed'];

export function conductStatusLabel(id) {
  return CONDUCT_STATUSES.find((s) => s.id === id)?.label || id;
}

export const CONDUCT_SOURCES = [
  { id: 'member_report', label: 'Member report' },
  { id: 'staff', label: 'Staff' },
];

export const CONDUCT_ACTIONS = [
  { id: 'dismiss', label: 'Dismiss' },
  { id: 'decline_content', label: 'Decline or remove the content' },
  { id: 'notify_cite', label: 'Notify and cite' },
  { id: 'warn', label: 'Warn' },
  { id: 'strike', label: 'Strike' },
  { id: 'restrict', label: 'Restrict' },
  { id: 'suspend', label: 'Suspend' },
  { id: 'ban', label: 'Ban' },
  { id: 'unban', label: 'Unban' },
  { id: 'lift_strike', label: 'Lift a strike' },
  { id: 'lift_restriction', label: 'Lift restrictions' },
  { id: 'mark_disputed', label: 'Mark disputed' },
  { id: 'note', label: 'Staff note' },
];

export function conductActionLabel(id) {
  return CONDUCT_ACTIONS.find((a) => a.id === id)?.label || id;
}

export const CONDUCT_PRIVATE_FIELDS = [
  'reporterId',
  'reporter_id',
  'reporterUsername',
  'staffNotes',
  'staff_notes',
  'linkedAccountsNote',
  'linked_accounts_note',
  'noisyReporter',
  'privateNote',
];

export function stripConductPrivateFields(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  for (const key of CONDUCT_PRIVATE_FIELDS) {
    if (key in out) delete out[key];
  }
  return out;
}

export function strikeNextStep(count) {
  const n = Number(count) || 0;
  if (n <= 1) {
    return 'The next similar violation can add a second strike and a temporary block on new task claims.';
  }
  if (n === 2) {
    return 'The next similar violation can lead to suspension or a ban.';
  }
  return 'Staff may suspend or ban this account.';
}

/**
 * Calm in-site / email notice. No slogans, no culture-war language.
 */
export function buildConductNotice({
  contentLabel = 'submission',
  projectName = '',
  documentName = 'the Code of Conduct',
  caseCode = '',
  addedStrike = false,
  strikeCount = 0,
  firstDecline = false,
  extra = '',
} = {}) {
  const where = projectName ? ` on ${projectName}` : '';
  const parts = [
    `Your ${contentLabel}${where} was declined because it does not match ${documentName}. Together Forge only ships work that fits the published project brief.`,
  ];
  if (firstDecline && !addedStrike) {
    parts.push('This is a first decline with no strike.');
  }
  if (addedStrike) {
    const n = Number(strikeCount) || 1;
    parts.push(
      `A strike was added. You now have ${n} strike${n === 1 ? '' : 's'}. ${strikeNextStep(n)}`
    );
  }
  if (extra) parts.push(String(extra).trim());
  parts.push(
    `This decision is recorded on your account. If you want it reviewed, email ${CONDUCT_EMAIL} and include this case ID: ${caseCode || '(pending)'}.`
  );
  return parts.join(' ');
}

export function requiresConfirm(actions = []) {
  return actions.some((a) =>
    ['suspend', 'ban', 'decline_content'].includes(a)
  );
}

export function shouldBlockFirstStrike({ reasonId, priorNotice, skipReason }) {
  if (!isFirstDeclineReason(reasonId)) return false;
  if (priorNotice) return false;
  return !String(skipReason || '').trim();
}
