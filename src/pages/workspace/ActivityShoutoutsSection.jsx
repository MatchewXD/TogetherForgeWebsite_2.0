/**
 * Project workspace: recent activity and shoutouts panels.
 * Presentational: all state and handlers live in ProjectWorkspace and arrive as props.
 */

import Card from '../../components/ui/Card';
import ActivityItem from '../../components/ui/ActivityItem';
import UserAvatar from '../../components/ui/UserAvatar';
import UserNameWithBadge from '../../components/badges/UserNameWithBadge';
import Badge from '../../components/ui/Badge';

export default function ActivityShoutoutsSection({
  activity,
  shoutouts,
}) {
  return (
    <div className="grid lg:grid-cols-5 gap-6 lg:items-stretch">
      <section
        aria-labelledby="activity-heading"
        className="lg:col-span-3 flex flex-col min-h-0"
      >
        <h2 id="activity-heading" className="section-header mb-4 shrink-0">
          Recent Activity
        </h2>
        <Card className="bg-cyber-card/80 !p-0 flex-1 min-h-0 max-h-[min(28rem,50vh)] flex flex-col overflow-hidden">
          <div className="task-scroll overflow-y-auto flex-1 min-h-0 px-5 py-2">
            {activity.length === 0 ? (
              <p className="text-sm text-text-muted py-6 text-center">
                No activity yet - claim a task to light up the feed.
              </p>
            ) : (
              activity.map((item) => (
                <ActivityItem key={item.id} activity={item} />
              ))
            )}
          </div>
        </Card>
      </section>

      <section
        aria-labelledby="shoutouts-heading"
        className="lg:col-span-2 flex flex-col min-h-0"
      >
        <h2 id="shoutouts-heading" className="section-header mb-4 shrink-0">
          Shoutouts
        </h2>
        <div className="task-scroll overflow-y-auto flex-1 min-h-0 max-h-[min(28rem,50vh)] space-y-3 pr-0.5">
          {shoutouts.length === 0 ? (
            <Card className="bg-cyber-card/80 border-semantic-achievement/25">
              <p className="text-sm text-text-secondary">
                Complete a task or support this project to earn a shoutout
                here. The forge celebrates shippers and supporters.
              </p>
            </Card>
          ) : (
            shoutouts.map((person) => (
              <Card
                key={person.id}
                className={
                  person.kind === 'donation'
                    ? 'bg-cyber-card/80 border-neon-magenta/30'
                    : 'bg-cyber-card/80 border-semantic-achievement/30'
                }
              >
                <div className="flex items-start gap-3">
                  <UserAvatar
                    src={person.avatarUrl || person.avatar_url}
                    name={person.name}
                    username={person.username}
                    initials={person.initials}
                    size="lg"
                    className="shrink-0 mt-0.5"
                    borderClass={
                      person.kind === 'donation'
                        ? 'border border-neon-magenta/50'
                        : 'border border-semantic-achievement/50'
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {person.username ? (
                        <UserNameWithBadge
                          username={person.username}
                          displayName={person.name}
                          pinnedBadgeKey={
                            person.pinnedBadgeKey ||
                            person.pinned_badge_key ||
                            null
                          }
                          linkClassName={
                            person.kind === 'donation'
                              ? 'font-medium text-neon-magenta'
                              : 'font-medium text-semantic-achievement'
                          }
                        />
                      ) : (
                        <span
                          className={
                            person.kind === 'donation'
                              ? 'font-medium text-neon-magenta'
                              : 'font-medium text-semantic-achievement'
                          }
                        >
                          {person.name}
                        </span>
                      )}
                      {person.role ? (
                        <Badge
                          variant={
                            person.kind === 'donation' ? 'purple' : 'gold'
                          }
                        >
                          {person.role}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {person.note}
                    </p>
                    {person.time && (
                      <p className="text-xs font-mono text-text-muted mt-1">
                        {person.time}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
