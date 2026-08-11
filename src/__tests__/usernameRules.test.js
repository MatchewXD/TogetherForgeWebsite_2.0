import { describe, it, expect } from 'vitest';
import {
  validatePublicUsername,
  getUsernameChangeCooldown,
  USERNAME_CHANGE_COOLDOWN_DAYS,
} from '../utils/ensureUserProfile';

describe('validatePublicUsername', () => {
  it('requires 3–24 alphanumerics/underscore', () => {
    expect(validatePublicUsername('').ok).toBe(false);
    expect(validatePublicUsername('ab').ok).toBe(false);
    expect(validatePublicUsername('abc').ok).toBe(true);
    expect(validatePublicUsername('good_name_1').value).toBe('good_name_1');
    expect(validatePublicUsername('bad name').ok).toBe(false);
    expect(validatePublicUsername('a'.repeat(25)).ok).toBe(false);
  });

  it('blocks reserved names', () => {
    expect(validatePublicUsername('admin').ok).toBe(false);
    expect(validatePublicUsername('Account').ok).toBe(false);
  });
});

describe('getUsernameChangeCooldown', () => {
  it('is unlocked with no prior change', () => {
    expect(getUsernameChangeCooldown(null).locked).toBe(false);
  });

  it('locks for 30 days after a change', () => {
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const cd = getUsernameChangeCooldown(recent);
    expect(cd.locked).toBe(true);
    expect(cd.daysLeft).toBeGreaterThan(0);
    expect(cd.daysLeft).toBeLessThanOrEqual(USERNAME_CHANGE_COOLDOWN_DAYS);
  });

  it('unlocks after cooldown window', () => {
    const old = new Date(
      Date.now() - (USERNAME_CHANGE_COOLDOWN_DAYS + 1) * 24 * 60 * 60 * 1000
    ).toISOString();
    expect(getUsernameChangeCooldown(old).locked).toBe(false);
  });
});
