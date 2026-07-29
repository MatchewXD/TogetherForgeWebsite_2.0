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
    projectIds: ['early', 'early-phase', 'prototype-systems'],
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
export const EARLY_CONTENT_VERSION = 3;

export const EARLY_PHASE_DEFAULTS = {
  /** Schema version for staff-saved content */
  contentVersion: EARLY_CONTENT_VERSION,
  heroTitle: 'Early Game Project Hub',
  heroSeriesLabel: 'Early Game (Proof of Concept Series)',
  heroBody:
    'A series of small, focused multiplayer games that promote teamwork and cooperation. The primary goal is to test and refine our community development systems (task management, volunteering, crediting, feedback loops). Each game should be relatively quick to make while still being genuinely fun and multiplayer.',
  goalsIntro: 'Early Game (Proof of Concept Series)',
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
    'Early Game is the foundation of Together Forge. We intentionally start with a series of smaller cooperative games so we can focus on what matters most: building fun teamwork mechanics and proving that a transparent, community-supported development process can create great games.',
    'Right now we have the capacity to develop one game at a time. As the Forge grows we will expand to multiple projects in parallel.',
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
  activeProjectHref: '/projects/prototype-systems',
  activeProjectStatus: 'In Development',
  gameOverviewsNote:
    'Future Early Game projects will appear here as they are selected. Right now Together Forge is focused on one game at a time.',
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
    ).trim(),
    activeProjectStatus: stripMarkup(
      c.activeProjectStatus || d.activeProjectStatus
    ),
    gameOverviewsNote: stripMarkup(
      c.gameOverviewsNote || d.gameOverviewsNote
    ),
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
