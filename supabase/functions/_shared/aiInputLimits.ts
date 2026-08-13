/**
 * Pre-call hard limits for AI actions (server).
 * Keep aligned with src/utils/aiInputLimits.js + src/constants/aiTokens.js
 */

// deno-lint-ignore-file
// @ts-nocheck
import {
  AI_COMPLETION_MAX_TOKENS,
  AI_IDEA_FIELD_LIMITS,
  AI_MAX_INPUT_CHARS,
} from './aiTokenPacks.ts';

const FIELD_ALIASES = {
  artStyle: 'art_style',
  targetPlatforms: 'target_platforms',
  coreLoopLength: 'core_loop_length',
  primaryInspiration: 'primary_inspiration',
  estimatedScope: 'estimated_scope',
  twitchIntegration: 'twitch_community',
  twitch_integration: 'twitch_community',
  environmentalStorytelling: 'environmental_storytelling',
  economySystem: 'economy_system',
  storyNarrative: 'story_narrative',
  storyOverview: 'story_narrative',
};

function resolveFieldKey(key) {
  const k = String(key || '');
  if (AI_IDEA_FIELD_LIMITS[k] != null) return k;
  if (FIELD_ALIASES[k]) return FIELD_ALIASES[k];
  const snake = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
  if (AI_IDEA_FIELD_LIMITS[snake] != null) return snake;
  return k;
}

export function enforceFieldLimit(fieldKey, value, opts = {}) {
  const mode = opts.mode === 'truncate' ? 'truncate' : 'reject';
  const key = resolveFieldKey(fieldKey);
  const max = AI_IDEA_FIELD_LIMITS[key];
  const text = value == null ? '' : String(value);
  if (max == null) return { ok: true, value: text };
  if (text.length <= max) return { ok: true, value: text };
  if (mode === 'truncate') {
    return { ok: true, value: text.slice(0, max), truncated: true };
  }
  return {
    ok: false,
    value: text,
    code: 'FIELD_TOO_LONG',
    message: `"${key}" is too long (max ${max} characters). Shorten it and try again.`,
  };
}

export function enforceIdeaFields(fields, opts = {}) {
  const mode = opts.mode === 'truncate' ? 'truncate' : 'reject';
  const out = {};
  const errors = [];
  if (!fields || typeof fields !== 'object') {
    return { ok: true, fields: {}, errors: [] };
  }
  for (const [key, raw] of Object.entries(fields)) {
    if (raw == null) continue;
    if (Array.isArray(raw)) {
      out[key] = raw.map((item, i) => {
        if (item && typeof item === 'object') {
          const name = enforceFieldLimit(
            'feature_name',
            item.name ?? item.title ?? '',
            { mode }
          );
          const desc = enforceFieldLimit(
            'feature_description',
            item.description ?? item.body ?? '',
            { mode }
          );
          if (!name.ok) errors.push(name.message);
          if (!desc.ok) errors.push(desc.message);
          return { ...item, name: name.value, description: desc.value };
        }
        const line = enforceFieldLimit('additional_note', item, { mode });
        if (!line.ok) errors.push(line.message);
        return line.value;
      });
      continue;
    }
    if (typeof raw === 'object') continue;
    const r = enforceFieldLimit(key, raw, { mode });
    if (!r.ok) errors.push(r.message);
    out[key] = r.value;
  }
  return {
    ok: errors.length === 0,
    fields: out,
    errors,
    message: errors[0] || null,
  };
}

export function enforceMaxInputChars(promptText, opts = {}) {
  const mode = opts.mode === 'truncate' ? 'truncate' : 'reject';
  const max = Math.max(1, Number(opts.maxChars) || AI_MAX_INPUT_CHARS);
  const text = promptText == null ? '' : String(promptText);
  if (text.length <= max) {
    return { ok: true, value: text, length: text.length, max };
  }
  if (mode === 'truncate') {
    return {
      ok: true,
      value: text.slice(0, max),
      length: max,
      max,
      truncated: true,
    };
  }
  return {
    ok: false,
    value: text,
    length: text.length,
    max,
    code: 'INPUT_TOO_LONG',
    message: `This request is too long (max ${max.toLocaleString()} characters). Shorten your idea text and try again.`,
  };
}

export function getCompletionMaxTokens() {
  return AI_COMPLETION_MAX_TOKENS;
}
