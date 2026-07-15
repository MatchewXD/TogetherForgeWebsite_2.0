/**
 * Helpers for responsive optional-detail cards (detail + submit preview).
 *
 * Layout uses CSS grid auto-fit so cards fill available width without
 * left-hugging empty space. Long items span full width.
 */

/** @param {string|null|undefined} text */
export function contentLength(text) {
  if (text == null) return 0;
  return String(text).trim().length;
}

/**
 * Classify by character length.
 * @returns {'short'|'medium'|'long'}
 */
export function classifyContentLength(len) {
  if (len > 480) return 'long';
  if (len > 160) return 'medium';
  return 'short';
}

/**
 * Grid cell classes for auto-fit layouts.
 * Parent should use: grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr))]
 * Long items force full row via col-span-full.
 */
export function guidedGridItemClass(size) {
  if (size === 'long') {
    return 'col-span-full w-full min-w-0';
  }
  // short + medium fill auto-fit tracks; medium can span 2 tracks on wide grids
  if (size === 'medium') {
    return 'w-full min-w-0 sm:col-span-1';
  }
  return 'w-full min-w-0';
}

/** @deprecated use guidedGridItemClass */
export function guidedFlexClass(size) {
  return guidedGridItemClass(size);
}

/** @deprecated use guidedGridItemClass */
export function guidedSpanClass(size) {
  return guidedGridItemClass(size);
}

/** Shared parent grid class for optional detail cards */
export const GUIDED_GRID_CLASS =
  'grid w-full gap-4 md:gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr))]';

/**
 * Build display items for optional-detail grids.
 * Only includes sections with real content.
 */
export function buildGuidedDisplayItems({
  features = [],
  textSections = [],
  notes = [],
} = {}) {
  const featureItems = [];
  const textItems = [];
  const noteItems = [];

  for (const f of features) {
    const name = String(f?.name || '').trim();
    const description = String(f?.description || '').trim();
    if (!name && !description) continue;
    const body = [name, description].filter(Boolean).join('\n');
    const size = classifyContentLength(contentLength(body));
    featureItems.push({
      key: `feature-${featureItems.length}`,
      kind: 'feature',
      label: name || `Feature ${featureItems.length + 1}`,
      body: description || name,
      title: name || null,
      size,
      gridClass: guidedGridItemClass(size),
      flexClass: guidedGridItemClass(size),
      spanClass: guidedGridItemClass(size),
    });
  }

  for (const sec of textSections) {
    const value = String(sec?.value || '').trim();
    if (!value || value === '[]' || value === '{}') continue;
    const size = classifyContentLength(contentLength(value));
    textItems.push({
      key: sec.key || `text-${textItems.length}`,
      kind: 'text',
      label: sec.label,
      body: value,
      size,
      gridClass: guidedGridItemClass(size),
      flexClass: guidedGridItemClass(size),
      spanClass: guidedGridItemClass(size),
    });
  }

  for (let i = 0; i < notes.length; i++) {
    const n = String(notes[i] || '').trim();
    if (!n || n === '[]') continue;
    const size = classifyContentLength(contentLength(n));
    noteItems.push({
      key: `note-${i}`,
      kind: 'note',
      label: notes.length > 1 ? `Note ${i + 1}` : 'Note',
      body: n,
      size,
      gridClass: guidedGridItemClass(size),
      flexClass: guidedGridItemClass(size),
      spanClass: guidedGridItemClass(size),
    });
  }

  return {
    features: featureItems,
    texts: textItems,
    notes: noteItems,
    /** flat list for simple previews */
    all: [...featureItems, ...textItems, ...noteItems],
  };
}
