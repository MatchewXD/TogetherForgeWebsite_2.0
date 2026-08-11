import { describe, it, expect } from 'vitest';
import {
  TAG_PROMOTION_THRESHOLD,
  CURATED_CORE_TAGS,
} from '../constants/ideaTags';
import {
  normalizeTagName,
  slugifyTag,
  isTagPubliclySelectable,
  sortTagsByUsage,
  uniqueTagNames,
  serializeTags,
  buildFallbackPublicTags,
  promotionProgress,
} from '../utils/ideaTags';

describe('ideaTags helpers', () => {
  it('normalizes and slugifies tag names', () => {
    expect(normalizeTagName('  #Co-Op  ')).toBe('Co-Op');
    expect(slugifyTag('  #Co-Op  ')).toBe('co-op');
    expect(slugifyTag('Local Multiplayer')).toBe('local-multiplayer');
    expect(slugifyTag('!!!')).toBe('');
  });

  it('uniqueTagNames dedupes by slug', () => {
    expect(uniqueTagNames(['RPG', 'rpg', 'Action', 'action'])).toEqual([
      'RPG',
      'Action',
    ]);
    expect(serializeTags(['a', 'a', 'b'])).toBe('a, b');
  });

  it('curated and approved are always publicly selectable', () => {
    expect(
      isTagPubliclySelectable({ status: 'curated', usage_count: 0 })
    ).toBe(true);
    expect(
      isTagPubliclySelectable({ status: 'approved', usage_count: 1 })
    ).toBe(true);
  });

  it('suggested tags need threshold uses', () => {
    expect(
      isTagPubliclySelectable({
        status: 'suggested',
        usage_count: TAG_PROMOTION_THRESHOLD - 1,
      })
    ).toBe(false);
    expect(
      isTagPubliclySelectable({
        status: 'suggested',
        usage_count: TAG_PROMOTION_THRESHOLD,
      })
    ).toBe(true);
  });

  it('hidden tags are never public', () => {
    expect(
      isTagPubliclySelectable({
        status: 'hidden',
        usage_count: 100,
      })
    ).toBe(false);
  });

  it('sorts by usage desc then name', () => {
    const sorted = sortTagsByUsage([
      { name: 'b', usage_count: 2 },
      { name: 'a', usage_count: 5 },
      { name: 'c', usage_count: 5 },
    ]);
    expect(sorted.map((t) => t.name)).toEqual(['a', 'c', 'b']);
  });

  it('promotionProgress reports remaining uses', () => {
    const p = promotionProgress({
      status: 'suggested',
      usage_count: TAG_PROMOTION_THRESHOLD - 2,
    });
    expect(p.public).toBe(false);
    expect(p.remaining).toBe(2);
  });

  it('fallback public list includes curated and high-usage tags only', () => {
    const ideas = [
      ...Array.from({ length: TAG_PROMOTION_THRESHOLD }, () => ({
        tags: 'one-off-hit, another',
      })),
      { tags: 'rare-tag' },
    ];
    const list = buildFallbackPublicTags(ideas);
    const names = list.map((t) => t.slug);
    expect(names).toContain(slugifyTag(CURATED_CORE_TAGS[0]));
    expect(names).toContain('one-off-hit');
    expect(names).not.toContain('rare-tag');
  });
});
