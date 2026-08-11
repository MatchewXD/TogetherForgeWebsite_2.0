import UserAvatar from './UserAvatar';
import UserNameWithBadge from '../badges/UserNameWithBadge';

/**
 * Single row in Recent Activity feeds.
 * activity: { user, username?, userInitials?, avatarUrl?, pinnedBadgeKey?, action, target, time }
 */
const ActivityItem = ({ activity }) => {
  const name = activity.user || activity.username || 'Someone';
  const username = activity.username || activity.user || null;
  const pinned =
    activity.pinnedBadgeKey ||
    activity.pinned_badge_key ||
    null;

  return (
    <div className="flex gap-3 py-3 border-b border-cyber-border last:border-none">
      <UserAvatar
        src={activity.avatarUrl || activity.avatar_url}
        name={name}
        username={username}
        initials={activity.userInitials}
        size="md"
        className="flex-shrink-0"
        borderClass="border border-neon-cyan/30"
      />
      <div className="flex-1 text-sm min-w-0">
        <UserNameWithBadge
          username={username}
          displayName={name}
          pinnedBadgeKey={pinned}
          linkClassName="text-text-primary font-medium"
        />{' '}
        <span className="text-text-secondary">{activity.action}</span>{' '}
        <span className="text-neon-cyan font-medium">{activity.target}</span>
        <div className="text-text-muted text-xs mt-0.5 font-mono">
          {activity.time}
        </div>
      </div>
    </div>
  );
};

export default ActivityItem;
