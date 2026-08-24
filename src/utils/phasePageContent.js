/**
 * Shared phase-page content defaults + helpers (Early / Mid / Late).
 * Content is stored in Supabase page_content as JSON under page_key.
 *
 * Public rendering always goes through sanitization so markdown/HTML
 * never appears as raw text for visitors.
 */

/** Project / tag keys that route ideas to a studio phase. */
export const PHASE_IDEA_KEYS = {
  early: {
    pageKey: 'early_game',
    /** User-facing label (avoid "phase" in public UI) */
    label: 'Early Game',
    /** project_id values that count as this stage */
    projectIds: ['early', 'early-phase', 'tether', 'prototype-systems'],
    /** tag tokens (lowercase) that count as this stage */
    tags: ['early', 'early-phase', 'early game', 'early-game'],
    submitProjectId: 'early',
    submitTag: 'early',
  },
  mid: {
    pageKey: 'mid_game',
    label: 'Mid Game',
    projectIds: ['mid', 'mid-phase', 'core-features'],
    tags: ['mid', 'mid-phase', 'mid game', 'mid-game'],
    submitProjectId: 'mid',
    submitTag: 'mid',
  },
  late: {
    pageKey: 'late_game',
    label: 'Late Game',
    projectIds: ['late', 'late-phase', 'polish-playtests'],
    tags: ['late', 'late-phase', 'late game', 'late-game'],
    submitProjectId: 'late',
    submitTag: 'late',
  },
};

/**
 * Bump when finalized public copy changes so legacy page_content rows
 * (old markdown/HTML or outdated wording) stop overriding defaults.
 */
export const EARLY_CONTENT_VERSION = 5;

export const EARLY_PHASE_DEFAULTS = {
  /** Schema version for staff-saved content */
  contentVersion: EARLY_CONTENT_VERSION,
  heroTitle: 'Early Game Project Hub',
  heroSeriesLabel: '',
  heroBody:
    'A series of small, focused multiplayer games that promote teamwork and cooperation. The primary goal is to test and refine our community development systems (task management, volunteering, crediting, feedback loops). Each game should be relatively quick to make while still being genuinely fun and multiplayer.',
  goalsIntro: '',
  goals: [
    'Test and prove our community-driven development model works.',
    'Build and refine core cooperation and teamwork mechanics.',
    'Create genuinely fun multiplayer experiences that bring players together.',
    'Establish transparent systems for volunteering, task tracking, and crediting contributors.',
    'Gather real community feedback to improve future projects.',
  ],
  successMetric:
    'Strong community engagement during development + positive feedback on cooperative gameplay.',
  targetIntro:
    'We are looking for small, focused multiplayer games that emphasize cooperation and teamwork.',
  targetExamplesHeading: 'Examples of the kind of games we want to make:',
  targetExamples: [
    'Cooperative survival challenges (ex: Lethal Company, Peak, PlateUp!)',
    'Shared vehicle/mech operation or crew-based gameplay (ex: Sea of Thieves, Barotrauma)',
    'Simple team-based exploration, building, and defense (ex: Terraria, Valheim, Deep Rock Galactic)',
    'Light resource management with clear role differentiation in short sessions (ex: Deep Rock Galactic, Lethal Company, Barotrauma)',
  ],
  aboutParagraphs: [
    'Early Game is where we prove the model in public.',
    'We start with focused cooperative games so we can build real teamwork systems, test transparent development in the open, and create the resources and culture needed for everything that comes next. These games are not side projects. They are the foundation.',
    'This is where Together Forge shows that a community-supported studio can ship fun, ambitious multiplayer experiences without the usual corporate overhead.',
  ],
  howToHelp: [
    'Submit game concepts, mechanics, or ideas through the Game Ideas page or the active projects page.',
    'Volunteer your skills (development, art, design, testing, writing, moderation, etc.).',
    'Help test prototypes and give honest feedback on what feels fun.',
    'Join discussions on existing ideas to help refine them.',
    'Share the project with streamers, communities, and other creators.',
    'Support the Forge through donations to help fund development tools and time.',
  ],
  howToHelpNote:
    'Every contribution is credited publicly, and we are transparent about how support is used.',
  activeProjectTitle: 'Tether',
  activeProjectSummary:
    'A tethered crew crosses dangerous semi-procedural levels to reach a destroyed orbital station. Linked by a shared energy tether, players must coordinate movement, manage resources for their stranded colony, and recover a permanent power source.',
  activeProjectHref: '/projects/tether',
  activeProjectStatus: 'In Development',
  gameOverviewsNote:
    'Future Early Game projects will appear here as they are selected. Right now Together Forge is focused on one game at a time.',
};

