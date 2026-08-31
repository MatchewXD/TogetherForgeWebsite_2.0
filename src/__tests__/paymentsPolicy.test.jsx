import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  hasAcceptedCurrentPaymentsPolicy,
  paymentsPolicyAcceptanceMetadata,
} from '../services/legalService';
import {
  PAYMENTS_POLICY_VERSION,
  LEGAL_PATHS,
} from '../constants/legal';
import { paymentsSections } from '../content/legal/paymentsContent';
import PaymentsPolicyCheckbox from '../components/legal/PaymentsPolicyCheckbox';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      updateUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

function policyText() {
  return paymentsSections
    .flatMap((s) => [
      s.heading,
      ...(s.body || []),
      ...(s.list || []),
      ...(s.bodyAfter || []),
    ])
    .filter(Boolean)
    .join('\n');
}

describe('Payments and refunds policy copy', () => {
  it('states the required public rules in first person for founder pay', () => {
    const text = policyText();
    expect(text).toContain(
      'Donations to Together Forge stay with the studio. The founder does not take donations as wages.'
    );
    expect(text).toContain(
      'Founder Runway is personal support for the founder so he can work on Together Forge full time. It does not go to the studio. The two never mix.'
    );
    expect(text).toContain(
      'None of this is a charity gift and none of it is tax-deductible. Together Forge is a for-profit studio.'
    );
    expect(text).toContain(
      'After a payment succeeds it is not refunded, except a double charge or a payment that never appears on the account.'
    );
    expect(text).toContain(
      'Studio subscriptions can be cancelled anytime in the account billing page. Cancel stops later bills. The current period is not refunded.'
    );
    expect(text).toContain(
      'AI Tokens are not refunded after they are added to the account. Spent tokens are never refunded. If a payment succeeds and tokens never appear, we correct that charge.'
    );
    expect(text).toContain(
      'A courtesy refund for an error does not change the policy.'
    );
    expect(text).toContain(
      'A chargeback after delivery may close the account.'
    );
    expect(text).toContain('Questions: contact@togetherforge.net.');
  });

  it('does not name processors or implementation details', () => {
    const text = policyText().toLowerCase();
    expect(text).not.toMatch(/stripe/);
    expect(text).not.toMatch(/ko-?fi/);
    expect(text).not.toMatch(/webhook/);
    expect(text).not.toMatch(/\brelay\b/);
  });
});

describe('payments policy acceptance', () => {
  it('stores the current version and timestamp fields', () => {
    const at = '2026-08-30T12:00:00.000Z';
    expect(paymentsPolicyAcceptanceMetadata(at)).toEqual({
      payments_policy_version: PAYMENTS_POLICY_VERSION,
      payments_policy_accepted_at: at,
    });
    expect(PAYMENTS_POLICY_VERSION).toBe('2026-08-30');
    expect(LEGAL_PATHS.payments).toBe('/payments');
  });

  it('is true only for the current policy version', () => {
    expect(
      hasAcceptedCurrentPaymentsPolicy({
        payments_policy_version: PAYMENTS_POLICY_VERSION,
      })
    ).toBe(true);
    expect(
      hasAcceptedCurrentPaymentsPolicy({
        payments_policy_version: '2019-01-01',
      })
    ).toBe(false);
    expect(hasAcceptedCurrentPaymentsPolicy(null)).toBe(false);
    expect(
      hasAcceptedCurrentPaymentsPolicy(null, {
        user_metadata: { payments_policy_version: PAYMENTS_POLICY_VERSION },
      })
    ).toBe(true);
  });
});

describe('PaymentsPolicyCheckbox', () => {
  it('links the policy title and uses studio copy by default', () => {
    render(
      <MemoryRouter>
        <PaymentsPolicyCheckbox checked={false} onChange={() => {}} />
      </MemoryRouter>
    );
    const link = screen.getByRole('link', {
      name: 'Payments and refunds policy',
    });
    expect(link).toHaveAttribute('href', '/payments');
    expect(
      screen.getByText(/Studio support stays with Together Forge/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/I do not take it as wages/i)).toBeInTheDocument();
  });

  it('uses personal-support copy for runway', () => {
    render(
      <MemoryRouter>
        <PaymentsPolicyCheckbox
          variant="runway"
          checked={false}
          onChange={() => {}}
        />
      </MemoryRouter>
    );
    expect(
      screen.getByText(/This supports me personally/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/It does not go to the studio/i)
    ).toBeInTheDocument();
  });
});
