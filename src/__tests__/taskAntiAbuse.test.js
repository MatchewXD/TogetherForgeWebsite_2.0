/**
 * Progressive trust, evidence, and identity gate pure rules.
 */
import { describe, it, expect } from 'vitest';
import {
  NEW_USER_CLAIM_LIMIT,
  ESTABLISHED_CLAIM_LIMIT,
  MAX_ACTIVE_CLAIMS,
  CLAIM_LIMIT_UNLOCK_COMPLETIONS,
  TRUSTED_CLAIM_UNLOCK_COMPLETIONS,
  NEW_USER_SUBMIT_LIMIT_24H,
  ESTABLISHED_SUBMIT_LIMIT_24H,
  TRUSTED_SUBMIT_LIMIT_24H,
  claimLimitForAcceptedCount,
  submitLimit24hForAcceptedCount,
  trustTierFromAccepted,
  userMeetsIdentityGate,
  identityGateBlockedReason,
} from '../services/tasksService';
import {
  isValidEvidenceUrl,
  normalizeEvidenceUrl,
  validateReviewEvidencePackage,
  composeReviewEvidence,
  REVIEW_EVIDENCE_MIN_CHARS,
} from '../constants/taskReviewEvidence';

describe('progressive claim limits', () => {
  it('uses product tiers: 0→2, 2+→3, 5+→5', () => {
    expect(claimLimitForAcceptedCount(0)).toBe(NEW_USER_CLAIM_LIMIT);
    expect(claimLimitForAcceptedCount(1)).toBe(NEW_USER_CLAIM_LIMIT);
    expect(claimLimitForAcceptedCount(2)).toBe(ESTABLISHED_CLAIM_LIMIT);
    expect(claimLimitForAcceptedCount(4)).toBe(ESTABLISHED_CLAIM_LIMIT);
    expect(claimLimitForAcceptedCount(5)).toBe(MAX_ACTIVE_CLAIMS);
    expect(claimLimitForAcceptedCount(99)).toBe(MAX_ACTIVE_CLAIMS);
    expect(CLAIM_LIMIT_UNLOCK_COMPLETIONS).toBe(2);
    expect(TRUSTED_CLAIM_UNLOCK_COMPLETIONS).toBe(5);
  });
});

describe('submit velocity limits', () => {
  it('caps submits per 24h by accepted count', () => {
    expect(submitLimit24hForAcceptedCount(0)).toBe(NEW_USER_SUBMIT_LIMIT_24H);
    expect(submitLimit24hForAcceptedCount(2)).toBe(
      ESTABLISHED_SUBMIT_LIMIT_24H
    );
    expect(submitLimit24hForAcceptedCount(5)).toBe(TRUSTED_SUBMIT_LIMIT_24H);
    expect(NEW_USER_SUBMIT_LIMIT_24H).toBe(2);
    expect(ESTABLISHED_SUBMIT_LIMIT_24H).toBe(4);
    expect(TRUSTED_SUBMIT_LIMIT_24H).toBe(12);
  });
});

describe('trustTierFromAccepted', () => {
  it('maps accepted count to New / Established / Trusted', () => {
    expect(trustTierFromAccepted(0).label).toBe('New');
    expect(trustTierFromAccepted(2).label).toBe('Established');
    expect(trustTierFromAccepted(5).label).toBe('Trusted');
    expect(trustTierFromAccepted(0, { isRestricted: true }).label).toBe(
      'Restricted'
    );
  });
});

describe('identity gate', () => {
  it('requires verified email + Discord, Google, or GitHub', () => {
    expect(userMeetsIdentityGate(null)).toBe(false);
    expect(
      userMeetsIdentityGate({
        email_confirmed_at: '2024-01-01',
        identities: [{ provider: 'email' }],
      })
    ).toBe(false);
    expect(
      userMeetsIdentityGate({
        email_confirmed_at: null,
        identities: [{ provider: 'discord' }],
      })
    ).toBe(false);
    expect(
      userMeetsIdentityGate({
        email_confirmed_at: '2024-01-01',
        identities: [{ provider: 'discord' }],
      })
    ).toBe(true);
    expect(
      userMeetsIdentityGate({
        email_confirmed_at: '2024-01-01',
        identities: [{ provider: 'google' }],
      })
    ).toBe(true);
    expect(
      userMeetsIdentityGate({
        email_confirmed_at: '2024-01-01',
        identities: [{ provider: 'github' }],
      })
    ).toBe(true);
    expect(
      userMeetsIdentityGate({
        email_confirmed_at: '2024-01-01',
        app_metadata: { providers: ['google'] },
      })
    ).toBe(true);
  });

  it('returns clear blocked reasons', () => {
    expect(identityGateBlockedReason(null)).toMatch(/Sign in/i);
    expect(
      identityGateBlockedReason({
        email_confirmed_at: null,
        identities: [],
      })
    ).toMatch(/email/i);
    expect(
      identityGateBlockedReason({
        email_confirmed_at: '2024-01-01',
        identities: [{ provider: 'email' }],
      })
    ).toMatch(/Discord|Google|GitHub/i);
  });
});

describe('evidence package', () => {
  it('requires min note length and at least one valid URL', () => {
    expect(
      validateReviewEvidencePackage({ note: 'short', links: [] }).ok
    ).toBe(false);
    expect(
      validateReviewEvidencePackage({
        note: 'A'.repeat(REVIEW_EVIDENCE_MIN_CHARS),
        links: [],
      }).code
    ).toBe('EVIDENCE_LINK_REQUIRED');
    expect(
      validateReviewEvidencePackage({
        note: 'A'.repeat(REVIEW_EVIDENCE_MIN_CHARS),
        links: ['not-a-url'],
      }).code
    ).toBe('EVIDENCE_LINK_INVALID');
    expect(
      validateReviewEvidencePackage({
        note: 'Implemented the dash ability and tests.',
        links: ['https://github.com/org/repo/pull/12'],
      }).ok
    ).toBe(true);
  });

  it('validates light URL shapes', () => {
    expect(isValidEvidenceUrl('https://github.com/a/b')).toBe(true);
    expect(isValidEvidenceUrl('http://drive.google.com/file/d/x')).toBe(true);
    expect(isValidEvidenceUrl('github.com/a/b')).toBe(true);
    expect(isValidEvidenceUrl('localhost/secret')).toBe(false);
    expect(isValidEvidenceUrl('ftp://files.example.com/x')).toBe(false);
    expect(isValidEvidenceUrl('')).toBe(false);
  });

  it('normalizes bare domains to https', () => {
    expect(normalizeEvidenceUrl('github.com/x/y')).toBe(
      'https://github.com/x/y'
    );
    expect(normalizeEvidenceUrl('https://already.com')).toBe(
      'https://already.com'
    );
  });

  it('composeReviewEvidence includes links section for server URL check', () => {
    const text = composeReviewEvidence({
      note: 'Done the work as requested.',
      links: ['https://example.com/pr/1'],
    });
    expect(text).toMatch(/https:\/\/example\.com\/pr\/1/);
    expect(text).toMatch(/Done the work/);
  });
});
