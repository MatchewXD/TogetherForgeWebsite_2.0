/**
 * Shared optional idea-section definitions for Guided Submit, Wizard, Edit, and display.
 * All sections here are optional. Multi-entry caps at MAX_MULTI.
 */

export const MAX_MULTI = 8;

/**
 * Single-value optional sections (form key → guided_data snake_case).
 * Order is the guided step-2 button grid order and wizard page order after core fields.
 */
export const SINGLE_OPTIONAL_SECTIONS = [
  {
    key: 'artStyle',
    snake: 'art_style',
    label: 'Art Style',
    description:
      'Describe the visual direction you imagine (realistic, stylized, pixel, hand-painted, etc.). This helps others picture the game.',
    tip: 'Describe the visual direction you imagine (realistic, stylized, pixel, etc.). This helps others picture the game.',
    placeholder: 'e.g. Stylized low-poly with neon accents, or 16-bit pixel...',
    rows: 3,
    maxLength: 1000,
  },
  {
    key: 'targetPlatforms',
    snake: 'target_platforms',
    label: 'Target Platforms',
    description:
      'Where do you imagine this running? PC, console, mobile, browser, VR, or a mix. Approximate is fine.',
    tip: 'Where should this run first? PC, console, mobile, browser, VR, or a mix. Approximate is fine.',
    placeholder: 'e.g. PC + Steam Deck first, console later...',
    rows: 3,
    maxLength: 1000,
  },
  {
    key: 'coreLoopLength',
    snake: 'core_loop_length',
    label: 'Core Loop Length',
    description:
      'How long is one satisfying play session or run? Think minutes for a match, hours for a campaign chapter.',
    tip: 'How long is one satisfying session or run? Minutes for a match, hours for a chapter. Rough ranges help.',
    placeholder: 'e.g. 15–20 minute runs, or 2–3 hour story chapters...',
    rows: 3,
    maxLength: 800,
  },
  {
    key: 'primaryInspiration',
    snake: 'primary_inspiration',
    label: 'Primary Inspiration / Comparable Games',
    description:
      'Games, media, or experiences this reminds you of. Comparables help the team calibrate scope and feel.',
    tip: 'Name games, media, or experiences this reminds you of. Comparables help the team calibrate scope and feel.',
    placeholder: 'e.g. Deep Rock Galactic meets Hades, with a touch of...',
    rows: 4,
    maxLength: 1500,
  },
  {
    key: 'estimatedScope',
    snake: 'estimated_scope',
    label: 'Estimated Scope',
    description:
      'Rough team size and ambition: solo jam, small team prototype, full multiplayer live service, etc.',
    tip: 'Rough ambition: solo jam, small team prototype, full multiplayer title, etc. No commitment, just a signal.',
    placeholder: 'e.g. Small team vertical slice, or solo prototype first...',
    rows: 3,
    maxLength: 800,
  },
  {
    key: 'twitchIntegration',
    snake: 'twitch_community',
    label: 'Twitch and Community Integration',
    description:
      'How streamers, chat, or viewers could engage with this idea. Skip if it is offline-only.',
    tip: 'How chat, viewers, or streamers interact with the idea. Skip if offline-only.',
    placeholder: 'How streamers and viewers engage with this idea...',
    rows: 4,
    maxLength: 2000,
    legacyKeys: ['twitch_integration', 'twitchIntegration'],
  },
  {
    key: 'environmentalStorytelling',
    snake: 'environmental_storytelling',
    label: 'Environmental Storytelling',
    description:
      'How the world, spaces, and details teach story without cutscenes. Skip if pure systems.',
    tip: 'How the world and spaces teach story without a cutscene. Skip if not relevant.',
    placeholder: 'How the world and environment convey narrative...',
    rows: 4,
    maxLength: 2000,
  },
  {
    key: 'economySystem',
    snake: 'economy_system',
    label: 'Economy System',
    description:
      'Resources, crafting, sinks, trading, or meta progression. Skip if pure combat or narrative.',
    tip: 'Resources, crafting, sinks, trading, or meta progression. Skip if pure combat or narrative.',
    placeholder: 'Resources, crafting, trading, or economy loop...',
    rows: 4,
    maxLength: 2000,
    legacyKeys: ['economy_description', 'economyResource', 'economy_resource'],
  },
  {
    key: 'storyNarrative',
    snake: 'story_narrative',
    label: 'Story and Narrative',
    description:
      'Main story beats, tone, stakes, and what players should remember. Skip if pure systems.',
    tip: 'Tone, stakes, and what players remember. Skip if pure systems.',
    placeholder: 'Main story beats, tone, and narrative goals...',
    rows: 4,
    maxLength: 2000,
    legacyKeys: ['story_overview', 'storyOverview'],
  },
];

/** Multi + single sections for Guided step-2 picker grid (display order). */
export const GUIDED_OPTIONAL_PICKER = [
  {
    key: 'features',
    kind: 'features',
    label: 'Key Features',
    description:
      'Concrete features players will notice. Up to 8 entries, each with an optional name and description.',
  },
  ...SINGLE_OPTIONAL_SECTIONS.map((s) => ({
    key: s.key,
    kind: 'single',
    label: s.label,
    description: s.description,
    section: s,
  })),
  {
    key: 'additionalNotes',
    kind: 'notes',
    label: 'Additional Notes',
    description:
      'References, constraints, or extras that did not fit above. Up to 8 notes.',
  },
];

