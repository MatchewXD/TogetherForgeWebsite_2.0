/**
 * Support founder personal runway (living expenses).
 * Separate from studio Donate page at /donate.
 * One-time or monthly via Stripe helpers; tierId: runway.
 */

import { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Heart,
  Loader2,
  Wallet,
} from 'lucide-react';

import Card from '../components/ui/Card';
import Button from '../components/ui/Buttons';
import RunwayTransparency from '../components/ui/RunwayTransparency';
import RecentDonationsList from '../components/support/RecentDonationsList';
import FundContributorsCard from '../components/support/FundContributorsCard';
import DonationCreditChoice, {
  resolveDonationCredit,
} from '../components/support/DonationCreditChoice';
import PaymentsComingSoon from '../components/support/PaymentsComingSoon';
import { areDonationsEnabled } from '../constants/donationsEnabled';
import {
  startStripeCheckout,
  isStripeConfigured,
  recordLocalSupportEvent,
  validateAmountCents,
} from '../services/supportService';
import { getPublicRecentDonations } from '../services/donationsService';
import { billingService } from '../services/billingService';
import { badgesService } from '../services/badgesService';
import { supabase } from '../lib/supabase';
import { ensureUserProfile } from '../utils/ensureUserProfile';
import { ONCE_TIERS, MONTH_TIERS } from '../constants/supportPlans';