export const MID_CONTENT_VERSION = 2;

export const MID_PHASE_DEFAULTS = {
  contentVersion: MID_CONTENT_VERSION,
  heroTitle: 'Mid Game Project Hub',
  heroSeriesLabel: '',
  heroBody:
    'This is where Together Forge aims higher. Mid Game is for cooperative games on the scale of Halo, Horizon Zero Dawn, and Skyrim, but with more: deeper progression systems, more dynamic NPCs and worlds, and stronger cooperative play. We are not interested in making safer, smaller versions of existing games. We are building the capacity to push what is possible.',
  goalsIntro: '',
  goals: [
    'Create cooperative games at a scale most independent studios never reach and most large studios no longer attempt.',
    'Push systemic depth, player agency, dynamic worlds, and meaningful teamwork further than current mainstream titles.',
    'Prove that a lean core team plus massive community contribution can outperform traditional layered management and political overhead.',
    'Use the foundation and funding built in Early Game to take real swings at ambitious projects.',
    'Establish Together Forge as a place where experimentation and scale can coexist.',
  ],
  successMetric:
    'Shipping Mid-scale cooperative games that players and contributors feel are meaningfully different and better than the current industry standard, built through transparent community power.',
  targetIntro:
    'We are aiming for games with the scope and presence of titles like Halo, Horizon Zero Dawn, and Skyrim, but designed from the ground up around cooperation and systemic depth.',
  targetExamplesHeading: 'We want:',
  targetExamples: [
    'Large, reactive worlds and progression systems that respond to how players actually play',
    'Dynamic NPCs and systems that create memorable, unscripted moments',
    'Strong cooperative play that makes teamwork feel essential and rewarding rather than optional',
    'The kind of ambition that used to define the best big-studio experiments, freed from the layers of management and risk-aversion that now limit them',
  ],
  targetClosing:
    'These will not be small prototypes. They will be substantial games made possible by community scale.',
  aboutParagraphs: [
    'Most large game companies have stopped experimenting. They reduce risk, simplify systems, and ship safer versions of what already worked. The result is a wave of games that feel smaller in spirit even when the budgets are huge.',
    'Together Forge exists to go the other direction.',
    'We are building a different kind of studio: a real core team of developers with minimal management overhead, supported by a growing community of volunteers, creators, and players who contribute ideas, labor, and funding. Early Game is where we prove the model and generate the resources. Mid Game is where we use that foundation to reach for games that actually push the medium.',
    'The long-term goal is not to become another mid-sized studio. The goal is to become the largest and most capable game-making force in the world, not through investors or political agendas, but through the combined power of people who want better games and are willing to help build them.',
    'Mid Game is the first major step in that direction.',
  ],
  howToHelp: [
    'Submit ambitious Mid-scale ideas, systems, and full pitches.',
    'Attach related ideas and add-ons to help strong concepts grow.',
    'Volunteer skills that matter at this scale: systems design, technical art, tools, long-term testing, writing, coordination, and more.',
    'Help evaluate and strengthen Mid ideas so the best ones are ready.',
    'Share the vision and the work with other creators and communities.',
    'Support the Forge so Early Game success can fund and unlock Mid Game projects.',
  ],
  howToHelpNote:
    'Every contribution is credited. This only works if people show up.',
  activeProjectTitle: '',
  activeProjectSummary: '',
  activeProjectHref: '',
  activeProjectStatus: '',
  gameOverviewsNote:
    'Future Mid Game projects will appear here as they are selected and prepared. Right now the Forge is focused on building the foundation in Early Game so that when we step up to this scale, we do it with real strength instead of empty promises.',
  activeEmptyMessage:
    'No Mid Game projects are in active development yet. The first Mid projects will begin once Early Game has proven the systems, generated real support, and given us the capacity to take on larger work. When they appear, they will sit here with full project hubs, task boards, and contributor tracking.',
  completedEmptyMessage:
    'Finished Mid work will be listed here with release links and full credits. The Released Games pages will expand this further.',
  projectsEmptyMessage:
    'No In Development, Planning, or On Hold Mid projects yet.',
  ideasSubmitCta: 'Submit a Mid Game Idea',
  ideasIntro:
    'Mid Game is where the most ambitious community ideas belong. If you have concepts that need real scale, deep systems, dynamic worlds, or rich cooperative play, this is the place for them. You can browse existing Mid-phase ideas, attach related ideas or add-ons, and help refine the concepts that could become the next major projects. The best ideas will be ready when the Forge has the capacity to build them.',
};

