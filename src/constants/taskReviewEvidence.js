/**
 * Category-aware guidance for Submit for Review evidence.
 * Together Forge Task Board = claim / track / credit.
 * GitHub (or Drive/Figma/etc.) = where the work lives.
 */

import { normalizeTaskCategoryKey } from './taskCategories';

const DEFAULT_HINT =
  'Link to wherever the work can be reviewed (GitHub, Drive, Figma, Discord, etc.).';

/** Link-field hints (section 2). Code strongly prefers GitHub PR/branch/commit. */
const LINK_HINTS = {
  code: 'Preferred: GitHub pull request, branch, or commit URL. That is the permanent technical record reviewers open first.',
  coding:
    'Preferred: GitHub pull request, branch, or commit URL. That is the permanent technical record reviewers open first.',
  art: 'Link to images, folders, or tools (Drive, Discord, ArtStation, etc.) so a reviewer can see the deliverable.',
  design:
    'Link to Figma, prototypes, or design docs so a reviewer can open the latest version.',
  audio:
    'Link to playable files or the folder where audio assets live (Drive, repo path, Discord).',
  sound:
    'Link to playable files or the folder where audio assets live (Drive, repo path, Discord).',
  writing:
    'Link to the document (Google Doc, PR with markdown, Notion, etc.) or the file location.',
  'level design':
    'Link to screenshots, video, map files, or a PR that contains the level content.',
  leveldesign:
    'Link to screenshots, video, map files, or a PR that contains the level content.',
  qa: 'Link to a bug report, video, or issue tracker entry with repro steps when possible.',
  testing:
    'Link to a bug report, video, or issue tracker entry with repro steps when possible.',
  other: DEFAULT_HINT,
};

/** Description-field hints (section 1) — no URLs here. */
const NOTE_HINTS = {
  code: 'Summarize what changed and how a reviewer can test it. Put the PR/branch URL in Evidence links, not here.',
  coding:
    'Summarize what changed and how a reviewer can test it. Put the PR/branch URL in Evidence links, not here.',
  art: 'Describe what was delivered (asset type, style notes, where it should land in the game).',
  design:
    'Describe the design outcome and any decisions a reviewer should know before opening the files.',
  writing: 'Summarize scope (which pages/dialogue) and tone notes for the reviewer.',
  audio: 'Note format, length, and how to preview the audio.',
  qa: 'Summarize expected vs actual results; attach repro links below.',
  other:
    'Describe what you finished in plain language. Put proof links in the next section.',
};

/**
 * Categories where GitHub is the primary home for work.
 * @param {string|null|undefined} category
 */
export function isCodeLikeCategory(category) {
  const key = normalizeTaskCategoryKey(category);
  return key === 'code' || key === 'coding';
}

/**
 * @param {string|null|undefined} category
 * @returns {string}
 */
export function getReviewEvidenceHint(category) {
  const key = normalizeTaskCategoryKey(category);
  if (!key) return DEFAULT_HINT;
  return LINK_HINTS[key] || LINK_HINTS[key.replace(/\s+/g, '')] || DEFAULT_HINT;
}

/**
 * Helper for the “What you delivered” description field only.
 * @param {string|null|undefined} category
 */
export function getReviewNoteHint(category) {
  const key = normalizeTaskCategoryKey(category);
  if (!key) return NOTE_HINTS.other;
  return NOTE_HINTS[key] || NOTE_HINTS[key.replace(/\s+/g, '')] || NOTE_HINTS.other;
}

/**
 * Placeholder for the first evidence link input.
 * @param {string|null|undefined} category
 */
export function getReviewLinkPlaceholder(category) {
  if (isCodeLikeCategory(category)) {
    return 'https://github.com/org/repo/pull/123';
  }
  return 'https://…';
}

/**
 * Short workflow line for claim / submit UI.
 * @param {string|null|undefined} category
 * @param {{ githubUrl?: string|null }} [opts]
 */
export function getContributionWorkflowSteps(category, opts = {}) {
  const code = isCodeLikeCategory(category);
  const hasRepo = Boolean(opts.githubUrl);
  return [
    'Claim this task on Together Forge',
    code
      ? hasRepo
        ? 'Do the work on GitHub (branch / PR in the project repo)'
        : 'Do the work on GitHub (PR, branch, or commit)'
      : 'Do the work in the right tool (files, Figma, docs, etc.)',
    code
      ? 'Submit for review with a clear note + GitHub PR/branch link'
      : 'Submit for review with a clear note + proof link',
    'Get credit here when a Project Lead accepts',
  ];
}

/**
 * Build the final evidence string for the API (note + links + dependency).
 * @param {{ note: string, links?: string[], dependsOn?: string }} parts
 */
