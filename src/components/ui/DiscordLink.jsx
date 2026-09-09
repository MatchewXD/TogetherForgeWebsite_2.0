/**
 * Consistent Discord entry points.
 * - link: quiet inline / footer style
 * - button: notice-able but not loud
 * - note: short contextual strip (project hub)
 * - card: full clickable panel (task board)
 */

import { MessageCircle } from 'lucide-react';
import {
  DISCORD_URL,
  DISCORD_LABELS,
} from '../../constants/communityLinks';

const DiscordLink = ({
  variant = 'link',
  /** join | chat | short — or pass label to override */
  labelKey = 'join',
  label = null,
  className = '',
  /** Extra line under the link for contextual variants */
  note = null,
}) => {
  const text = label || DISCORD_LABELS[labelKey] || DISCORD_LABELS.join;

  if (variant === 'card') {
    return (
      <a
        href={DISCORD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex flex-col gap-3 rounded-xl border border-cyber-border bg-cyber-surface/50 px-4 py-4 sm:px-5 sm:py-5 h-full hover:border-neon-cyan/50 hover:bg-cyber-surface/80 transition-colors ${className}`}
      >
        <h2 className="text-sm font-mono tracking-widest text-neon-cyan uppercase flex items-center gap-2">
          <MessageCircle className="w-4 h-4 shrink-0" aria-hidden />
          Discord
        </h2>
        {note ? (
          <p className="text-sm text-text-secondary leading-relaxed flex-1">
            {note}
          </p>
        ) : (
          <div className="flex-1" />
        )}
        <span className="inline-flex items-center justify-center gap-2 w-full rounded-lg border border-neon-cyan bg-neon-cyan text-cyber-bg font-semibold px-5 py-2.5 text-base shadow-neon-cyan">
          <MessageCircle className="w-4 h-4 shrink-0" aria-hidden />
          {text}
        </span>
      </a>
    );
  }

  if (variant === 'note') {
    return (
      <div
        className={`rounded-lg border border-cyber-border/80 bg-cyber-surface/50 px-3 py-2.5 text-sm text-text-secondary ${className}`}
      >
        {note ? (
          <p className="text-text-secondary leading-snug mb-1.5">{note}</p>
        ) : null}
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-medium text-neon-cyan hover:text-white transition-colors"
        >
          <MessageCircle className="w-4 h-4 shrink-0" aria-hidden />
          {text}
        </a>
      </div>
    );
  }

  if (variant === 'button') {
    return (
      <a
        href={DISCORD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-4 py-2 text-sm font-medium text-neon-cyan hover:bg-neon-cyan/15 hover:border-neon-cyan/60 transition-colors ${className}`}
      >
        <MessageCircle className="w-4 h-4 shrink-0" aria-hidden />
        {text}
      </a>
    );
  }

  // Quiet link (footer / medium priority)
  return (
    <a
      href={DISCORD_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-text-secondary hover:text-neon-cyan transition-colors ${className}`}
    >
      <MessageCircle className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden />
      {text}
    </a>
  );
};

export default DiscordLink;
