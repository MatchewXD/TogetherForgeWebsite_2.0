/**
 * Official X (Twitter) account link.
 * Uses the X mark, not the old bird.
 */

import { X_URL, X_LABELS } from '../../constants/communityLinks';

export function XLogo({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      fill="currentColor"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.743l7.724-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

const XLink = ({
  variant = 'link',
  labelKey = 'follow',
  label = null,
  className = '',
}) => {
  const text = label || X_LABELS[labelKey] || X_LABELS.follow;

  if (variant === 'button') {
    return (
      <a
        href={X_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2 rounded-lg border border-cyber-border bg-cyber-surface/60 px-4 py-2 text-sm font-medium text-text-secondary hover:text-neon-cyan hover:border-neon-cyan/50 transition-colors ${className}`}
      >
        <XLogo className="w-4 h-4" />
        {text}
      </a>
    );
  }

  if (variant === 'icon') {
    return (
      <a
        href={X_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center text-text-muted hover:text-neon-cyan transition-colors ${className}`}
        aria-label="Together Forge on X"
      >
        <XLogo className="w-4 h-4" />
      </a>
    );
  }

  return (
    <a
      href={X_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-text-secondary hover:text-neon-cyan transition-colors ${className}`}
    >
      <XLogo className="w-3.5 h-3.5 opacity-80" />
      {text}
    </a>
  );
};

export default XLink;
