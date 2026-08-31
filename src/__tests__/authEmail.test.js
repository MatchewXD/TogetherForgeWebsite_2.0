import { describe, it, expect } from 'vitest';
import {
  AUTH_FROM_EMAIL,
  AUTH_FROM_HINT,
  AUTH_FROM_NAME,
} from '../constants/authEmail';

describe('auth from-address copy', () => {
  it('names Together Forge / hello@togetherforge.net and never noreply', () => {
    expect(AUTH_FROM_NAME).toBe('Together Forge');
    expect(AUTH_FROM_EMAIL).toBe('hello@togetherforge.net');
    expect(AUTH_FROM_HINT).toBe('Together Forge (hello@togetherforge.net)');
    expect(AUTH_FROM_HINT.toLowerCase()).not.toContain('noreply');
  });
});
