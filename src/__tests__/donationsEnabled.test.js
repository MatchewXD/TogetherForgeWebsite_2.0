import { describe, it, expect } from 'vitest';
import {
  parseEnableFlag,
  areDonationsEnabled,
} from '../constants/donationsEnabled';

describe('parseEnableFlag', () => {
  it('treats true-like values as on', () => {
    expect(parseEnableFlag('true')).toBe(true);
    expect(parseEnableFlag('TRUE')).toBe(true);
    expect(parseEnableFlag('1')).toBe(true);
    expect(parseEnableFlag('on')).toBe(true);
    expect(parseEnableFlag('yes')).toBe(true);
  });

  it('treats false-like values as off', () => {
    expect(parseEnableFlag('false')).toBe(false);
    expect(parseEnableFlag('0')).toBe(false);
    expect(parseEnableFlag('off')).toBe(false);
    expect(parseEnableFlag('no')).toBe(false);
  });

  it('returns null when unset or unknown', () => {
    expect(parseEnableFlag(undefined)).toBe(null);
    expect(parseEnableFlag('')).toBe(null);
    expect(parseEnableFlag('maybe')).toBe(null);
  });
});

describe('areDonationsEnabled', () => {
  it('defaults off for live publishable keys when the flag is unset', () => {
    expect(
      areDonationsEnabled({
        VITE_STRIPE_PUBLISHABLE_KEY: 'pk_live_abc',
      })
    ).toBe(false);
  });

  it('defaults on for test keys and off when the key is missing', () => {
    expect(
      areDonationsEnabled({
        VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_abc',
      })
    ).toBe(true);
    expect(areDonationsEnabled({})).toBe(false);
  });

  it('lets the env switch override live-key default', () => {
    expect(
      areDonationsEnabled({
        VITE_ENABLE_DONATIONS: 'true',
        VITE_STRIPE_PUBLISHABLE_KEY: 'pk_live_abc',
      })
    ).toBe(true);
    expect(
      areDonationsEnabled({
        VITE_ENABLE_DONATIONS: 'false',
        VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_abc',
      })
    ).toBe(false);
  });
});
