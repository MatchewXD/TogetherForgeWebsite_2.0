import { describe, it, expect } from 'vitest';
import {
  validatePasswordStrength,
  passwordStrengthScore,
  getPasswordRequirementStatus,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
} from '../utils/passwordRules';

describe('validatePasswordStrength', () => {
  it('requires minimum length, letter, and number', () => {
    expect(validatePasswordStrength('short1').ok).toBe(false);
    expect(validatePasswordStrength('onlyletters').ok).toBe(false);
    expect(validatePasswordStrength('12345678').ok).toBe(false);
    expect(validatePasswordStrength('GoodPass1').ok).toBe(true);
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });

  it('rejects spaces and email local part', () => {
    expect(validatePasswordStrength('Bad Pass1').ok).toBe(false);
    expect(
      validatePasswordStrength('matts1234', { email: 'matts@example.com' }).ok
    ).toBe(false);
  });

  it('scores longer mixed passwords higher', () => {
    expect(passwordStrengthScore('a')).toBeLessThan(
      passwordStrengthScore('Aa1!longenough')
    );
  });

  it('lists password requirements for sign-up UI', () => {
    expect(PASSWORD_REQUIREMENTS.length).toBeGreaterThanOrEqual(4);
    const status = getPasswordRequirementStatus('GoodPass1', {
      email: 'user@example.com',
    });
    expect(status.every((r) => r.met)).toBe(true);
    const weak = getPasswordRequirementStatus('short', {
      email: 'user@example.com',
    });
    expect(weak.find((r) => r.id === 'length')?.met).toBe(false);
    expect(weak.find((r) => r.id === 'number')?.met).toBe(false);
  });
});
