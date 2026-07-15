import { useEffect, useMemo, useState } from 'react';
import defaultAvatar from '../../assets/default-avatar.svg';
import {
  accentFromName,
  initialsFromName,
  resolveAvatarUrl,
} from '../../utils/avatarUtils';

/**
 * Circular user avatar with fixed fallback priority:
 * 1. profile avatar_url (if present and loads)
 * 2. default avatar image
 * 3. colored initials circle
 *
 * @param {string|null} [src] - Primary image URL (avatar_url)
 * @param {string} [name] - Display name for alt text + initials
 * @param {string} [initials] - Optional precomputed initials
 * @param {'xs'|'sm'|'md'|'lg'|'xl'} [size]
 * @param {string} [className] - Extra classes on the outer element
 * @param {string} [alt]
 */
const SIZE_CLASSES = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-xs',
  xl: 'w-28 h-28 text-2xl',
};

const UserAvatar = ({
  src = null,
  name = '',
  initials,
  size = 'md',
  className = '',
  alt,
  borderClass = 'border border-neon-cyan/40',
}) => {
  const primaryUrl = useMemo(() => resolveAvatarUrl(src), [src]);
  const label = name || 'User';
  const letters = (initials || initialsFromName(name)).slice(0, 2);
  const accent = accentFromName(name || letters);
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  // 'primary' | 'default' | 'initials'
  const [stage, setStage] = useState(() => (primaryUrl ? 'primary' : 'default'));

  useEffect(() => {
    setStage(primaryUrl ? 'primary' : 'default');
  }, [primaryUrl]);

  const shell = `rounded-full shrink-0 overflow-hidden ${sizeClass} ${className}`;

  if (stage === 'primary' && primaryUrl) {
    return (
      <img
        src={primaryUrl}
        alt={alt ?? label}
        className={`${shell} object-cover ${borderClass} bg-cyber-surface`}
        onError={() => setStage('default')}
        loading="lazy"
        decoding="async"
      />
    );
  }

  if (stage === 'default') {
    return (
      <img
        src={defaultAvatar}
        alt={alt ?? label}
        className={`${shell} object-cover ${borderClass} bg-cyber-surface`}
        onError={() => setStage('initials')}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={alt ?? label}
      className={`${shell} ${borderClass} bg-cyber-surface flex items-center justify-center font-mono ${accent}`}
      title={label}
    >
      {letters}
    </div>
  );
};

export default UserAvatar;
