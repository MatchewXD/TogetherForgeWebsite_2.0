/**
 * Static credit categories for Project Contributors pages.
 * Keep static for now (not data-driven). Same keys feed Released Games later.
 */

/** Top-level sections in display order */
export const CONTRIBUTION_CATEGORIES = [
  {
    id: 'donations',
    title: 'Donations',
    description:
      'Community support that funds tools, hosting, and independent development.',
    accountRequired: false,
    subcategories: [],
  },
  {
    id: 'development',
    title: 'Development',
    description: 'People who built systems, art, design, and playable work.',
    accountRequired: true,
    subcategories: [
      'Art',
      'Coding',
      'Models',
      'Server Design',
      'Design',
      'Audio',
      'Writing',
      'QA / Testing',
      'Other',
    ],
  },
  {
    id: 'marketing',
    title: 'Marketing / Content',
    description: 'Creators who help the forge grow in public.',
    accountRequired: true,
    subcategories: [
      'Content Creation',
      'Social Media',
      'Video',
      'Community Outreach',
      'Other',
    ],
  },
  {
    id: 'community',
    title: 'Community & Support',
    description: 'Moderation, playtests, feedback, and day-to-day care.',
    accountRequired: true,
    subcategories: ['Moderation', 'Playtesting', 'Feedback', 'Other'],
  },
];

/** Map task board categories → development subcategories */
export const TASK_CATEGORY_TO_DEV_SUB = {
  code: 'Coding',
  coding: 'Coding',
  art: 'Art',
  'art / visual design': 'Art',
  design: 'Design',
  models: 'Models',
  model: 'Models',
  audio: 'Audio',
  sound: 'Audio',
  writing: 'Writing',
  qa: 'QA / Testing',
  testing: 'QA / Testing',
  'qa / testing': 'QA / Testing',
  server: 'Server Design',
  'server design': 'Server Design',
};

export function mapTaskCategoryToDevSub(category) {
  if (!category) return 'Other';
  const key = String(category).trim().toLowerCase();
  return TASK_CATEGORY_TO_DEV_SUB[key] || 'Other';
}
