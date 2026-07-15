import UserAvatar from './UserAvatar';

/**
 * Single row in Recent Activity feeds.
 * activity: { user, userInitials?, avatarUrl?, action, target, time }
 */
const ActivityItem = ({ activity }) => {
  const name = activity.user || 'Someone';

  return (
    <div className="flex gap-3 py-3 border-b border-cyber-border last:border-none">
      <UserAvatar
        src={activity.avatarUrl || activity.avatar_url}
        name={name}
        initials={activity.userInitials}
        size="md"
        className="flex-shrink-0"
        borderClass="border border-neon-cyan/30"
      />
      <div className="flex-1 text-sm min-w-0">
        <span className="text-text-primary">{name}</span>{' '}
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
