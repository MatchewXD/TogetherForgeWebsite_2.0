/**
 * Structured estimated effort for task create/edit and board display.
 * Stored as stable display strings in tasks.estimated_effort (text column).
 */

/** Preset options — value is what we store and show on cards */
export const TASK_EFFORT_OPTIONS = [
  { value: '< 1 hour', label: '< 1 hour' },
  { value: '1–2 hours', label: '1–2 hours' },
  { value: '2–4 hours', label: '2–4 hours' },
  { value: 'Half day', label: 'Half day (~4–6 hours)' },
  { value: '1 day', label: '1 day' },
  { value: '2–3 days', label: '2–3 days' },
  { value: 'About a week', label: 'About a week' },
];

const VALUE_SET = new Set(TASK_EFFORT_OPTIONS.map((o) => o.value));

/** True when value is one of the structured presets (or empty). */
export function isStructuredTaskEffort(value) {
  if (value == null || value === '') return true;
  return VALUE_SET.has(String(value).trim());
}

/**
 * Normalize free-text legacy efforts into a preset when we can guess.
 * Unknown strings are returned unchanged so staff can re-pick a preset.
 */
export function normalizeTaskEffort(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  if (!s) return '';
  if (VALUE_SET.has(s)) return s;

  const lower = s.toLowerCase().replace(/–/g, '-').replace(/\s+/g, ' ');

  // Common free-text patterns → nearest preset
  if (
    /^(< ?1|under 1|less than 1|30 ?m|45 ?m|quick|tiny)/i.test(lower) ||
    lower === '1h' ||
    lower === '<1h'
  ) {
    return '< 1 hour';
  }
  if (
    /1\s*-\s*2\s*h|1\s*to\s*2\s*h|1-2 hours|couple hours|2h\b/i.test(lower)
  ) {
    return '1–2 hours';
  }
  if (/2\s*-\s*4|2\s*to\s*4|3\s*-\s*4|few hours|afternoon/i.test(lower)) {
    return '2–4 hours';
  }
  if (/half[\s-]?day|4\s*-\s*6|morning|4h|5h|6h/i.test(lower)) {
    return 'Half day';
  }
  if (/^1\s*day|full day|8h|one day/i.test(lower)) {
    return '1 day';
  }
  if (/2\s*-\s*3\s*day|2\s*to\s*3\s*day|couple days|2 days|3 days/i.test(lower)) {
    return '2–3 days';
  }
  if (/week|5\s*-\s*7|several days|multi[\s-]?day/i.test(lower)) {
    return 'About a week';
  }

  return s;
}
