import { describe, it, expect } from 'vitest';
import {
  applicationMatchesBlock,
  normalizeVolunteerDiscord,
  normalizeVolunteerEmail,
} from '../services/volunteerService';

describe('volunteer apply blocks', () => {
  it('normalizes email and Discord the same way the database does', () => {
    expect(normalizeVolunteerEmail('  Foo@Example.COM ')).toBe('foo@example.com');
    expect(normalizeVolunteerDiscord(' @Name#0000 ')).toBe('name#0000');
    expect(normalizeVolunteerDiscord('name')).toBe('name');
  });

  it('matches a block on account, email, or Discord', () => {
    const app = {
      userId: 'u1',
      email: 'Foo@Example.com',
      discordUsername: '@Nick',
    };
    expect(
      applicationMatchesBlock(app, { active: true, userId: 'u1' })
    ).toBe(true);
    expect(
      applicationMatchesBlock(app, {
        active: true,
        email: 'foo@example.com',
      })
    ).toBe(true);
    expect(
      applicationMatchesBlock(app, {
        active: true,
        discordUsername: 'nick',
      })
    ).toBe(true);
    expect(
      applicationMatchesBlock(app, {
        active: true,
        email: 'other@example.com',
      })
    ).toBe(false);
    expect(
      applicationMatchesBlock(app, { active: false, userId: 'u1' })
    ).toBe(false);
  });
});
