import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isModeratorTrafficTab,
  sanitizeTrafficPath,
} from '../utils/trafficPath';
import {
  mergeTrafficPages,
  trafficPageLabel,
} from '../utils/trafficPageLabel';
import { getTrafficSessionKey } from '../utils/trafficSession';
import { mapTrafficReport } from '../services/trafficService';
import {
  TRAFFIC_DEFAULT_RANGE,
  TRAFFIC_RANGES,
  TRAFFIC_SESSION_AT_KEY,
  TRAFFIC_SESSION_KEY,
} from '../constants/traffic';

describe('traffic path helpers', () => {
  it('strips query strings, hashes, and dangerous schemes', () => {
    expect(sanitizeTrafficPath('/ideas?email=a@b.com#x')).toBe('/ideas');
    expect(sanitizeTrafficPath('https://evil.example/x')).toBe('/');
    expect(sanitizeTrafficPath('/javascript:alert(1)')).toBe('/');
    expect(sanitizeTrafficPath('ideas')).toBe('/ideas');
    expect(sanitizeTrafficPath('')).toBe('/');
  });

  it('maps paths to English page names', () => {
    expect(trafficPageLabel('/')).toBe('Home');
    expect(trafficPageLabel('/how-it-works')).toBe('How It Works');
    expect(trafficPageLabel('/ideas')).toBe('Ideas');
    expect(trafficPageLabel('/projects/tether')).toBe('Tether');
    expect(trafficPageLabel('/ideas/abc-123')).toBe('Idea posts');
    expect(trafficPageLabel('/projects/early')).toBe('Early Game');
    expect(trafficPageLabel('/account/plan')).toBe('My Plan');
    expect(trafficPageLabel('/u/matchew')).toBe('Profiles');
  });

  it('groups every idea post into one Idea posts row', () => {
    const merged = mergeTrafficPages([
      { path: '/ideas/1', pageviews: 3 },
      { path: '/ideas/2', pageviews: 2 },
      { path: '/ideas/:id', pageviews: 8, uniquePages: 8 },
      { path: '/ideas', pageviews: 10 },
      { path: '/donate', pageviews: 1 },
      { path: '/support', pageviews: 4 },
    ]);
    const posts = merged.find((r) => r.label === 'Idea posts');
    expect(posts?.pageviews).toBe(13);
    expect(posts?.uniquePages).toBe(10);
    expect(merged.find((r) => r.label === 'Donate')?.pageviews).toBe(5);
    expect(merged.find((r) => r.label === 'Ideas')?.pageviews).toBe(10);
  });

  it('skips the Moderator Traffic tab only', () => {
    expect(isModeratorTrafficTab('/moderator', '?tab=traffic')).toBe(true);
    expect(isModeratorTrafficTab('/moderator', '?tab=users')).toBe(false);
    expect(isModeratorTrafficTab('/ideas', '?tab=traffic')).toBe(false);
  });
});

describe('traffic session key', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reuses a fresh key across calls (tabs share a session)', () => {
    const a = getTrafficSessionKey(1_000);
    const b = getTrafficSessionKey(2_000);
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
  });

  it('issues a new key after idle timeout', () => {
    localStorage.setItem(TRAFFIC_SESSION_KEY, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    localStorage.setItem(TRAFFIC_SESSION_AT_KEY, '1');
    const next = getTrafficSessionKey(40 * 60 * 1000);
    expect(next).not.toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });
});

describe('mapTrafficReport', () => {
  it('whitelists aggregates and never passes identities through', () => {
    const mapped = mapTrafficReport({
      range: '7d',
      bucket: '1 hour',
      active_now: 2,
      unique_visitors: 9,
      pageviews: 20,
      signed_in_visitors: 3,
      guest_visitors: 6,
      signed_in_pageviews: 8,
      guest_pageviews: 12,
      user_id: 'uuid-should-not-leak',
      email: 'staff@example.com',
      series: [{ t: '2026-08-01T00:00:00Z', concurrent: 2, pageviews: 4, user_id: 'x' }],
      top_pages: [
        { path: '/about', pageviews: 2 },
        { path: '/ideas?x=1', pageviews: 5, user_id: 'y' },
      ],
    });
    expect(mapped.range).toBe(TRAFFIC_DEFAULT_RANGE);
    expect(mapped.activeNow).toBe(2);
    expect(mapped.uniqueVisitors).toBe(9);
    expect(mapped.topPages).toEqual([
      { path: '/ideas', pageviews: 5, uniquePages: 1 },
      { path: '/about', pageviews: 2, uniquePages: 1 },
    ]);
    expect(JSON.stringify(mapped)).not.toMatch(/uuid-should-not-leak|staff@example.com/);
    expect(mapped).not.toHaveProperty('user_id');
    expect(mapped).not.toHaveProperty('email');
    expect(mapped.series[0]).toEqual({
      t: '2026-08-01T00:00:00Z',
      concurrent: 2,
      pageviews: 4,
    });
  });

  it('treats an empty payload as zeros', () => {
    const mapped = mapTrafficReport(null);
    expect(mapped.uniqueVisitors).toBe(0);
    expect(mapped.pageviews).toBe(0);
    expect(mapped.series).toEqual([]);
    expect(mapped.topPages).toEqual([]);
  });

  it('lists the required range options including default 7 days', () => {
    expect(TRAFFIC_RANGES.map((r) => r.id)).toContain('7d');
    expect(TRAFFIC_RANGES.map((r) => r.id)).toEqual([
      '1h',
      '6h',
      '12h',
      '24h',
      '3d',
      '7d',
      '14d',
      '21d',
      '30d',
      '3m',
      '6m',
      '9m',
      '12m',
      '3y',
      'lifetime',
    ]);
  });
});
