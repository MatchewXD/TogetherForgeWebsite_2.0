/**
 * Contributors / donation credit presentation rules.
 */
import { describe, it, expect } from 'vitest';
import { formatUsdFromCents } from '../services/contributorsService';
import {
  contributorContextLine,
  mapTaskCategoryToDevSub,
} from '../constants/contributionCategories';
import {
  shouldListOnProjectContributors,
  staffCreditSourceKey,
} from '../constants/staffCredit';
import {
  taskMatchesCategoryFilter,
  normalizeTaskCategoryKey,
} from '../constants/taskCategories';

describe('formatUsdFromCents (public totals, not individual gifts on cards)', () => {
  it('formats whole dollars without cents when exact', () => {
    const s = formatUsdFromCents(5000);
    expect(s).toMatch(/\$50/);
  });

  it('handles zero and invalid', () => {
    expect(formatUsdFromCents(0)).toMatch(/\$0/);
    expect(formatUsdFromCents(null)).toMatch(/\$0/);
  });
});

describe('staff-granted credits on project Contributors', () => {
  it('lists pending staff credits next to task credit and never as donations', () => {
    expect(
      shouldListOnProjectContributors({
        category: 'community',
        userId: null,
        sourceKey: staffCreditSourceKey('grant-1'),
      })
    ).toBe(true);
    expect(
      shouldListOnProjectContributors({
        category: 'development',
        userId: 'user-1',
        sourceKey: 'task:abc',
      })
    ).toBe(true);
    expect(
      shouldListOnProjectContributors({
        category: 'donations',
        userId: 'user-1',
        sourceKey: staffCreditSourceKey('grant-1'),
      })
    ).toBe(false);
  });
});

describe('contributorContextLine (All Contributors subtitle)', () => {
  it('shows the public credit line instead of Together Forge · Other', () => {
    expect(
      contributorContextLine(
        {
          roleLabel: 'Discord moderation, September 2026',
          subcategory: 'Other',
          projectTitleSnapshot: 'Together Forge',
        },
        'Together Forge'
      )
    ).toBe('Discord moderation, September 2026');
  });

  it('keeps project name with a specific subcategory when there is no public line', () => {
    expect(
      contributorContextLine({ subcategory: 'Coding', roleLabel: null }, 'Tether')
    ).toBe('Tether · Coding');
  });
});

describe('mapTaskCategoryToDevSub (credit buckets)', () => {
  it('maps board categories to development subcategories', () => {
    expect(mapTaskCategoryToDevSub('Code')).toBe('Coding');
    expect(mapTaskCategoryToDevSub('Art')).toBe('Art');
    expect(mapTaskCategoryToDevSub('QA')).toBe('QA / Testing');
  });

  it('unknown becomes Other', () => {
    expect(mapTaskCategoryToDevSub('Magic')).toBe('Other');
    expect(mapTaskCategoryToDevSub(null)).toBe('Other');
  });
});

describe('taskMatchesCategoryFilter', () => {
  it('empty filter matches all', () => {
    expect(taskMatchesCategoryFilter({ category: 'Art' }, [])).toBe(true);
  });

  it('matches selected categories', () => {
    expect(
      taskMatchesCategoryFilter({ category: 'Art' }, ['Art', 'Code'])
    ).toBe(true);
    expect(taskMatchesCategoryFilter({ category: 'Audio' }, ['Art'])).toBe(
      false
    );
  });

  it('Other includes missing category', () => {
    expect(taskMatchesCategoryFilter({ category: null }, ['Other'])).toBe(
      true
    );
    expect(taskMatchesCategoryFilter({ category: 'Code' }, ['Other'])).toBe(
      false
    );
  });

  it('normalize is stable', () => {
    expect(normalizeTaskCategoryKey('Level Design')).toBe('level design');
  });
});
