import { describe, it, expect } from 'vitest';
import {
  STUDIO_EXPENSE_CATEGORIES,
  STUDIO_EXPENSE_CATEGORY_LABELS,
} from '../constants/studioExpenses';
import {
  centsToUsdInput,
  parseUsdToCents,
  sumStudioExpenses,
} from '../services/studioExpensesService';

describe('studio published expenses', () => {
  it('uses the four public spend categories', () => {
    expect(STUDIO_EXPENSE_CATEGORY_LABELS).toEqual([
      'Development & tools',
      'Tools & infrastructure',
      'Community',
      'Operations',
    ]);
    expect(STUDIO_EXPENSE_CATEGORIES).toHaveLength(4);
  });

  it('treats an empty list as $0 with no placeholder spend', () => {
    const empty = sumStudioExpenses([]);
    expect(empty.totalCents).toBe(0);
    expect(empty.byCategory).toEqual({
      dev: 0,
      infra: 0,
      community: 0,
      ops: 0,
    });
    expect(sumStudioExpenses(null).totalCents).toBe(0);
  });

  it('sums Total spent and spend-by-category from listed rows', () => {
    const { totalCents, byCategory } = sumStudioExpenses([
      {
        category: 'Development & tools',
        amountCents: 1250,
      },
      {
        category: 'Operations',
        amountCents: 400,
      },
      {
        category: 'Development & tools',
        amountCents: 750,
      },
      {
        category: 'Community',
        amountCents: 100,
        archived: true,
      },
    ]);
    expect(totalCents).toBe(2400);
    expect(byCategory.dev).toBe(2000);
    expect(byCategory.ops).toBe(400);
    expect(byCategory.community).toBe(0);
    expect(byCategory.infra).toBe(0);
  });

  it('does not subtract spend from Stripe money-in', () => {
    const receivedCents = 10000;
    const { totalCents: spentCents } = sumStudioExpenses([
      { category: 'Operations', amountCents: 3000 },
    ]);
    expect(receivedCents).toBe(10000);
    expect(spentCents).toBe(3000);
    expect(receivedCents - spentCents).not.toBe(receivedCents);
  });

  it('parses dollar amounts to cents', () => {
    expect(parseUsdToCents('12.50')).toBe(1250);
    expect(parseUsdToCents('$1,200.00')).toBe(120000);
    expect(parseUsdToCents('3')).toBe(300);
    expect(centsToUsdInput(1250)).toBe('12.50');
    expect(() => parseUsdToCents('0')).toThrow(/greater than/);
    expect(() => parseUsdToCents('-4')).toThrow(/positive dollar/);
  });
});
