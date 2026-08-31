/**
 * Account → My Plan: current subscription, status/expiry, change / renew / cancel.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  Loader2,
  RefreshCw,
  ArrowRightLeft,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Buttons';
import Modal from '../ui/Modal';
import { billingService } from '../../services/billingService';
import { formatBillingDate } from '../../constants/supportPlans';
import { areDonationsEnabled } from '../../constants/donationsEnabled';

function formatBillingDateSafe(iso) {
  return formatBillingDate(iso) || 'period end';
}

function statusBadgeVariant(tone) {
  if (tone === 'success') return 'success';
  if (tone === 'warning') return 'warning';
  if (tone === 'danger') return 'danger';
  return 'default';
}

export default function AccountPlanSection() {
  const donationsEnabled = areDonationsEnabled();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // One-shot recovery after Checkout return (URL or sessionStorage)
      try {
        const params = new URLSearchParams(window.location.search);
        const sid =
          params.get('session_id') ||
          params.get('sessionId') ||
          sessionStorage.getItem('tf_last_checkout_session') ||
          '';
        if (sid.startsWith('cs_')) {
          // Always clear so a failed sync does not spam on every visit
          sessionStorage.removeItem('tf_last_checkout_session');
          await billingService.syncCheckoutSession(sid);
        }
      } catch {
        /* optional recovery */
      }
      const p = await billingService.getMyPlan();
      setPlan(p);
    } catch (e) {
      setError(e?.message || 'Could not load plan.');
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefreshFromStripe = async () => {
    if (!plan?.id) {
      setError('No plan id to refresh. Subscribe again or open Billing after checkout.');
      return;
    }
    setBusy('refresh');
    setError('');
    setMessage('');
    try {
      const updated = await billingService.refreshSubscription(plan.id);
      setPlan(updated);
      setMessage('Plan status refreshed from Stripe.');
    } catch (e) {
      setError(e?.message || 'Could not refresh from Stripe.');
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  const handleCancel = async () => {
    if (!plan?.id) return;
    setBusy('cancel');
    setMessage('');
    try {
      const updated = await billingService.cancelSubscription(plan.id);
      setPlan(updated);
      setConfirmCancel(false);
      setMessage(
        updated?.expiryLine ||
          'Subscription canceled. You keep access until the period ends.'
      );
    } catch (e) {
      setError(e?.message || 'Could not cancel.');
    } finally {
      setBusy(null);
    }
  };

  const handleRenew = async () => {
    if (!plan?.id) return;
    setBusy('renew');
    setMessage('');
    setError('');
    try {
      const updated = await billingService.renewSubscription(plan.id);
      setPlan(updated);
      setMessage('Plan renewed. Billing continues at the next cycle.');
    } catch (e) {
      setError(e?.message || 'Could not renew.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-text-muted text-sm py-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading plan…
      </div>
    );
  }

  const active =
    plan &&
    ['active', 'trialing', 'past_due'].includes(
      String(plan.status || '').toLowerCase()
    );
  const canRenew = plan?.cancelAtPeriodEnd && active;
  const canCancel = active && !plan?.cancelAtPeriodEnd;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">My Plan</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={() => void load()}
            disabled={Boolean(busy)}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload
          </Button>
          {plan?.id ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => void handleRefreshFromStripe()}
              disabled={busy === 'refresh'}
            >
              {busy === 'refresh' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Refresh from Stripe
            </Button>
          ) : null}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p
          className="text-sm text-emerald-200 border border-emerald-400/30 bg-emerald-500/10 rounded-lg px-3 py-2"
          role="status"
        >
          {message}
        </p>
      )}

      {!plan || !active ? (
        <Card className="bg-cyber-card/80 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <CreditCard className="w-8 h-8 text-text-muted shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-white">
                No active monthly plan
              </h3>
              <p className="text-sm text-text-secondary mt-1">
                {donationsEnabled
                  ? 'Subscribe on the Donate page for monthly support. One-time gifts do not create a plan.'
                  : 'Studio support is temporarily unavailable. They will be back shortly.'}
              </p>
            </div>
          </div>
          <Link to="/donate">
            <Button size="sm" className="gap-2">
              {donationsEnabled ? 'View monthly plans' : 'Support page'}
            </Button>
          </Link>
        </Card>
      ) : (
        <Card className="bg-cyber-card/80 p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono tracking-widest uppercase text-text-muted mb-1">
                Current plan
              </p>
              <h3 className="text-2xl font-bold text-white">{plan.label}</h3>
              <p className="text-neon-cyan font-mono text-sm mt-1">
                {plan.amountLabel}
              </p>
            </div>
            <Badge variant={statusBadgeVariant(plan.statusTone)}>
              {plan.statusLabel}
            </Badge>
          </div>

          {plan.expiryLine && (
            <p className="text-sm text-text-secondary border border-white/10 rounded-lg px-3 py-2.5 bg-cyber-surface/50">
              {plan.expiryLine}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {String(plan.status || '').toLowerCase() === 'past_due' ? (
              <Link to="/account/billing">
                <Button type="button" size="sm" className="gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  Update payment method
                </Button>
              </Link>
            ) : null}
            {donationsEnabled ? (
            <Link to="/donate">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1.5"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Change plan
              </Button>
            </Link>
            ) : null}
            {donationsEnabled && canRenew && (
              <Button
                type="button"
                size="sm"
                variant="primary"
                className="gap-1.5"
                disabled={busy === 'renew'}
                onClick={() => void handleRenew()}
              >
                {busy === 'renew' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                Renew plan
              </Button>
            )}
            {canCancel && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1.5 text-red-200 hover:text-red-100"
                onClick={() => setConfirmCancel(true)}
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancel subscription
              </Button>
            )}
          </div>
        </Card>
      )}

      <Modal
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel subscription?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Your plan will stay active until the end of the current billing
            period
            {plan?.currentPeriodEnd
              ? ` (${formatBillingDateSafe(plan.currentPeriodEnd)})`
              : ''}
            . You will not be charged again. You can renew before then if you
            change your mind.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmCancel(false)}
            >
              Keep plan
            </Button>
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={busy === 'cancel'}
              onClick={() => void handleCancel()}
            >
              {busy === 'cancel' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                'Confirm cancel'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
