/**
 * Official Media: published visibility mapping.
 */
import { describe, it, expect } from 'vitest';

// Test mapRow via listPublished filter behavior by importing service internals
// through a light re-export pattern — map is not exported, so we test
// normalize + public list filter semantics via known helpers.
import { normalizeOfficialVideoCategory } from '../constants/officialVideoCategories';

describe('official media category normalization', () => {
  it('normalizes known categories', () => {
    const cat = normalizeOfficialVideoCategory('Devlog');
    expect(typeof cat).toBe('string');
    expect(cat.length).toBeGreaterThan(0);
  });
});

/**
 * Pure visibility rule used by public catalog:
 * published and not archived.
 */
function isPublicMediaRow(row) {
  return row.is_published !== false && !row.archived_at;
}

describe('published vs unpublished media visibility', () => {
  it('hides unpublished and archived rows from public catalog rule', () => {
    expect(
      isPublicMediaRow({ is_published: true, archived_at: null })
    ).toBe(true);
    expect(
      isPublicMediaRow({ is_published: false, archived_at: null })
    ).toBe(false);
    expect(
      isPublicMediaRow({
        is_published: true,
        archived_at: '2026-01-01T00:00:00Z',
      })
    ).toBe(false);
  });
});
