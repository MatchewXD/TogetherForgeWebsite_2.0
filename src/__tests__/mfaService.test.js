/**
 * MFA status helpers: when the session needs a TOTP challenge.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const listFactors = vi.fn();
const getAuthenticatorAssuranceLevel = vi.fn();
const challengeAndVerify = vi.fn();
const enroll = vi.fn();
const unenroll = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      mfa: {
        listFactors: (...a) => listFactors(...a),
        getAuthenticatorAssuranceLevel: (...a) =>
          getAuthenticatorAssuranceLevel(...a),
        challengeAndVerify: (...a) => challengeAndVerify(...a),
        enroll: (...a) => enroll(...a),
        unenroll: (...a) => unenroll(...a),
      },
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

import { mfaService } from '../services/mfaService';

describe('mfaService.getStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports disabled when no verified TOTP factor', async () => {
    listFactors.mockResolvedValue({
      data: { totp: [], all: [] },
      error: null,
    });
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal1' },
      error: null,
    });
    const s = await mfaService.getStatus();
    expect(s.enabled).toBe(false);
    expect(s.factor).toBeNull();
    expect(s.needsChallenge).toBe(false);
  });

  it('reports enabled + needsChallenge when nextLevel is aal2', async () => {
    listFactors.mockResolvedValue({
      data: {
        totp: [{ id: 'f1', status: 'verified', factor_type: 'totp' }],
        all: [],
      },
      error: null,
    });
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal2' },
      error: null,
    });
    const s = await mfaService.getStatus();
    expect(s.enabled).toBe(true);
    expect(s.factor?.id).toBe('f1');
    expect(s.needsChallenge).toBe(true);
  });

  it('does not need challenge when already aal2', async () => {
    listFactors.mockResolvedValue({
      data: {
        totp: [{ id: 'f1', status: 'verified' }],
        all: [],
      },
      error: null,
    });
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal2', nextLevel: 'aal2' },
      error: null,
    });
    const s = await mfaService.getStatus();
    expect(s.enabled).toBe(true);
    expect(s.needsChallenge).toBe(false);
  });
});

describe('mfaService.needsMfaChallenge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('true only when next is aal2 and current is not', async () => {
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal2' },
      error: null,
    });
    expect(await mfaService.needsMfaChallenge()).toBe(true);

    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal2', nextLevel: 'aal2' },
      error: null,
    });
    expect(await mfaService.needsMfaChallenge()).toBe(false);
  });
});

describe('mfaService.confirmEnroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-6-digit codes before verify', async () => {
    await expect(mfaService.confirmEnroll('f1', '12')).rejects.toMatchObject({
      code: 'MFA_CODE_INVALID',
    });
    expect(challengeAndVerify).not.toHaveBeenCalled();
  });

  it('verifies cleaned 6-digit code', async () => {
    challengeAndVerify.mockResolvedValue({ data: {}, error: null });
    await mfaService.confirmEnroll('f1', '123 456');
    expect(challengeAndVerify).toHaveBeenCalledWith({
      factorId: 'f1',
      code: '123456',
    });
  });
});

describe('mfaService.generateRecoveryCodes', () => {
  it('maps Failed to fetch to a deploy hint instead of a raw CORS error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    );
    await expect(
      mfaService.generateRecoveryCodes('123456')
    ).rejects.toMatchObject({
      code: 'RECOVERY_UNAVAILABLE',
    });
    vi.unstubAllGlobals();
  });
});
