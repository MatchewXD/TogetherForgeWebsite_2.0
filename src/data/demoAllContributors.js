/**
 * Demo people for /contributors/all layout preview.
 * Off unless VITE_SHOW_DEMO_CONTRIBUTORS=true (keep off in production).
 */

export function isDemoContributorsEnabled() {
  const flag = import.meta.env?.VITE_SHOW_DEMO_CONTRIBUTORS;
  return flag === 'true' || flag === '1';
}

function p(id, username, displayName, extra = {}) {
  return {
    userId: `demo-contrib-${id}`,
    username,
    avatarUrl: null,
    displayName,
    roleLabel: extra.roleLabel || null,
    contexts: extra.contexts || [],
    _isDemo: true,
  };
}

/**
 * Seed maps for listAllContributorsGrouped upsert helpers.
 * @param {{
 *   projectContributors: Map,
 *   donors: Map,
 *   communityModeration: Map,
 *   ideasFeedback: Map,
 *   contentShowcase: Map,
 *   otherSkills: Map,
 * }} maps
 * @param {(map: Map, person: object, context?: string|null) => void} upsertPerson
 */
export function injectDemoAllContributors(maps, upsertPerson) {
  if (!isDemoContributorsEnabled()) return;

  const {
    projectContributors,
    donors,
    communityModeration,
    ideasFeedback,
    contentShowcase,
    otherSkills,
  } = maps;

  // —— Project Contributors ——
  const dev = [
    p('dev-1', 'alex_rivers', 'Alex Rivers', {
      roleLabel: 'Gameplay programmer',
      contexts: ['Tether · Coding'],
    }),
    p('dev-2', 'sam_ortega', 'Sam Ortega', {
      roleLabel: 'Systems',
      contexts: ['Tether · Coding', 'Tether · Server Design'],
    }),
    p('dev-3', 'jordan_lee', 'Jordan Lee', {
      roleLabel: 'Environment art',
      contexts: ['Tether · Art'],
    }),
    p('dev-4', 'riley_chen', 'Riley Chen', {
      roleLabel: 'Character models',
      contexts: ['Tether · Models'],
    }),
    p('dev-5', 'casey_bloom', 'Casey Bloom', {
      roleLabel: 'Sound design',
      contexts: ['Tether · Audio'],
    }),
    p('dev-6', 'morgan_vale', 'Morgan Vale', {
      roleLabel: 'Level design',
      contexts: ['Tether · Design'],
    }),
    p('dev-7', 'taylor_kim', 'Taylor Kim', {
      roleLabel: 'Playtest lead',
      contexts: ['Tether · QA / Testing'],
    }),
    p('dev-8', 'nova_park', 'Nova Park', {
      roleLabel: 'UI systems',
      contexts: ['Tether · Coding'],
    }),
    p('dev-9', 'eden_cross', 'Eden Cross', {
      roleLabel: 'Narrative',
      contexts: ['Tether · Writing'],
    }),
  ];
  for (const person of dev) {
    upsertPerson(
      projectContributors,
      person,
      person.contexts[0] || null
    );
  }

  // —— Donors (includes one guest-style name without account username) ——
  const donorList = [
    p('donor-1', 'MatchewXD', 'MatchewXD', {
      contexts: ['Tether'],
    }),
    p('donor-2', 'forge_friend', 'Forge Friend', {
      contexts: ['Tether'],
    }),
    p('donor-3', 'pixel_patron', 'Pixel Patron', {
      contexts: ['Tether'],
    }),
    {
      userId: null,
      username: null,
      avatarUrl: null,
      displayName: 'Community Supporter',
      roleLabel: null,
      contexts: ['Tether'],
      _isDemo: true,
    },
    p('donor-5', 'lumen_gift', 'Lumen Gift', {
      contexts: ['Studio support'],
    }),
    p('donor-6', 'ember_aid', 'Ember Aid', {
      contexts: ['Tether'],
    }),
  ];
  for (const person of donorList) {
    upsertPerson(donors, person, person.contexts?.[0] || null);
  }

  // —— Community & Moderation ——
  const community = [
    p('com-1', 'mod_warden', 'Quinn Harper', {
      roleLabel: 'Discord mod',
      contexts: ['Tether · Moderation'],
    }),
    p('com-2', 'playtest_pro', 'Avery Cole', {
      roleLabel: 'Weekend playtest',
      contexts: ['Tether · Playtesting'],
    }),
    p('com-3', 'night_shift_mod', 'Sky Nakamura', {
      roleLabel: 'Moderation',
      contexts: ['Community · Moderation'],
    }),
    p('com-4', 'build_night', 'Remy Santos', {
      roleLabel: 'Playtesting',
      contexts: ['Tether · Playtesting'],
    }),
  ];
  for (const person of community) {
    upsertPerson(
      communityModeration,
      person,
      person.contexts[0] || null
    );
  }

  // —— Ideas & Feedback ——
  const ideas = [
    p('idea-1', 'pitch_pilot', 'Jules Hart', {
      contexts: ['Idea: Linked movement fantasy'],
    }),
    p('idea-2', 'note_taker', 'Reese Nguyen', {
      roleLabel: 'Feedback',
      contexts: ['Tether · Feedback'],
    }),
    p('idea-3', 'scope_check', 'Pat Okonkwo', {
      contexts: ['Idea: Colony stakes over score chase'],
    }),
    p('idea-4', 'loop_lab', 'Kai Mendoza', {
      contexts: ['Idea: Shared resource backpack'],
    }),
    p('idea-5', 'voice_of_play', 'Dana Frost', {
      roleLabel: 'Feedback',
      contexts: ['Tether · Feedback'],
    }),
  ];
  for (const person of ideas) {
    upsertPerson(ideasFeedback, person, person.contexts[0] || null);
  }

  // —— Content & Showcase ——
  const content = [
    p('mkt-1', 'clip_captain', 'Jamie Brooks', {
      roleLabel: 'Trailer edit',
      contexts: ['Tether · Video'],
    }),
    p('mkt-2', 'social_spark', 'Drew Patel', {
      roleLabel: 'Community posts',
      contexts: ['Studio · Social Media'],
    }),
    p('mkt-3', 'stream_bridge', 'Robin Hale', {
      roleLabel: 'Content Creation',
      contexts: ['Showcase · Content Creation'],
    }),
    p('mkt-4', 'outreach_node', 'Sasha Voss', {
      roleLabel: 'Community Outreach',
      contexts: ['Studio · Community Outreach'],
    }),
  ];
  for (const person of content) {
    upsertPerson(contentShowcase, person, person.contexts[0] || null);
  }

  // —— Other Skills ——
  const other = [
    p('oth-1', 'docs_sprite', 'Ivy Calder', {
      roleLabel: 'Docs helper',
      contexts: ['Tether · Other'],
    }),
    p('oth-2', 'tool_smith', 'Chris Vale', {
      contexts: ['Studio tooling'],
    }),
    p('oth-3', 'l10n_scout', 'Mira Sol', {
      roleLabel: 'Localization notes',
      contexts: ['Tether · Other'],
    }),
  ];
  for (const person of other) {
    upsertPerson(otherSkills, person, person.contexts[0] || null);
  }
}
