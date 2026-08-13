import { describe, it, expect } from 'vitest';
import {
  AI_TOKEN_PACKS,
  AI_ACTION_BASE_COSTS,
  AI_TOKENS_PER_USD,
  AI_MICROS_PER_TOKEN,
  getTokenPack,
  formatTokenCount,
  formatPackPrice,
  ledgerEntryLabel,
  ledgerTokensLine,
  providerCostToChargeableTokens,
  computeHybridDebitAmounts,
  getActionBaseCost,
  AI_NEED_MORE_TOKENS_MESSAGE,
} from '../constants/aiTokens';
import { canUseAiAction } from '../services/aiTokensService';
import {
  enforceMaxInputChars,
  enforceFieldLimit,
  enforceIdeaFields,
} from '../utils/aiInputLimits';

describe('AI token scale (50k per $1)', () => {
  it('uses exactly 50,000 tokens per dollar', () => {
    expect(AI_TOKENS_PER_USD).toBe(50_000);
    expect(AI_MICROS_PER_TOKEN).toBe(20);
  });

  it('defines Starter / Builder / Studio at the new scale', () => {
    expect(getTokenPack('starter')).toMatchObject({
      priceCents: 500,
      tokens: 250_000,
    });
    expect(getTokenPack('builder')).toMatchObject({
      priceCents: 1200,
      tokens: 600_000,
    });
    expect(getTokenPack('studio')).toMatchObject({
      priceCents: 2500,
      tokens: 1_250_000,
    });
    expect(AI_TOKEN_PACKS.map((p) => p.id)).toEqual([
      'starter',
      'builder',
      'studio',
    ]);
    // Verify ratio
    for (const p of AI_TOKEN_PACKS) {
      const dollars = p.priceCents / 100;
      expect(p.tokens).toBe(dollars * AI_TOKENS_PER_USD);
    }
  });

  it('has temporary base costs (structure 5k, gap fill 3k)', () => {
    expect(AI_ACTION_BASE_COSTS.idea_structure).toBe(5_000);
    expect(AI_ACTION_BASE_COSTS.gap_fill).toBe(3_000);
  });
});

describe('hybrid charging math', () => {
  it('converts provider cost + margin to tokens', () => {
    // $0.02 API = 20_000 micros → 20_000/20 * 2.5 = 2500
    expect(providerCostToChargeableTokens(20_000, 2.5)).toBe(2500);
  });

  it('debits base then additional up to ceiling and balance', () => {
    const base = getActionBaseCost('idea_structure');
    // Huge provider cost → additional hits ceiling
    const r = computeHybridDebitAmounts({
      actionKey: 'idea_structure',
      apiCostUsdMicros: 5_000_000, // $5
      balanceAfterBase: 100_000,
    });
    expect(r.base).toBe(base);
    expect(r.additional).toBeGreaterThan(0);
    expect(r.additional).toBeLessThanOrEqual(20_000); // ceiling
  });

  it('never requests more additional than remaining balance', () => {
    const r = computeHybridDebitAmounts({
      actionKey: 'idea_structure',
      apiCostUsdMicros: 5_000_000,
      balanceAfterBase: 100,
    });
    expect(r.additional).toBe(100);
  });

  it('additional is zero when base covers chargeable', () => {
    const r = computeHybridDebitAmounts({
      actionKey: 'idea_structure',
      apiCostUsdMicros: 100, // tiny
      balanceAfterBase: 50_000,
    });
    expect(r.additional).toBe(0);
  });
});

describe('formatting helpers', () => {
  it('formats large token counts and pack prices', () => {
    expect(formatTokenCount(250_000)).toBe('250,000');
    expect(formatPackPrice(500)).toBe('$5');
    expect(formatPackPrice(1200)).toBe('$12');
  });

  it('builds user-safe ledger lines', () => {
    const spend = {
      entry_type: 'spend',
      tokens: 5000,
      prompt_summary: 'Idea Structuring (base)',
    };
    expect(ledgerTokensLine(spend)).toMatch(/5,000 tokens used/i);
    expect(ledgerEntryLabel(spend)).toMatch(/base/i);

    const add = {
      entry_type: 'spend',
      tokens: 1200,
      prompt_summary: 'Idea Structuring (additional)',
    };
    expect(ledgerEntryLabel(add)).toMatch(/additional/i);

    const purchase = {
      entry_type: 'purchase',
      tokens: 250_000,
      pack_id: 'starter',
    };
    expect(ledgerTokensLine(purchase)).toMatch(/\+250,000/);

    const blob = JSON.stringify(spend) + JSON.stringify(purchase);
    expect(blob.toLowerCase()).not.toMatch(/api cost|margin|usd micros/);
  });
});

describe('canUseAiAction', () => {
  it('blocks when platform disabled', () => {
    const r = canUseAiAction(
      {
        servicesEnabled: false,
        platformEnabled: false,
        disabledMessage:
          'AI services are temporarily unavailable due to usage limits. Please try again later.',
        balance: 100_000,
      },
      'idea_structure'
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/temporarily unavailable/i);
  });

  it('blocks insufficient balance without revealing base price', () => {
    const r = canUseAiAction(
      { servicesEnabled: true, platformEnabled: true, balance: 3 },
      'idea_structure'
    );
    expect(r.ok).toBe(false);
    expect(r.code).toBe('INSUFFICIENT_TOKENS');
    expect(r.message).toBe(AI_NEED_MORE_TOKENS_MESSAGE);
    expect(r.message).not.toMatch(/\d{3,}/); // no large base number
  });

  it('allows when funded and enabled', () => {
    const r = canUseAiAction(
      { servicesEnabled: true, platformEnabled: true, balance: 50_000 },
      'idea_structure'
    );
    expect(r.ok).toBe(true);
  });
});

describe('input limits', () => {
  it('rejects overlong total input', () => {
    const r = enforceMaxInputChars('x'.repeat(20_000), { mode: 'reject' });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('INPUT_TOO_LONG');
  });

  it('enforces idea title max 100', () => {
    const r = enforceFieldLimit('title', 'y'.repeat(101), { mode: 'reject' });
    expect(r.ok).toBe(false);
  });

  it('enforces description max 4000', () => {
    const ok = enforceIdeaFields(
      { title: 'Hi', description: 'd'.repeat(4000) },
      { mode: 'reject' }
    );
    expect(ok.ok).toBe(true);
    const bad = enforceIdeaFields(
      { description: 'd'.repeat(4001) },
      { mode: 'reject' }
    );
    expect(bad.ok).toBe(false);
  });
});
