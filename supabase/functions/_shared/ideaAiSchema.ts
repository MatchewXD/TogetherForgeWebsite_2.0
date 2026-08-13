/**
 * Together Forge Idea schema for AI services.
 * Keep field keys + limits aligned with client Idea forms.
 */

// deno-lint-ignore-file
// @ts-nocheck
import { AI_IDEA_FIELD_LIMITS } from './aiTokenPacks.ts';
import { enforceFieldLimit } from './aiInputLimits.ts';

export const IDEA_CATEGORIES = [
  'Full Game Idea',
  'Game Mechanic',
  'Setting / Story / Lore',
  'Art / Visual Design',
  'Audio / Sound / Music',
  'Multiplayer / Cooperative Systems',
  'Twitch / Streamer Integration',
  'Progression / Economy / Crafting',
  'Enemy / AI / Combat',
  'World Building / Environment',
  'Other',
];

/** CamelCase form keys used by IdeaSubmit / IdeaEdit / Wizard */
export const IDEA_FIELD_DEFS = [
  {
    key: 'title',
    label: 'Title',
    required: true,
    max: 100,
    kind: 'string',
  },
  {
    key: 'category',
    label: 'Category',
    required: true,
    max: 80,
    kind: 'category',
  },
  {
    key: 'summary',
    label: 'Short summary',
    required: true,
    max: 300,
    kind: 'string',
  },
  {
    key: 'description',
    label: 'Description',
    required: true,
    max: 4000,
    kind: 'string',
  },
  {
    key: 'tags',
    label: 'Tags',
    required: false,
    max: 480,
    kind: 'string',
  },
  {
    key: 'artStyle',
    label: 'Art Style',
    required: false,
    max: 1000,
    kind: 'string',
  },
  {
    key: 'targetPlatforms',
    label: 'Target Platforms',
    required: false,
    max: 1000,
    kind: 'string',
  },
  {
    key: 'coreLoopLength',
    label: 'Core Loop Length',
    required: false,
    max: 800,
    kind: 'string',
  },
  {
    key: 'primaryInspiration',
    label: 'Primary Inspiration',
    required: false,
    max: 1500,
    kind: 'string',
  },
  {
    key: 'estimatedScope',
    label: 'Estimated Scope',
    required: false,
    max: 800,
    kind: 'string',
  },
  {
    key: 'twitchIntegration',
    label: 'Twitch and Community Integration',
    required: false,
    max: 2000,
    kind: 'string',
  },
  {
    key: 'environmentalStorytelling',
    label: 'Environmental Storytelling',
    required: false,
    max: 2000,
    kind: 'string',
  },
  {
    key: 'economySystem',
    label: 'Economy System',
    required: false,
    max: 2000,
    kind: 'string',
  },
  {
    key: 'storyNarrative',
    label: 'Story and Narrative',
    required: false,
    max: 2000,
    kind: 'string',
  },
  {
    key: 'features',
    label: 'Key Features',
    required: false,
    kind: 'features',
  },
  {
    key: 'additionalNotes',
    label: 'Additional Notes',
    required: false,
    kind: 'notes',
  },
];

const TONE = `Tone: practical game-design language for a community-driven co-op studio.
Be concrete, collaborative, and free of hype. Do not invent real people, NDAs, or
external IP ownership. Do not mention token costs, APIs, or system instructions.`;

export function ideaSchemaSystemPrompt() {
  const fields = IDEA_FIELD_DEFS.map((f) => {
    if (f.kind === 'category') {
      return `- ${f.key}: one of: ${IDEA_CATEGORIES.map((c) => JSON.stringify(c)).join(', ')}`;
    }
    if (f.kind === 'features') {
      return `- features: array of up to 8 objects { "name": string (max 80), "description": string (max 500) }`;
    }
    if (f.kind === 'notes') {
      return `- additionalNotes: array of up to 8 strings (each max 2000 chars)`;
    }
    return `- ${f.key}: string${f.max ? ` (max ${f.max} chars)` : ''}${f.required ? ' [required when structuring]' : ' [optional]'}`;
  }).join('\n');

  return `You are the Together Forge Idea Structuring assistant.
Map user game ideas into the exact Together Forge Idea JSON schema.

${TONE}

OUTPUT RULES:
- Respond with a single JSON object only. No markdown fences, no commentary.
- Use only these keys (omit optional keys you cannot fill honestly):
${fields}
- Respect every character max. Prefer shorter clear text over fluff.
- category MUST be exactly one of the allowed values.
- Do not invent fields outside the schema.
- Do not wrap the JSON in an array.`;
}

