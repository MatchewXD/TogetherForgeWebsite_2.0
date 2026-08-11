/**
 * Username link + optional single pinned badge (site-wide flair).
 */
import ProfileLink from '../ui/ProfileLink';
import BadgeIcon from './BadgeIcon';

/**
 * @param {{
 *   username?: string|null,
 *   displayName?: string|null,
 *   pinnedBadgeKey?: string|null,
 *   className?: string,
 *   linkClassName?: string,
 *   stopPropagation?: boolean,
 * }} props
 */
export default function UserNameWithBadge({
  username = null,
  displayName = null,
  pinnedBadgeKey = null,
  className = '',
  linkClassName = '',
  stopPropagation = true,
}) {
  const name = displayName || username || 'Member';

  return (
    <span
      className={`inline-flex items-center gap-1.5 min-w-0 max-w-full ${className}`}
    >
      <ProfileLink
        username={username}
        className={`truncate ${linkClassName}`}
        stopPropagation={stopPropagation}
      >
        {name}
      </ProfileLink>
      {pinnedBadgeKey ? (
        <BadgeIcon badgeKey={pinnedBadgeKey} size="sm" />
      ) : null}
    </span>
  );
}