const SupportRunway = () => {
  const [searchParams] = useSearchParams();
  const [interval, setInterval] = useState('once'); // once | month
  const [customAmount, setCustomAmount] = useState('');
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState(null);
  const [recentItems, setRecentItems] = useState([]);
  const [recentSource, setRecentSource] = useState('empty');
  const [recentLoading, setRecentLoading] = useState(true);
  const [wantPublicCredit, setWantPublicCredit] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [authUsername, setAuthUsername] = useState(null);
  const [authAvatarUrl, setAuthAvatarUrl] = useState(null);
  const [authProfileReady, setAuthProfileReady] = useState(false);

  const stripeReady = useMemo(() => isStripeConfigured(), []);
  const donationsEnabled = useMemo(() => areDonationsEnabled(), []);
  const amountTiers = interval === 'month' ? MONTH_TIERS : ONCE_TIERS;

  useEffect(() => {
    let mounted = true;
    (async () => {
      setRecentLoading(true);
      try {
        const recent = await getPublicRecentDonations(12, {
          fundType: 'runway',
        });
        if (!mounted) return;
        setRecentItems(recent.items || []);
        setRecentSource(recent.source || 'empty');
      } catch (e) {
        console.warn('[SupportRunway] recent', e?.message || e);
      } finally {
        if (mounted) setRecentLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadProfile = async (user) => {
      if (!user?.id) {
        if (mounted) {
          setAuthUser(null);
          setAuthUsername(null);
          setAuthAvatarUrl(null);
          setAuthProfileReady(true);
        }
        return;
      }
      setAuthUser(user);
      try {
        const profile =
          (await ensureUserProfile(user.id, { email: user.email })) || null;
        if (!mounted) return;
        setAuthUsername(String(profile?.username || '').trim() || null);
        setAuthAvatarUrl(String(profile?.avatar_url || '').trim() || null);
      } catch {
        if (mounted) {
          setAuthUsername(null);
          setAuthAvatarUrl(null);
        }
      } finally {
        if (mounted) setAuthProfileReady(true);
      }
    };

    supabase.auth.getSession().then((res) => {
      void loadProfile(res?.data?.session?.user || null);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      void loadProfile(session?.user || null);
    });
    return () => {
      mounted = false;
      data?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const status = searchParams.get('checkout');
    if (status === 'success') {
      const pending = sessionStorage.getItem('tf_pending_runway');
      if (pending) {
        try {
          const p = JSON.parse(pending);
          recordLocalSupportEvent({
            amountCents: p.amountCents,
            label: p.label || 'Runway support',
            fundType: 'runway',
            interval: p.interval || 'once',
            isAnonymous: p.isAnonymous !== false,
            username: p.username || null,
            avatarUrl: p.avatarUrl || null,
          });
        } catch {
          /* ignore */
        }
        sessionStorage.removeItem('tf_pending_runway');
      }
      setBanner({
        type: 'success',
        text: 'Thank you for supporting the runway. This is separate from studio project funds.',
      });
      void getPublicRecentDonations(12, { fundType: 'runway' }).then(
        (recent) => {
          setRecentItems(recent.items || []);
          setRecentSource(recent.source || 'empty');
        }
      );

      let cancelled = false;
      (async () => {
        const sessionId =
          searchParams.get('session_id') ||
          searchParams.get('sessionId') ||
          '';
        if (!sessionId.startsWith('cs_')) return;
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (cancelled || !session?.user?.id) return;
          const sync = await billingService.syncCheckoutSession(sessionId);
          if (!sync.ok) {
            console.warn('[SupportRunway] sync-checkout', sync.error);
            return;
          }
          await badgesService.syncMyBadges();
        } catch (e) {
          console.warn('[SupportRunway] sync-checkout', e?.message || e);
        }
      })();
      return () => {
        cancelled = true;
      };
    } else if (status === 'cancel') {
      sessionStorage.removeItem('tf_pending_runway');
      setBanner({
        type: 'info',
        text: 'Checkout canceled. You can try again anytime.',
      });
    }
  }, [searchParams]);

  const runCheckout = async (amount, key) => {
    setError('');
    if (!areDonationsEnabled()) return;
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

    setBusyKey(key);
    try {
      const label =
        interval === 'month'
          ? 'Founder runway (monthly)'
          : 'Founder runway (one-time)';
      try {
        sessionStorage.setItem(
          'tf_pending_runway',
          JSON.stringify({
            amountCents: validated.amountCents,
            label,
            interval,
            isAnonymous: credit.isAnonymous,
            username: credit.isAnonymous ? null : credit.displayName || null,
            avatarUrl: credit.isAnonymous ? null : authAvatarUrl || null,
          })
        );
      } catch {
        /* ignore */
      }
      const origin = window.location.origin;
      await startStripeCheckout({
        amountCents: validated.amountCents,
        interval,
        tierId: 'runway',
        label,
        fundType: 'runway',
        userId: credit.userId || authUser?.id || null,
        email: authUser?.email || null,
        displayName: credit.displayName,
        isAnonymous: credit.isAnonymous,
        successUrl: `${origin}/support-runway?checkout=success`,
        cancelUrl: `${origin}/support-runway?checkout=cancel`,
      });
    } catch (err) {
      console.error('[SupportRunway] checkout', err);
      sessionStorage.removeItem('tf_pending_runway');
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
          <div className="max-w-3xl">
            <h1 className="section-header dashboard-page-title !mb-4 !text-3xl sm:!text-4xl !font-bold !tracking-tight !normal-case">
              Founder Runway
            </h1>
            <p className="text-base sm:text-lg font-semibold text-white leading-relaxed">
              Not project funds. Not studio support.
            </p>
            <p className="mt-4 text-sm sm:text-base text-text-secondary leading-relaxed">
              This is a completely separate personal funding path. It covers my
              living expenses so I can move toward working full-time on Together
              Forge without ever taking money from studio support or project
              funds.
            </p>
            <p className="mt-3 text-sm sm:text-base text-text-secondary leading-relaxed">
              Studio donations stay with the studio. This runway is tracked on
              its own so the community can see exactly where personal support
              goes and confirm the two are never mixed.
            </p>
            <p className="mt-5 text-sm sm:text-base leading-relaxed">
              <Link
                to="/founders-thoughts#founder-compensation"
                className="inline-flex items-center gap-1 font-semibold text-neon-cyan hover:underline"
              >
                Read the full explanation of founder compensation and why this
                separation exists
                <span aria-hidden="true"> → </span>
                Founders Thoughts
              </Link>
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

        {donationsEnabled ? (
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

          <DonationCreditChoice
            className="mb-6"
            variant="full"
            wantPublicCredit={wantPublicCredit}
            onChange={setWantPublicCredit}
            isSignedIn={Boolean(authUser)}
            username={authUsername}
            avatarUrl={authAvatarUrl}
            displayName={authUsername}
            profileLoading={Boolean(authUser) && !authProfileReady}
            description="Named credit on this page shows your name and amount. Choose anonymous to appear as Anonymous, without an amount. Runway gifts are never added to the studio Contributors page."
          />

          {!stripeReady && (
            <p className="text-xs font-mono text-text-muted mb-4 border border-dashed border-cyber-border rounded-lg p-3">
              Stripe not configured. Optional keys:{' '}
              <span className="text-neon-cyan">runway_once</span>
              {' / '}
              <span className="text-neon-cyan">runway_month</span>
            </p>
          )}

          <div className="grid grid-cols-3 gap-3 mb-6">
            {amountTiers.map((tier) => {
              const amount = tier.amount;
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
        ) : (
          <PaymentsComingSoon />
        )}

        <RecentDonationsList
          items={recentItems}
          loading={recentLoading}
          source={recentSource}
          title="Recent contributions"
          headingId="recent-runway-heading"
          emptyTitle="No public runway support yet"
          emptyBody="Runway gifts appear here. Named supporters opted in to public credit. Private gifts show as Anonymous."
          showCreditNote={false}
        />

        <FundContributorsCard fundType="runway" />

        <RunwayTransparency />
      </div>
    </div>
  );
};

export default SupportRunway;
