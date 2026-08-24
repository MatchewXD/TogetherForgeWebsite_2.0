/**
 * Shown when live Stripe Checkout is paused (ENABLE_DONATIONS / VITE_ENABLE_DONATIONS).
 */
import { Clock } from 'lucide-react';
import Card from '../ui/Card';

/**
 * @param {{ variant?: string, className?: string }} props
 */
export default function PaymentsComingSoon({ className = '' }) {
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
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
            Support and Runway are temporarily unavailable.
          </p>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed mt-1">
            They will be back shortly.
          </p>
        </div>
      </div>
    </Card>
  );
}
