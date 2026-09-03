/**
 * Staff Grant Credit categories → memorial ledger buckets.
 * Public lists still use development / marketing / community.
 */

export const STAFF_CREDIT_PUBLIC_MAX = 160;
export const STAFF_CREDIT_NOTE_MAX = 500;

export const STAFF_CREDIT_CATEGORIES = [
  {
    id: 'community_moderation',
    label: 'Community moderation',
    category: 'community',
    subcategory: 'Moderation',
  },
  {
    id: 'playtest',
    label: 'Playtest',
    category: 'community',
    subcategory: 'Playtesting',
  },
  {
    id: 'content',
    label: 'Content',
    category: 'marketing',
    subcategory: 'Content Creation',
  },
  {
    id: 'documentation',
    label: 'Documentation',
    category: 'development',
    subcategory: 'Writing',
  },
  {
    id: 'offsite_development',
    label: 'Off-site development',
    category: 'development',
    subcategory: 'Other',
  },
  {
    id: 'organizing',
    label: 'Organizing',
    category: 'community',
    subcategory: 'Organizing',
  },
  {
    id: 'other',
    label: 'Other',
    category: 'community',
    subcategory: 'Other',
  },
];

export const STAFF_CREDIT_STUDIO_ID = 'studio';
export const STAFF_CREDIT_SOURCE_PREFIX = 'staff-credit:';
export const STAFF_CREDIT_PENDING_LABEL = 'Pending account';
export const STAFF_CREDIT_SOURCE_LABEL = 'Staff credited';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function looksLikeEmail(value) {
  return EMAIL_RE.test(String(value || '').trim().toLowerCase());
}

export function staffCreditCategoryById(id) {
  return (
    STAFF_CREDIT_CATEGORIES.find((c) => c.id === id) ||
    STAFF_CREDIT_CATEGORIES[STAFF_CREDIT_CATEGORIES.length - 1]
  );
}

export function isStaffCreditSourceKey(key) {
  return String(key || '').startsWith(STAFF_CREDIT_SOURCE_PREFIX);
}

export function staffCreditSourceKey(grantId) {
  const id = String(grantId || '').trim();
  return id ? `${STAFF_CREDIT_SOURCE_PREFIX}${id}` : '';
}

export function staffCreditGrantIdFromSourceKey(key) {
  const raw = String(key || '');
  if (!raw.startsWith(STAFF_CREDIT_SOURCE_PREFIX)) return null;
  const id = raw.slice(STAFF_CREDIT_SOURCE_PREFIX.length).trim();
  return id || null;
}

/** Public name for a memorial / grant row. Never returns an email. */
export function staffCreditPublicName(row) {
  if (!row) return STAFF_CREDIT_PENDING_LABEL;
  if (row.userId || row.username) {
    return row.username || row.displayName || 'Contributor';
  }
  const line = String(row.roleLabel || row.publicLine || row.displayName || '').trim();
  return line || STAFF_CREDIT_PENDING_LABEL;
}

export function isPendingStaffCredit(row) {
  if (!row) return false;
  if (row.pendingAccount === true) return true;
  return isStaffCreditSourceKey(row.sourceKey) && !row.userId;
}

/**
 * Public contributor lists include bound accounts and pending staff credits.
 * Never include donation rows or guest names that are not staff-credit.
 */
export function shouldListOnProjectContributors(row) {
  if (!row) return false;
  if (row.category === 'donations') return false;
  if (row.userId) return true;
  return isStaffCreditSourceKey(row.sourceKey);
}

/** Fields that must never appear on public contributor / profile views. */
export const STAFF_CREDIT_PRIVATE_FIELDS = [
  'pendingEmail',
  'pending_email',
  'privateNote',
  'private_note',
  'revokeReason',
  'revoke_reason',
  'email',
];

export function stripStaffCreditPrivateFields(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  for (const key of STAFF_CREDIT_PRIVATE_FIELDS) {
    if (key in out) delete out[key];
  }
  return out;
}

export function isDuplicateStaffCreditGrant(existing, candidate) {
  if (!existing || !candidate) return false;
  if (existing.revokedAt || existing.revoked_at) return false;
  const sameUser =
    existing.userId && candidate.userId
      ? existing.userId === candidate.userId
      : false;
  const sameEmail =
    !sameUser &&
    (existing.pendingEmailHash || existing.pending_email_hash) &&
    (candidate.pendingEmailHash || candidate.pending_email_hash)
      ? String(existing.pendingEmailHash || existing.pending_email_hash) ===
        String(candidate.pendingEmailHash || candidate.pending_email_hash)
      : false;
  if (!sameUser && !sameEmail) return false;
  const aProject = existing.projectId || existing.project_id || null;
  const bProject = candidate.projectId || candidate.project_id || null;
  if (aProject !== bProject) return false;
  const aCat = existing.grantCategory || existing.grant_category;
  const bCat = candidate.grantCategory || candidate.grant_category;
  if (aCat !== bCat) return false;
  const aLine = String(existing.publicLine || existing.public_line || '')
    .trim()
    .toLowerCase();
  const bLine = String(candidate.publicLine || candidate.public_line || '')
    .trim()
    .toLowerCase();
  return aLine === bLine && aLine.length > 0;
}
