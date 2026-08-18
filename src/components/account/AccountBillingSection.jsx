/**
 * Account → Billing: open Stripe Customer Portal for methods/subs;
 * keep TF-side transaction history and a light subscription status snapshot.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  Loader2,
  RefreshCw,
  ExternalLink,
  Receipt,
  Wallet,
} from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Buttons';
import { billingService } from '../../services/billingService';
import { formatBillingDate } from '../../constants/supportPlans';

export default function AccountBillingSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [history, setHistory] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusBanner, setStatusBanner] = useState('');
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      try {
        const sid =
          searchParams.get('session_id') ||
          searchParams.get('sessionId') ||
          sessionStorage.getItem('tf_last_checkout_session') ||
          '';
        if (sid.startsWith('cs_')) {
          sessionStorage.removeItem('tf_last_checkout_session');
          await billingService.syncCheckoutSession(sid);
        }
      } catch {
        /* optional */
      }
      const [h, s] = await Promise.all([
        billingService.getMyHistory(40),
        billingService.listMySubscriptions(),
      ]);
      setHistory(h);
      setSubs(s);
    } catch (e) {
      setError(e?.message || 'Could not load billing.');
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  // After Stripe Customer Portal return
  useEffect(() => {
    try {
      const portal = searchParams.get('portal');
      if (portal === 'return' || portal === '1') {
        setStatusBanner(
          'Returned from Stripe. Subscription status and history are refreshed below.'
        );
        void load();
        const next = new URLSearchParams(searchParams);
        next.delete('portal');
        setSearchParams(next, { replace: true });
      }
    } catch {
      /* ignore */
    }
  }, [searchParams, setSearchParams, load]);

  /** Full Stripe Customer Portal (payment methods, invoices, subscriptions). */
  const openPortal = async () => {
    setBusy('portal');
    setError('');
    try {
      await billingService.openCustomerPortal({
        returnUrl: `${window.location.origin}/account/billing?portal=return`,
        flow: null,
      });
    } catch (e) {
      setError(e?.message || 'Could not open Stripe billing portal.');
      setBusy(null);
    }
  };

  const activeSubs = subs.filter((s) =>
    ['active', 'trialing', 'past_due'].includes(
      String(s?.status || '').toLowerCase()
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Billing</h2>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1.5"
          onClick={() => void load()}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {statusBanner && (
        <p
          role="status"
          className="text-sm text-emerald-200 border border-emerald-400/30 bg-emerald-500/10 rounded-lg px-3 py-2"
        >
          {statusBanner}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      {/* Stripe portal — single place for methods + subscriptions */}
      <Card className="bg-cyber-card/80 p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-neon-cyan" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-white">
              Payment methods &amp; subscriptions
            </h3>
            <p className="text-sm text-text-secondary mt-1 leading-relaxed">
              Open your Stripe billing account to add or remove cards, update
              Link, download invoices, and manage monthly subscriptions.
            </p>
          </div>
        </div>
        <Button
          type="button"
          className="gap-2 w-full sm:w-auto"
          disabled={Boolean(busy)}
          onClick={() => void openPortal()}
        >
          {busy === 'portal' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ExternalLink className="w-4 h-4" />
          )}
          Manage payment methods
        </Button>
        <p className="text-[11px] text-text-muted font-mono">
          You will leave Together Forge briefly and return here when done.
        </p>
      </Card>

      {/* Light snapshot of subs we know about (full manage is in Stripe) */}
      <Card className="bg-cyber-card/80 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-neon-purple" />
            <h3 className="text-sm font-semibold text-white">
              Active monthly subscriptions
            </h3>
          </div>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void openPortal()}
            className="text-xs text-neon-cyan hover:underline inline-flex items-center gap-1 disabled:opacity-50"
          >
            Manage in Stripe
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-text-muted flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </p>
        ) : activeSubs.length === 0 ? (
          <p className="text-sm text-text-muted">
            No active monthly subscriptions on this account.{' '}
            <Link to="/donate" className="text-neon-cyan hover:underline">
              Start one on Donate
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {activeSubs.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-cyber-surface/40 px-3 py-2.5 text-sm"
              >
                <div>
                  <span className="text-white font-medium">{s.label}</span>
                  <span className="text-text-muted font-mono text-xs ml-2">
                    {s.amountLabel}
                  </span>
                </div>
                <Badge
                  variant={
                    s.cancelAtPeriodEnd
                      ? 'warning'
                      : s.statusTone === 'success'
                        ? 'success'
                        : 'default'
                  }
                >
                  {s.statusLabel}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-text-muted">
          Cancel, renew, or change billing details in Stripe. Plan perks on this
          site are under{' '}
          <Link to="/account/plan" className="text-neon-cyan hover:underline">
            My Plan
          </Link>
          .
        </p>
      </Card>

      {/* Transaction history (TF records) */}
      <Card className="bg-cyber-card/80 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-forge-gold" />
            <h3 className="text-sm font-semibold text-white">
              Transaction history
            </h3>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1.5 text-xs"
            disabled={Boolean(busy)}
            onClick={() => void openPortal()}
          >
            {busy === 'portal' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ExternalLink className="w-3.5 h-3.5" />
            )}
            Invoices in Stripe
          </Button>
        </div>
        <p className="text-xs text-text-muted">
          Charges recorded for your Together Forge account. Official invoices and
          receipts are in the Stripe portal.
        </p>

        {loading ? (
          <p className="text-sm text-text-muted flex items-center gap-2 py-4">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </p>
        ) : history.length === 0 ? (
          <p className="text-sm text-text-muted py-2">
            No payments yet on this account.
          </p>
        ) : (
          <div className="task-scroll max-h-72 overflow-y-auto overscroll-contain rounded-lg border border-cyber-border/80">
            <table className="w-full text-sm text-left">
              <thead className="bg-cyber-surface/80 text-[10px] font-mono tracking-widest uppercase text-text-muted sticky top-0">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Purpose</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.map((row) => (
                  <tr key={row.id} className="bg-cyber-card/30">
                    <td className="px-3 py-2 text-text-secondary whitespace-nowrap">
                      {formatBillingDate(row.createdAt) || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          row.paymentKind === 'subscription_payment'
                            ? 'text-neon-purple'
                            : 'text-neon-cyan'
                        }
                      >
                        {row.kindLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-white">
                      {row.purposeLabel || 'Studio Support'}
                    </td>
                    <td className="px-3 py-2 font-mono text-white tabular-nums">
                      {row.amountLabel}
                    </td>
                    <td className="px-3 py-2 text-text-muted capitalize">
                      {row.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
