/**
 * Badge / achievement catalog.
 * Keys must match public.sync_user_badges grants in supabase_badges.sql.
 */

/** @typedef {'status'|'donation'|'tasks'|'starter'|'impact'|'giving'|'collaboration'} BadgeCategory */

/**
 * @typedef {object} BadgeDef
 * @property {string} key
 * @property {BadgeCategory} category
 * @property {string} name
 * @property {string} description
 * @property {string} icon - lucide-style key used by BadgeIcon
 * @property {number|null} threshold - cents (donation) or count (tasks) or null
 */

export const DONATION_THRESHOLDS_DOLLARS = [
  10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000,
];

export const TASK_THRESHOLDS = [1, 5, 10, 25, 50, 75, 100, 150, 200, 250];

/**
 * Published recognition thresholds. Keep in sync with
 * supabase/sql/supabase_badges_recognition.sql.
 * Counts only; no hidden multipliers.
 */
export const BADGE_THRESHOLDS = {
  /** Comments shorter than this do not count as feedback. */
  meaningfulCommentChars: 20,
  discussionStarterComments: 10,
  deepDiscussionComments: 25,
  wellReceivedVotes: 15,
  wellReceivedAwards: 3,
  wellReceivedShowcaseLikes: 15,
  communityFavoriteAwards: 8,
  recognizedAwards: 5,
  respectedAwards: 15,
  distinguishedAwards: 40,
  talkOfTheForgeComments: 25,
  talkOfTheForgeAwards: 5,
  /** Matches idea heat “Hot”. */
  viralIdeaVotes: 100,
  generousMarks: 1000,
  patronMarks: 5000,
  commentatorComments: 10,
  activeVoiceComments: 50,
  supporterAwardsGiven: 1,
  supporterComments: 10,
  enthusiastAwardsGiven: 5,
  enthusiastComments: 25,
};

/** One-time custom amount → support tier_id */
export function mapCustomDonationTier(amountCents) {
  const cents = Number(amountCents) || 0;
  if (cents >= 5000) {
    return { tierId: 'builder', tierLabel: 'Builder' };
  }
  if (cents >= 2000) {
    return { tierId: 'member', tierLabel: 'Forge Member' };
  }
  if (cents >= 500) {
    return { tierId: 'supporter', tierLabel: 'Supporter' };
  }
  return { tierId: 'custom', tierLabel: 'Custom' };
}

/**
 * Monthly custom amount → MONTH_TIERS style brackets ($5 / $15 / $40).
 */
export function mapCustomMonthlyTier(amountCents) {
  const cents = Number(amountCents) || 0;
  if (cents >= 4000) {
    return { tierId: 'builder', tierLabel: 'Builder' };
  }
  if (cents >= 1500) {
    return { tierId: 'member', tierLabel: 'Forge Member' };
  }
  if (cents >= 500) {
    return { tierId: 'supporter', tierLabel: 'Supporter' };
  }
  return { tierId: 'custom', tierLabel: 'Custom' };
}

/**
 * Normalize tier for webhook/checkout: keep explicit supporter|member|builder;
 * map custom / missing by amount.
 */
export function resolveDonationTierMeta({
  tierId,
  tierLabel,
  amountCents,
  interval = 'once',
} = {}) {
  const id = String(tierId || '').toLowerCase().trim();
  if (id === 'supporter' || id === 'member' || id === 'builder') {
    return {
      tierId: id,
      tierLabel:
        tierLabel ||
        (id === 'member' ? 'Forge Member' : id.charAt(0).toUpperCase() + id.slice(1)),
    };
  }
  const mapped =
    String(interval || 'once').toLowerCase() === 'month'
      ? mapCustomMonthlyTier(amountCents)
      : mapCustomDonationTier(amountCents);
  return {
    tierId: mapped.tierId,
    tierLabel: tierLabel || mapped.tierLabel,
  };
}

function formatDollar(n) {
  return n.toLocaleString('en-US');
}

/**
 * Custom art under public/images/Badges/.
 * Explicit map when filenames differ (case / naming).
 * Conventions (auto-resolved if not listed):
 *   donation_N → {N}_donor.png
 *   tasks_N    → {N}_tasks.png  (except First Ship → first_Ship.png)
 */
