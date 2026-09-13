/**
 * Polls public nav + vote actions.
 *
 * VITE_ENABLE_POLLS: true/false (also 1/0, on/off, yes/no).
 * Unset defaults off so production stays dark until Matthew flips the flag.
 * Staging sets VITE_ENABLE_POLLS=true.
 *
 * Does not bind Tether, StyleLock, or the task board. Votes inform staff.
 */

import { parseEnableFlag } from './donationsEnabled';

export function arePollsEnabled(env = import.meta.env) {
  const explicit = parseEnableFlag(env?.VITE_ENABLE_POLLS);
  if (explicit !== null) return explicit;
  return false;
}
