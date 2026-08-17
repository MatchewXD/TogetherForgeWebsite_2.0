/**
 * Account → Forge Marks: spendable balance + donation grant ledger.
 * Place awards from Showcase posts and ideas; this page is the Marks wallet.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Hexagon, Loader2, RefreshCw } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Buttons';
import {
  FORGE_MARK_DONATION_TIERS,
  FORGE_AWARD_TIERS,
  formatForgeMarks,
  resolveForgeAwardTier,
} from '../../utils/forgeMarks';
import { AwardTierIcon } from '../awards/awardIcons';
import ForgeMarksHoverHint from '../awards/ForgeMarksHoverHint';
import {
  fetchMyForgeMarks,
  fetchMyForgeMarkLedger,
} from '../../services/forgeMarksService';

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

const rateRows = [...FORGE_MARK_DONATION_TIERS].reverse();

export default function AccountForgeMarksSection() {
  const [status, setStatus] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [st, led] = await Promise.all([
        fetchMyForgeMarks(),
        fetchMyForgeMarkLedger(40).catch(() => []),
      ]);
      setStatus(st);
      setLedger(Array.isArray(led) ? led : []);
    } catch (e) {
      setError(e?.message || 'Could not load Forge Marks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const balance = status?.balance ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Forge Marks</h2>
          <p className="text-sm text-text-secondary mt-1 max-w-xl leading-relaxed">
            Marks come from completed donations only. They never expire, cannot
            be withdrawn as cash, and cannot be sent to another account.
            Community Awards will spend Marks from this balance.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1.5"
          onClick={() => load()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-200" role="alert">
          {error}
        </p>
      )}

      {status?.missing && (
        <Card className="p-5 border-dashed text-sm text-text-secondary leading-relaxed">
          Forge Marks are not enabled on this database yet. Apply{' '}
          <code className="text-neon-cyan">supabase/sql/supabase_forge_marks.sql</code>{' '}
          in the SQL Editor (after donations SQL).
        </Card>
      )}

      <Card className="bg-cyber-card border border-cyber-border p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-mono tracking-widest text-text-muted uppercase mb-2">
              Current balance
            </div>
            <div className="flex items-center gap-2">
              <Hexagon className="w-6 h-6 text-forge-gold" aria-hidden />
              <span className="text-3xl sm:text-4xl font-mono font-bold text-white tabular-nums">
                {loading ? '—' : formatForgeMarks(balance)}
              </span>
            </div>
            <ForgeMarksHoverHint align="start" className="mt-1">
              <span className="text-xs text-text-muted">Forge Marks</span>
            </ForgeMarksHoverHint>
          </div>
          <Link
            to="/donations"
            className="text-sm font-semibold text-neon-cyan hover:text-white"
          >
            Donate to earn Marks →
          </Link>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-center border-t border-cyber-border/80 pt-4">
          <div>
            <dt className="text-[10px] font-mono tracking-widest text-text-muted uppercase">
              Earned from donations
            </dt>
            <dd className="text-sm font-semibold text-white tabular-nums mt-1">
              {formatForgeMarks(status?.lifetimeEarned || 0)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-mono tracking-widest text-text-muted uppercase">
              Spent on awards
            </dt>
            <dd className="text-sm font-semibold text-white tabular-nums mt-1">
              {formatForgeMarks(status?.lifetimeSpent || 0)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="bg-cyber-card/80 border border-cyber-border p-5 sm:p-6 space-y-3">
        <h3 className="text-sm font-semibold text-white">Donation rate</h3>
        <p className="text-xs text-text-muted leading-relaxed">
          Base rate is $1 = 100 Marks. Larger completed gifts use one published
          rate for the whole amount — no hidden multipliers.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-mono tracking-widest uppercase text-text-muted">
                <th className="py-1.5 pr-3">Gift size</th>
                <th className="py-1.5">Marks per $1</th>
              </tr>
            </thead>
            <tbody>
              {rateRows.map((tier) => (
                <tr key={tier.minCents} className="border-t border-cyber-border/70">
                  <td className="py-1.5 pr-3 text-text-secondary">{tier.minLabel}</td>
                  <td className="py-1.5 text-white tabular-nums">
                    {tier.marksPerDollar}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="bg-cyber-card/80 border border-cyber-border p-5 sm:p-6 space-y-3">
        <h3 className="text-sm font-semibold text-white">Community Awards</h3>
        <p className="text-xs text-text-muted leading-relaxed">
          Place these on Showcase posts and ideas. Anvil and Masterwork may
          include a short message. Awards are permanent.
        </p>
        <ul className="space-y-2 list-none p-0 m-0">
          {FORGE_AWARD_TIERS.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="inline-flex items-center gap-2 text-white">
                <AwardTierIcon
                  tierId={t.id}
                  className={t.id === 'masterwork' ? 'w-10 h-10' : 'w-5 h-5'}
                  alt=""
                />
                {t.name}
              </span>
              <span className="text-text-muted tabular-nums">
                {formatForgeMarks(t.marksCost)} Marks
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <section>
        <h3 className="text-sm font-semibold text-white mb-3">History</h3>
        {loading ? (
          <p className="text-xs font-mono tracking-widest text-text-muted">
            Loading…
          </p>
        ) : ledger.length === 0 ? (
          <Card className="p-5 border-dashed text-sm text-text-secondary">
            No Marks yet. Completed donations on a signed-in account appear
            here.
          </Card>
        ) : (
          <ul className="space-y-2 list-none p-0 m-0">
            {ledger.map((row) => {
              const credit = (row.marksDelta || 0) >= 0;
              const awardTier =
                row.entryType === 'award_spend'
                  ? resolveForgeAwardTier(row.note)
                  : null;
              return (
                <li key={row.id}>
                  <Card className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm text-white inline-flex items-center gap-2">
                        {awardTier && (
                          <AwardTierIcon
                            tierId={awardTier.id}
                            className={
                              awardTier.id === 'masterwork'
                                ? 'w-8 h-8'
                                : 'w-4 h-4'
                            }
                            alt=""
                          />
                        )}
                        {awardTier ? awardTier.name : row.label}
                      </div>
                      {row.note && (
                        <div className="text-xs text-text-muted truncate">
                          {row.note}
                        </div>
                      )}
                      <div className="text-[11px] font-mono text-text-muted mt-0.5">
                        {formatWhen(row.createdAt)}
                      </div>
                    </div>
                    <div
                      className={`text-sm font-mono tabular-nums ${
                        credit ? 'text-neon-cyan' : 'text-text-secondary'
                      }`}
                    >
                      {credit ? '+' : '−'}
                      {formatForgeMarks(row.marks)}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
