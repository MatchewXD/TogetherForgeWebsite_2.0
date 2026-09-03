import { describe, it, expect } from 'vitest';
import {
  STAFF_CREDIT_CATEGORIES,
  STAFF_CREDIT_PENDING_LABEL,
  STAFF_CREDIT_PRIVATE_FIELDS,
  STAFF_CREDIT_SOURCE_LABEL,
  STAFF_CREDIT_SOURCE_PREFIX,
  isDuplicateStaffCreditGrant,
  isPendingStaffCredit,
  isStaffCreditSourceKey,
  shouldListOnProjectContributors,
  staffCreditCategoryById,
  staffCreditGrantIdFromSourceKey,
  staffCreditPublicName,
  looksLikeEmail,
  staffCreditSourceKey,
  stripStaffCreditPrivateFields,
} from '../constants/staffCredit';
import { getBadgeDef } from '../constants/badges';

describe('staff Grant Credit categories', () => {
  it('covers the seven public categories and maps onto memorial buckets', () => {
    expect(STAFF_CREDIT_CATEGORIES.map((c) => c.id)).toEqual([
      'community_moderation',
      'playtest',
      'content',
      'documentation',
      'offsite_development',
      'organizing',
      'other',
    ]);
    expect(staffCreditCategoryById('community_moderation')).toMatchObject({
      category: 'community',
      subcategory: 'Moderation',
    });
    expect(staffCreditCategoryById('playtest').subcategory).toBe('Playtesting');
    expect(staffCreditCategoryById('content')).toMatchObject({
      category: 'marketing',
      subcategory: 'Content Creation',
    });
    expect(staffCreditCategoryById('documentation').category).toBe(
      'development'
    );
    expect(staffCreditCategoryById('offsite_development').category).toBe(
      'development'
    );
  });
});

describe('staff credit source keys', () => {
  it('round-trips grant ids and ignores other memorial keys', () => {
    const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    expect(staffCreditSourceKey(id)).toBe(`${STAFF_CREDIT_SOURCE_PREFIX}${id}`);
    expect(staffCreditGrantIdFromSourceKey(staffCreditSourceKey(id))).toBe(id);
    expect(isStaffCreditSourceKey('task:123')).toBe(false);
    expect(isStaffCreditSourceKey('official-media:abc:def')).toBe(false);
  });
});

describe('public contributor listing', () => {
  it('includes bound accounts and pending staff credits, not donations or guests', () => {
    expect(
      shouldListOnProjectContributors({
        userId: 'u1',
        category: 'community',
      })
    ).toBe(true);
    expect(
      shouldListOnProjectContributors({
        userId: null,
        category: 'community',
        sourceKey: staffCreditSourceKey('g1'),
      })
    ).toBe(true);
    expect(
      shouldListOnProjectContributors({
        userId: null,
        category: 'community',
        sourceKey: 'manual',
      })
    ).toBe(false);
    expect(
      shouldListOnProjectContributors({
        userId: 'u1',
        category: 'donations',
      })
    ).toBe(false);
  });

  it('pending public name uses the credit line, never an email', () => {
    const pending = {
      userId: null,
      sourceKey: staffCreditSourceKey('g1'),
      roleLabel: 'Discord moderation, September 2026',
      displayName: 'Discord moderation, September 2026',
      pendingEmail: 'secret@example.com',
    };
    expect(isPendingStaffCredit(pending)).toBe(true);
    const name = staffCreditPublicName(pending);
    expect(name).toBe('Discord moderation, September 2026');
    expect(name).not.toMatch(/@/);
    expect(name).not.toBe(pending.pendingEmail);
    expect(STAFF_CREDIT_PENDING_LABEL).toBe('Pending account');
    expect(STAFF_CREDIT_SOURCE_LABEL).toBe('Staff credited');
  });

  it('strips email, staff notes, and revoke reasons from public views', () => {
    const publicRow = stripStaffCreditPrivateFields({
      publicLine: 'Playtest weekend',
      pendingEmail: 'hidden@togetherforge.net',
      privateNote: 'Paid in pizza',
      revokeReason: 'wrong person',
      email: 'hidden@togetherforge.net',
      points: 10,
    });
    for (const key of STAFF_CREDIT_PRIVATE_FIELDS) {
      expect(publicRow).not.toHaveProperty(key);
    }
    expect(publicRow.publicLine).toBe('Playtest weekend');
    expect(publicRow.points).toBe(10);
  });
});

describe('duplicate identical grants', () => {
  const base = {
    userId: 'u1',
    projectId: 'p1',
    grantCategory: 'playtest',
    publicLine: 'Playtest weekend',
  };

  it('flags the same user, project, category, and public line', () => {
    expect(isDuplicateStaffCreditGrant(base, { ...base })).toBe(true);
    expect(
      isDuplicateStaffCreditGrant(base, { ...base, publicLine: 'Different' })
    ).toBe(false);
    expect(
      isDuplicateStaffCreditGrant(base, { ...base, projectId: 'p2' })
    ).toBe(false);
    expect(
      isDuplicateStaffCreditGrant(
        { ...base, revokedAt: '2026-01-01' },
        { ...base }
      )
    ).toBe(false);
  });

  it('also matches pending-email grants by hash', () => {
    const pending = {
      userId: null,
      pendingEmailHash: 'abc',
      projectId: null,
      grantCategory: 'organizing',
      publicLine: 'Meetup host',
    };
    expect(isDuplicateStaffCreditGrant(pending, { ...pending })).toBe(true);
    expect(
      isDuplicateStaffCreditGrant(pending, {
        ...pending,
        pendingEmailHash: 'other',
      })
    ).toBe(false);
  });
});

describe('recognition options', () => {
  it('reuses the current badge catalog rather than a new family', () => {
    expect(getBadgeDef('starter_first_idea')?.name).toBe('First Idea');
    expect(getBadgeDef('staff_offsite_helper')).toBeNull();
  });

  it('treats emails as bind-to-account identifiers', () => {
    expect(looksLikeEmail('Alex@TogetherForge.net')).toBe(true);
    expect(looksLikeEmail('not-an-email')).toBe(false);
  });
});
