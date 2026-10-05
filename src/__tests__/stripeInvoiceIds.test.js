import { describe, it, expect } from 'vitest';
import {
  invoiceCustomerId,
  invoicePaymentIntentId,
  invoiceSubscriptionId,
} from '../../supabase/functions/_shared/stripeInvoiceIds.ts';

describe('invoiceSubscriptionId', () => {
  it('reads the 2023 invoice.subscription field', () => {
    expect(
      invoiceSubscriptionId({ subscription: 'sub_legacy' })
    ).toBe('sub_legacy');
  });

  it('reads Basil parent.subscription_details.subscription', () => {
    expect(
      invoiceSubscriptionId({
        parent: {
          type: 'subscription_details',
          subscription_details: { subscription: 'sub_basil' },
        },
      })
    ).toBe('sub_basil');
  });

  it('reads the first line item subscription', () => {
    expect(
      invoiceSubscriptionId({
        lines: { data: [{ subscription: 'sub_line' }] },
      })
    ).toBe('sub_line');
  });
});

describe('invoicePaymentIntentId', () => {
  it('reads the 2023 invoice.payment_intent field', () => {
    expect(
      invoicePaymentIntentId({ payment_intent: 'pi_legacy' })
    ).toBe('pi_legacy');
  });

  it('reads Basil payments[].payment.payment_intent', () => {
    expect(
      invoicePaymentIntentId({
        payments: {
          data: [
            {
              payment: {
                type: 'payment_intent',
                payment_intent: 'pi_basil',
              },
            },
          ],
        },
      })
    ).toBe('pi_basil');
  });
});

describe('invoiceCustomerId', () => {
  it('reads a string or expanded customer', () => {
    expect(invoiceCustomerId({ customer: 'cus_1' })).toBe('cus_1');
    expect(invoiceCustomerId({ customer: { id: 'cus_2' } })).toBe('cus_2');
  });
});
