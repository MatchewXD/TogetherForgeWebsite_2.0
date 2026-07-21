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
  ExternalLink,
  Loader2,
} from 'lucide-react';

import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import FaqAccordion from '../components/ui/FaqAccordion';
import {
  startStripeCheckout,
  isStripeConfigured,
  recordLocalSupportEvent,
  validateAmountCents,
  getCheckoutApiUrl,
} from '../services/supportService';
import StripeCheckoutButton from '../components/support/StripeCheckoutButton';
import SupportTotals from '../components/support/SupportTotals';
import RecentDonationsList from '../components/support/RecentDonationsList';
import {
  getPublicSupportSummary,
  getPublicRecentDonations,
} from '../services/donationsService';

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
  const [socialLoading, setSocialLoading] = useState(true);
  const [supportStats, setSupportStats] = useState({
    studioTotalCents: 0,
    studioPaymentCount: 0,
    studioMrrCents: 0,
    studioSubscriberCount: 0,
    source: 'empty',
  });
  const [recentDonations, setRecentDonations] = useState([]);
  const [recentSource, setRecentSource] = useState('empty');

  const stripeReady = useMemo(() => isStripeConfigured(), []);
  const tiers = interval === 'month' ? MONTH_TIERS : ONCE_TIERS;

  const loadSocialProof = async ({ quiet = false } = {}) => {
    if (!quiet) setSocialLoading(true);
    try {
      const [summary, recent] = await Promise.all([
        getPublicSupportSummary(),
        getPublicRecentDonations(12),
      ]);
      setSupportStats(summary);
      setRecentDonations(recent.items || []);
      setRecentSource(recent.source || 'empty');
      return summary;
    } catch (e) {
      console.error('[Support] social proof load', e);
      return null;
    } finally {
      if (!quiet) setSocialLoading(false);
    }
  };

  useEffect(() => {
    loadSocialProof();
  }, []);

  useEffect(() => {
    const status = searchParams.get('checkout');
    if (status === 'success') {
      // Optimistic local note (shows if webhook/RPC not ready yet)
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
        text: 'Thank you! Your payment was successful. We really appreciate your support',
      });

      // Webhook may lag a few seconds — poll for updated totals
      let cancelled = false;
      (async () => {
        await loadSocialProof({ quiet: true });
        for (const delay of [1500, 3000, 5000]) {
          await new Promise((r) => setTimeout(r, delay));
          if (cancelled) return;
          const summary = await loadSocialProof({ quiet: true });
          if (summary && summary.studioTotalCents > 0) break;
        }
      })();

      return () => {
        cancelled = true;
      };
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

      <div className="container-custom relative z-10 py-12 md:py-16 max-w-6xl space-y-12">
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

        {/* 1. Compact totals (full width) */}
        <SupportTotals
          totalCents={supportStats.studioTotalCents}
          mrrCents={supportStats.studioMrrCents}
          paymentCount={supportStats.studioPaymentCount}
          subscriberCount={supportStats.studioSubscriberCount}
          loading={socialLoading}
          source={supportStats.source}
        />

        {/* 2. Donation options */}
        <section aria-labelledby="tiers-heading">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2
              id="tiers-heading"
              className="section-header mb-0 text-base sm:text-lg tracking-[0.2em]"
            >
              Choose a level
            </h2>

            {/* Billing interval toggle — high-contrast so it is hard to miss */}
            <div className="self-start sm:self-auto">
              <p className="text-[10px] font-mono tracking-widest uppercase text-neon-cyan mb-1.5 text-left sm:text-right">
                Billing type
              </p>
              <div
                className="inline-flex items-center rounded-xl border-2 border-neon-cyan/50 bg-cyber-surface p-1 shadow-[0_0_20px_rgba(0,249,255,0.12)]"
                role="group"
                aria-label="One-time or monthly billing"
              >
                <button
                  type="button"
                  onClick={() => setInterval('once')}
                  aria-pressed={interval === 'once'}
                  className={`px-5 py-2.5 text-sm font-mono tracking-wide rounded-lg transition-all ${
                    interval === 'once'
                      ? 'bg-neon-cyan text-cyber-bg font-semibold shadow-neon-cyan'
                      : 'text-text-secondary hover:text-white'
                  }`}
                >
                  One-time
                </button>
                <button
                  type="button"
                  onClick={() => setInterval('month')}
                  aria-pressed={interval === 'month'}
                  className={`px-5 py-2.5 text-sm font-mono tracking-wide rounded-lg transition-all ${
                    interval === 'month'
                      ? 'bg-neon-cyan text-cyber-bg font-semibold shadow-neon-cyan'
                      : 'text-text-secondary hover:text-white'
                  }`}
                >
                  Monthly
                </button>
              </div>
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

        <section aria-labelledby="custom-heading">
          <Card className="bg-cyber-card/80">
            <h2 id="custom-heading" className="section-header mb-2">
              Custom amount
            </h2>
            <p className="text-sm text-text-secondary mb-5">
              Any amount from $1 up. Uses the same{' '}
              {interval === 'month' ? 'monthly' : 'one-time'} checkout mode
              selected above.
            </p>
            <form
              onSubmit={handleCustom}
              className="flex flex-col sm:flex-row gap-3 w-full items-stretch sm:items-center"
            >
              <div className="relative flex-1 min-w-0">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-lg font-mono">
                  $
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="25"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full bg-cyber-surface border border-cyber-border rounded-xl pl-10 pr-4 py-4 text-xl sm:text-2xl font-mono text-text-primary tabular-nums focus:border-neon-cyan outline-none"
                  aria-label="Custom amount in dollars"
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="gap-2 w-full sm:w-auto sm:shrink-0 px-8"
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
          </Card>
        </section>

        {/* 3. Recent support */}
        <RecentDonationsList
          items={recentDonations}
          loading={socialLoading}
          source={recentSource}
        />

        {/* Dev-friendly single test button (uses Edge Function + product id) */}
        {import.meta.env.DEV && (
          <Card className="bg-cyber-card/80 border-neon-purple/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="text-xs font-mono tracking-widest text-neon-purple uppercase mb-1">
                  Local Stripe test
                </div>
                <p className="text-sm text-text-secondary">
                  One-click $5 Checkout via Supabase Edge Function. Secret key stays on
                  the server. API:{' '}
                  <code className="text-xs text-neon-cyan font-mono break-all">
                    {getCheckoutApiUrl() || '(not set)'}
                  </code>
                </p>
              </div>
              <StripeCheckoutButton
                amountDollars={5}
                interval="once"
                tierId="test"
                label="Together Forge Support (test)"
                fundType="studio"
                className="shrink-0"
              />
            </div>
          </Card>
        )}

        {/* Funds use + important notes (single card) */}
        <Card className="bg-cyber-card/80 border-cyber-border">
          <p className="text-base sm:text-lg text-text-secondary leading-relaxed mb-5">
            All contributions support general development, tools, assets,
            playtesting, community growth, and advancing active projects. Funds
            are used where most needed.
          </p>
          <p className="font-semibold text-white text-sm sm:text-base mb-2">
            Important notes:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-text-secondary leading-relaxed">
            <li>
              Contributions are not tax-deductible. Together Forge is a
              community-supported for-profit studio.
            </li>
            <li>
              Payments support development and operations, not equity or
              ownership.
            </li>
            <li>
              Founder pay comes only from future profits, not from supporter
              contributions.
            </li>
            <li>
              Perks are thank-you incentives only and may evolve as the forge
              grows.
            </li>
          </ul>
        </Card>

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
          <FaqAccordion items={FAQ_ITEMS} />
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