export const LATE_CONTENT_VERSION = 1;

export const LATE_PHASE_DEFAULTS = {
  contentVersion: LATE_CONTENT_VERSION,
  heroTitle: 'Late Game Project Hub',
  heroSeriesLabel: 'This is the magnum opus.',
  heroBody:
    'Late Game is where Together Forge aims to create the best MMORPG in the world. A persistent cooperative world that pushes past the safe, cloned systems of current games and builds something genuinely new.',
  goalsIntro: '',
  goals: [
    'Create a large-scale cooperative MMORPG that sets a new standard for years to come.',
    'Build systems that strongly incentivize player cooperation against evolving, large-scale threats.',
    'Support both casual players who want to build and create, and dedicated players who want to defend, expand, and push the frontier.',
    'Design a living world story that changes based on what players actually accomplish.',
    'Establish Together Forge as the most capable game-making force in the world through community scale.',
  ],
  successMetric:
    'Shipping an MMORPG that players experience as meaningfully different and superior to existing options, built and sustained through transparent community power.',
  targetIntro:
    'We are building toward a cooperative MMORPG with systems that current games largely avoid.',
  targetExamplesHeading: 'Core directions include:',
  targetExamples: [
    'Cooperative combat and large-scale group content that feels essential rather than optional',
    'Overarching enemies that actively attack player colonies and evolve over time',
    'A shared world story that progresses as players achieve major goals and defeat major threats',
    'Dynamic NPCs that can assist with large objectives',
    'Content that requires armies to stop armies',
    'Strong support for both city-building / creation focused players and high-intensity defense and expansion players',
    'Player-created vehicles, blueprints, and technologies that other players can build and use',
    'Clear incentives that push players to cooperate against a greater evolving threat',
  ],
  targetClosing:
    'This is not a safer version of existing MMOs. It is an attempt to push the boundaries of what a persistent cooperative world can be.',
  aboutParagraphs: [
    'Late Game is the highest ambition of Together Forge.',
    'After Early Game proves the model and Mid Game proves we can deliver substantial cooperative titles, Late Game is where we attempt to make the best MMORPG in the world. Not a clone of systems that already feel safe and familiar, but a new foundation: cooperative combat, evolving world-level threats, a story that the entire player base shapes together, and deep support for both creators and fighters.',
    'The long-term intent is clear. Once this scale of game is established and successful, Together Forge will be positioned as the leading game-making force in the world, with the ability to expand far beyond a single title. That growth will come from community power, not from investors or political agendas.',
    'This stage only opens when the Forge has earned it through earlier success.',
  ],
  howToHelp: [
    'Submit large-scale systemic ideas, world designs, and full pitches for Late Game.',
    'Attach related ideas and add-ons to help the strongest concepts grow.',
    'Contribute skills that matter at MMO scale: systems design, tools, technical art, economy design, large-scale testing, writing, coordination, and more.',
    'Help evaluate and strengthen Late ideas so the best ones are ready.',
    'Share the vision with other creators and communities.',
    'Support the earlier phases so the path to Late Game stays real.',
  ],
  howToHelpNote:
    'Every contribution is credited. This only works if people show up for the long term.',
  activeProjectTitle: '',
  activeProjectSummary: '',
  activeProjectHref: '',
  activeProjectStatus: '',
  gameOverviewsNote:
    'Future Late Game projects will appear here once the Forge has the capacity and foundation to take them on. Right now the focus remains on Early and then Mid so that when we reach this stage, we do it with real strength.',
  activeEmptyMessage:
    'No Late Game projects are in active development yet. Late Game begins only after Mid Game has proven we can deliver ambitious cooperative titles at scale. When the first Late project starts, it will appear here with full project infrastructure, task tracking, and contributor systems.',
  completedEmptyMessage:
    'Finished Late work will be listed here with release links and full credits. The Released Games pages will expand this further.',
  projectsEmptyMessage:
    'No In Development, Planning, or On Hold Late projects yet.',
  ideasSubmitCta: 'Submit a Late Game Idea',
  ideasIntro:
    'Late Game is where the largest and most systemic ideas belong. If you have concepts for living worlds, evolving threats, large-scale cooperation, player-driven creation systems, or new approaches to MMO design, this is the place for them. You can browse existing Late-phase ideas, attach related ideas or add-ons, and help develop the concepts that could shape the future of the Forge. The strongest ideas will be ready when we have the capacity to build at this scale.',
};

