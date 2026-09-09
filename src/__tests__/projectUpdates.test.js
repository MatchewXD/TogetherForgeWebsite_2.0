import { describe, it, expect } from 'vitest';
import {
  bodyMaxForCategory,
  mapUpdateRow,
  validateUpdate,
  UPDATE_BODY_MAX,
  UPDATE_DEVLOG_BODY_MAX,
  UPDATE_TITLE_MAX,
} from '../services/projectUpdatesService';

describe('project updates', () => {
  it('gives Devlogs a longer body limit than other posts', () => {
    expect(bodyMaxForCategory('Devlog')).toBe(UPDATE_DEVLOG_BODY_MAX);
    expect(bodyMaxForCategory('Announcement')).toBe(UPDATE_BODY_MAX);
    expect(bodyMaxForCategory('Process')).toBe(UPDATE_BODY_MAX);
    expect(UPDATE_DEVLOG_BODY_MAX).toBeGreaterThan(UPDATE_BODY_MAX);
  });

  it('maps a row including author profile', () => {
    const view = mapUpdateRow({
      id: 'u1',
      project_id: 'p1',
      created_by: 'staff1',
      category: 'Devlog',
      title: 'Networking pass',
      body: 'Interpolation landed.',
      created_at: '2026-09-08T00:00:00Z',
      updated_at: '2026-09-08T00:00:00Z',
      profiles: { username: 'matchew', avatar_url: null },
    });
    expect(view.title).toBe('Networking pass');
    expect(view.category).toBe('Devlog');
    expect(view.author.username).toBe('matchew');
  });

  it('rejects a short title and an over-long announcement body', () => {
    expect(() =>
      validateUpdate({ title: 'Hi', body: 'Long enough body here.', category: 'Devlog' })
    ).toThrow(/at least 8/);
    expect(() =>
      validateUpdate({
        title: 'Weekly pulse notes',
        body: 'x'.repeat(UPDATE_BODY_MAX + 1),
        category: 'Announcement',
      })
    ).toThrow(/2000/);
  });

  it('allows a long Devlog body within the Devlog cap', () => {
    const body = 'x'.repeat(UPDATE_BODY_MAX + 50);
    const next = validateUpdate({
      title: 'A'.repeat(UPDATE_TITLE_MAX),
      body,
      category: 'Devlog',
    });
    expect(next.body).toHaveLength(UPDATE_BODY_MAX + 50);
  });
});