/** Empty form shape for optional guided fields (null = section not activated). */
export function emptyOptionalForm() {
  const singles = Object.fromEntries(
    SINGLE_OPTIONAL_SECTIONS.map((s) => [s.key, null])
  );
  return {
    features: null,
    additionalNotes: null,
    ...singles,
  };
}

/** Build the object passed into buildGuidedData from a form state object. */
export function guidedFieldsFromForm(form = {}) {
  return {
    features: form.features,
    additionalNotes: form.additionalNotes,
    twitchIntegration: form.twitchIntegration,
    environmentalStorytelling: form.environmentalStorytelling,
    economySystem: form.economySystem,
    storyNarrative: form.storyNarrative,
    artStyle: form.artStyle,
    targetPlatforms: form.targetPlatforms,
    coreLoopLength: form.coreLoopLength,
    primaryInspiration: form.primaryInspiration,
    estimatedScope: form.estimatedScope,
  };
}

/** Whether a guided optional section is currently active on the form. */
export function isOptionalSectionActive(form, key) {
  if (key === 'features') return form.features != null;
  if (key === 'additionalNotes') return form.additionalNotes != null;
  return form[key] != null;
}

/** Activate an optional section with a sensible empty value. */
export function activateOptionalSection(form, key) {
  if (key === 'features') {
    return {
      ...form,
      features:
        Array.isArray(form.features) && form.features.length
          ? form.features
          : [{ name: '', description: '' }],
    };
  }
  if (key === 'additionalNotes') {
    return {
      ...form,
      additionalNotes:
        Array.isArray(form.additionalNotes) && form.additionalNotes.length
          ? form.additionalNotes
          : [''],
    };
  }
  return { ...form, [key]: form[key] == null ? '' : form[key] };
}

/** Deactivate / clear an optional section. */
export function deactivateOptionalSection(form, key) {
  if (key === 'features') return { ...form, features: null };
  if (key === 'additionalNotes') return { ...form, additionalNotes: null };
  return { ...form, [key]: null };
}

/**
 * Map idea row + guided_data into optional form fields
 * (null when empty so edit/submit can show Add buttons).
 */
export function optionalFormFromIdea(data = {}) {
  const guided =
    data.guided_data && typeof data.guided_data === 'object' && !Array.isArray(data.guided_data)
      ? data.guided_data
      : {};

  let features = null;
  const featSrc = Array.isArray(guided.features)
    ? guided.features
    : data.features;
  if (featSrc) {
    try {
      const f =
        typeof featSrc === 'string' ? JSON.parse(featSrc) : featSrc;
      if (Array.isArray(f) && f.length) {
        features = f.map((item) =>
          typeof item === 'string'
            ? { name: '', description: item }
            : {
                name: item?.name || '',
                description: item?.description || '',
              }
        );
      }
    } catch {
      /* ignore */
    }
  }

  let additionalNotes = null;
  const notesSrc = guided.additional_notes ?? data.additional_notes;
  if (Array.isArray(notesSrc) && notesSrc.length) {
    additionalNotes = notesSrc.map(String);
  } else if (typeof notesSrc === 'string' && notesSrc.trim()) {
    try {
      const parsed = JSON.parse(notesSrc);
      if (Array.isArray(parsed) && parsed.length) {
        additionalNotes = parsed.map(String);
      } else if (notesSrc.trim()) {
        additionalNotes = [notesSrc.trim()];
      }
    } catch {
      additionalNotes = [notesSrc.trim()];
    }
  }

  const singleOrNull = (...vals) => {
    for (const v of vals) {
      if (v == null) continue;
      const s = String(v).trim();
      if (s) return s;
    }
    return null;
  };

  const singles = {};
  for (const sec of SINGLE_OPTIONAL_SECTIONS) {
    singles[sec.key] = singleOrNull(
      guided[sec.snake],
      guided[sec.key],
      data[sec.snake],
      // legacy flat columns
      sec.key === 'twitchIntegration' ? data.twitch_integration : null,
      sec.key === 'environmentalStorytelling'
        ? data.environmental_storytelling
        : null,
      sec.key === 'economySystem' ? data.economy_description : null,
      sec.key === 'storyNarrative' ? data.story_overview : null,
      sec.key === 'primaryInspiration' ? data.inspiration : null,
      sec.key === 'artStyle' ? data.visual_style : null
    );
  }

  return {
    features,
    additionalNotes,
    ...singles,
  };
}

/** Text sections list for previews (only non-empty values). */
export function buildPreviewTextSections(guided = {}) {
  return [
    { key: 'art', label: 'Art Style', value: guided.art_style },
    {
      key: 'platforms',
      label: 'Target Platforms',
      value: guided.target_platforms,
    },
    {
      key: 'loop',
      label: 'Core Loop Length',
      value: guided.core_loop_length,
    },
    {
      key: 'inspiration',
      label: 'Primary Inspiration / Comparable Games',
      value: guided.primary_inspiration,
    },
    {
      key: 'scope',
      label: 'Estimated Scope',
      value: guided.estimated_scope,
    },
    {
      key: 'twitch',
      label: 'Twitch and Community Integration',
      value: guided.twitch_community,
    },
    {
      key: 'env',
      label: 'Environmental Storytelling',
      value: guided.environmental_storytelling,
    },
    {
      key: 'economy',
      label: 'Economy System',
      value: guided.economy_system,
    },
    {
      key: 'story',
      label: 'Story and Narrative',
      value: guided.story_narrative,
    },
  ];
}

/** localStorage key for light auto-save while composing. */
export function localDraftStorageKey(userId, flow) {
  return `tf_idea_compose_${flow}_${userId || 'anon'}`;
}
