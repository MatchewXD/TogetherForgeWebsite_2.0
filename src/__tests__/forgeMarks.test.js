import { describe, it, expect } from 'vitest';
import {
  FORGE_MARKS_PER_USD_BASE,
  FORGE_MARK_DONATION_TIERS,
  FORGE_AWARD_TIERS,
  forgeMarksForDonationCents,
  marksPerDollarForCents,
  formatForgeMarks,
  forgeMarkLedgerLabel,
  awardAllowsMessage,
  giverAlreadyPlacedTier,
  summarizeAwardsByTier,
  getAwardNotes,
  sortAwardTotalsByTier,
  FORGE_MARKS_HOVER_HINT,
} from '../utils/forgeMarks';

describe('Forge Marks donation rates (whole-gift, published table)', () => {
  it('uses 100 Marks per $1 as the base rate', () => {
    expect(FORGE_MARKS_PER_USD_BASE).toBe(100);
    expect(forgeMarksForDonationCents(100)).toBe(100);
    expect(forgeMarksForDonationCents(1000)).toBe(1000);
  });

  it('applies the published brackets to the whole gift', () => {
    expect(marksPerDollarForCents(100)).toBe(100);
    expect(marksPerDollarForCents(2499)).toBe(100);
    expect(marksPerDollarForCents(2500)).toBe(110);
    expect(marksPerDollarForCents(4999)).toBe(110);
    expect(marksPerDollarForCents(5000)).toBe(120);
    expect(marksPerDollarForCents(9999)).toBe(120);
    expect(marksPerDollarForCents(10000)).toBe(130);
    expect(marksPerDollarForCents(24999)).toBe(130);
    expect(marksPerDollarForCents(25000)).toBe(140);
    expect(marksPerDollarForCents(49999)).toBe(140);
    expect(marksPerDollarForCents(50000)).toBe(150);
    expect(marksPerDollarForCents(120000)).toBe(150);
  });

  it('credits exact published amounts at the bracket edges', () => {
    expect(forgeMarksForDonationCents(2400)).toBe(2400); // $24 × 100
    expect(forgeMarksForDonationCents(2500)).toBe(2750); // $25 × 110
    expect(forgeMarksForDonationCents(5000)).toBe(6000); // $50 × 120
    expect(forgeMarksForDonationCents(10000)).toBe(13000); // $100 × 130
    expect(forgeMarksForDonationCents(25000)).toBe(35000); // $250 × 140
    expect(forgeMarksForDonationCents(50000)).toBe(75000); // $500 × 150
  });

  it('credits the checkout max ($10,000) at the $500+ rate with no hidden boost', () => {
    expect(forgeMarksForDonationCents(1_000_000)).toBe(1_500_000);
  });

  it('does not grant Marks for empty or invalid amounts', () => {
    expect(forgeMarksForDonationCents(0)).toBe(0);
    expect(forgeMarksForDonationCents(-100)).toBe(0);
    expect(forgeMarksForDonationCents(null)).toBe(0);
    expect(forgeMarksForDonationCents(undefined)).toBe(0);
  });

  it('floors fractional cents × rate (same as SQL integer division)', () => {
    // $24.99 at 100/dollar → 2499
    expect(forgeMarksForDonationCents(2499)).toBe(2499);
    // $25.01 at 110/dollar → floor(2501 * 110 / 100) = 2751
    expect(forgeMarksForDonationCents(2501)).toBe(2751);
  });

  it('lists six transparent tiers and no extra boosts', () => {
    expect(FORGE_MARK_DONATION_TIERS).toHaveLength(6);
    expect(FORGE_MARK_DONATION_TIERS.map((t) => t.marksPerDollar)).toEqual([
      150, 140, 130, 120, 110, 100,
    ]);
  });
});

describe('Community Award tiers', () => {
  it('publishes Spark, Hammer, Anvil, Masterwork at the listed costs', () => {
    expect(FORGE_AWARD_TIERS.map((t) => [t.id, t.marksCost])).toEqual([
      ['spark', 100],
      ['hammer', 200],
      ['anvil', 500],
      ['masterwork', 1000],
    ]);
  });

  it('allows a short message only on Anvil and Masterwork', () => {
    expect(awardAllowsMessage('spark')).toBe(false);
    expect(awardAllowsMessage('hammer')).toBe(false);
    expect(awardAllowsMessage('anvil')).toBe(true);
    expect(awardAllowsMessage('masterwork')).toBe(true);
  });

  it('blocks the same giver from repeating a tier on one post', () => {
    const awards = [{ giverId: 'u1', awardTier: 'spark' }];
    expect(giverAlreadyPlacedTier(awards, 'u1', 'spark')).toBe(true);
    expect(giverAlreadyPlacedTier(awards, 'u1', 'hammer')).toBe(false);
    expect(giverAlreadyPlacedTier(awards, 'u2', 'spark')).toBe(false);
  });

  it('collects only Anvil and Masterwork notes', () => {
    const notes = getAwardNotes([
      { awardTier: 'spark', message: 'nope' },
      { awardTier: 'hammer', message: 'nope' },
      { awardTier: 'anvil', message: '  ' },
      { awardTier: 'anvil', message: 'Solid work' },
      { awardTier: 'masterwork', message: 'You are awesome' },
    ]);
    expect(notes.map((n) => n.message)).toEqual([
      'Solid work',
      'You are awesome',
    ]);
  });

  it('summarizes awards by tier for post display', () => {
    const summary = summarizeAwardsByTier([
      { awardTier: 'spark', awardName: 'Spark' },
      { awardTier: 'spark', awardName: 'Spark' },
      { awardTier: 'anvil', awardName: 'Anvil', message: 'Nice' },
    ]);
    const spark = summary.find((s) => s.id === 'spark');
    const anvil = summary.find((s) => s.id === 'anvil');
    expect(spark.count).toBe(2);
    expect(anvil.count).toBe(1);
  });
});

describe('Forge Marks display', () => {
  it('explains Marks on hover: donations, spend, no expire/transfer/withdraw', () => {
    expect(FORGE_MARKS_HOVER_HINT).toMatch(/completed donations/i);
    expect(FORGE_MARKS_HOVER_HINT).toMatch(/Spark, Hammer, Anvil, or Masterwork/);
    expect(FORGE_MARKS_HOVER_HINT).toMatch(/never expire/i);
    expect(FORGE_MARKS_HOVER_HINT).toMatch(/cannot be transferred or withdrawn/i);
  });

  it('sorts running totals Spark → Hammer → Anvil → Masterwork', () => {
    const sorted = sortAwardTotalsByTier([
      { awardTier: 'masterwork', awardName: 'Masterwork', awardCount: 1 },
      { awardTier: 'spark', awardName: 'Spark', awardCount: 3 },
      { awardTier: 'anvil', awardName: 'Anvil', awardCount: 2 },
    ]);
    expect(sorted.map((t) => t.awardTier)).toEqual([
      'spark',
      'anvil',
      'masterwork',
    ]);
  });

  it('formats counts', () => {
    expect(formatForgeMarks(0)).toBe('0');
    expect(formatForgeMarks(2750)).toMatch(/2,750|2750/);
  });

  it('labels ledger entry types', () => {
    expect(forgeMarkLedgerLabel('donation_grant')).toBe('Donation');
    expect(forgeMarkLedgerLabel('award_spend')).toBe('Community Award');
    expect(forgeMarkLedgerLabel('refund_clawback')).toBe('Refund adjustment');
  });
});
