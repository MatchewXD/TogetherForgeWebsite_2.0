/**
 * Public claim kill switch.
 *
 * Client: VITE_ENABLE_CLAIMS
 * Edge: ENABLE_CLAIMS
 *
 * Unset defaults on so production claims keep working.
 * Off blocks new claims only. Existing In Progress claims stay.
 * Staff (founder / moderator / admin / project_lead) may still claim.
 *
 * Values: true/false, 1/0, on/off, yes/no.
 */

import { parseEnableFlag } from './donationsEnabled';

export const CLAIMS_PAUSED_CODE = 'CLAIMS_PAUSED';

export const CLAIMS_PAUSED_ERROR =
  'Claims are paused right now. You can still browse the board.';

export const CLAIMS_PAUSED_LINE =
  'Claims are paused right now. You can still browse the board.';

/**
 * @param {{ VITE_ENABLE_CLAIMS?: string }|undefined} env
 * @returns {boolean}
 */
export function areClaimsEnabled(env = import.meta.env) {
  const explicit = parseEnableFlag(env?.VITE_ENABLE_CLAIMS);
  if (explicit !== null) return explicit;
  return true;
}