export const BADGE_IMAGE_DIR = '/images/Badges';

/** @type {Record<string, string>} key → filename in BADGE_IMAGE_DIR */
export const BADGE_IMAGE_FILES = {
  status_active_subscriber: 'Active_Subscriber.png',
  status_donor: 'Donator.png',
  status_game_shipper: 'game_shipper.png',

  donation_10: '10_donor.png',
  donation_50: '50_donor.png',
  donation_100: '100_donor.png',
  donation_250: '250_donor.png',
  donation_500: '500_donor.png',
  donation_1000: '1000_donor.png',
  donation_2500: '2500_donor.png',
  donation_5000: '5000_donor.png',
  donation_10000: '10000_donor.png',
  donation_25000: '25000_donor.png',
  donation_50000: '50000_donor.png',
  donation_100000: '100000_donor.png',

  tasks_1: 'first_Ship.png',
  tasks_5: '5_tasks.png',
  tasks_10: '10_tasks.png',
  tasks_25: '25_tasks.png',
  tasks_50: '50_tasks.png',
  tasks_75: '75_tasks.png',
  tasks_100: '100_tasks.png',
  tasks_150: '150_tasks.png',
  tasks_200: '200_tasks.png',
  tasks_250: '250_tasks.png',
};

/**
 * Public URL for badge art, or null if we have no known asset yet.
 * Unlisted donation/task keys still try the naming convention; img onError
 * falls back to Lucide in BadgeIcon.
 * @param {string|null|undefined} key
 * @returns {string|null}
 */
export function getBadgeImageSrc(key) {
  if (!key) return null;
  const k = String(key);
  const file = BADGE_IMAGE_FILES[k];
  if (file) return `${BADGE_IMAGE_DIR}/${file}`;

  const donationMatch = /^donation_(\d+)$/.exec(k);
  if (donationMatch) {
    return `${BADGE_IMAGE_DIR}/${donationMatch[1]}_donor.png`;
  }
  const taskMatch = /^tasks_(\d+)$/.exec(k);
  if (taskMatch) {
    if (taskMatch[1] === '1') {
      return `${BADGE_IMAGE_DIR}/first_Ship.png`;
    }
    return `${BADGE_IMAGE_DIR}/${taskMatch[1]}_tasks.png`;
  }
  return null;
}

