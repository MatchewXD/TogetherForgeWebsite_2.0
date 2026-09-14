import { describe, it, expect } from 'vitest';
import {
  areClaimsEnabled,
  CLAIMS_PAUSED_LINE,
} from '../constants/claimsEnabled';

describe('areClaimsEnabled', () => {
  it('defaults on when unset so production claims keep working', () => {
    expect(areClaimsEnabled({})).toBe(true);
  });

  it('follows VITE_ENABLE_CLAIMS', () => {
    expect(areClaimsEnabled({ VITE_ENABLE_CLAIMS: 'true' })).toBe(true);
    expect(areClaimsEnabled({ VITE_ENABLE_CLAIMS: 'false' })).toBe(false);
    expect(areClaimsEnabled({ VITE_ENABLE_CLAIMS: 'off' })).toBe(false);
  });

  it('keeps pause copy calm and specific', () => {
    expect(CLAIMS_PAUSED_LINE).toBe(
      'Claims are paused right now. You can still browse the board.'
    );
  });
});
