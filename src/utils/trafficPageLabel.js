/**
 * English names for first-party traffic paths.
 */

import { ACCOUNT_SECTIONS } from '../constants/accountSections';
import { ideaLinkMeta } from './ideaStatus';
import { sanitizeTrafficPath } from './trafficPath';

const EXACT = {
  '/': 'Home',
  '/about': 'About',
  '/ideas': 'Ideas',
  '/ideas/submit': 'Submit Idea',
  '/ideas/wizard': 'Idea Wizard',
  '/projects': 'Projects',
  '/open-work': 'Open Work',
  '/task-boards': 'Open Work',
  '/projects/early': 'Early Game',
  '/projects/edit': 'Edit Projects',
  '/projects/early/edit': 'Edit Early Projects',
  '/projects/mid': 'Mid Game',
  '/projects/late': 'Late Game',
  '/projects/tether': 'Tether',
  '/contributors': 'Contributors',
  '/contributors/all': 'All Contributors',
  '/get-involved': 'Get Involved',
  '/demos': 'Mechanic Lab',
  '/mechanic-lab': 'Mechanic Lab',
  '/how-it-works': 'How It Works',
  '/media': 'Media',
  '/media/edit': 'Official Media',
  '/videos': 'Media',
  '/showcase': 'Showcase',
  '/showcase/submit': 'Submit Showcase',
  '/showcase/moderate': 'Showcase Moderation',
  '/released': 'Released Games',
  '/education': 'Education',
  '/apprenticeships': 'Education',
  '/faq': 'FAQ',
  '/bugs': 'Bug Tracker',
  '/bugs/report': 'Report a Bug',
  '/report-bug': 'Report a Bug',
  '/report-a-concern': 'Report a Concern',
  '/report-concern': 'Report a Concern',
  '/suggestions': 'Suggestions',
  '/platform-suggestions': 'Suggestions',
  '/donate': 'Donate',
  '/support': 'Donate',
  '/donations': 'Donate',
  '/badges': 'Badges',
  '/achievements': 'Badges',
  '/contact': 'Contact',
  '/terms': 'Terms of Service',
  '/privacy': 'Privacy Policy',
  '/guidelines': 'Community Guidelines',
  '/payments': 'Payments',
  '/payments-and-refunds': 'Payments',
  '/community-guidelines': 'Community Guidelines',
  '/code-of-conduct': 'Community Guidelines',
  '/transparency': 'Transparency',
  '/founders-thoughts': 'Founders Thoughts',
  '/support-runway': 'Founder Runway',
  '/moderator': 'Moderator Dashboard',
  '/dashboard': 'Dashboard',
  '/account': 'Account',
  '/profile': 'Account',
  '/profile/edit': 'Edit Profile',
  '/confirm-email': 'Confirm Email',
  '/reset-password': 'Reset Password',
};

const ACCOUNT_LABELS = Object.fromEntries(
  ACCOUNT_SECTIONS.map((s) => [s.id, s.label])
);

const PATTERNS = [
  [/^\/ideas\/[^/]+\/edit$/, 'Edit Idea'],
  [/^\/ideas\/[^/]+$/, 'Idea'],
  [/^\/projects\/early\/[^/]+$/, 'Early Project'],
  [/^\/projects\/[^/]+\/contributors$/, 'Project Contributors'],
  [/^\/projects\/[^/]+\/board\/staging$/, 'Staging Board'],
  [/^\/projects\/[^/]+\/board$/, 'Task Board'],
  [/^\/projects\/[^/]+$/, 'Project'],
  [/^\/released\/[^/]+$/, 'Released Game'],
  [/^\/u\/[^/]+$/, 'Profile'],
  [/^\/profile\/[^/]+$/, 'Profile'],
];

