import { describe, it, expect, beforeEach } from 'vitest';
import {
  MFA_TRUST_STORAGE_KEY,
  clearStoredMfaDevice,
  readStoredMfaDevice,
  storeMfaDevice,
} from '../utils/mfaTrustedDevice';

describe('mfa trusted device storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and reads a token for the same user', () => {
    storeMfaDevice('user-1', 'tok-abc', '2099-01-01T00:00:00Z');
    expect(readStoredMfaDevice('user-1')?.token).toBe('tok-abc');
    expect(readStoredMfaDevice('user-2')).toBeNull();
  });

  it('ignores an expired token', () => {
    storeMfaDevice('user-1', 'tok-abc', '2020-01-01T00:00:00Z');
    expect(readStoredMfaDevice('user-1')).toBeNull();
    expect(localStorage.getItem(MFA_TRUST_STORAGE_KEY)).toBeNull();
  });

  it('clears the stored token', () => {
    storeMfaDevice('user-1', 'tok-abc', '2099-01-01T00:00:00Z');
    clearStoredMfaDevice();
    expect(readStoredMfaDevice('user-1')).toBeNull();
  });
});