/**
 * True when saved CMS JSON is pre-finalized / legacy (should not override defaults).
 */
export function isLegacyEarlyContent(raw) {
  if (!raw || typeof raw !== 'object') return true;
  const ver = Number(raw.contentVersion) || 0;
  if (ver < EARLY_CONTENT_VERSION) return true;
  // Raw markdown/HTML still present in any string field
  const blob = JSON.stringify(raw);
  if (/<small|<li|<\/p>|\*\*|\\n/.test(blob)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Sanitization (public display + safe save)
// ---------------------------------------------------------------------------

/** Strip HTML, markdown emphasis, and literal \n sequences. */
export function stripMarkup(text) {
  if (text == null) return '';
  let s = String(text);
  // Literal backslash-n from JSON/DB mistakes
  s = s.split('\\n').join('\n');
  // HTML
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/?small[^>]*>/gi, '');
  s = s.replace(/<\/?p[^>]*>/gi, '\n');
  s = s.replace(/<\/?li[^>]*>/gi, '\n');
  s = s.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  // Markdown emphasis / code
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/__([^_]+)__/g, '$1');
  s = s.replace(/\*([^*]+)\*/g, '$1');
  s = s.replace(/_([^_\n]+)_/g, '$1');
  s = s.replace(/`([^`]+)`/g, '$1');
  // Headings
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  // Collapse whitespace on single lines (keep newlines for parsers)
  s = s
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n');
  return s.trim();
}

function isSuccessMetricLine(line) {
  const t = stripMarkup(line).toLowerCase();
  return (
    t.startsWith('success metric') ||
    t.startsWith('strong community engagement')
  );
}

function isExamplesHeadingLine(line) {
  const t = stripMarkup(line).toLowerCase();
  return (
    t.startsWith('examples of the kind') ||
    t.startsWith('examples of') ||
    t === 'examples' ||
    /^examples[:\s]/.test(t)
  );
}

function isNoiseHeading(line) {
  const t = stripMarkup(line).toLowerCase();
  if (!t) return true;
  if (isSuccessMetricLine(t)) return true;
  if (isExamplesHeadingLine(t)) return true;
  // Legacy intro headings that shouldn't become bullets
  if (/^early game\b/.test(t) && t.length < 80) return true;
  if (/^proof of concept/.test(t)) return true;
  return false;
}

function extractSuccessMetric(text, fallback = '') {
  const s = stripMarkup(text);
  const m =
    s.match(/success metric[:\s]+(.+)/i) ||
    s.match(/<small>\s*success metric[:\s]*(.+?)\s*<\/small>/i);
  if (m?.[1]) return stripMarkup(m[1]);
  // Entire string is the metric
  if (/^strong community engagement/i.test(s)) return s;
  return fallback ? stripMarkup(fallback) : '';
}

/**
 * Parse a bullet list from markdown, HTML-ish text, or string arrays.
 * Returns clean plain-text items only.
 */
export function parseBulletList(raw, fallback = []) {
  const fallbackClean = (fallback || [])
    .map((s) => stripMarkup(s))
    .filter(Boolean);

  let lines = [];
  if (Array.isArray(raw)) {
    lines = raw.map((s) => String(s ?? ''));
  } else if (typeof raw === 'string') {
    let text = raw.split('\\n').join('\n');
    // If it looks like a single blob with <li>
    if (/<li[\s>]/i.test(text)) {
      text = text.replace(/<\/li>/gi, '\n').replace(/<li[^>]*>/gi, '\n- ');
    }
    lines = text.split(/\r?\n/);
  } else {
    return [...fallbackClean];
  }

  const items = [];
  for (const line of lines) {
    let t = String(line || '');
    t = t.replace(/^\s*[-*•]\s+/, '');
    t = stripMarkup(t);
    if (!t) continue;
    if (isNoiseHeading(t)) continue;
    if (isSuccessMetricLine(t)) continue;
    // Drop pure markdown leftover lines
    if (/^[\s*_#`-]+$/.test(t)) continue;
    items.push(t);
  }

  // Dedupe (case-insensitive) preserving order
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const k = item.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(item);
  }

  return unique.length ? unique : [...fallbackClean];
}

