/**
 * Per-route page titles and descriptions (browser tab, history, search).
 * Matched by longest path prefix, so "/ideas/123" inherits "/ideas".
 */

export const SITE_NAME = 'Together Forge';

export const DEFAULT_DESCRIPTION =
  'Together Forge is a community-supported indie game studio building cooperative games in the open. Share ideas, claim real work, and see how support is used.';

/** @type {Array<[string, { title: string, description?: string }]>} */
const ROUTES = [
  ['/about', { title: 'About', description: 'Who we are, why Together Forge exists, and where the studio is headed.' }],
  ['/ideas/submit', { title: 'Submit an Idea' }],
  ['/ideas/wizard', { title: 'Idea Wizard' }],
  ['/ideas', { title: 'Ideas', description: 'Community game ideas, mechanics, and systems. Vote, comment, and pitch your own.' }],
  ['/questions', { title: 'Open Questions', description: 'Design questions the studio is working through with the community.' }],
  ['/polls', { title: 'Polls', description: 'Vote on decisions that shape Together Forge games.' }],
  ['/projects/early', { title: 'Early Game Projects', description: 'Smaller cooperative games built with the community.' }],
  ['/projects/mid', { title: 'Mid Game', description: 'The next stage: larger cooperative games built with the community.' }],
  ['/projects/late', { title: 'Late Game', description: 'The long-term dream: a community-shaped MMORPG.' }],
  ['/projects/tether', { title: 'Tether', description: 'Tether is the active Together Forge project: a co-op game about a crew linked by a shared energy tether. Follow progress and claim tasks.' }],
  ['/projects', { title: 'Projects', description: 'The Together Forge roadmap from Early Game to Late Game, and the project in active development.' }],
  ['/open-work', { title: 'Open Work', description: 'Tasks that are open to claim right now.' }],
  ['/task-boards', { title: 'Open Work' }],
  ['/contributors', { title: 'Contributors', description: 'The people who have built Together Forge games and the studio.' }],
  ['/get-involved', { title: 'Get Involved', description: 'Ways to help: game development, ideas and feedback, content, moderation, and supporting the studio.' }],
  ['/demos', { title: 'Mechanic Lab' }],
  ['/mechanic-lab', { title: 'Mechanic Lab' }],
  ['/how-it-works', { title: 'How It Works', description: 'How ideas become tasks, tasks become games, and contributors get credit.' }],
  ['/media', { title: 'Media', description: 'Official Together Forge videos and updates.' }],
  ['/videos', { title: 'Media' }],
  ['/showcase', { title: 'Community Showcase', description: 'Work shared by the Together Forge community.' }],
  ['/released', { title: 'Released Games', description: 'Games shipped by Together Forge and its community.' }],
  ['/education', { title: 'Education & Apprenticeships', description: 'Learn game development by working on real projects.' }],
  ['/apprenticeships', { title: 'Education & Apprenticeships' }],
  ['/faq', { title: 'FAQ', description: 'Answers to common questions about Together Forge.' }],
  ['/bugs/report', { title: 'Report a Bug' }],
  ['/report-bug', { title: 'Report a Bug' }],
  ['/bugs', { title: 'Bug Tracker', description: 'Known website bugs and their status.' }],
  ['/report-a-concern', { title: 'Report a Concern' }],
  ['/report-concern', { title: 'Report a Concern' }],
  ['/suggestions', { title: 'Platform Suggestions', description: 'Suggest improvements to the Together Forge website.' }],
  ['/platform-suggestions', { title: 'Platform Suggestions' }],
  ['/donate', { title: 'Support the Studio', description: 'Support Together Forge and see exactly how contributions are used.' }],
  ['/support-runway', { title: 'Founder Runway' }],
  ['/support', { title: 'Support the Studio' }],
  ['/donations', { title: 'Support the Studio' }],
  ['/badges', { title: 'Badges', description: 'Badges earned by contributing, supporting, and taking part.' }],
  ['/achievements', { title: 'Badges' }],
  ['/contact', { title: 'Contact' }],
  ['/terms', { title: 'Terms of Service' }],
  ['/privacy', { title: 'Privacy Policy' }],
  ['/guidelines', { title: 'Community Guidelines' }],
  ['/community-guidelines', { title: 'Community Guidelines' }],
  ['/code-of-conduct', { title: 'Community Guidelines' }],
  ['/payments', { title: 'Payments & Refunds' }],
  ['/transparency', { title: 'Transparency', description: 'Studio finances, decisions, and expenses, published in the open.' }],
  ['/founders-thoughts', { title: "Founder's Thoughts" }],
  ['/moderator', { title: 'Moderator Dashboard' }],
  ['/dashboard', { title: 'Dashboard' }],
  ['/account', { title: 'Account' }],
  ['/profile', { title: 'Profile' }],
  ['/u', { title: 'Profile' }],
  ['/confirm-email', { title: 'Confirm Email' }],
  ['/reset-password', { title: 'Reset Password' }],
];

/**
 * @param {string} pathname
 * @returns {{ title: string, description: string }}
 */
export function getRouteMeta(pathname) {
  const path = String(pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
  if (path === '/') return { title: '', description: DEFAULT_DESCRIPTION };
  let best = null;
  let bestLen = -1;
  for (const [prefix, meta] of ROUTES) {
    if (
      (path === prefix || path.startsWith(`${prefix}/`)) &&
      prefix.length > bestLen
    ) {
      best = meta;
      bestLen = prefix.length;
    }
  }
  return {
    title: best?.title || '',
    description: best?.description || DEFAULT_DESCRIPTION,
  };
}
