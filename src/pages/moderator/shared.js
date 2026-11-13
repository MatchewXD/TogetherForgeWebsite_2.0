/**
 * Shared labels, formatters and small UI bits for the Moderator Dashboard tabs.
 */

import {
  Activity,
  Users,
  Scale,
  Handshake,
  Award,
  Lightbulb,
  MessageSquare,
  BarChart3,
  Tags,
  ScrollText,
  Receipt,
  SplitSquareVertical,
  Ban,
  Flag,
  Bug,
  TriangleAlert,
  LayoutGrid,
  ClipboardList,
  Mail,
  UserCog,
} from 'lucide-react';
import {
  COMMUNITY_MOD_ROLES,
  OPEN_NEEDS,
  VOLUNTEER_SKILL_OPTIONS,
  TIME_COMMITMENT_OPTIONS,
} from '../../constants/volunteer';

export const TABS = [
  { id: 'traffic', label: 'Traffic', icon: Activity },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'conduct', label: 'Conduct', icon: Scale },
  { id: 'volunteers', label: 'Volunteers', icon: Handshake },
  { id: 'credit', label: 'Grant Credit', icon: Award },
  { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  { id: 'suggestions', label: 'Suggestions', icon: MessageSquare },
  { id: 'polls', label: 'Polls', icon: BarChart3 },
  { id: 'tags', label: 'Tags', icon: Tags },
  { id: 'decisions', label: 'Decision logs', icon: ScrollText },
  { id: 'expenses', label: 'Studio expenses', icon: Receipt },
  { id: 'scope', label: 'Scope help', icon: SplitSquareVertical },
  { id: 'restrictions', label: 'Claim restrict', icon: Ban },
  { id: 'reports', label: 'Reports', icon: Flag },
  { id: 'bugs', label: 'Bugs', icon: Bug },
  { id: 'errors', label: 'Site errors', icon: TriangleAlert },
  { id: 'showcase', label: 'Showcase', icon: LayoutGrid },
  { id: 'suggested', label: 'Suggested tasks', icon: ClipboardList },
];

export const CONCERNS_TAB = { id: 'concerns', label: 'Concerns', icon: Mail };

export const ROLES_TAB = { id: 'roles', label: 'Role Management', icon: UserCog };

export const ALL_TABS = [...TABS, CONCERNS_TAB, ROLES_TAB];

export const SCOPE_RESOLUTION_LABELS = {
  breakdown: 'Broken into sub-tasks',
  promoted: 'Promoted / re-parented',
  adjusted: 'Adjusted in place',
  kept: 'Clarified / keep as-is',
  other: 'Other',
};

export const filterControl =
  'w-full min-w-0 bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-cyan';

export const filterLabel =
  'block text-[10px] font-mono tracking-widest uppercase text-text-muted mb-1';

export function volunteerTypeLabel(type) {
  if (type === 'moderation_role') return 'Community moderator';
  if (type === 'open_need') return 'Open need';
  return 'Skill offer';
}

export function volunteerRoleLabel(roleId) {
  return COMMUNITY_MOD_ROLES.find((r) => r.id === roleId)?.title || roleId || '';
}

export function volunteerNeedLabel(needId) {
  return OPEN_NEEDS.find((n) => n.id === needId)?.title || needId || '';
}

export function volunteerSkillLabel(id) {
  return VOLUNTEER_SKILL_OPTIONS.find((s) => s.id === id)?.label || id;
}

export function volunteerTimeLabel(id) {
  return TIME_COMMITMENT_OPTIONS.find((t) => t.id === id)?.label || id || '';
}

export const formatDate = (iso) => {
  if (!iso) return 'n/a';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'n/a';
  }
};

export const formatDateTime = (iso) => {
  if (!iso) return 'n/a';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'n/a';
  }
};

export function joinTime(u) {
  const t = Date.parse(u?.joined_at || u?.created_at || '');
  return Number.isFinite(t) ? t : 0;
}

export function ideaTime(idea) {
  const t = Date.parse(idea?.created_at || '');
  return Number.isFinite(t) ? t : 0;
}