/** Parse paragraphs split by blank lines; sanitize each. */
export function parseParagraphs(raw, fallback = []) {
  const fallbackClean = (fallback || [])
    .map((s) => stripMarkup(s))
    .filter(Boolean);

  let parts = [];
  if (Array.isArray(raw)) {
    parts = raw.map((s) => stripMarkup(s)).filter(Boolean);
  } else if (typeof raw === 'string') {
    const text = stripMarkup(raw.split('\\n').join('\n'));
    parts = text
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\n/g, ' ').trim())
      .filter(Boolean);
  } else {
    return [...fallbackClean];
  }

  // Dedupe consecutive / identical paragraphs
  const seen = new Set();
  const unique = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(p);
  }

  return unique.length ? unique : [...fallbackClean];
}

/**
 * Split a legacy "goals" markdown blob into { goals[], successMetric, goalsIntro }.
 */
export function parseGoalsBlob(raw, defaults = {}) {
  const defaultGoals = defaults.goals || EARLY_PHASE_DEFAULTS.goals;
  const defaultMetric =
    defaults.successMetric || EARLY_PHASE_DEFAULTS.successMetric;
  const defaultIntro = defaults.goalsIntro || EARLY_PHASE_DEFAULTS.goalsIntro;

  if (Array.isArray(raw)) {
    return {
      goals: parseBulletList(raw, defaultGoals),
      successMetric: stripMarkup(defaults.successMetric || defaultMetric),
      goalsIntro: stripMarkup(defaults.goalsIntro || defaultIntro),
    };
  }

  if (typeof raw !== 'string' || !raw.trim()) {
    return {
      goals: [...defaultGoals],
      successMetric: defaultMetric,
      goalsIntro: defaultIntro,
    };
  }

  const text = raw.split('\\n').join('\n');
  const successMetric =
    extractSuccessMetric(text, defaultMetric) || defaultMetric;

  // Intro: first non-bullet line that looks like a title
  let goalsIntro = defaultIntro;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const cleaned = stripMarkup(line.replace(/^\s*[-*•]\s+/, ''));
    if (!cleaned || isSuccessMetricLine(cleaned)) continue;
    const isBullet = /^\s*[-*•]\s+/.test(line) || /^[-*•]\s+/.test(line);
    if (!isBullet && /early game|proof of concept/i.test(cleaned)) {
      goalsIntro = cleaned;
      break;
    }
  }

  const goals = parseBulletList(text, defaultGoals).filter(
    (g) =>
      g.toLowerCase() !== goalsIntro.toLowerCase() &&
      !isSuccessMetricLine(g)
  );

  return {
    goals: goals.length ? goals : [...defaultGoals],
    successMetric: stripMarkup(successMetric),
    goalsIntro: stripMarkup(goalsIntro),
  };
}

/**
 * Parse legacy targetStyle markdown into intro + examples[].
 */
