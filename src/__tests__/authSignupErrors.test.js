import { describe, it, expect } from 'vitest';
import {
  EXISTING_EMAIL_SIGNUP_BANNER,
  EXISTING_EMAIL_SIGNUP_MESSAGE,
  humanizeSignupError,
  isDuplicateEmailSignupResult,
} from '../utils/authSignupErrors';

describe('humanizeSignupError', () => {
  it('maps User already registered to the email field', () => {
    const mapped = humanizeSignupError({
      message: 'User already registered',
      status: 422,
    });
    expect(mapped.field).toBe('email');
    expect(mapped.message).toBe(EXISTING_EMAIL_SIGNUP_MESSAGE);
    expect(EXISTING_EMAIL_SIGNUP_BANNER).toMatch(/email/i);
    expect(mapped.message.toLowerCase()).not.toContain('username');
  });

  it('maps user_already_exists code', () => {
    expect(
      humanizeSignupError({ code: 'user_already_exists', message: 'ignored' })
        .field
    ).toBe('email');
  });

  it('maps email_exists code', () => {
    expect(humanizeSignupError({ code: 'email_exists' }).field).toBe('email');
  });

  it('keeps password-strength Auth errors on the password field', () => {
    const mapped = humanizeSignupError({
      message: 'Password should be at least 8 characters',
    });
    expect(mapped.field).toBe('password');
    expect(mapped.message).toMatch(/password/i);
  });

  it('falls back to the Auth message for unknown errors', () => {
    const mapped = humanizeSignupError({ message: 'Database error saving new user' });
    expect(mapped.field).toBe('form');
    expect(mapped.message).toBe('Database error saving new user');
  });
});

describe('isDuplicateEmailSignupResult', () => {
  it('detects empty identities with no session (existing email)', () => {
    expect(
      isDuplicateEmailSignupResult({
        user: { id: '1', identities: [] },
        session: null,
      })
    ).toBe(true);
  });

  it('does not treat a real unconfirmed signup as a duplicate', () => {
    expect(
      isDuplicateEmailSignupResult({
        user: {
          id: '1',
          identities: [{ provider: 'email' }],
        },
        session: null,
      })
    ).toBe(false);
  });

  it('does not treat a signed-in signup as a duplicate', () => {
    expect(
      isDuplicateEmailSignupResult({
        user: { id: '1', identities: [] },
        session: { access_token: 'x' },
      })
    ).toBe(false);
  });

  it('ignores missing identities (unknown shape)', () => {
    expect(
      isDuplicateEmailSignupResult({
        user: { id: '1' },
        session: null,
      })
    ).toBe(false);
  });
});
