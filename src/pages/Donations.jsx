/**
 * Donate page (primary route: /donate; aliases: /support, /donations).
 * Tiered one-time + monthly options, custom amount, disclaimers, impact, FAQ,
 * Stripe Checkout via Payment Links or server API (see supportService.js).
 */

import { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Heart,
  Shield,
  Sparkles,
  Users,
  Hammer,
  CheckCircle2,
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
import SupportTotals from '../components/support/SupportTotals';
import RecentDonationsList from '../components/support/RecentDonationsList';
import DonationCreditChoice, {
  resolveDonationCredit,
} from '../components/support/DonationCreditChoice';
import {
  getPublicSupportSummary,
  getPublicRecentDonations,
} from '../services/donationsService';
import { supabase } from '../lib/supabase';

/** One-time tiers */
const SUPPORT_BANNER_SRC = '/images/Support_Page.webp';

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
    accent: 'text-neon-cyan',
    border: 'border-neon-cyan/25',
    iconBg: 'bg-neon-cyan/10 border-neon-cyan/30',
  },
  {
    icon: Users,
    title: 'Community systems',
    desc: 'Task boards, idea reviews, and credit tracking that keep volunteers unblocked.',
    accent: 'text-neon-magenta',
    border: 'border-neon-magenta/25',
    iconBg: 'bg-neon-magenta/10 border-neon-magenta/30',
  },
  {
    icon: Sparkles,
    title: 'Transparent growth',
    desc: 'Funds stay in the forge. Impact reports live on the Transparency Hub.',
    accent: 'text-forge-gold',
    border: 'border-forge-gold/30',
    iconBg: 'bg-forge-gold/10 border-forge-gold/35',
  },
];

