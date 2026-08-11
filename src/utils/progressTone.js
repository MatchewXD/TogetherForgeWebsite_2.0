/**
 * Progress bar / label colors by completion closeness.
 * Stale claims keep warning so aging still stands out.
 *
 * @param {number} percent 0–100
 * @param {{ isCompleted?: boolean, isStale?: boolean }} [opts]
 * @returns {{ text: string, bar: string }}
 */
export function progressTone(percent, { isCompleted = false, isStale = false } = {}) {
  if (isCompleted) {
    return {
      text: 'text-semantic-success',
      bar: 'bg-semantic-success',
    };
  }
  if (isStale) {
    return {
      text: 'text-semantic-warning',
      bar: 'bg-semantic-warning',
    };
  }

  const p = Math.min(100, Math.max(0, Number(percent) || 0));

  // Near done
  if (p >= 80) {
    return {
      text: 'text-semantic-success',
      bar: 'bg-semantic-success',
    };
  }
  // Solid progress
  if (p >= 50) {
    return {
      text: 'text-neon-cyan',
      bar: 'bg-neon-cyan',
    };
  }
  // Early progress
  if (p >= 25) {
    return {
      text: 'text-semantic-warning',
      bar: 'bg-semantic-warning',
    };
  }
  // Just started (still a clear tint, not flat grey)
  return {
    text: 'text-neon-purple',
    bar: 'bg-neon-purple',
  };
}
