/**
 * Account → AI Tokens: balance, pack purchase, user-safe history.
 * Strictly separate from Donate / My Plan donation records.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Loader2,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Buttons';
import {
  AI_TOKEN_PACKS,
  AI_TOKENS_PER_USD,
  formatPackPrice,
  formatTokenCount,
  ledgerEntryLabel,
  ledgerTokensLine,
} from '../../constants/aiTokens';
import {
  fetchAiTokenStatus,
  fetchMyTokenLedger,
  fetchMyTokenPurchases,
  startTokenPackCheckout,
  syncTokenCheckoutSession,
} from '../../services/aiTokensService';
import TokenBalanceChip from '../ai/TokenBalanceChip';

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return String(iso);
  }
}

export default function AccountAiTokensSection() {
  const [status, setStatus] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyPack, setBusyPack] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Recover tokens after Stripe return
      try {
        const params = new URLSearchParams(window.location.search);
        const sid =
          params.get('session_id') ||
          params.get('sessionId') ||
          sessionStorage.getItem('tf_last_token_checkout_session') ||
          '';
        const flag = params.get('tokens');
        if (sid.startsWith('cs_')) {
          sessionStorage.removeItem('tf_last_token_checkout_session');
          const sync = await syncTokenCheckoutSession(sid);
          if (sync.ok && sync.kind === 'ai_tokens') {
            setMessage(
              sync.duplicate
                ? 'Token pack already applied to your balance.'
                : `Added ${formatTokenCount(sync.tokens || 0)} tokens to your balance.`
            );
          } else if (sync.ok) {
            setMessage('Checkout synced.');
          } else if (flag === 'success') {
            setMessage(
              'Payment received. Tokens will appear shortly if not already credited.'
            );
          }
          // Clean query noise
          if (params.has('session_id') || params.has('tokens')) {
            const url = new URL(window.location.href);
            url.searchParams.delete('session_id');
            url.searchParams.delete('sessionId');
            url.searchParams.delete('tokens');
            window.history.replaceState({}, '', url.pathname + url.search);
          }
        } else if (flag === 'cancelled') {
          setMessage('Checkout cancelled — no tokens were charged.');
          const url = new URL(window.location.href);
          url.searchParams.delete('tokens');
          window.history.replaceState({}, '', url.pathname + url.search);
        }
      } catch {
        /* optional */
      }

      const [st, led, purch] = await Promise.all([
        fetchAiTokenStatus(),
        fetchMyTokenLedger(40).catch(() => []),
        fetchMyTokenPurchases(15).catch(() => []),
      ]);
      setStatus(st);
      setLedger(led);
      setPurchases(purch);
    } catch (e) {
      setError(e?.message || 'Could not load AI tokens.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onBuy = async (packId) => {
    setBusyPack(packId);
    setError('');
    setMessage('');
    try {
      const result = await startTokenPackCheckout({ packId });
      if (!result.ok) {
        setError(result.error || 'Checkout failed.');
        return;
      }
      window.location.assign(result.url);
    } catch (e) {
      setError(e?.message || 'Checkout failed.');
    } finally {
      setBusyPack(null);
    }
  };

  const balance = status?.balance;
  // Always render packs from client constants (50k tokens per $1).
  // Do not let a stale ai-token-status Edge Function overwrite token counts
  // (that caused "250 tokens" headlines next to "250,000" perks).
  const packs = AI_TOKEN_PACKS;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-neon-purple" aria-hidden />
            AI Tokens
          </h2>
          <p className="text-sm text-text-secondary mt-1 max-w-xl leading-relaxed">
            Tokens power upcoming AI tools (Idea Structuring, Gap Filling, and
            more). Purchases and balances are completely separate from studio
            donations.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="gap-2 self-start"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Refresh
        </Button>
      </div>

      {message ? (
        <p
          className="text-sm text-emerald-300 flex items-start gap-2"
          role="status"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{message}</span>
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <Card className="bg-cyber-card border border-cyber-border p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono tracking-widest text-text-muted uppercase mb-2">
              Current balance
            </div>
            <TokenBalanceChip
              balance={balance}
              loading={loading}
              showBuyLink={false}
            />
          </div>
          {status?.platformEnabled === false ? (
            <div className="flex items-start gap-2 max-w-sm text-sm text-amber-200/90">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {status.disabledMessage ||
                  'AI services are temporarily unavailable due to usage limits. Please try again later.'}
              </span>
            </div>
          ) : (
            <p className="text-xs text-text-muted max-w-xs leading-relaxed">
              Tokens used by AI tools appear in your history after each run.
              Pack scale: {AI_TOKENS_PER_USD.toLocaleString()} tokens per $1.
              Raw API costs are never shown.
            </p>
          )}
        </div>
        {status?.lifetime ? (
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center border-t border-cyber-border/80 pt-4">
            <div>
              <dt className="text-[10px] font-mono tracking-widest text-text-muted uppercase">
                Purchased
              </dt>
              <dd className="text-sm font-semibold text-white tabular-nums mt-1">
                {formatTokenCount(status.lifetime.purchased)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-mono tracking-widest text-text-muted uppercase">
                Used
              </dt>
              <dd className="text-sm font-semibold text-white tabular-nums mt-1">
                {formatTokenCount(status.lifetime.spent)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-mono tracking-widest text-text-muted uppercase">
                Awarded
              </dt>
              <dd className="text-sm font-semibold text-white tabular-nums mt-1">
                {formatTokenCount(status.lifetime.awarded)}
              </dd>
            </div>
          </dl>
        ) : null}
      </Card>

      <section aria-labelledby="token-packs-heading">
        <div className="mb-4">
          <div className="section-header mb-1">Packs</div>
          <h3 id="token-packs-heading" className="text-lg font-semibold text-white">
            Buy AI tokens
          </h3>
          <p className="text-sm text-text-secondary mt-1">
            One-time packs via Stripe. Not a donation — no public donor credit.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {packs.map((pack) => (
            <Card
              key={pack.id}
              className={`bg-cyber-card/90 border h-full flex flex-col p-5 ${
                pack.featured
                  ? 'border-neon-purple/50 shadow-[0_0_24px_rgba(168,85,247,0.12)]'
                  : 'border-cyber-border'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="text-base font-bold text-white">{pack.label}</h4>
                {pack.featured ? (
                  <Badge variant="purple">Popular</Badge>
                ) : null}
              </div>
              <div className="text-2xl font-bold text-neon-cyan tabular-nums">
                {formatPackPrice(pack.priceCents)}
              </div>
              <div className="text-sm text-white mt-1 font-semibold">
                {formatTokenCount(pack.tokens)} tokens
              </div>
              <p className="text-xs text-text-secondary mt-2 leading-relaxed flex-1">
                {pack.blurb}
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-text-secondary">
                {(pack.perks || []).map((perk) => (
                  <li key={perk} className="flex gap-2">
                    <span className="text-neon-cyan shrink-0">·</span>
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                className="mt-4 w-full gap-2"
                disabled={Boolean(busyPack) || loading}
                onClick={() => void onBuy(pack.id)}
              >
                {busyPack === pack.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                Buy {pack.label}
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </Button>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="token-history-heading">
        <div className="mb-3">
          <div className="section-header mb-1">History</div>
          <h3
            id="token-history-heading"
            className="text-lg font-semibold text-white"
          >
            Recent activity
          </h3>
          <p className="text-xs text-text-muted mt-1">
            Exact tokens used appear here after each run (base and any additional
            usage). API costs and margins are never shown.
          </p>
        </div>
        <Card className="bg-cyber-card border border-cyber-border overflow-hidden">
          {loading ? (
            <div className="p-6 flex items-center gap-2 text-text-muted text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading history…
            </div>
          ) : ledger.length === 0 ? (
            <p className="p-6 text-sm text-text-secondary">
              No token activity yet. Buy a pack to get started when AI tools go
              live.
            </p>
          ) : (
            <ul className="divide-y divide-cyber-border/80">
              {ledger.map((row) => (
                <li
                  key={row.id}
                  className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="text-white font-medium truncate">
                      {ledgerEntryLabel(row)}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {formatWhen(row.created_at)}
                      {row.status && row.status !== 'success'
                        ? ` · ${row.status}`
                        : ''}
                    </div>
                  </div>
                  <div
                    className={`font-mono text-sm tabular-nums shrink-0 ${
                      row.entry_type === 'spend'
                        ? 'text-text-secondary'
                        : 'text-emerald-300'
                    }`}
                  >
                    {ledgerTokensLine(row)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {purchases.length > 0 ? (
        <section aria-labelledby="token-purchases-heading">
          <h3
            id="token-purchases-heading"
            className="text-sm font-mono tracking-widest text-text-muted uppercase mb-2"
          >
            Pack purchases
          </h3>
          <ul className="space-y-2">
            {purchases.map((p) => (
              <li
                key={p.id}
                className="text-xs text-text-secondary flex flex-wrap gap-x-3 gap-y-1"
              >
                <span className="text-white">{p.label || p.pack_id}</span>
                <span>{formatTokenCount(p.tokens_granted)} tokens</span>
                <span>{formatPackPrice(p.amount_cents)}</span>
                <span className="capitalize">{p.status}</span>
                <span>{formatWhen(p.completed_at || p.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-text-muted leading-relaxed">
        Looking to support the studio instead?{' '}
        <Link to="/donate" className="text-neon-cyan hover:underline">
          Donate
        </Link>{' '}
        is a separate system from AI tokens.
      </p>
    </div>
  );
}
