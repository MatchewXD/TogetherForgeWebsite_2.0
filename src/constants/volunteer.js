/**
 * Volunteer funnel content for Get Involved.
 * Open Needs and roles are public product copy; applications stay private.
 */

/** Skill areas for Volunteer Your Skills / applications */
export const VOLUNTEER_SKILL_OPTIONS = [
  { id: 'documentation', label: 'Documentation' },
  { id: 'translations', label: 'Translations' },
  { id: 'tooling', label: 'Tooling / tech' },
  { id: 'testing', label: 'Testing' },
  { id: 'marketing', label: 'Marketing assets' },
  { id: 'design', label: 'Design' },
  { id: 'video', label: 'Video / editing' },
  { id: 'moderation', label: 'Moderation' },
  { id: 'outreach', label: 'Outreach' },
  { id: 'game_dev', label: 'Game development' },
  { id: 'ideas', label: 'Ideas & feedback' },
  { id: 'other', label: 'Other' },
];

export const TIME_COMMITMENT_OPTIONS = [
  { id: 'few_hours_week', label: 'A few hours per week' },
  { id: 'few_hours_month', label: 'A few hours per month' },
  { id: 'project_based', label: 'Project-based / as needed' },
  { id: 'exploring', label: 'Just exploring for now' },
];

/**
 * What Community Moderators help with (public copy on Get Involved).
 * Framed as activities, not separate job titles.
 */
export const COMMUNITY_MODERATOR_ACTIVITIES = [
  'Greet newcomers, answer first questions, and point people toward the right path on the site and in Discord.',
  'Help read, tag, and surface strong ideas so discussion stays useful and fair.',
  'Keep conversations constructive on Discord and related threads, following the Community Guidelines.',
  'Match people to needs, follow up on skill offers, and help new helpers land useful work.',
  'Handle site reports, Showcase moderation, content flags, and other website-side care.',
];

/**
 * @deprecated Prefer COMMUNITY_MODERATOR_ACTIVITIES for public copy.
 * Kept for any staff tooling that still references role ids.
 */
export const COMMUNITY_MOD_ROLES = [
  {
    id: 'welcome_helper',
    title: 'Welcome / Onboarding Helper',
    summary: COMMUNITY_MODERATOR_ACTIVITIES[0],
  },
  {
    id: 'idea_reviewer',
    title: 'Idea Reviewer',
    summary: COMMUNITY_MODERATOR_ACTIVITIES[1],
  },
  {
    id: 'discussion_moderator',
    title: 'Discussion Moderator',
    summary: COMMUNITY_MODERATOR_ACTIVITIES[2],
  },
  {
    id: 'volunteer_coordinator',
    title: 'Volunteer Coordinator',
    summary: COMMUNITY_MODERATOR_ACTIVITIES[3],
  },
  {
    id: 'website_moderator',
    title: 'Website / Content Moderator',
    summary: COMMUNITY_MODERATOR_ACTIVITIES[4],
  },
];

/**
 * Optional short need tags for routing / staff labels (not a large public list).
 * Prefer the single “Volunteer Your Skills” CTA on Get Involved.
 */
export const OPEN_NEEDS = [
  {
    id: 'docs-onboarding',
    title: 'Onboarding docs & how-to guides',
    description:
      'Short, clear write-ups for claiming tasks, submitting ideas, and using the site. Great for people who like explaining systems.',
    skillIds: ['documentation'],
  },
  {
    id: 'translations',
    title: 'Translations for key pages',
    description:
      'Help make core pages (Get Involved, How it works, Guidelines) readable in other languages when we have native speakers available.',
    skillIds: ['translations'],
  },
  {
    id: 'qa-testing',
    title: 'Playtest & bug triage helpers',
    description:
      'Reproduce bugs, write clear reports, and smoke-test claim/submit flows on staging and live boards.',
    skillIds: ['testing'],
  },
  {
    id: 'creators-youtube',
    title: 'Content Creators Team (official YouTube)',
    description:
      'Help plan, shoot, edit, or thumbnail official Together Forge channel videos and playlists. Volunteer with public credit for now.',
    skillIds: ['video', 'marketing', 'design'],
  },
  {
    id: 'mod-team',
    title: 'Community & site moderators',
    description:
      'We are building a small trusted group across welcome help, idea review, discussion, coordination, and website moderation.',
    skillIds: ['moderation'],
    roleFocus: true,
  },
  {
    id: 'tooling',
    title: 'Lightweight tooling & site helpers',
    description:
      'Scripts, checklists, or small site improvements that make volunteer work smoother (not always full feature builds).',
    skillIds: ['tooling'],
  },
];

export const APPLICATION_TYPES = {
  skill_offer: 'skill_offer',
  moderation_role: 'moderation_role',
  open_need: 'open_need',
};
