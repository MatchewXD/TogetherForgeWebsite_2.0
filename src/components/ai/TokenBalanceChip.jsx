/**
 * Compact balance display for future AI surfaces (ideas, tools, etc.).
 */
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { formatTokenCount } from '../../constants/aiTokens';

/**
 * @param {{
 *   balance: number|null|undefined,
 *   loading?: boolean,
 *   className?: string,
 *   showBuyLink?: boolean,
 * }} props
 */
export default function TokenBalanceChip({
  balance,
  loading = false,
  className = '',
  showBuyLink = true,
}) {
  const n = balance == null ? null : Math.max(0, Number(balance) || 0);

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border border-cyber-border bg-cyber-surface/80 px-2.5 py-1.5 text-sm ${className}`}
    >
      <Sparkles className="w-3.5 h-3.5 text-neon-purple shrink-0" aria-hidden />
      <span className="font-mono text-xs tracking-widest text-text-muted uppercase">
        Tokens
      </span>
      <span className="font-semibold text-white tabular-nums">
        {loading ? '…' : n == null ? '—' : formatTokenCount(n)}
      </span>
      {showBuyLink ? (
        <Link
          to="/account/ai-tokens"
          className="text-[11px] font-mono tracking-widest text-neon-cyan hover:underline ml-0.5"
        >
          GET MORE
        </Link>
      ) : null}
    </div>
  );
}
