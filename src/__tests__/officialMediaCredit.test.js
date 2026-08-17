import { describe, it, expect } from 'vitest';
import {
  OFFICIAL_MEDIA_SOURCE_PREFIX,
  officialMediaSourcePrefix,
  officialMediaSourceKey,
  parseOfficialMediaSourceKey,
  groupOfficialMediaCreditsByVideo,
} from '../utils/officialMediaCredit';

describe('official media memorial source keys', () => {
  const videoId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const userId = '11111111-2222-4333-8444-555555555555';

  it('builds a stable per-video per-user key', () => {
    const key = officialMediaSourceKey(videoId, userId);
    expect(key).toBe(`${OFFICIAL_MEDIA_SOURCE_PREFIX}${videoId}:${userId}`);
    expect(officialMediaSourcePrefix(videoId)).toBe(
      `${OFFICIAL_MEDIA_SOURCE_PREFIX}${videoId}:`
    );
  });

  it('round-trips parse', () => {
    const key = officialMediaSourceKey(videoId, userId);
    expect(parseOfficialMediaSourceKey(key)).toEqual({ videoId, userId });
  });

  it('rejects empty or non-media keys', () => {
    expect(officialMediaSourceKey('', userId)).toBe('');
    expect(officialMediaSourceKey(videoId, '')).toBe('');
    expect(parseOfficialMediaSourceKey('showcase:abc')).toBeNull();
    expect(parseOfficialMediaSourceKey('official-media:only-video')).toBeNull();
    expect(parseOfficialMediaSourceKey(null)).toBeNull();
  });

  it('groups credit rows by video id', () => {
    const otherVideo = '99999999-0000-4000-8000-aaaaaaaaaaaa';
    const grouped = groupOfficialMediaCreditsByVideo([
      { id: '1', sourceKey: officialMediaSourceKey(videoId, userId) },
      { id: '2', sourceKey: officialMediaSourceKey(otherVideo, userId) },
      { id: '3', sourceKey: officialMediaSourceKey(videoId, 'other-user') },
      { id: '4', sourceKey: 'showcase:nope' },
    ]);
    expect(grouped[videoId].map((r) => r.id)).toEqual(['1', '3']);
    expect(grouped[otherVideo].map((r) => r.id)).toEqual(['2']);
  });
});