export function parseTargetStyleBlob(raw, defaults = {}) {
  const defaultIntro = defaults.targetIntro || EARLY_PHASE_DEFAULTS.targetIntro;
  const defaultExamples =
    defaults.targetExamples || EARLY_PHASE_DEFAULTS.targetExamples;
  const defaultHeading =
    defaults.targetExamplesHeading ||
    EARLY_PHASE_DEFAULTS.targetExamplesHeading;

  if (typeof raw !== 'string' || !raw.trim()) {
    return {
      targetIntro: defaultIntro,
      targetExamples: [...defaultExamples],
      targetExamplesHeading: defaultHeading,
    };
  }

  const text = raw.split('\\n').join('\n');
  const lines = text.split(/\r?\n/);
  const introParts = [];
  const bullets = [];
  let seenBullet = false;
  let heading = defaultHeading;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const isBullet = /^[-*•]\s+/.test(trimmed);
    const cleaned = stripMarkup(trimmed.replace(/^[-*•]\s+/, ''));
    if (!cleaned) continue;

    if (isExamplesHeadingLine(cleaned)) {
      heading = cleaned.endsWith(':') ? cleaned : `${cleaned}:`;
      seenBullet = true; // remaining non-bullets are not intro
      continue;
    }

    if (isBullet) {
      seenBullet = true;
      if (!isNoiseHeading(cleaned)) bullets.push(cleaned);
      continue;
    }

    if (!seenBullet) {
      introParts.push(cleaned);
    }
  }

  let targetIntro = introParts.join(' ').trim() || defaultIntro;
  targetIntro = stripMarkup(targetIntro);
  // Avoid intro duplicating heading text
  if (isExamplesHeadingLine(targetIntro)) targetIntro = defaultIntro;

  const targetExamples = parseBulletList(
    bullets.length ? bullets : text,
    defaultExamples
  ).filter((b) => !isExamplesHeadingLine(b) && b.toLowerCase() !== targetIntro.toLowerCase());

  return {
    targetIntro,
    targetExamples: targetExamples.length ? targetExamples : [...defaultExamples],
    targetExamplesHeading: stripMarkup(heading) || defaultHeading,
  };
}

/**
 * Final pass: every public string field is plain text; lists are clean arrays.
 */
export function sanitizePhaseContent(content, defaults = EARLY_PHASE_DEFAULTS) {
  const d = defaults || {};
  const c = content || {};

  const goals = parseBulletList(c.goals, d.goals).map(stripMarkup).filter(Boolean);
  const targetExamples = parseBulletList(c.targetExamples, d.targetExamples)
    .map(stripMarkup)
    .filter(Boolean);
  const howToHelp = parseBulletList(c.howToHelp, d.howToHelp)
    .map(stripMarkup)
    .filter(Boolean);
  const aboutParagraphs = parseParagraphs(c.aboutParagraphs, d.aboutParagraphs);

  // Deduplicate goals vs goalsIntro
  const goalsIntro = stripMarkup(c.goalsIntro || d.goalsIntro || '');
  const goalsClean = goals.filter(
    (g) => g.toLowerCase() !== goalsIntro.toLowerCase() && !isSuccessMetricLine(g)
  );

  return {
    contentVersion:
      Number(c.contentVersion) ||
      Number(d.contentVersion) ||
      EARLY_CONTENT_VERSION,
    heroTitle: stripMarkup(c.heroTitle || d.heroTitle),
    heroSeriesLabel: stripMarkup(c.heroSeriesLabel || d.heroSeriesLabel),
    heroBody: stripMarkup(c.heroBody || d.heroBody),
    goalsIntro,
    goals: goalsClean.length ? goalsClean : parseBulletList(d.goals, d.goals),
    successMetric: stripMarkup(c.successMetric || d.successMetric),
    targetIntro: stripMarkup(c.targetIntro || d.targetIntro),
    targetExamplesHeading: stripMarkup(
      c.targetExamplesHeading || d.targetExamplesHeading
    ),
    targetExamples: targetExamples.length
      ? targetExamples
      : parseBulletList(d.targetExamples, d.targetExamples),
    aboutParagraphs: aboutParagraphs.length
      ? aboutParagraphs
      : parseParagraphs(d.aboutParagraphs, d.aboutParagraphs),
    howToHelp: howToHelp.length
      ? howToHelp
      : parseBulletList(d.howToHelp, d.howToHelp),
    howToHelpNote: stripMarkup(c.howToHelpNote || d.howToHelpNote),
    activeProjectTitle: stripMarkup(
      c.activeProjectTitle || d.activeProjectTitle
    ),
    activeProjectSummary: stripMarkup(
      c.activeProjectSummary || d.activeProjectSummary
    ),
    activeProjectHref: String(
      c.activeProjectHref || d.activeProjectHref || ''
    )
      .trim()
      .replace(/\/projects\/prototype-systems/gi, '/projects/tether'),
    activeProjectStatus: stripMarkup(
      c.activeProjectStatus || d.activeProjectStatus
    ),
    gameOverviewsNote: stripMarkup(
      c.gameOverviewsNote || d.gameOverviewsNote
    ),
    // Mid/Late optional copy fields
    targetClosing: stripMarkup(c.targetClosing || d.targetClosing || ''),
    activeEmptyMessage: stripMarkup(
      c.activeEmptyMessage || d.activeEmptyMessage || ''
    ),
    completedEmptyMessage: stripMarkup(
      c.completedEmptyMessage || d.completedEmptyMessage || ''
    ),
    projectsEmptyMessage: stripMarkup(
      c.projectsEmptyMessage || d.projectsEmptyMessage || ''
    ),
    ideasSubmitCta: stripMarkup(c.ideasSubmitCta || d.ideasSubmitCta || ''),
    ideasIntro: stripMarkup(c.ideasIntro || d.ideasIntro || ''),
  };
}

