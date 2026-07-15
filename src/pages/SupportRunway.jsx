/**
 * Support founder personal runway (living expenses).
 * Separate from studio Support at /support.
 * One-time or monthly via Stripe helpers; tierId: runway.
 */

import { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Heart,
  Loader2,
  Wallet,
} from 'lucide-react';

import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import RunwayTransparency from '../components/ui/RunwayTransparency';
import {
  startStripeCheckout,
  isStripeConfigured,
} from '../services/supportService';

const PRESETS = [25, 50, 100, 250];

const SupportRunway = () => {
  const [searchParams] = useSearchParams();
  const [interval, setInterval] = useState('once'); // once | month
  const [customAmount, setCustomAmount] = useState('');
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState(null);

  const stripeReady = useMemo(() => isStripeConfigured(), []);

  useEffect(() => {
    const status = searchParams.get('checkout');
    if (status === 'success') {
      setBanner({
        type: 'success',
        text: 'Thank you for supporting the runway.',
      });
    } else if (status === 'cancel') {
      setBanner({
        type: 'info',
        text: 'Checkout canceled. You can try again anytime.',
      });
    }
  }, [searchParams]);

  const runCheckout = async (amount, key) => {
    setError('');
    const amountCents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents < 100) {
      setError('Enter at least $1.00.');
      return;
    }

    setBusyKey(key);
    try {
      const origin = window.location.origin;
      await startStripeCheckout({
        amountCents,
        interval,
        tierId: 'runway',
        label:
          interval === 'month'
            ? 'Founder runway (monthly)'
            : 'Founder runway (one-time)',
        successUrl: `${origin}/support-runway?checkout=success`,
        cancelUrl: `${origin}/support-runway?checkout=cancel`,
      });
    } catch (err) {
      console.error('[SupportRunway] checkout', err);
      if (err?.code === 'STRIPE_NOT_CONFIGURED') {
        setError(
          'Stripe is not connected yet. Configure VITE_STRIPE_CHECKOUT_API_URL or VITE_STRIPE_PAYMENT_LINKS (runway_once / runway_month) in your environment.'
        );
      } else {
        setError(err?.message || 'Could not start checkout. Try again.');
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleCustom = (e) => {
    e.preventDefault();
    runCheckout(parseFloat(customAmount), `custom_${interval}`);
  };

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(192,38,211,0.06)_0%,transparent_55%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 border-b border-cyber-border bg-cyber-surface/80">
        <div className="container-custom py-12 md:py-16">
          <Link
            to="/founders-thoughts"
            className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group transition-colors"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
            BACK TO FOUNDERS THOUGHTS
          </Link>

          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="section-header mb-0">Founder runway</div>
              <Badge variant="purple">Not project funds</Badge>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Support my Runway
            </h1>
            <p className="text-lg sm:text-xl text-text-secondary leading-relaxed">
              Direct support for my living expenses so I can quit my day job and
              focus full-time on building Together Forge.
            </p>
            <p className="mt-3 text-sm text-text-muted leading-relaxed">
              Separate from{' '}
              <Link to="/support" className="text-neon-cyan hover:underline">
                studio Support
              </Link>
              . Not tax-deductible.
            </p>
          </div>
        </div>
      </div>

      <div className="container-custom relative z-10 py-12 md:py-16 max-w-2xl space-y-6">
        {banner && (
          <Card
            className={`bg-cyber-card/80 ${
              banner.type === 'success'
                ? 'border-neon-cyan/40'
                : 'border-cyber-border'
            }`}
          >
            <p className="text-sm text-text-secondary">{banner.text}</p>
          </Card>
        )}

        <Card className="bg-cyber-card/80">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-neon-purple" />
              <h2 className="text-xl font-bold text-white">Choose an amount</h2>
            </div>

            <div
              className="inline-flex items-center bg-cyber-surface border border-cyber-border rounded-lg p-1 self-start shrink-0"
              role="group"
              aria-label="Payment frequency"
            >
              <button
                type="button"
                onClick={() => setInterval('once')}
                className={`px-4 py-2 text-sm rounded-md transition-colors ${
                  interval === 'once'
                    ? 'bg-neon-cyan text-cyber-bg font-medium'
                    : 'text-text-secondary hover:text-white'
                }`}
              >
                One-time
              </button>
              <button
                type="button"
                onClick={() => setInterval('month')}
                className={`px-4 py-2 text-sm rounded-md transition-colors ${
                  interval === 'month'
                    ? 'bg-neon-cyan text-cyber-bg font-medium'
                    : 'text-text-secondary hover:text-white'
                }`}
              >
                Monthly
              </button>
            </div>
          </div>

          {!stripeReady && (
            <p className="text-xs font-mono text-text-muted mb-4 border border-dashed border-cyber-border rounded-lg p-3">
              Stripe not configured. Optional keys:{' '}
              <span className="text-neon-cyan">runway_once</span>
              {' / '}
              <span className="text-neon-cyan">runway_month</span>
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {PRESETS.map((amount) => {
              const key = `preset_${interval}_${amount}`;
              const busy = busyKey === key;
              return (
                <Button
                  key={key}
                  variant="secondary"
                  className="gap-1 w-full flex-col h-auto py-3"
                  disabled={!!busyKey}
                  onClick={() => runCheckout(amount, key)}
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span className="text-base font-semibold">${amount}</span>
                      {interval === 'month' && (
                        <span className="text-[10px] font-mono tracking-widest uppercase opacity-80">
                          / month
                        </span>
                      )}
                    </>
                  )}
                </Button>
              );
            })}
          </div>

          <form onSubmit={handleCustom} className="space-y-3">
            <label
              htmlFor="runway-custom"
              className="block text-xs font-mono tracking-widest uppercase text-text-muted"
            >
              Custom amount (USD{interval === 'month' ? ' / month' : ''})
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                  $
                </span>
                <input
                  id="runway-custom"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="decimal"
                  placeholder="Amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 rounded-lg bg-cyber-surface border border-cyber-border text-white focus:outline-none focus:border-neon-purple"
                />
              </div>
              <Button
                type="submit"
                className="gap-2 shrink-0"
                disabled={!!busyKey}
              >
                {busyKey === `custom_${interval}` ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Heart className="w-4 h-4" />
                )}
                {interval === 'month' ? 'Give monthly' : 'Support my Runway'}
              </Button>
            </div>
          </form>

          {error && (
            <p className="mt-4 text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
        </Card>

        <RunwayTransparency />
      </div>
    </div>
  );
};

export default SupportRunway;
