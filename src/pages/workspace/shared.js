/**
 * Shared constants and small helpers for the project workspace page and its sections.
 */

import { TETHER_SLUG } from '../../utils/ideaStatus';
import { STAFF_ONLY_TASK_MESSAGE, STAGING_TASK_CLAIM_MESSAGE } from '../../services/tasksService';

// ---------------------------------------------------------------------------
// Fallback copy when projects table has no matching slug yet
// ---------------------------------------------------------------------------

export const FALLBACK_PROJECTS = {
  tether: {
    slug: 'tether',
    title: 'Tether',
    phase: 'Early',
    status: 'In Development',
    description:
      'A tethered crew crosses dangerous semi-procedural levels to reach a destroyed orbital station. Linked by a shared energy tether, players must coordinate movement, manage tension and momentum, collect critical resources for their stranded colony, and ultimately recover an antimatter generator that will let the colony survive on its own. Teamwork tools grow stronger when used together, while simple enemies try to break the tether. The tone is serious and the stakes are real: the people waiting below are counting on the crew.',
  },
  'core-features': {
    slug: 'core-features',
    title: 'Mid Game Ambitions',
    phase: 'Mid',
    status: 'Planning',
    description:
      'Next up after Early is completed: cooperative games at the scale of Halo, Horizon Zero Dawn, and Skyrim, with deeper systems, dynamic worlds, and stronger teamwork. Not open for claims yet.',
  },
  'polish-playtests': {
    slug: 'polish-playtests',
    title: 'Stability & Polish',
    phase: 'Late',
    status: 'Vision',
    description:
      'Polish passes, optimization, and wider playtests. Help stress-test builds and report what breaks - or what delights.',
  },
};

export const DEFAULT_PROJECT = {
  slug: 'unknown',
  title: 'Community Project',
  phase: 'Early',
  status: 'In Development',
  description:
    'A collaborative Together Forge project. Claim tasks, ship wins, and help shape the build with the community.',
};

FALLBACK_PROJECTS['prototype-systems'] = FALLBACK_PROJECTS[TETHER_SLUG];

export const IDEA_CATEGORIES = [
  'Full Game Idea',
  'Game Mechanic',
  'Setting / Story / Lore',
  'Art / Visual Design',
  'Audio / Sound / Music',
  'Multiplayer / Cooperative Systems',
  'Twitch / Streamer Integration',
  'Progression / Economy / Crafting',
  'Enemy / AI / Combat',
  'World Building / Environment',
  'Other',
];

export const mapWorkspaceIdea = (idea) => ({
  id: idea.id,
  title: idea.title,
  summary: idea.summary || idea.description || '',
  description: idea.description || '',
  votes: idea.votes || 0,
  category: idea.category || 'Idea',
  tags: idea.tags || null,
  created_at: idea.created_at || null,
  createdAt: idea.created_at || null,
  lastVoteTime: idea.last_vote_time || idea.lastVoteTime || null,
  project_id: idea.project_id || null,
  projectId: idea.project_id || null,
  user_id: idea.user_id || null,
  commentCount: idea.commentCount || 0,
  submitter: idea.creator?.username || 'Member',
  creator: idea.creator || {
    username: 'Member',
    avatar_url: null,
    avatarUrl: null,
  },
});

/** Main kanban columns (side-by-side). Review + Completed are collapsible rows below. */
export const KANBAN_COLUMNS = [
  {
    key: 'todo',
    label: 'To Do',
    accent: 'border-neon-cyan/40',
    header: 'text-neon-cyan',
    dot: 'bg-neon-cyan',
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    accent: 'border-neon-magenta/40',
    header: 'text-neon-magenta',
    dot: 'bg-neon-magenta',
  },
];

export const REVIEW_COLUMN = {
  key: 'in_review',
  label: 'Ready for Review',
  accent: 'border-semantic-warning/40',
  header: 'text-semantic-warning',
  dot: 'bg-semantic-warning',
};

export const COMPLETED_COLUMN = {
  key: 'completed',
  label: 'Completed',
  accent: 'border-semantic-success/40',
  header: 'text-semantic-success',
  dot: 'bg-semantic-success',
};