/**
 * Merge DB content with phase defaults, then sanitize for safe public display.
 * Supports legacy Early edit fields (heroSubtitle, aboutText, goals markdown, targetStyle).
 */
export function mergePhaseContent(defaults, raw = {}) {
  const d = defaults || EARLY_PHASE_DEFAULTS;
  const c = raw && typeof raw === 'object' ? raw : {};

  // --- Hero ---
  let heroSeriesLabel = c.heroSeriesLabel || d.heroSeriesLabel;
  let heroBody = c.heroBody || d.heroBody;
  if (c.heroSubtitle && typeof c.heroSubtitle === 'string') {
    const lines = c.heroSubtitle
      .split(/\\n|\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length) {
      heroSeriesLabel = lines[0];
      if (lines.length > 1) heroBody = lines.slice(1).join(' ');
    }
  }

  // --- Goals ---
  let goalsIntro = c.goalsIntro || d.goalsIntro;
  let goals = d.goals;
  let successMetric = c.successMetric || d.successMetric;

  if (c.goals != null) {
    if (typeof c.goals === 'string') {
      const parsed = parseGoalsBlob(c.goals, d);
      goals = parsed.goals;
      successMetric = c.successMetric
        ? stripMarkup(c.successMetric)
        : parsed.successMetric;
      if (!c.goalsIntro) goalsIntro = parsed.goalsIntro;
    } else {
      goals = parseBulletList(c.goals, d.goals);
      if (typeof c.goals === 'string' && /success metric/i.test(c.goals)) {
        successMetric = extractSuccessMetric(c.goals, successMetric);
      }
    }
  }

  // --- Target style ---
  let targetIntro = c.targetIntro || d.targetIntro;
  let targetExamples = c.targetExamples
    ? parseBulletList(c.targetExamples, d.targetExamples)
    : d.targetExamples;
  let targetExamplesHeading =
    c.targetExamplesHeading || d.targetExamplesHeading;

  if (c.targetStyle && typeof c.targetStyle === 'string') {
    const parsed = parseTargetStyleBlob(c.targetStyle, d);
    if (!c.targetIntro) targetIntro = parsed.targetIntro;
    if (!c.targetExamples) targetExamples = parsed.targetExamples;
    if (!c.targetExamplesHeading) {
      targetExamplesHeading = parsed.targetExamplesHeading;
    }
  }

  // --- About ---
  let aboutParagraphs = c.aboutParagraphs
    ? parseParagraphs(c.aboutParagraphs, d.aboutParagraphs)
    : d.aboutParagraphs;
  if (c.aboutText && typeof c.aboutText === 'string') {
    aboutParagraphs = parseParagraphs(c.aboutText, aboutParagraphs);
  }

  // --- How to help ---
  let howToHelp = c.howToHelp
    ? parseBulletList(c.howToHelp, d.howToHelp)
    : d.howToHelp;

  const merged = {
    heroTitle: c.heroTitle || d.heroTitle,
    heroSeriesLabel,
    heroBody,
    goalsIntro,
    goals,
    successMetric,
    targetIntro,
    targetExamplesHeading,
    targetExamples,
    aboutParagraphs,
    howToHelp,
    howToHelpNote: c.howToHelpNote || d.howToHelpNote,
    activeProjectTitle: c.activeProjectTitle || d.activeProjectTitle,
    activeProjectSummary: c.activeProjectSummary || d.activeProjectSummary,
    activeProjectHref: c.activeProjectHref || d.activeProjectHref,
    activeProjectStatus: c.activeProjectStatus || d.activeProjectStatus,
    gameOverviewsNote: c.gameOverviewsNote || d.gameOverviewsNote,
  };

  return sanitizePhaseContent(merged, d);
}