export function composeReviewEvidence({ note, links = [], dependsOn = '' }) {
  const sections = [];
  const body = String(note || '').trim();
  if (body) sections.push(body);

  const cleanLinks = (links || [])
    .map((l) => String(l || '').trim())
    .filter(Boolean);
  if (cleanLinks.length) {
    sections.push(
      ['Links:', ...cleanLinks.map((url) => `- ${url}`)].join('\n')
    );
  }

  const dep = String(dependsOn || '').trim();
  if (dep) {
    sections.push(`Blocked by / depends on:\n${dep}`);
  }

  // Reserved for future attachments (upload slots) — keep section shape stable
  // sections.push('Attachments:\n(none)');

  return sections.join('\n\n').trim();
}

/** Minimum length for the free-text evidence note (not counting links alone). */
export const REVIEW_EVIDENCE_MIN_CHARS = 15;

/**
 * Light URL check — real enough for volunteers, not a full parser.
 * Accepts http(s) URLs with a host (optionally missing scheme if domain-like).
 * @param {string} raw
 * @returns {boolean}
 */
export function isValidEvidenceUrl(raw) {
  const s = String(raw || '').trim();
  if (!s || s.length > 2048) return false;
  // Reject obvious placeholders
  if (/^(https?:\/\/)?(example\.com|localhost|127\.0\.0\.1)/i.test(s)) {
    // Allow example.com in tests/docs? Product: block pure localhost as spam
    if (/localhost|127\.0\.0\.1/i.test(s)) return false;
  }
  let candidate = s;
  if (!/^https?:\/\//i.test(candidate)) {
    // Bare domain/path — only accept if it looks like host.tld/...
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+([/:?#].*)?$/i.test(candidate)) {
      return false;
    }
    candidate = `https://${candidate}`;
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (!u.hostname || !u.hostname.includes('.')) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize a volunteer-entered link to include https:// when possible.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeEvidenceUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (isValidEvidenceUrl(s)) return `https://${s}`;
  return s;
}

/**
 * True if URL looks like a GitHub PR, commit, branch, compare, or repo path.
 * Soft signal for guidance (not a hard gate).
 * @param {string} raw
 */
export function isGithubEvidenceUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return false;
  try {
    const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const u = new URL(withScheme);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    if (host !== 'github.com' && host !== 'gist.github.com') return false;
    return u.pathname.length > 1;
  } catch {
    return false;
  }
}

/**
 * Extract ordered GitHub URLs from free-text evidence (for cards / future Discord).
 * @param {string} evidenceText
 * @returns {string[]}
 */
export function extractGithubUrlsFromEvidence(evidenceText) {
  const text = String(evidenceText || '');
  const re = /https?:\/\/(?:www\.)?github\.com\/[^\s<>"')\]]+/gi;
  const found = text.match(re) || [];
  return [...new Set(found.map((u) => u.replace(/[.,;:]+$/g, '')))];
}

/**
 * Client-side evidence package validation (note min length + ≥1 valid URL).
 * Hard rules unchanged for anti-abuse. Soft warning for code tasks without GitHub.
 * @param {{ note: string, links?: string[], category?: string }} parts
 * @returns {{ ok: true, warning?: string } | { ok: false, code: string, message: string }}
 */
export function validateReviewEvidencePackage({
  note,
  links = [],
  category,
} = {}) {
  const body = String(note || '').trim();
  if (body.length < REVIEW_EVIDENCE_MIN_CHARS) {
    return {
      ok: false,
      code: 'EVIDENCE_REQUIRED',
      message: `Add a short evidence note (at least ${REVIEW_EVIDENCE_MIN_CHARS} characters) describing what you delivered.`,
    };
  }
  const cleanLinks = (links || [])
    .map((l) => String(l || '').trim())
    .filter(Boolean);
  if (cleanLinks.length === 0) {
    return {
      ok: false,
      code: 'EVIDENCE_LINK_REQUIRED',
      message: isCodeLikeCategory(category)
        ? 'Add at least one evidence link — for Code tasks, prefer a GitHub PR, branch, or commit URL.'
        : 'Add at least one evidence link (URL) so a reviewer can verify your work.',
    };
  }
  const invalid = cleanLinks.find((l) => !isValidEvidenceUrl(l));
  if (invalid) {
    return {
      ok: false,
      code: 'EVIDENCE_LINK_INVALID',
      message: isCodeLikeCategory(category)
        ? 'One or more links look invalid. For Code tasks use a full https://github.com/… PR, branch, or commit URL.'
        : 'One or more links look invalid. Use a full URL starting with https:// (e.g. a PR, Drive folder, or Discord message link).',
    };
  }

  // Soft guidance only — still allow Drive/Figma if that is all they have
  if (
    isCodeLikeCategory(category) &&
    !cleanLinks.some((l) => isGithubEvidenceUrl(l))
  ) {
    return {
      ok: true,
      warning:
        'Tip: Code tasks review fastest with a GitHub PR, branch, or commit link. You can still submit other links if needed.',
    };
  }

  return { ok: true };
}
