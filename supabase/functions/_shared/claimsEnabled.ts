/**
 * Public claim kill switch for Edge (claim-task).
 * Switch: ENABLE_CLAIMS. Unset defaults on.
 * Staff bypass is applied by the caller, not here.
 */

export const CLAIMS_PAUSED_CODE = 'CLAIMS_PAUSED';

export const CLAIMS_PAUSED_ERROR =
  'Claims are paused right now. You can still browse the board.';

export function parseEnableFlag(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  if (!v) return null;
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return null;
}

export function areClaimsEnabled(): boolean {
  const explicit = parseEnableFlag(Deno.env.get('ENABLE_CLAIMS'));
  if (explicit !== null) return explicit;
  return true;
}
