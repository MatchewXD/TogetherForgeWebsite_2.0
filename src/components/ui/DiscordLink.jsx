/**
 * Consistent Discord entry points.
 * - link: quiet inline / footer style
 * - button: notice-able but not loud
 * - note: short contextual strip (boards, project hub)
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
