/**
 * Clean Stripe Checkout button for testing and reuse on Support pages.
 *
 * Flow:
 *  1. Client validates amount
 *  2. POST to Supabase Edge Function create-checkout (secret key stays server-side)
 *  3. Redirect browser to session.url (Stripe-hosted Checkout)
 *
 * Local success/cancel URLs default to current origin, e.g.
 *   http://localhost:5173/support?checkout=success
 *   http://localhost:5173/support?checkout=cancel
 */

import { useState } from 'react';
import { Loader2, CreditCard } from 'lucide-react';
import Button from '../ui/Buttons';
import {
  startStripeCheckout,
  isStripeConfigured,
  validateAmountCents,
} from '../../services/supportService';

/**
 * @param {object} props
 * @param {number} [props.amountDollars=5] - Dollars (converted to cents)
 * @param {'once'|'month'} [props.interval='once']
 * @param {string} [props.tierId='test']
 * @param {string} [props.label='Together Forge Support']
 * @param {'studio'|'runway'} [props.fundType='studio']
 * @param {string} [props.productId] - optional Stripe product (e.g. prod_UvB5nILGYFdPln)
 * @param {string} [props.successPath='/support?checkout=success']
 * @param {string} [props.cancelPath='/support?checkout=cancel']
 * @param {string} [props.children]
 * @param {string} [props.className]
 * @param {string} [props.variant]
 * @param {string} [props.size]
 */
const StripeCheckoutButton = ({
  amountDollars = 5,
  interval = 'once',
  tierId = 'test',
  label = 'Together Forge Support',
  fundType = 'studio',
  productId,
  successPath = '/support?checkout=success',
  cancelPath = '/support?checkout=cancel',
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  onError,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ready = isStripeConfigured();

  const handleClick = async () => {
    setError('');
    const amountCents = Math.round(Number(amountDollars) * 100);
    const validated = validateAmountCents(amountCents);
    if (!validated.ok) {
      setError(validated.error);
      onError?.(validated.error);
      return;
    }

    if (!ready) {
      const msg =
        'Checkout is not configured. Set VITE_SUPABASE_URL + run create-checkout with STRIPE_SECRET_KEY.';
      setError(msg);
      onError?.(msg);
      return;
    }

    const origin = window.location.origin;
    setBusy(true);
    try {
      await startStripeCheckout({
        amountCents: validated.amountCents,
        interval,
        tierId,
        label,
        fundType,
        productId:
          productId || import.meta.env.VITE_STRIPE_PRODUCT_ID || undefined,
        successUrl: `${origin}${successPath.startsWith('/') ? successPath : `/${successPath}`}`,
        cancelUrl: `${origin}${cancelPath.startsWith('/') ? cancelPath : `/${cancelPath}`}`,
      });
      // Redirect happens inside startStripeCheckout
    } catch (err) {
      console.error('[StripeCheckoutButton]', err);
      const msg = err?.message || 'Could not start checkout.';
      setError(msg);
      onError?.(msg);
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <Button
        type="button"
        variant={variant}
        size={size}
        className="gap-2"
        disabled={busy}
        onClick={handleClick}
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CreditCard className="w-4 h-4" />
        )}
        {children ||
          `Pay $${Number(amountDollars).toFixed(0)}${interval === 'month' ? '/mo' : ''} with Stripe`}
      </Button>
      {error && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      {!ready && !error && (
        <p className="mt-2 text-xs text-text-muted font-mono">
          Stripe Edge Function not reachable yet. See docs/STRIPE_LOCAL_SETUP.md
        </p>
      )}
    </div>
  );
};

export default StripeCheckoutButton;
