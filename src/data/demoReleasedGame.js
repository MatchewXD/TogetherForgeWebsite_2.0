/**
 * Fully populated demo release for layout preview.
 * Appears on /released and /released/demo-release without needing Supabase rows.
 *
 * Disable by setting VITE_SHOW_DEMO_RELEASE=false in .env
 */

export const DEMO_RELEASE_SLUG = 'demo-release';
/** Stable fake UUID so service lookups can match by id */
export const DEMO_RELEASE_ID = '00000000-0000-4000-8000-0000000000d1';

export function isDemoReleaseEnabled() {
  const flag = import.meta.env?.VITE_SHOW_DEMO_RELEASE;
  if (flag === 'false' || flag === '0') return false;
  return true;
}

export function isDemoReleaseKey(slugOrId) {
  if (!slugOrId) return false;
  const key = String(slugOrId).trim().toLowerCase();
  return (
    key === DEMO_RELEASE_SLUG ||
    key === DEMO_RELEASE_ID.toLowerCase() ||
    key === 'demo' ||
    key === 'test-release'
  );
}

/**
 * Complete project row shape (after mapProjectRow / withReleaseExtras).
 */
export function getDemoReleasedGame() {
  return {
    id: DEMO_RELEASE_ID,
    slug: DEMO_RELEASE_SLUG,
    title: 'Forgebound',
    phase: 'Early',
    status: 'Completed',
    sort_order: 0,
    created_at: '2025-03-01T12:00:00.000Z',
    completed_at: '2026-06-15T16:00:00.000Z',
    updated_at: '2026-06-15T16:00:00.000Z',
    summary:
      'A co-op expedition game where linked explorers cross unstable ruins to recover a colony power core.',
    description:
      'Forgebound is a short co-op adventure built as an Early Game proof of the Together Forge model.\n\nTwo to four players are linked by a shared energy tether. Every jump, haul, and rescue depends on timing and trust. Simple enemies try to break the line while the crew pushes deeper into semi-procedural chambers for scrap, tools, and the antimatter generator that will keep their colony alive.\n\nThe tone is serious and the stakes are real: the people waiting below are counting on the crew. This demo entry shows how a finished release page looks with full catalog fields filled in.',
    completion_notes:
      'Shipped after a focused volunteer sprint. Core loop, first biome, and public credits were the release bar.',
    completion_links: [
      {
        label: 'Play free',
        url: 'https://togetherforge.gg',
        kind: 'play',
      },
      {
        label: 'Download',
        url: 'https://togetherforge.gg',
        kind: 'download',
      },
      {
        label: 'Steam',
        url: 'https://store.steampowered.com/',
        kind: 'steam',
      },
    ],
    release_meta: {
      tagline:
        'Linked explorers. One tether. A colony waiting on the other side of the dark.',
      platforms: ['PC', 'Steam'],
      genre: ['Co-op', 'Action', 'Adventure'],
      coverImage: '/images/Release_HeroImage.webp',
      media: [
        {
          url: '/images/Hero_Background.webp',
          alt: 'Forgebound key art',
          caption: 'Key art',
        },
        {
          url: '/images/Projects_Page.webp',
          alt: 'Crew crossing a chasm',
          caption: 'Tether crossing',
        },
        {
          url: '/images/Support_Page.webp',
          alt: 'Ruin chamber exploration',
          caption: 'First biome chamber',
        },
        {
          url: '/images/phase_images/Early_Phase_Illistration.webp',
          alt: 'Early phase concept',
          caption: 'Development concept',
        },
        {
          url: '/images/Transparency_Page.webp',
          alt: 'Colony briefing scene',
          caption: 'Briefing UI',
        },
        {
          url: '/images/About_Page_Background.webp',
          alt: 'Wide vista',
          caption: 'Vista shot',
        },
      ],
      steamReviews: {
        recent: {
          label: 'Overwhelmingly Positive',
          percent: 97,
          count: null,
        },
        overall: {
          label: 'Very Positive',
          percent: 94,
          count: 8512,
        },
        url: 'https://store.steampowered.com/',
      },
      developmentStory:
        'Forgebound started as a community idea about linked movement, then spent months on the Early board as small volunteer tasks: prototype tether physics, first enemy, audio pass, and a public playtest weekend.\n\nDonations attributed while the project was In Development paid for tools and hosting. When the core loop felt solid, we marked the project complete, published play links, and moved the permanent record here so credits and the story of how it was made stay visible.',
      originIdeaIds: ['demo-idea-1'],
    },
    /** Marker for UI badges / service short-circuits */
    _isDemoRelease: true,
  };
}