export const TASK_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

/** Max optional checklist steps per task (staff create/edit form). */
export const MAX_CHECKLIST_STEPS = 20;

export const EMPTY_TASK_FORM = {
  title: '',
  description: '',
  category: 'Code',
  difficulty: 'Medium',
  estimatedEffort: '',
  subtaskLines: [''],
  parentTaskId: null,
  /** Task ids this task is blocked by (all must be Completed to unlock) */
  blockedByTaskIds: [],
  /** Staff: allow claim while blockers incomplete */
  dependencyOverride: false,
  /** Staff: volunteers can view but cannot claim */
  staffOnly: false,
  /** Staff: skip 14/30-day auto-release on this card */
  holdClaim: false,
};

export const fieldLabelClass =
  'block text-sm font-mono tracking-widest text-neon-cyan mb-2';

export const fieldControlClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors';

export function parseSubtaskLines(lines) {
  return (lines || [])
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .map((label, i) => ({
      id: `s${i + 1}`,
      label,
      done: false,
    }));
}

export function friendlyError(err) {
  const msg = err?.message || String(err || 'Something went wrong');
  if (err?.code === 'IDENTITY_GATE' || /IDENTITY_GATE/i.test(msg)) {
    return msg.replace(/^IDENTITY_GATE:\s*/i, '');
  }
  if (err?.code === 'CLAIM_RESTRICTED' || /CLAIM_RESTRICTED/i.test(msg)) {
    return msg.replace(/^CLAIM_RESTRICTED:\s*/i, '');
  }
  if (err?.code === 'TASK_LOCKED' || /TASK_LOCKED|Locked – waiting on/i.test(msg)) {
    return msg.replace(/^TASK_LOCKED:\s*/i, '');
  }
  if (err?.code === 'STAFF_ONLY' || /STAFF_ONLY/i.test(msg)) {
    return msg.replace(/^STAFF_ONLY:\s*/i, '') || STAFF_ONLY_TASK_MESSAGE;
  }
  if (err?.code === 'STAGING_TASK' || /STAGING_TASK/i.test(msg)) {
    return msg.replace(/^STAGING_TASK:\s*/i, '') || STAGING_TASK_CLAIM_MESSAGE;
  }
  if (
    err?.code === 'SUBMIT_LIMIT' ||
    err?.code === 'SUBMIT_COOLDOWN' ||
    /SUBMIT_LIMIT|SUBMIT_COOLDOWN/i.test(msg)
  ) {
    return msg.replace(/^(SUBMIT_LIMIT|SUBMIT_COOLDOWN):\s*/i, '');
  }
  if (
    err?.code === 'EVIDENCE_LINK_REQUIRED' ||
    err?.code === 'EVIDENCE_LINK_INVALID' ||
    err?.code === 'EVIDENCE_REQUIRED'
  ) {
    return msg;
  }
  if (/JWT|not authenticated|sign in/i.test(msg)) {
    return 'Sign in to claim tasks and track progress.';
  }
  if (/already claimed/i.test(msg)) {
    return 'Someone already claimed that task. Pick another!';
  }
  if (/already completed/i.test(msg)) return 'That task is already complete.';
  if (/No active claim/i.test(msg)) return 'No active claim on this task.';
  if (/active tasks|CLAIM_LIMIT|claim limit|before claiming/i.test(msg)) {
    return msg;
  }
  if (/Only the claimant/i.test(msg)) {
    return 'Only the claimant or a project lead can do that.';
  }
  if (/relation .* does not exist|Could not find the table/i.test(msg)) {
    return 'Task tables are not set up yet. Run supabase/sql/supabase_tasks_schema.sql in the Supabase SQL Editor.';
  }
  if (/Maximum nesting|hierarchy|parent_task|Epic|sub-task|cannot be claimed|calculated from completed/i.test(msg)) {
    return msg;
  }
  if (/do not hold an active claim|Claim it before/i.test(msg)) {
    return 'Claim this task first before saving progress or checklist items.';
  }
  if (/already have a pending|already helping|already requested/i.test(msg)) {
    return msg;
  }
  return msg;
}