/** @type {BadgeDef[]} */
export const BADGE_CATALOG = [
  {
    key: 'status_active_subscriber',
    category: 'status',
    name: 'Active Subscriber',
    description: 'Hold an active monthly studio support subscription.',
    icon: 'spark',
    threshold: null,
  },
  {
    key: 'status_donor',
    category: 'status',
    name: 'Donor',
    description: 'Make at least one completed donation (one-time or subscription payment).',
    icon: 'heart',
    threshold: null,
  },
  {
    key: 'status_game_shipper',
    category: 'status',
    name: 'Game Shipper',
    description:
      'Be credited on a project when it reaches Released / Completed (task claims, contributions, or used ideas).',
    icon: 'ship',
    threshold: null,
  },
  ...DONATION_THRESHOLDS_DOLLARS.map((dollars) => ({
    key: `donation_${dollars}`,
    category: /** @type {BadgeCategory} */ ('donation'),
    name: `$${formatDollar(dollars)} Donor`,
    description: `Donate a lifetime total of $${formatDollar(dollars)} or more (all completed gifts).`,
    icon: dollars >= 10000 ? 'crown' : dollars >= 1000 ? 'gem' : 'coin',
    threshold: dollars * 100,
  })),
  ...TASK_THRESHOLDS.map((count) => ({
    key: `tasks_${count}`,
    category: /** @type {BadgeCategory} */ ('tasks'),
    name: count === 1 ? 'First Ship' : `${count} Tasks Shipped`,
    description:
      count === 1
        ? 'Complete your first accepted task claim.'
        : `Complete ${count} accepted task claims.`,
    icon: count >= 100 ? 'rocket' : count >= 25 ? 'flag' : 'check',
    threshold: count,
  })),
  {
    key: 'starter_first_idea',
    category: 'starter',
    name: 'First Idea',
    description: 'Submit your first public idea (not a draft).',
    icon: 'lightbulb',
    threshold: 1,
  },
  {
    key: 'starter_showcase',
    category: 'starter',
    name: 'Showcase',
    description: 'Submit your first Community Showcase post.',
    icon: 'image',
    threshold: 1,
  },
  {
    key: 'starter_first_feedback',
    category: 'starter',
    name: 'First Feedback',
    description: `Leave a meaningful comment (at least ${BADGE_THRESHOLDS.meaningfulCommentChars} characters) on someone else's idea.`,
    icon: 'message',
    threshold: 1,
  },
  {
    key: 'starter_task_claimed',
    category: 'starter',
    name: 'Task Claimed',
    description: 'Claim your first project task.',
    icon: 'flag',
    threshold: 1,
  },
  {
    key: 'starter_early_supporter',
    category: 'starter',
    name: 'Early Supporter',
    description:
      'Make a completed donation or hold a studio subscription while any official project is in Early phase. Permanent once earned.',
    icon: 'heart',
    threshold: null,
  },
  {
    key: 'impact_discussion_starter',
    category: 'impact',
    name: 'Discussion Starter',
    description: `One of your ideas receives ${BADGE_THRESHOLDS.discussionStarterComments}+ comments from other people.`,
    icon: 'megaphone',
    threshold: BADGE_THRESHOLDS.discussionStarterComments,
  },
  {
    key: 'impact_well_received',
    category: 'impact',
    name: 'Well Received',
    description: `One of your ideas reaches ${BADGE_THRESHOLDS.wellReceivedVotes}+ votes or ${BADGE_THRESHOLDS.wellReceivedAwards}+ awards, or one Showcase post reaches ${BADGE_THRESHOLDS.wellReceivedShowcaseLikes}+ likes or ${BADGE_THRESHOLDS.wellReceivedAwards}+ awards.`,
    icon: 'spark',
    threshold: BADGE_THRESHOLDS.wellReceivedVotes,
  },
  {
    key: 'impact_deep_discussion',
    category: 'impact',
    name: 'Deep Discussion',
    description: `One of your ideas receives ${BADGE_THRESHOLDS.deepDiscussionComments}+ comments from other people.`,
    icon: 'messages',
    threshold: BADGE_THRESHOLDS.deepDiscussionComments,
  },
  {
    key: 'impact_community_favorite',
    category: 'impact',
    name: 'Community Favorite',
    description: `One of your posts receives ${BADGE_THRESHOLDS.communityFavoriteAwards}+ community awards, or a Masterwork.`,
    icon: 'crown',
    threshold: BADGE_THRESHOLDS.communityFavoriteAwards,
  },
  {
    key: 'impact_awarded_idea',
    category: 'impact',
    name: 'Awarded Idea',
    description: 'One of your ideas receives at least one community award (Spark or higher).',
    icon: 'star',
    threshold: 1,
  },
  {
    key: 'impact_recognized',
    category: 'impact',
    name: 'Recognized',
    description: `Receive ${BADGE_THRESHOLDS.recognizedAwards}+ community awards across all of your posts.`,
    icon: 'trophy',
    threshold: BADGE_THRESHOLDS.recognizedAwards,
  },
  {
    key: 'impact_respected',
    category: 'impact',
    name: 'Respected',
    description: `Receive ${BADGE_THRESHOLDS.respectedAwards}+ community awards across all of your posts.`,
    icon: 'gem',
    threshold: BADGE_THRESHOLDS.respectedAwards,
  },
  {
    key: 'impact_distinguished',
    category: 'impact',
    name: 'Distinguished',
    description: `Receive ${BADGE_THRESHOLDS.distinguishedAwards}+ community awards across all of your posts.`,
    icon: 'crown',
    threshold: BADGE_THRESHOLDS.distinguishedAwards,
  },
  {
    key: 'impact_talk_of_the_forge',
    category: 'impact',
    name: 'Talk of the Forge',
    description: `One idea reaches ${BADGE_THRESHOLDS.talkOfTheForgeComments}+ comments from others and ${BADGE_THRESHOLDS.talkOfTheForgeAwards}+ community awards.`,
    icon: 'megaphone',
    threshold: null,
  },
  {
    key: 'impact_viral_idea',
    category: 'impact',
    name: 'Viral Idea',
    description: `One idea reaches ${BADGE_THRESHOLDS.viralIdeaVotes}+ votes (the same bar as Hot).`,
    icon: 'rocket',
    threshold: BADGE_THRESHOLDS.viralIdeaVotes,
  },
  {
    key: 'giving_first_spark',
    category: 'giving',
    name: 'First Spark Given',
    description: 'Place your first community award on someone else’s post.',
    icon: 'spark',
    threshold: 1,
  },
  {
    key: 'giving_generous',
    category: 'giving',
    name: 'Generous',
    description: `Spend ${BADGE_THRESHOLDS.generousMarks.toLocaleString()} Forge Marks placing community awards.`,
    icon: 'gift',
    threshold: BADGE_THRESHOLDS.generousMarks,
  },
  {
    key: 'giving_patron',
    category: 'giving',
    name: 'Patron',
    description: `Spend ${BADGE_THRESHOLDS.patronMarks.toLocaleString()} Forge Marks placing community awards.`,
    icon: 'gem',
    threshold: BADGE_THRESHOLDS.patronMarks,
  },
  {
    key: 'giving_commentator',
    category: 'giving',
    name: 'Commentator',
    description: `Leave ${BADGE_THRESHOLDS.commentatorComments}+ meaningful comments (${BADGE_THRESHOLDS.meaningfulCommentChars}+ characters each).`,
    icon: 'message',
    threshold: BADGE_THRESHOLDS.commentatorComments,
  },
  {
    key: 'giving_active_voice',
    category: 'giving',
    name: 'Active Voice',
    description: `Leave ${BADGE_THRESHOLDS.activeVoiceComments}+ meaningful comments.`,
    icon: 'megaphone',
    threshold: BADGE_THRESHOLDS.activeVoiceComments,
  },
  {
    key: 'giving_supporter',
    category: 'giving',
    name: 'Supporter',
    description: `Give at least one community award and leave ${BADGE_THRESHOLDS.supporterComments}+ meaningful comments.`,
    icon: 'heart',
    threshold: null,
  },
  {
    key: 'giving_enthusiast',
    category: 'giving',
    name: 'Enthusiast',
    description: `Give ${BADGE_THRESHOLDS.enthusiastAwardsGiven}+ community awards and leave ${BADGE_THRESHOLDS.enthusiastComments}+ meaningful comments.`,
    icon: 'flame',
    threshold: null,
  },
  {
    key: 'collab_joined_force',
    category: 'collaboration',
    name: 'Joined Force',
    description:
      'Claim a task on a project where at least one other person has also claimed work or holds a public credit.',
    icon: 'handshake',
    threshold: null,
  },
  {
    key: 'collab_shared_victory',
    category: 'collaboration',
    name: 'Shared Victory',
    description:
      'Complete a task on a released project that at least one other person also shipped or is credited on.',
    icon: 'users',
    threshold: null,
  },
];

