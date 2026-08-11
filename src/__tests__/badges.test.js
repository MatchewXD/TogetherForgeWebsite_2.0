import { describe, it, expect } from 'vitest';
import {
  mapCustomDonationTier,
  mapCustomMonthlyTier,
  resolveDonationTierMeta,
  expectedBadgeKeys,
  getBadgeDef,
  getBadgeImageSrc,
  BADGE_CATALOG,
  DONATION_THRESHOLDS_DOLLARS,
  TASK_THRESHOLDS,
} from '../constants/badges';

describe('mapCustomDonationTier', () => {
  it('maps $5–$19.99 → supporter', () => {
    expect(mapCustomDonationTier(500).tierId).toBe('supporter');
    expect(mapCustomDonationTier(1999).tierId).toBe('supporter');
  });
  it('maps $20–$49.99 → member', () => {
    expect(mapCustomDonationTier(2000).tierId).toBe('member');
    expect(mapCustomDonationTier(4999).tierId).toBe('member');
  });
  it('maps $50+ → builder', () => {
    expect(mapCustomDonationTier(5000).tierId).toBe('builder');
    expect(mapCustomDonationTier(999999).tierId).toBe('builder');
  });
});

describe('mapCustomMonthlyTier', () => {
  it('maps monthly brackets', () => {
    expect(mapCustomMonthlyTier(500).tierId).toBe('supporter');
    expect(mapCustomMonthlyTier(1500).tierId).toBe('member');
    expect(mapCustomMonthlyTier(4000).tierId).toBe('builder');
  });
});

describe('resolveDonationTierMeta', () => {
  it('keeps explicit tier ids', () => {
    expect(
      resolveDonationTierMeta({ tierId: 'member', amountCents: 99999 }).tierId
    ).toBe('member');
  });
  it('maps custom one-time by amount', () => {
    expect(
      resolveDonationTierMeta({
        tierId: 'custom',
        amountCents: 2500,
        interval: 'once',
      }).tierId
    ).toBe('member');
  });
});

describe('expectedBadgeKeys', () => {
  it('grants donor and donation milestones', () => {
    const keys = expectedBadgeKeys({ totalCents: 10000 }); // $100
    expect(keys).toContain('status_donor');
    expect(keys).toContain('donation_10');
    expect(keys).toContain('donation_50');
    expect(keys).toContain('donation_100');
    expect(keys).not.toContain('donation_250');
  });
  it('grants task milestones', () => {
    const keys = expectedBadgeKeys({ tasksCompleted: 10 });
    expect(keys).toContain('tasks_1');
    expect(keys).toContain('tasks_5');
    expect(keys).toContain('tasks_10');
    expect(keys).not.toContain('tasks_25');
  });
  it('grants active subscriber only when active', () => {
    expect(expectedBadgeKeys({ hasActiveSub: true })).toContain(
      'status_active_subscriber'
    );
    expect(expectedBadgeKeys({ hasActiveSub: false })).not.toContain(
      'status_active_subscriber'
    );
  });

  it('grants game shipper when hasShippedGame', () => {
    expect(expectedBadgeKeys({ hasShippedGame: true })).toContain(
      'status_game_shipper'
    );
    expect(expectedBadgeKeys({ hasShippedGame: false })).not.toContain(
      'status_game_shipper'
    );
  });
});

describe('catalog', () => {
  it('has unique keys covering thresholds', () => {
    const keys = BADGE_CATALOG.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const d of DONATION_THRESHOLDS_DOLLARS) {
      expect(getBadgeDef(`donation_${d}`)).toBeTruthy();
    }
    for (const t of TASK_THRESHOLDS) {
      expect(getBadgeDef(`tasks_${t}`)).toBeTruthy();
    }
    expect(getBadgeDef('status_game_shipper')?.name).toBe('Game Shipper');
  });
});

describe('getBadgeImageSrc', () => {
  it('maps existing status and donor art', () => {
    expect(getBadgeImageSrc('status_donor')).toBe(
      '/images/Badges/Donator.png'
    );
    expect(getBadgeImageSrc('status_active_subscriber')).toBe(
      '/images/Badges/Active_Subscriber.png'
    );
    expect(getBadgeImageSrc('donation_10')).toBe(
      '/images/Badges/10_donor.png'
    );
    expect(getBadgeImageSrc('donation_500')).toBe(
      '/images/Badges/500_donor.png'
    );
    expect(getBadgeImageSrc('donation_1000')).toBe(
      '/images/Badges/1000_donor.png'
    );
  });

  it('conventions for future donation files', () => {
    expect(getBadgeImageSrc('donation_2500')).toBe(
      '/images/Badges/2500_donor.png'
    );
  });

  it('returns null for badges without art yet', () => {
    expect(getBadgeImageSrc('status_game_shipper')).toBeNull();
    expect(getBadgeImageSrc('tasks_1')).toBeNull();
  });
});