function titleCaseSegment(seg) {
  const raw = String(seg || '');
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  return decoded
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function trafficPageLabel(path) {
  return classifyTrafficPath(path).label;
}

/**
 * Break a path into a display label + merge group.
 * Dynamic idea/profile URLs share one group so the list stays finite.
 */
export function classifyTrafficPath(path) {
  const p = sanitizeTrafficPath(path);
  if (EXACT[p]) {
    return {
      path: p,
      label: EXACT[p],
      group: `label:${EXACT[p]}`,
      kind: 'page',
      entityId: null,
    };
  }

  const account = p.match(/^\/account\/([^/]+)$/);
  if (account) {
    const label = ACCOUNT_LABELS[account[1]] || 'Account';
    return {
      path: p,
      label,
      group: `label:${label}`,
      kind: 'page',
      entityId: account[1],
    };
  }

  if (p === '/ideas/:id/edit' || /^\/ideas\/[^/]+\/edit$/.test(p)) {
    return {
      path: p,
      label: 'Edit Idea',
      group: 'idea-edit',
      kind: 'idea-edit',
      entityId: null,
    };
  }

  if (
    p === '/ideas/:id' ||
    (/^\/ideas\/[^/]+$/.test(p) && !['/ideas/submit', '/ideas/wizard'].includes(p))
  ) {
    return {
      path: p,
      label: 'Idea posts',
      group: 'idea',
      kind: 'idea',
      entityId: null,
    };
  }

  if (
    p === '/u/:username' ||
    p === '/profile/:username' ||
    /^\/u\/[^/]+$/.test(p) ||
    (/^\/profile\/[^/]+$/.test(p) && p !== '/profile/edit')
  ) {
    return {
      path: p,
      label: 'Profiles',
      group: 'profile',
      kind: 'profile',
      entityId: null,
    };
  }

  if (p === '/released/:slug' || /^\/released\/[^/]+$/.test(p)) {
    return {
      path: p,
      label: 'Released games',
      group: 'released',
      kind: 'released',
      entityId: null,
    };
  }

  const project = p.match(/^\/projects\/([^/]+)$/);
  if (project) {
    const meta = ideaLinkMeta(project[1]);
    const label = meta.name || 'Project';
    return {
      path: p,
      label,
      group: meta.isStage ? `stage:${label}` : `project:${project[1]}`,
      kind: meta.isStage ? 'stage' : 'project',
      entityId: project[1],
    };
  }

  for (let i = 0; i < PATTERNS.length; i += 1) {
    const [re, label] = PATTERNS[i];
    if (re.test(p)) {
      return {
        path: p,
        label,
        group: `label:${label}`,
        kind: 'page',
        entityId: null,
      };
    }
  }

  const parts = p.split('/').filter(Boolean);
  const label = parts.length
    ? titleCaseSegment(parts[parts.length - 1]) || 'Page'
    : 'Home';
  return {
    path: p,
    label,
    group: `label:${label}`,
    kind: 'page',
    entityId: null,
  };
}

/**
 * Collapse unbounded URLs (every idea post, profile, etc.) into one row
 * per page type so the Pages list stays finite.
 *
 * @param {Array<{ path?: string, pageviews?: number, uniquePages?: number }>} rows
 */
export function mergeTrafficPages(rows) {
  const buckets = new Map();
  const list = Array.isArray(rows) ? rows : [];
  for (let i = 0; i < list.length; i += 1) {
    const row = list[i];
    const info = classifyTrafficPath(row?.path || '/');
    const extraUnique = Math.max(1, Number(row?.uniquePages) || 1);
    const prev = buckets.get(info.group) || {
      label: info.label,
      group: info.group,
      pageviews: 0,
      uniquePages: 0,
    };
    prev.pageviews += Math.max(0, Number(row?.pageviews) || 0);
    prev.uniquePages += extraUnique;
    buckets.set(info.group, prev);
  }
  return [...buckets.values()].sort(
    (a, b) => b.pageviews - a.pageviews || a.label.localeCompare(b.label)
  );
}
