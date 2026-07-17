/**
 * Support page (route: /support and /donations).
 * Tiered one-time + monthly options, custom amount, disclaimers, impact, FAQ,
 * Stripe Checkout via Payment Links or server API (see supportService.js).
 */

import { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Heart,
  Shield,
  Sparkles,
  Users,
  Hammer,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react';

import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import {
  startStripeCheckout,
  isStripeConfigured,
  recordLocalSupportEvent,
  validateAmountCents,
} from '../services/supportService';

/** One-time tiers */
const ONCE_TIERS = [
  {
    id: 'supporter',
    amount: 5,
    label: 'Supporter',
    perks: ['Public thank-you', 'Name on the supporters list'],
  },
  {
    id: 'member',
    amount: 20,
    label: 'Forge Member',
    perks: [
      'Discord supporter role',
      'Monthly devlog access',
      'Name in credits list',
    ],
    featured: true,
  },
  {
    id: 'builder',
    amount: 50,
    label: 'Builder',
    perks: [
      'Early prototype peeks',
      'Name in game credits',
      'Occasional digital thank-yous',
    ],
  },
];

/** Monthly tiers (same labels, recurring impact) */
const MONTH_TIERS = [
  {
    id: 'supporter',
    amount: 5,
    label: 'Supporter',
    perks: ['Public thank-you', 'Ongoing supporters list'],
  },
  {
    id: 'member',
    amount: 15,
    label: 'Forge Member',
    perks: [
      'Discord supporter role',
      'Monthly devlog access',
      'Priority shoutouts',
    ],
    featured: true,
  },
  {
    id: 'builder',
    amount: 40,
    label: 'Builder',
    perks: [
      'Early prototype peeks',
      'Name in game credits',
      'Builder badge on profile (when live)',
    ],
  },
];

const IMPACT_POINTS = [
  {
    icon: Hammer,
    title: 'Real development time',
    desc: 'Tools, hosting, assets, and the work that ships projects. Support funds development and operations.',
  },
  {
    icon: Users,
    title: 'Community systems',
    desc: 'Task boards, idea reviews, and credit tracking that keep volunteers unblocked.',
  },
  {
    icon: Sparkles,
    title: 'Transparent growth',
    desc: 'Funds stay in the forge. Impact reports live on the Transparency Hub.',
  },
];

const FAQ_ITEMS = [
  {
    q: 'Are contributions tax-deductible?',
    a: 'No. Together Forge is a community-supported for-profit studio. Support is not a charitable donation and is not tax-deductible.',
  },
  {
    q: 'Where does the money go?',
    a: 'Project development, tools, assets, community infrastructure, and studio operations. Founder compensation comes only from future profits once the studio sustains itself, not from support contributions.',
  },
  {
    q: 'What is the difference between one-time and monthly?',
    a: 'One-time is a single payment. Monthly is a recurring subscription you can cancel anytime through Stripe.',
  },
  {
    q: 'Do I have to take the perks?',
    a: 'Perks are optional thank-yous. You can support any amount without using Discord roles or credit listings if you prefer privacy.',
  },
  {
    q: 'How do refunds work?',
    a: 'Contact us if something went wrong. Recurring plans can be canceled in your Stripe customer portal or by emailing us.',
  },
];

const SupportPage = () => {
  const [searchParams] = useSearchParams();
  const [interval, setInterval] = useState('once'); // once | month
  const [customAmount, setCustomAmount] = useState('');
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState(null);

  const stripeReady = useMemo(() => isStripeConfigured(), []);
  const tiers = interval === 'month' ? MONTH_TIERS : ONCE_TIERS;

  useEffect(() => {
    const status = searchParams.get('checkout');
    const sessionId = searchParams.get('session_id');
    if (status === 'success') {
      // Optimistic local note only (webhook is source of truth for Transparency)
      const pending = sessionStorage.getItem('tf_pending_support');
      if (pending) {
        try {
          const p = JSON.parse(pending);
          recordLocalSupportEvent({
            amountCents: p.amountCents,
            label: p.label || 'Studio support',
            fundType: 'studio',
            interval: p.interval || 'once',
          });
        } catch {
          /* ignore */
        }
        sessionStorage.removeItem('tf_pending_support');
      }
      setBanner({
        type: 'success',
        text: sessionId
          ? 'Thank you! Payment completed. A receipt will come from Stripe. Studio totals update on the Transparency Hub after the webhook records the payment.'
          : 'Thank you! Your support helps fuel the forge. A receipt will come from Stripe if payment completed.',
      });
    } else if (status === 'cancel') {
      sessionStorage.removeItem('tf_pending_support');
      setBanner({
        type: 'info',
        text: 'Checkout canceled. You can pick a tier anytime you are ready.',
      });
    }
  }, [searchParams]);

  const runCheckout = async ({ amount, tierId, label }) => {
    setError('');
    const amountCents = Math.round(Number(amount) * 100);
    const validated = validateAmountCents(amountCents);
    if (!validated.ok) {
      setError(validated.error);
      return;
    }

    const key = `${tierId}_${interval}_${amountCents}`;
    setBusyKey(key);
    try {
      try {
        sessionStorage.setItem(
          'tf_pending_support',
          JSON.stringify({
            amountCents: validated.amountCents,
            label,
            interval,
            tierId,
          })
        );
      } catch {
        /* ignore */
      }
      await startStripeCheckout({
        amountCents: validated.amountCents,
        interval,
        tierId,
        label,
        fundType: 'studio',
      });
    } catch (err) {
      console.error('[Support] checkout', err);
      sessionStorage.removeItem('tf_pending_support');
      if (err?.code === 'STRIPE_NOT_CONFIGURED') {
        setError(
          'Stripe is not connected yet. Configure VITE_STRIPE_CHECKOUT_API_URL or VITE_STRIPE_PAYMENT_LINKS in your environment.'
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
    const amount = parseFloat(customAmount);
    runCheckout({
      amount,
      tierId: 'custom',
      label: 'Custom support',
    });
  };

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(192,38,211,0.06)_0%,transparent_55%)]"
        aria-hidden="true"
      />

      {/* Header */}
      <div className="relative z-10 border-b border-cyber-border bg-cyber-surface/80">
        <div className="container-custom py-12 md:py-16">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group transition-colors"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
            BACK TO HOME
          </Link>

          <div className="max-w-3xl">
            <div className="section-header">Support</div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Help fuel the forge
            </h1>
            <p className="text-lg sm:text-xl text-text-secondary leading-relaxed">
              Community support keeps development independent. No venture
              capital. Transparent use of funds. Every dollar goes toward better
              games and stronger systems.
            </p>
          </div>
        </div>
      </div>

      <div className="container-custom relative z-10 py-12 md:py-16 max-w-5xl space-y-14">
        {/* Status banners */}
        {banner && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-sm ${
              banner.type === 'success'
                ? 'border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan'
                : 'border-cyber-border bg-cyber-surface text-text-secondary'
            }`}
          >
            {banner.text}
          </div>
        )}

        {/* How funds are used (single clear statement) */}
        <Card className="bg-cyber-card/80 border-neon-cyan/25">
          <p className="text-base sm:text-lg text-text-secondary leading-relaxed">
            All contributions support general development, tools, assets,
            playtesting, community growth, and advancing active projects. Funds
            are used where most needed with full transparency reported in the{' '}
            <Link to="/transparency" className="text-neon-cyan hover:underline">
              Transparency Hub
            </Link>
            .
          </p>
        </Card>

        {/* Strong disclaimers */}
        <Card className="bg-amber-500/5 border-amber-400/30">
          <div className="flex gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-300 shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-text-secondary leading-relaxed">
              <p className="font-semibold text-amber-100 text-base">
                Important disclaimers
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  Contributions are <strong className="text-white">not tax-deductible</strong>.
                  Together Forge is a community-supported for-profit studio, not a charity.
                </li>
                <li>
                  Payments are support for development and operations, not equity or ownership.
                </li>
                <li>
                  Funds go toward building projects and studio operations (tools,
                  assets, infrastructure, taxes, and related costs). Founder pay
                  comes only from future profits once the studio sustains itself,
                  not from support contributions.
                </li>
                <li>
                  Perks are thank-you incentives only and may evolve as the forge grows.
                </li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Interval toggle + tiers */}
        <section aria-labelledby="tiers-heading">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <div className="section-header">Choose a level</div>
              <h2
                id="tiers-heading"
                className="text-2xl sm:text-3xl font-bold text-white"
              >
                One-time or monthly
              </h2>
            </div>

            <div className="inline-flex items-center bg-cyber-surface border border-cyber-border rounded-lg p-1 self-start">
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
            <p className="text-xs font-mono text-text-muted mb-4 tracking-wide">
              Stripe checkout URLs are not set in this environment. CTAs still
              work; you will see a setup message until env vars are configured.
            </p>
          )}

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-100"
            >
              {error}
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-4 md:gap-5">
            {tiers.map((tier) => {
              const key = `${tier.id}_${interval}_${tier.amount * 100}`;
              const busy = busyKey === key;
              return (
                <Card
                  key={`${tier.id}-${interval}`}
                  className={`bg-cyber-card/80 flex flex-col h-full ${
                    tier.featured ? 'border-neon-cyan/40 shadow-neon-cyan/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div>
                      <div className="text-3xl sm:text-4xl font-bold text-neon-cyan tabular-nums">
                        ${tier.amount}
                        {interval === 'month' && (
                          <span className="text-sm font-mono text-text-muted">
                            /mo
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-white mt-1">
                        {tier.label}
                      </h3>
                    </div>
                    {tier.featured && <Badge variant="neon">Popular</Badge>}
                  </div>

                  <div className="mb-5 flex-1">
                    <div className="font-mono text-[10px] tracking-widest text-text-muted uppercase mb-2">
                      Thank-you perks
                    </div>
                    <ul className="space-y-1.5">
                      {tier.perks.map((p) => (
                        <li
                          key={p}
                          className="flex items-start gap-2 text-sm text-text-secondary"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-neon-cyan shrink-0 mt-0.5" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    className="w-full gap-2"
                    disabled={!!busyKey}
                    onClick={() =>
                      runCheckout({
                        amount: tier.amount,
                        tierId: tier.id,
                        label: tier.label,
                      })
                    }
                  >
                    {busy ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Redirecting...
                      </>
                    ) : (
                      <>
                        <Heart className="w-4 h-4" />
                        {interval === 'month' ? 'Subscribe' : 'Support once'}
                      </>
                    )}
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Custom amount */}
        <section aria-labelledby="custom-heading">
          <Card className="bg-cyber-card/80">
            <div className="flex flex-col md:flex-row md:items-end gap-6">
              <div className="flex-1">
                <div className="section-header mb-1">Custom amount</div>
                <h2
                  id="custom-heading"
                  className="text-xl font-bold text-white mb-2"
                >
                  Choose your own number
                </h2>
                <p className="text-sm text-text-secondary">
                  Any amount from $1 up. Uses the same{' '}
                  {interval === 'month' ? 'monthly' : 'one-time'} checkout mode
                  selected above.
                </p>
              </div>
              <form
                onSubmit={handleCustom}
                className="flex flex-col sm:flex-row gap-3 w-full md:w-auto"
              >
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                    $
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="25.00"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="w-full sm:w-40 bg-cyber-surface border border-cyber-border rounded-lg pl-7 pr-4 py-3 text-text-primary focus:border-neon-cyan outline-none"
                    aria-label="Custom amount in dollars"
                  />
                </div>
                <Button
                  type="submit"
                  className="gap-2"
                  disabled={!!busyKey}
                >
                  {busyKey?.startsWith('custom_') ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    <>
                      Continue to Stripe
                      <ExternalLink className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </Card>
        </section>

        {/* Impact */}
        <section aria-labelledby="impact-heading">
          <div className="mb-6">
            <div className="section-header">Impact</div>
            <h2
              id="impact-heading"
              className="text-2xl sm:text-3xl font-bold text-white"
            >
              Where support goes
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {IMPACT_POINTS.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="bg-cyber-card/80">
                  <Icon className="w-6 h-6 text-neon-cyan mb-3" />
                  <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {item.desc}
                  </p>
                </Card>
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            <Shield className="w-4 h-4 text-neon-purple" />
            <span className="text-text-secondary">
              No stealth investor capture. Community-supported by design. Funds
              go where most needed, with reporting in the Transparency Hub.
            </span>
            <Link
              to="/transparency"
              className="text-neon-cyan hover:underline font-mono text-xs tracking-widest"
            >
              VIEW TRANSPARENCY HUB
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-heading">
          <div className="mb-6">
            <div className="section-header">FAQ</div>
            <h2
              id="faq-heading"
              className="text-2xl sm:text-3xl font-bold text-white"
            >
              Common questions
            </h2>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <Card key={item.q} className="bg-cyber-card/80 !p-5">
                <div className="flex gap-3">
                  <HelpCircle className="w-5 h-5 text-neon-cyan shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-white mb-1.5">{item.q}</h3>
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {item.a}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-sm text-text-muted">
            More answers on the{' '}
            <Link to="/faq" className="text-neon-cyan hover:underline">
              FAQ page
            </Link>
            , or{' '}
            <Link to="/contact" className="text-neon-cyan hover:underline">
              contact us
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
};

export default SupportPage;