const BY_KEY = Object.fromEntries(BADGE_CATALOG.map((b) => [b.key, b]));

export function getBadgeDef(key) {
  if (!key) return null;
  return BY_KEY[String(key)] || null;
}

export function listCatalogByCategory() {
  const order = [
    'status',
    'starter',
    'impact',
    'giving',
    'collaboration',
    'donation',
    'tasks',
  ];
  const labels = {
    status: 'Status',
    starter: 'Starter',
    impact: 'Impact',
    giving: 'Giving & Engagement',
    collaboration: 'Collaboration',
    donation: 'Donation milestones',
    tasks: 'Tasks shipped',
  };
  return order.map((category) => ({
    category,
    label: labels[category],
    badges: BADGE_CATALOG.filter((b) => b.category === category),
  }));
}

/** Stable display order matching the public catalog. */
export function sortBadgesByCatalog(badges = []) {
  const order = new Map(BADGE_CATALOG.map((b, i) => [b.key, i]));
  return [...(badges || [])].sort((a, b) => {
    const ia = order.has(a?.key) ? order.get(a.key) : 999;
    const ib = order.has(b?.key) ? order.get(b.key) : 999;
    if (ia !== ib) return ia - ib;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}

/** Keys that sync_user_badges would grant for given totals (for tests). */
export function expectedBadgeKeys({
  totalCents = 0,
  tasksCompleted = 0,
  hasActiveSub = false,
  hasShippedGame = false,
  publicIdeaCount = 0,
  showcaseSubmissions = 0,
  meaningfulFeedbackOnOthers = 0,
  taskClaims = 0,
  isEarlySupporter = false,
  maxIdeaCommentsByOthers = 0,
  maxIdeaVotes = 0,
  maxIdeaAwards = 0,
  maxIdeaMasterworks = 0,
  maxShowcaseLikes = 0,
  maxShowcaseAwards = 0,
  awardsReceived = 0,
  awardsGiven = 0,
  marksSpentOnAwards = 0,
  meaningfulComments = 0,
  hasJoinedForce = false,
  hasSharedVictory = false,
} = {}) {
  const t = BADGE_THRESHOLDS;
  const keys = [];
  if (totalCents > 0) keys.push('status_donor');
  if (hasActiveSub) keys.push('status_active_subscriber');
  if (hasShippedGame) keys.push('status_game_shipper');
  for (const d of DONATION_THRESHOLDS_DOLLARS) {
    if (totalCents >= d * 100) keys.push(`donation_${d}`);
  }
  for (const n of TASK_THRESHOLDS) {
    if (tasksCompleted >= n) keys.push(`tasks_${n}`);
  }

  if (publicIdeaCount >= 1) keys.push('starter_first_idea');
  if (showcaseSubmissions >= 1) keys.push('starter_showcase');
  if (meaningfulFeedbackOnOthers >= 1) keys.push('starter_first_feedback');
  if (taskClaims >= 1) keys.push('starter_task_claimed');
  if (isEarlySupporter) keys.push('starter_early_supporter');

  if (maxIdeaCommentsByOthers >= t.discussionStarterComments) {
    keys.push('impact_discussion_starter');
  }
  if (
    maxIdeaVotes >= t.wellReceivedVotes ||
    maxIdeaAwards >= t.wellReceivedAwards ||
    maxShowcaseLikes >= t.wellReceivedShowcaseLikes ||
    maxShowcaseAwards >= t.wellReceivedAwards
  ) {
    keys.push('impact_well_received');
  }
  if (maxIdeaCommentsByOthers >= t.deepDiscussionComments) {
    keys.push('impact_deep_discussion');
  }
  if (
    maxIdeaAwards >= t.communityFavoriteAwards ||
    maxShowcaseAwards >= t.communityFavoriteAwards ||
    maxIdeaMasterworks >= 1
  ) {
    keys.push('impact_community_favorite');
  }
  if (maxIdeaAwards >= 1) keys.push('impact_awarded_idea');
  if (awardsReceived >= t.recognizedAwards) keys.push('impact_recognized');
  if (awardsReceived >= t.respectedAwards) keys.push('impact_respected');
  if (awardsReceived >= t.distinguishedAwards) {
    keys.push('impact_distinguished');
  }
  if (
    maxIdeaCommentsByOthers >= t.talkOfTheForgeComments &&
    maxIdeaAwards >= t.talkOfTheForgeAwards
  ) {
    keys.push('impact_talk_of_the_forge');
  }
  if (maxIdeaVotes >= t.viralIdeaVotes) keys.push('impact_viral_idea');

  if (awardsGiven >= 1) keys.push('giving_first_spark');
  if (marksSpentOnAwards >= t.generousMarks) keys.push('giving_generous');
  if (marksSpentOnAwards >= t.patronMarks) keys.push('giving_patron');
  if (meaningfulComments >= t.commentatorComments) {
    keys.push('giving_commentator');
  }
  if (meaningfulComments >= t.activeVoiceComments) {
    keys.push('giving_active_voice');
  }
  if (
    awardsGiven >= t.supporterAwardsGiven &&
    meaningfulComments >= t.supporterComments
  ) {
    keys.push('giving_supporter');
  }
  if (
    awardsGiven >= t.enthusiastAwardsGiven &&
    meaningfulComments >= t.enthusiastComments
  ) {
    keys.push('giving_enthusiast');
  }

  if (hasJoinedForce) keys.push('collab_joined_force');
  if (hasSharedVictory) keys.push('collab_shared_victory');
  return keys;
}
