import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import defaultAvatar from '../../assets/default-avatar.svg';
import {
  accentFromName,
  initialsFromName,
  resolveAvatarUrl,
} from '../../utils/avatarUtils';
import { publicProfilePath } from '../../utils/profileLinks';

/**
 * Circular user avatar with fixed fallback priority:
 * 1. profile avatar_url (if present and loads)
 * 2. default avatar image
 * 3. colored initials circle
 *
 * Pass `username` (or `to`) to make the avatar a link to the public profile.
 * Clicks stop propagation so cards/lists do not open parent targets.
 *
 * @param {string|null} [src] - Primary image URL (avatar_url)
 * @param {string} [name] - Display name for alt text + initials
 * @param {string} [username] - Real username for /u/:username link
 * @param {string|null} [to] - Override link path
 * @param {boolean} [linkProfile=true] - When username is set, wrap in Link
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
  username = null,
  to = null,
  linkProfile = true,
  initials,
  size = 'md',
  className = '',
  alt,
  borderClass = 'border border-neon-cyan/40',
  stopPropagation = true,
}) => {
  const primaryUrl = useMemo(() => resolveAvatarUrl(src), [src]);
  const label = name || username || 'User';
  const letters = (initials || initialsFromName(name || username || '')).slice(
    0,
    2
  );
  const accent = accentFromName(name || username || letters);
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  // 'primary' | 'default' | 'initials'
  const [stage, setStage] = useState(() => (primaryUrl ? 'primary' : 'default'));

  useEffect(() => {
    setStage(primaryUrl ? 'primary' : 'default');
  }, [primaryUrl]);

  const shell = `rounded-full shrink-0 overflow-hidden ${sizeClass} ${className}`;

  let avatarNode;
  if (stage === 'primary' && primaryUrl) {
    avatarNode = (
      <img
        src={primaryUrl}
        alt={alt ?? label}
        className={`${shell} object-cover ${borderClass} bg-cyber-surface`}
        onError={() => setStage('default')}
        loading="lazy"
        decoding="async"
      />
    );
  } else if (stage === 'default') {
    avatarNode = (
      <img
        src={defaultAvatar}
        alt={alt ?? label}
        className={`${shell} object-cover ${borderClass} bg-cyber-surface`}
        onError={() => setStage('initials')}
        loading="lazy"
        decoding="async"
      />
    );
  } else {
    avatarNode = (
      <div
        role="img"
        aria-label={alt ?? label}
        className={`${shell} ${borderClass} bg-cyber-surface flex items-center justify-center font-mono ${accent}`}
        title={label}
      >
        {letters}
      </div>
    );
  }

  // Only link when an explicit public username (or `to`) is provided.
  // Do not infer from display name (emails, "You", etc. must not open PublicProfile).
  const href = to || (linkProfile && username ? publicProfilePath(username) : null);

  if (!href) return avatarNode;

  return (
    <Link
      to={href}
      title={`View ${label}'s profile`}
      className="inline-flex rounded-full shrink-0 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg transition-opacity"
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
      }}
    >
      {avatarNode}
    </Link>
  );
};

export default UserAvatar;
