/**
 * Named vs anonymous donation credit resolution (checkout metadata).
 */
import { describe, it, expect } from 'vitest';
import { resolveDonationCredit } from '../components/support/DonationCreditChoice';

describe('resolveDonationCredit', () => {
  it('anonymous when user opts out (may still pass userId for internal records)', () => {
    const r = resolveDonationCredit({
      wantPublicCredit: false,
      authUser: { id: 'u1' },
      username: 'alice',
    });
    expect(r.isAnonymous).toBe(true);
    expect(r.displayName).toBeNull();
    expect(r.error).toBeNull();
  });

  it('requires sign-in for public credit', () => {
    const r = resolveDonationCredit({
      wantPublicCredit: true,
      authUser: null,
      username: 'alice',
    });
    expect(r.isAnonymous).toBe(true);
    expect(r.error).toMatch(/Sign in/i);
  });

  it('requires username for public credit', () => {
    const r = resolveDonationCredit({
      wantPublicCredit: true,
      authUser: { id: 'u1' },
      username: '  ',
    });
    expect(r.isAnonymous).toBe(true);
    expect(r.error).toMatch(/username/i);
  });

  it('public credit when signed in with username', () => {
    const r = resolveDonationCredit({
      wantPublicCredit: true,
      authUser: { id: 'u1' },
      username: 'forge_dev',
    });
    expect(r).toEqual({
      isAnonymous: false,
      userId: 'u1',
      displayName: 'forge_dev',
      error: null,
    });
  });
});