/** Flat edit form shape (plain textareas) from structured content. */
export function contentToEditForm(content) {
  const c = sanitizePhaseContent(content || EARLY_PHASE_DEFAULTS);
  return {
    heroTitle: c.heroTitle || '',
    heroSeriesLabel: c.heroSeriesLabel || '',
    heroBody: c.heroBody || '',
    goalsIntro: c.goalsIntro || '',
    // Store bullets as plain lines for staff (no markdown required)
    goals: (c.goals || []).join('\n'),
    successMetric: c.successMetric || '',
    targetIntro: c.targetIntro || '',
    targetExamples: (c.targetExamples || []).join('\n'),
    aboutText: (c.aboutParagraphs || []).join('\n\n'),
    howToHelp: (c.howToHelp || []).join('\n'),
    howToHelpNote: c.howToHelpNote || '',
    activeProjectTitle: c.activeProjectTitle || '',
    activeProjectSummary: c.activeProjectSummary || '',
    activeProjectHref: c.activeProjectHref || '',
    activeProjectStatus: c.activeProjectStatus || '',
    gameOverviewsNote: c.gameOverviewsNote || '',
  };
}

/**
 * Convert edit form to structured content for storage.
 * Always sanitizes so re-saving cleans legacy corruption.
 */
export function editFormToContent(form, defaults = EARLY_PHASE_DEFAULTS) {
  const d = defaults || EARLY_PHASE_DEFAULTS;
  // Allow bullets with or without leading "- "
  const goalsLines = String(form.goals || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•]\s+/, '').trim())
    .filter(Boolean);
  const exampleLines = String(form.targetExamples || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•]\s+/, '').trim())
    .filter(Boolean);
  const helpLines = String(form.howToHelp || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•]\s+/, '').trim())
    .filter(Boolean);

  return sanitizePhaseContent(
    {
      contentVersion: EARLY_CONTENT_VERSION,
      heroTitle: form.heroTitle,
      heroSeriesLabel: form.heroSeriesLabel,
      heroBody: form.heroBody,
      goalsIntro: form.goalsIntro,
      goals: goalsLines,
      successMetric: form.successMetric,
      targetIntro: form.targetIntro,
      targetExamples: exampleLines,
      targetExamplesHeading: d.targetExamplesHeading,
      aboutParagraphs: parseParagraphs(form.aboutText, d.aboutParagraphs),
      howToHelp: helpLines,
      howToHelpNote: form.howToHelpNote,
      activeProjectTitle: form.activeProjectTitle,
      activeProjectSummary: form.activeProjectSummary,
      activeProjectHref: form.activeProjectHref,
      activeProjectStatus: form.activeProjectStatus,
      gameOverviewsNote: form.gameOverviewsNote,
    },
    d
  );
}
