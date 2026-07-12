const ActivityItem = ({ activity }) => {
    return (
        <div className="flex gap-3 py-3 border-b border-cyber-border last:border-none">
            <div className="w-8 h-8 rounded-full bg-cyber-surface flex-shrink-0 border border-neon-cyan/30 flex items-center justify-center text-neon-cyan text-xs">
                {activity.userInitials || '👤'}
            </div>
            <div className="flex-1 text-sm">
                <span className="text-text-primary">{activity.user}</span>{' '}
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