/** Per-tier accent palette so the grid is not all cyan */
const TIER_THEME = {
  supporter: {
    amount: 'text-neon-cyan',
    check: 'text-neon-cyan',
    card: 'border-neon-cyan/30 hover:border-neon-cyan/50',
    badge: 'neon',
    buttonVariant: 'primary',
  },
  member: {
    amount: 'text-neon-magenta',
    check: 'text-neon-magenta',
    card: 'border-neon-magenta/40 shadow-[0_0_24px_rgba(233,64,245,0.12)] hover:border-neon-magenta/55',
    badge: 'purple',
    buttonVariant: 'outline',
  },
  builder: {
    amount: 'text-forge-gold',
    check: 'text-forge-gold',
    card: 'border-forge-gold/40 cyber-card-gold hover:border-forge-gold/55',
    badge: 'gold',
    buttonVariant: 'gold',
  },
};

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
  /** Public credit vs anonymous — chosen before Stripe Checkout */
  const [wantPublicCredit, setWantPublicCredit] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [authUsername, setAuthUsername] = useState(null);
  const [authAvatarUrl, setAuthAvatarUrl] = useState(null);

  const stripeReady = useMemo(() => isStripeConfigured(), []);
  const tiers = interval === 'month' ? MONTH_TIERS : ONCE_TIERS;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!mounted) return;
        setAuthUser(user || null);
        if (user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', user.id)
            .maybeSingle();
          if (mounted) {
            setAuthUsername(profile?.username || null);
            setAuthAvatarUrl(profile?.avatar_url || null);
          }
        } else if (mounted) {
          setAuthUsername(null);
          setAuthAvatarUrl(null);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

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

      // Webhook may lag a few seconds - poll for updated totals
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

    const credit = resolveDonationCredit({
      wantPublicCredit,
      authUser,
      username: authUsername,
    });
    if (credit.error) {
      setError(credit.error);
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
            isAnonymous: credit.isAnonymous,
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
        // Visibility decided on-site; Stripe Checkout metadata + webhook record it
        userId: credit.userId,
        displayName: credit.displayName,
        isAnonymous: credit.isAnonymous,
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
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(192,38,211,0.06)_0%,transparent_55%)]"
        aria-hidden="true"
      />

      {/* Page header banner */}
      <header className="relative pt-20 overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <img
            src={SUPPORT_BANNER_SRC}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-[center_40%] sm:object-center"
            decoding="async"
            fetchPriority="high"
          />
          {/* Readability: base dim + left-weighted panel + top shade */}
          <div className="absolute inset-0 bg-cyber-bg/55" />
          <div className="absolute inset-0 bg-gradient-to-r from-cyber-bg/96 via-cyber-bg/85 to-cyber-bg/35" />
          <div className="absolute inset-0 bg-gradient-to-b from-cyber-bg/70 via-cyber-bg/25 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgb(var(--tf-neon-magenta)/0.08)_0%,transparent_50%)]" />
        </div>
        {/* Soft fade into page background (matches home hero) */}
        <div
          className="absolute bottom-0 inset-x-0 h-28 sm:h-32 pointer-events-none z-[5] bg-gradient-to-b from-transparent via-cyber-bg/50 to-cyber-bg"
          aria-hidden="true"
        />

        <div className="container-custom relative z-10 py-10 sm:py-12 md:py-14 min-h-[16rem] sm:min-h-[18rem] md:min-h-[20rem] flex flex-col justify-center">
          <div className="max-w-3xl [text-shadow:0_1px_2px_rgb(0_0_0_/_0.9),0_2px_16px_rgb(0_0_0_/_0.55)]">
            <div className="section-header">Donate</div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Help fuel the forge
            </h1>
            <p className="text-lg sm:text-xl text-white/85 leading-relaxed">
              Community support keeps development independent. No venture
              capital. Transparent use of funds. Every dollar goes toward better
              games and stronger systems.
            </p>
          </div>
        </div>
      </header>

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

            {/* Billing interval toggle */}
            <div className="self-start sm:self-auto">
              <p className="text-[10px] font-mono tracking-widest uppercase text-forge-gold mb-1.5 text-left sm:text-right">
                Billing type
              </p>
              <div
                className="inline-flex items-center rounded-xl border-2 border-forge-gold/40 bg-cyber-surface p-1 shadow-[0_0_20px_rgba(245,197,66,0.1)]"
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
                      ? 'bg-neon-magenta text-white font-semibold shadow-[0_0_16px_rgba(233,64,245,0.35)]'
                      : 'text-text-secondary hover:text-white'
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>
          </div>

          {/* Credit choice — must happen before any donate button */}
          <DonationCreditChoice
            className="mb-6"
            wantPublicCredit={wantPublicCredit}
            onChange={setWantPublicCredit}
            isSignedIn={Boolean(authUser)}
            username={authUsername}
            avatarUrl={authAvatarUrl}
            displayName={authUsername}
          />

          {!stripeReady && (
            <p className="text-xs font-mono text-text-muted mb-4 tracking-wide">
              Online checkout is temporarily unavailable. Please try again
              later, or reach out through Contact if you need help.
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
              const theme = TIER_THEME[tier.id] || TIER_THEME.supporter;
              return (
                <Card
                  key={`${tier.id}-${interval}`}
                  className={`bg-cyber-card/80 flex flex-col h-full border ${theme.card}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div>
                      <div
                        className={`text-3xl sm:text-4xl font-bold tabular-nums ${theme.amount}`}
                      >
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
                    {tier.featured && (
                      <Badge variant={theme.badge || 'purple'}>Popular</Badge>
                    )}
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
                          <CheckCircle2
                            className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${theme.check}`}
                          />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <p className="mb-2 text-[11px] font-mono tracking-wide text-text-muted text-center">
                    {wantPublicCredit
                      ? 'Credit: show my name'
                      : 'Credit: anonymous'}
                  </p>
                  <Button
                    size="lg"
                    variant={theme.buttonVariant || 'primary'}
                    className="w-full gap-2 py-3.5 text-lg sm:text-xl font-bold tracking-wide"
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
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Redirecting...
                      </>
                    ) : (
                      <>
                        <Heart className="w-5 h-5" />
                        {interval === 'month' ? 'Subscribe' : 'Donate'}
                      </>
                    )}
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="custom-heading">
          <Card className="bg-cyber-card/80 border-neon-purple/30">
            <h2 id="custom-heading" className="section-header mb-2">
              Custom amount
            </h2>
            <p className="text-sm text-text-secondary mb-5">
              Any amount from $1 up. Uses the same billing type and public
              credit choice selected above.
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
                  className={`w-full bg-cyber-surface border rounded-xl pl-10 py-4 text-xl sm:text-2xl font-mono text-text-primary tabular-nums outline-none ${
                    interval === 'month'
                      ? 'border-neon-magenta/40 focus:border-neon-magenta pr-16'
                      : 'border-forge-gold/35 focus:border-forge-gold pr-4'
                  }`}
                  aria-label={
                    interval === 'month'
                      ? 'Custom amount in dollars per month'
                      : 'Custom amount in dollars'
                  }
                />
                {interval === 'month' && (
                  <span
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-mono text-text-muted pointer-events-none"
                    aria-hidden
                  >
                    /mo
                  </span>
                )}
              </div>
              <Button
                type="submit"
                size="lg"
                variant={interval === 'month' ? 'outline' : 'gold'}
                className="gap-2 w-full sm:w-auto sm:shrink-0 px-8 py-3.5 text-lg sm:text-xl font-bold tracking-wide"
                disabled={!!busyKey}
              >
                {busyKey?.startsWith('custom_') ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  <>
                    <Heart className="w-5 h-5" />
                    {interval === 'month' ? 'Subscribe' : 'Donate'}
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

        {/* Dev-friendly single test button (same credit path as real tiers) */}
        {import.meta.env.DEV && (
          <Card className="bg-cyber-card/80 border-neon-purple/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="text-xs font-mono tracking-widest text-neon-purple uppercase mb-1">
                  Local Stripe test
                </div>
                <p className="text-sm text-text-secondary">
                  One-click $5 Checkout via Supabase Edge Function. Uses the same
                  public credit choice as the buttons above. API:{' '}
                  <code className="text-xs text-neon-cyan font-mono break-all">
                    {getCheckoutApiUrl() || '(not set)'}
                  </code>
                </p>
              </div>
              <Button
                className="shrink-0 gap-2"
                disabled={!!busyKey}
                onClick={() =>
                  runCheckout({
                    amount: 5,
                    tierId: 'test',
                    label: 'Together Forge Support (test)',
                  })
                }
              >
                {busyKey?.startsWith('test_') ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4" />
                    Pay $5 test
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* Funds use + important notes (single card) */}
        <Card className="bg-cyber-card/80 border-l-4 border-l-forge-gold border-cyber-border">
          <p className="text-base sm:text-lg text-text-secondary leading-relaxed mb-5">
            All contributions support general development, tools, assets,
            playtesting, community growth, and advancing active projects. Funds
            are used where most needed.
          </p>
          <p className="font-semibold text-forge-gold text-sm sm:text-base mb-2">
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
                <Card
                  key={item.title}
                  className={`bg-cyber-card/80 border ${item.border}`}
                >
                  <div
                    className={`inline-flex items-center justify-center w-11 h-11 rounded-xl border mb-3 ${item.iconBg}`}
                  >
                    <Icon className={`w-5 h-5 ${item.accent}`} />
                  </div>
                  <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {item.desc}
                  </p>
                </Card>
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm rounded-xl border border-neon-purple/25 bg-neon-purple/5 px-4 py-3">
            <Shield className="w-4 h-4 text-neon-purple shrink-0" />
            <span className="text-text-secondary flex-1 min-w-[12rem]">
              No stealth investor capture. Community-supported by design. Funds
              go where most needed, with reporting in the Transparency Hub.
            </span>
            <Link
              to="/transparency"
              className="text-neon-magenta hover:text-neon-cyan hover:underline font-mono text-xs tracking-widest"
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
