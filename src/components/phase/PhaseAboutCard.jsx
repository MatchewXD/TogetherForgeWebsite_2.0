/**
 * Eye-catching “About this phase” block for Early / Mid / Late hubs.
 * Designed to stand out from quieter sidebar cards (How to Help, etc.).
 */

import { Compass } from 'lucide-react';
import Card from '../ui/Card';

const ACCENTS = {
  early: {
    frame: 'cyber-card-gold',
    iconWrap: 'border-forge-gold/40 bg-forge-gold/10 text-forge-gold',
    kicker: 'text-forge-gold',
    bar: 'from-forge-gold via-neon-cyan to-transparent',
    glow: 'shadow-[0_0_40px_rgba(212,175,55,0.08)]',
  },
  mid: {
    frame: 'cyber-card-purple',
    iconWrap: 'border-neon-purple/40 bg-neon-purple/10 text-neon-purple',
    kicker: 'text-neon-purple',
    bar: 'from-neon-purple via-neon-cyan to-transparent',
    glow: 'shadow-[0_0_40px_rgba(168,85,247,0.1)]',
  },
  late: {
    frame: 'cyber-card-gold',
    iconWrap: 'border-forge-gold/50 bg-forge-gold/15 text-forge-gold',
    kicker: 'text-forge-gold',
    bar: 'from-forge-gold via-neon-magenta to-transparent',
    glow: 'shadow-[0_0_40px_rgba(212,175,55,0.1)]',
  },
};

/**
 * @param {'early'|'mid'|'late'} [phase]
 * @param {string} title - e.g. "About Mid Game"
 * @param {string[]} paragraphs
 * @param {string} [headingId]
 */
const PhaseAboutCard = ({
  phase = 'early',
  title,
  paragraphs = [],
  headingId = 'about-phase-heading',
}) => {
  const a = ACCENTS[phase] || ACCENTS.early;
  const paras = Array.isArray(paragraphs) ? paragraphs.filter(Boolean) : [];

  return (
    <section aria-labelledby={headingId}>
      <Card
        className={`${a.frame} ${a.glow} bg-cyber-card/95 border-cyber-border p-0 overflow-hidden`}
      >
        {/* Top accent bar */}
        <div
          className={`h-1 w-full bg-gradient-to-r ${a.bar}`}
          aria-hidden="true"
        />

        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div
              className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center ${a.iconWrap}`}
              aria-hidden="true"
            >
              <Compass className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p
                className={`text-[10px] font-mono tracking-[0.22em] uppercase mb-1 ${a.kicker}`}
              >
                Why this phase
              </p>
              <h2
                id={headingId}
                className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-snug"
              >
                {title}
              </h2>
            </div>
          </div>

          <div className="space-y-4 text-sm sm:text-base leading-relaxed">
            {paras.map((p, i) => (
              <p
                key={p.slice(0, 48)}
                className={
                  i === 0
                    ? 'text-white font-medium'
                    : 'text-text-secondary'
                }
              >
                {p}
              </p>
            ))}
          </div>
        </div>
      </Card>
    </section>
  );
};

export default PhaseAboutCard;
