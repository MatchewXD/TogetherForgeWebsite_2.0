/**
 * Shared helpers for idea compose autosave sessions (Guided + Wizard).
 * Session pointer lives in localStorage; full draft body is on the server.
 */

import { localDraftStorageKey } from './ideaOptionalSections';

/** Autosave cadence while the user is working */
export const AUTOSAVE_INTERVAL_MS = 25000;

/** How long the "Draft saved" flash stays visible */
export const AUTOSAVE_FLASH_MS = 2800;

/**
 * True when the form has anything worth persisting as a draft.
 * Avoids creating empty draft rows on open.
 */
export function formHasMeaningfulContent(form = {}) {
  if ((form.title || '').trim()) return true;
  if ((form.category || '').trim()) return true;
  if ((form.summary || '').trim()) return true;
  if ((form.description || '').trim()) return true;
  if ((form.tags || '').trim()) return true;
  if ((form.projectId || form.project_id || '').toString().trim()) return true;
  if (
    (form.parentIdeaId || form.parent_idea_id || '').toString().trim()
  ) {
    return true;
  }

  const features = form.features;
  if (Array.isArray(features)) {
    if (
      features.some(
        (f) =>
          (typeof f === 'string' && f.trim()) ||
          (f && ((f.name || '').trim() || (f.description || '').trim()))
      )
    ) {
      return true;
    }
  }

  const notes = form.additionalNotes ?? form.additional_notes;
  if (Array.isArray(notes) && notes.some((n) => String(n || '').trim())) {
    return true;
  }
  if (typeof notes === 'string' && notes.trim()) return true;

  const singles = [
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
  for (const key of singles) {
    if (form[key] != null && String(form[key]).trim()) return true;
  }

  return false;
}

/** Read in-progress compose session for a flow ('guided' | 'wizard'). */
export function readComposeSession(userId, flow) {
  if (!userId || !flow) return null;
  try {
    const raw = localStorage.getItem(localDraftStorageKey(userId, flow));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persist session pointer (draftId + step + optional form snapshot). */
export function writeComposeSession(userId, flow, data = {}) {
  if (!userId || !flow) return;
  try {
    const prev = readComposeSession(userId, flow) || {};
    localStorage.setItem(
      localDraftStorageKey(userId, flow),
      JSON.stringify({
        ...prev,
        ...data,
        savedAt: Date.now(),
      })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/** Clear compose sessions for both flows (after publish). */
export function clearComposeSessions(userId) {
  if (!userId) return;
  try {
    localStorage.removeItem(localDraftStorageKey(userId, 'guided'));
    localStorage.removeItem(localDraftStorageKey(userId, 'wizard'));
  } catch {
    /* ignore */
  }
}

/** Clear one flow only. */
export function clearComposeSession(userId, flow) {
  if (!userId || !flow) return;
  try {
    localStorage.removeItem(localDraftStorageKey(userId, flow));
  } catch {
    /* ignore */
  }
}
