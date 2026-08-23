/**
 * Shown when live Stripe Checkout is paused (ENABLE_DONATIONS / VITE_ENABLE_DONATIONS).
 * Pages keep totals, history, and transparency; only new charges are blocked.
 */
import { Clock } from 'lucide-react';
import Card from '../ui/Card';

const COPY = {
  studio: {
    title: 'Support checkout is coming soon',
    body: 'Full Support checkout will return once banking is ready. Past contributions, donor badges, and Forge Marks stay in place. If you already have a monthly plan, you can manage or cancel it under Account → My Plan.',
  },
  runway: {
    title: 'Runway checkout is coming soon',
    body: 'Full Runway support will return once banking is ready. Past runway contributions stay visible here.',
  },
  tokens: {
    title: 'Token purchases are coming soon',
    body: 'AI token pack checkout will return once banking is ready. Your existing balance is unchanged.',
  },
};

/**
 * @param {{ variant?: 'studio'|'runway'|'tokens', className?: string }} props
 */
export default function PaymentsComingSoon({
  variant = 'studio',
  className = '',
}) {
  const copy = COPY[variant] || COPY.studio;
  return (
    <Card
      className={`bg-cyber-card/80 border-forge-gold/35 ${className}`}
      role="status"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-forge-gold/40 bg-forge-gold/10">
          <Clock className="w-5 h-5 text-forge-gold" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-mono tracking-widest uppercase text-forge-gold mb-1">
            Coming Soon
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
            {copy.title}
          </h2>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed mb-3">
            Payment processing is temporarily unavailable while we finish
            Together Forge LLC registration and business banking. This pause is
            only temporary.
          </p>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
            {copy.body}
          </p>
        </div>
      </div>
    </Card>
  );
}
