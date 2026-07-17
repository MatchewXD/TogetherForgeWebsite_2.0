import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateAmountCents,
  isStripeConfigured,
  recordLocalSupportEvent,
} from '../services/supportService';

describe('supportService.validateAmountCents', () => {
  it('rejects non-numeric', () => {
    const r = validateAmountCents('abc');
    expect(r.ok).toBe(false);
  });

  it('rejects under $1', () => {
    const r = validateAmountCents(50);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/1\.00/);
  });

  it('accepts $5', () => {
    const r = validateAmountCents(500);
    expect(r).toEqual({ ok: true, amountCents: 500 });
  });

  it('rejects over max', () => {
    const r = validateAmountCents(2_000_000);
    expect(r.ok).toBe(false);
  });

  it('rounds fractional cents', () => {
    const r = validateAmountCents(199.6);
    expect(r.ok).toBe(true);
    expect(r.amountCents).toBe(200);
  });
});

describe('supportService.isStripeConfigured', () => {
  const env = import.meta.env;

  afterEach(() => {
    delete env.VITE_STRIPE_CHECKOUT_API_URL;
    delete env.VITE_STRIPE_PAYMENT_LINKS;
  });

  it('true when API URL set', () => {
    env.VITE_STRIPE_CHECKOUT_API_URL = 'https://example.com/checkout';
    expect(isStripeConfigured()).toBe(true);
  });

  it('true when payment links JSON valid', () => {
    env.VITE_STRIPE_PAYMENT_LINKS = JSON.stringify({
      custom_once: 'https://buy.stripe.com/test',
    });
    expect(isStripeConfigured()).toBe(true);
  });
});

describe('supportService.recordLocalSupportEvent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes studio ledger entry', () => {
    const entry = recordLocalSupportEvent({
      amountCents: 2000,
      label: 'Forge Member',
      fundType: 'studio',
      interval: 'once',
    });
    expect(entry.amount).toBe(20);
    const stored = JSON.parse(localStorage.getItem('tf_donations') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].amountCents).toBe(2000);
  });

  it('writes runway ledger separately', () => {
    recordLocalSupportEvent({
      amountCents: 1500,
      fundType: 'runway',
    });
    expect(JSON.parse(localStorage.getItem('tf_runway_donations') || '[]')).toHaveLength(
      1
    );
    expect(JSON.parse(localStorage.getItem('tf_donations') || '[]')).toHaveLength(0);
  });
});