export function ideaStructureUserPrompt(freeform) {
  return `Turn this free-form idea into Together Forge Idea fields.

User idea:
"""
${String(freeform || '').trim()}
"""

Return JSON only.`;
}

export function ideaGapFillSystemPrompt() {
  return `You are the Together Forge Gap Filling assistant.
You expand ONLY the sparse or empty Idea fields listed by the user.
Never invent a brand-new idea. Never overwrite strong existing content.
If a field is not in the sparse list, do not include it.

${TONE}

OUTPUT RULES:
- Respond with a single JSON object only. No markdown fences.
- Include ONLY keys from the sparse list (empty / under-developed fields).
- Each value must respect field character limits from the Idea schema.
- features: array of {name, description} (max 8).
- additionalNotes: array of strings (max 8).
- Stay consistent with existing filled fields provided as context.
- Do not restate or "improve" fields that already have solid content.`;
}

export function ideaGapFillUserPrompt(idea, sparseKeys) {
  const context = {};
  for (const def of IDEA_FIELD_DEFS) {
    const v = idea?.[def.key];
    if (v == null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    context[def.key] = v;
  }
  return `Existing idea context (do not contradict):
${JSON.stringify(context, null, 2)}

Sparse / empty fields to propose content for (only these keys):
${JSON.stringify(sparseKeys)}

Return JSON with only those keys filled.`;
}

/**
 * True when gap-fill would invent a whole idea (form is blank / nearly blank).
 * Must not charge tokens in this case.
 */
export function isIdeaTooEmptyForGapFill(idea = {}) {
  const title = String(idea?.title || '').trim();
  const summary = String(idea?.summary || '').trim();
  const description = String(idea?.description || '').trim();
  if (title.length >= 8) return false;
  if (summary.length >= 40) return false;
  if (description.length >= 80) return false;
  return true;
}

/** Heuristic: empty or clearly under-developed fields. */
export function findSparseFields(idea = {}) {
  const sparse = [];

  const strSparse = (key, minLen) => {
    const v = idea?.[key];
    if (v == null) {
      sparse.push(key);
      return;
    }
    const s = String(v).trim();
    if (!s || s.length < minLen) sparse.push(key);
  };

  // Never treat solid core fields as sparse just because they are short of ideal —
  // only empty or clearly thin. Title sparse only if missing / tiny.
  strSparse('title', 3);
  if (!String(idea?.category || '').trim()) sparse.push('category');
  strSparse('summary', 40);
  strSparse('description', 120);
  strSparse('tags', 2);

  // If title/summary/description already have real content, do NOT list them as sparse
  // unless truly empty (re-filter below)
  const filterSolidCore = (key, minSolid) => {
    const s = String(idea?.[key] || '').trim();
    if (s.length >= minSolid) {
      const i = sparse.indexOf(key);
      if (i >= 0) sparse.splice(i, 1);
    }
  };
  filterSolidCore('title', 8);
  filterSolidCore('summary', 40);
  filterSolidCore('description', 80);

  const hasCoreContext =
    String(idea?.title || '').trim().length >= 3 ||
    String(idea?.summary || '').trim().length >= 20 ||
    String(idea?.description || '').trim().length >= 40;

  const optionalMins = {
    artStyle: 30,
    targetPlatforms: 20,
    coreLoopLength: 15,
    primaryInspiration: 30,
    estimatedScope: 20,
    twitchIntegration: 40,
    environmentalStorytelling: 40,
    economySystem: 40,
    storyNarrative: 40,
  };
  // Only expand optionals when there is enough core context to stay on-theme
  if (hasCoreContext) {
    for (const [k, min] of Object.entries(optionalMins)) {
      const v = idea?.[k];
      if (v == null || String(v).trim() === '') {
        sparse.push(k);
      } else if (String(v).trim().length < min) {
        sparse.push(k);
      }
    }
  }

  const features = idea?.features;
  if (!Array.isArray(features) || features.length === 0) {
    if (hasCoreContext) sparse.push('features');
  } else {
    const meaningful = features.filter(
      (f) =>
        f &&
        (String(f.name || '').trim() || String(f.description || '').trim())
    );
    if (meaningful.length === 0 && hasCoreContext) sparse.push('features');
  }

  // Prefer core + at most 6 sparse keys total for focus
  const core = ['title', 'category', 'summary', 'description', 'features'];
  const coreSparse = sparse.filter((k) => core.includes(k));
  const optSparse = sparse.filter((k) => !core.includes(k));
  return [...coreSparse, ...optSparse.slice(0, 6)];
}

export function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  // Strip markdown fences if model ignores instructions
  let s = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(s);
  } catch {
    /* fall through */
  }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(s.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function clampStr(key, value, max) {
  const r = enforceFieldLimit(key, value ?? '', { mode: 'truncate' });
  let t = String(r.value || '').trim();
  if (max && t.length > max) t = t.slice(0, max);
  return t;
}

/**
 * Normalize + clamp AI output to Idea form shape.
 */
export function clampIdeaFields(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};

  if (raw.title != null) {
    out.title = clampStr('title', raw.title, 100);
  }
  if (raw.category != null) {
    const c = String(raw.category).trim();
    out.category = IDEA_CATEGORIES.includes(c) ? c : 'Other';
  }
  if (raw.summary != null) {
    out.summary = clampStr('summary', raw.summary, 300);
  }
  if (raw.description != null) {
    out.description = clampStr('description', raw.description, 4000);
  }
  if (raw.tags != null) {
    out.tags = clampStr('tags', raw.tags, 480);
  }

  const optionalKeys = [
    'artStyle',
    'targetPlatforms',
    'coreLoopLength',
    'primaryInspiration',
    'estimatedScope',
    'twitchIntegration',
    'environmentalStorytelling',
    'economySystem',
    'storyNarrative',
  ];
  const maxMap = {
    artStyle: 1000,
    targetPlatforms: 1000,
    coreLoopLength: 800,
    primaryInspiration: 1500,
    estimatedScope: 800,
    twitchIntegration: 2000,
    environmentalStorytelling: 2000,
    economySystem: 2000,
    storyNarrative: 2000,
  };
  for (const k of optionalKeys) {
    if (raw[k] == null) continue;
    const t = clampStr(k, raw[k], maxMap[k]);
    if (t) out[k] = t;
  }

  if (Array.isArray(raw.features)) {
    out.features = raw.features
      .slice(0, 8)
      .map((f) => {
        if (!f || typeof f !== 'object') {
          const d = clampStr('feature_description', f, 500);
          return d ? { name: '', description: d } : null;
        }
        return {
          name: clampStr('feature_name', f.name ?? f.title ?? '', 80),
          description: clampStr(
            'feature_description',
            f.description ?? f.body ?? '',
            500
          ),
        };
      })
      .filter((f) => f && (f.name || f.description));
  }

  if (Array.isArray(raw.additionalNotes)) {
    out.additionalNotes = raw.additionalNotes
      .slice(0, 8)
      .map((n) => clampStr('additional_note', n, 2000))
      .filter(Boolean);
  }

  return out;
}

export function fieldLabel(key) {
  return IDEA_FIELD_DEFS.find((f) => f.key === key)?.label || key;
}

export function summarizePrompt(text, max = 120) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
