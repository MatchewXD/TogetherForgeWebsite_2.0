/**
 * Client-side sparse/empty heuristics for Gap Filling.
 * Keep aligned with supabase/functions/_shared/ideaAiSchema.ts findSparseFields.
 */

const OPTIONAL_MINS = {
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

/**
 * True when the form lacks enough core content for gap-fill (would invent an idea).
 */
export function isIdeaTooEmptyForGapFill(form = {}) {
  const title = String(form.title || '').trim();
  const summary = String(form.summary || '').trim();
  const description = String(form.description || '').trim();
  // Require at least one substantial core field
  if (title.length >= 8) return false;
  if (summary.length >= 40) return false;
  if (description.length >= 80) return false;
  return true;
}

/**
 * Whether a single field is empty or clearly under-developed on the form.
 */
export function isFieldSparseOnForm(form = {}, key) {
  if (key === 'category') {
    return !String(form.category || '').trim();
  }
  if (key === 'features') {
    const features = form.features;
    if (!Array.isArray(features) || features.length === 0) return true;
    const meaningful = features.filter(
      (f) =>
        f &&
        (String(f.name || '').trim() || String(f.description || '').trim())
    );
    return meaningful.length === 0;
  }
  if (key === 'additionalNotes') {
    const notes = form.additionalNotes;
    if (!Array.isArray(notes) || notes.length === 0) return true;
    return !notes.some((n) => String(n || '').trim());
  }
  const mins = {
    title: 3,
    summary: 40,
    description: 120,
    tags: 2,
    ...OPTIONAL_MINS,
  };
  const min = mins[key] ?? 20;
  const v = form[key];
  if (v == null) return true;
  const s = String(v).trim();
  return !s || s.length < min;
}

/**
 * Keys that Gap Filling may fill (empty / sparse only).
 */
export function findSparseFieldsOnForm(form = {}) {
  const sparse = [];
  const pushIf = (key) => {
    if (isFieldSparseOnForm(form, key)) sparse.push(key);
  };

  pushIf('title');
  pushIf('category');
  pushIf('summary');
  pushIf('description');
  pushIf('tags');

  const hasCoreContext =
    String(form.title || '').trim().length >= 3 ||
    String(form.summary || '').trim().length >= 20 ||
    String(form.description || '').trim().length >= 40;

  if (hasCoreContext) {
    for (const k of Object.keys(OPTIONAL_MINS)) {
      pushIf(k);
    }
    pushIf('features');
  }

  const core = ['title', 'category', 'summary', 'description', 'features'];
  const coreSparse = sparse.filter((k) => core.includes(k));
  const optSparse = sparse.filter((k) => !core.includes(k));
  return [...coreSparse, ...optSparse.slice(0, 6)];
}

export const GAP_FILL_EMPTY_MESSAGE =
  'Add a title, summary, or description first. Gap Filling expands an existing idea. It will not invent one from a blank form.';