/** Mock credits matching getProjectCredits() shape */
export function getDemoReleaseCredits() {
  const person = (id, username, displayName, extra = {}) => ({
    id,
    projectId: DEMO_RELEASE_ID,
    userId: `demo-user-${id}`,
    username,
    avatarUrl: null,
    displayName,
    isAnonymous: false,
    amountCents: null,
    notes: null,
    sortOrder: 0,
    source: 'demo',
    ...extra,
  });

  return {
    donations: {
      projectTotalCents: 428500,
      anonymousCents: 87500,
      namedDonors: [
        {
          userId: 'demo-user-donor-1',
          username: 'MatchewXD',
          avatarUrl: null,
          displayName: 'MatchewXD',
        },
        {
          userId: 'demo-user-donor-2',
          username: 'forge_friend',
          avatarUrl: null,
          displayName: 'Forge Friend',
        },
        {
          userId: 'demo-user-donor-3',
          username: 'pixel_patron',
          avatarUrl: null,
          displayName: 'Pixel Patron',
        },
      ],
      attributedWhileActive: true,
    },
    development: [
      person('dev-1', 'lead_code', 'Alex Rivers', {
        category: 'development',
        subcategory: 'Coding',
        roleLabel: 'Gameplay programmer',
      }),
      person('dev-2', 'tether_phys', 'Sam Ortega', {
        category: 'development',
        subcategory: 'Coding',
        roleLabel: 'Systems',
      }),
      person('dev-3', 'ruin_brush', 'Jordan Lee', {
        category: 'development',
        subcategory: 'Art',
        roleLabel: 'Environment art',
      }),
      person('dev-4', 'model_maker', 'Riley Chen', {
        category: 'development',
        subcategory: 'Models',
        roleLabel: 'Character models',
      }),
      person('dev-5', 'sound_forge', 'Casey Bloom', {
        category: 'development',
        subcategory: 'Audio',
        roleLabel: 'Sound design',
      }),
      person('dev-6', 'level_mind', 'Morgan Vale', {
        category: 'development',
        subcategory: 'Design',
        roleLabel: 'Level design',
      }),
      person('dev-7', 'qa_hawk', 'Taylor Kim', {
        category: 'development',
        subcategory: 'QA / Testing',
        roleLabel: 'Playtest lead',
      }),
    ],
    marketing: [
      person('mkt-1', 'clip_captain', 'Jamie Brooks', {
        category: 'marketing',
        subcategory: 'Video',
        roleLabel: 'Trailer edit',
      }),
      person('mkt-2', 'social_spark', 'Drew Patel', {
        category: 'marketing',
        subcategory: 'Social Media',
        roleLabel: 'Community posts',
      }),
    ],
    community: [
      person('com-1', 'mod_warden', 'Quinn Harper', {
        category: 'community',
        subcategory: 'Moderation',
        roleLabel: 'Discord mod',
      }),
      person('com-2', 'playtest_pro', 'Avery Cole', {
        category: 'community',
        subcategory: 'Playtesting',
        roleLabel: 'Weekend playtest',
      }),
      person('com-3', 'feedback_fox', 'Reese Nguyen', {
        category: 'community',
        subcategory: 'Feedback',
        roleLabel: 'Design notes',
      }),
    ],
    raw: [],
  };
}

/** Mock pulse matching getProjectPulse() shape */
export function getDemoReleasePulse() {
  return {
    contributors: 14,
    tasksCompleted: 87,
    openTasks: 0,
    activeWorkers: [],
    activePeople: 14,
    tasksThisWeek: 87,
    tasksThisMonth: 87,
    recentWins: 0,
  };
}

/** Mock related ideas for the Community ideas section (enough to exercise scroll) */
export function getDemoReleaseIdeas() {
  const seeds = [
    {
      title: 'Tethered co-op movement as the core fantasy',
      summary:
        'Players share an energy tether that powers movement tools only when the team coordinates.',
    },
    {
      title: 'Colony stakes instead of pure score attack',
      summary:
        'Recover a permanent power source so the people below can survive without constant resupply.',
    },
    {
      title: 'Enemies that sever the line',
      summary:
        'Simple foes whose job is to force the crew to re-form the tether under pressure.',
    },
    {
      title: 'Semi-procedural ruin chambers',
      summary:
        'Hand-authored rooms with modular connectors so each run still feels authored.',
    },
    {
      title: 'Shared resource backpack',
      summary:
        'Scrap and tools live in a team inventory so hoarding hurts everyone.',
    },
    {
      title: 'Rescue pull as a signature move',
      summary:
        'Yank a falling teammate back with the tether instead of a free double-jump.',
    },
    {
      title: 'Quiet briefing before the drop',
      summary:
        'A short story beat that reminds the crew who is waiting below.',
    },
    {
      title: 'Audio cues for tether tension',
      summary:
        'Pitch and strain tell you when the line is about to snap without a UI spam fest.',
    },
    {
      title: 'Optional third-player support role',
      summary:
        'A lighter loadout for friends who want to help without mastering combat.',
    },
    {
      title: 'Post-run colony upgrade screen',
      summary:
        'Spend recovered scrap on permanent colony systems between expeditions.',
    },
  ];

  return seeds.map((idea, i) => ({
    id: `demo-idea-${i + 1}`,
    title: idea.title,
    summary: idea.summary,
    description: null,
    created_at: new Date(Date.UTC(2025, 0, 12 + i)).toISOString(),
  }));
}
