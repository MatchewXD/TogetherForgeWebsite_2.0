/**
 * Moderator Dashboard: Member list with moderation status controls.
 * Presentational: all state and handlers live in ModeratorDashboard and arrive as props.
 */

import Button from '../../components/ui/Buttons';
import Card from '../../components/ui/Card';
import {
  Search,
  ExternalLink,
  CheckCircle2,
  PauseCircle,
  Ban,
} from 'lucide-react';
import moderationService, { MODERATION_STATUSES, roleLabel } from '../../services/moderationService';
import UserAvatar from '../../components/ui/UserAvatar';
import Badge from '../../components/ui/Badge';
import { Link } from 'react-router-dom';
import { filterLabel, filterControl, formatDate } from './shared';

export default function UsersTab({
  busyKey,
  filteredUsers,
  loading,
  runAction,
  setConfirmDialog,
  setUserRoleFilter,
  setUserSearch,
  setUserSort,
  setUserStatusFilter,
  userRoleFilter,
  userRoles,
  users,
  userSearch,
  userSort,
  userStatusFilter,
}) {
  return (
    <section aria-labelledby="users-heading">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
        <div>
          <h2
            id="users-heading"
            className="text-xl sm:text-2xl font-bold text-white tracking-tight"
          >
            All Users
          </h2>
          <p className="text-xs font-mono text-text-muted mt-1">
            Showing {filteredUsers.length}
            {filteredUsers.length !== users.length
              ? ` of ${users.length}`
              : ''}
          </p>
        </div>
        {(userSearch ||
          userRoleFilter !== 'all' ||
          userStatusFilter !== 'all' ||
          userSort !== 'newest') && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setUserSearch('');
              setUserRoleFilter('all');
              setUserStatusFilter('all');
              setUserSort('newest');
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <Card className="bg-cyber-card/80 mb-4 p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className={filterLabel} htmlFor="mod-user-search">
              Search
            </label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
                aria-hidden
              />
              <input
                id="mod-user-search"
                type="search"
                className={`${filterControl} pl-9`}
                placeholder="Username, email, id…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={filterLabel} htmlFor="mod-user-role">
              Role
            </label>
            <select
              id="mod-user-role"
              className={filterControl}
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
            >
              <option value="all">All roles</option>
              {userRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={filterLabel} htmlFor="mod-user-status">
              Status
            </label>
            <select
              id="mod-user-status"
              className={filterControl}
              value={userStatusFilter}
              onChange={(e) => setUserStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              {MODERATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={filterLabel} htmlFor="mod-user-sort">
              Sort
            </label>
            <select
              id="mod-user-sort"
              className={filterControl}
              value={userSort}
              onChange={(e) => setUserSort(e.target.value)}
            >
              <option value="newest">Newest joined</option>
              <option value="oldest">Oldest joined</option>
              <option value="name_az">Name A–Z</option>
              <option value="name_za">Name Z–A</option>
              <option value="role">Role</option>
            </select>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {users.length === 0 && !loading && (
          <Card className="bg-cyber-card/80 text-sm text-text-muted">
            No profiles found (or staff read policy not applied yet).
          </Card>
        )}
        {users.length > 0 && filteredUsers.length === 0 && !loading && (
          <Card className="bg-cyber-card/80 text-sm text-text-muted">
            No users match these filters.
          </Card>
        )}
        {filteredUsers.map((u) => {
          const status = u.moderation_status || 'active';
          const busy = busyKey === `user-${u.id}`;
          return (
            <Card
              key={u.id}
              className="bg-cyber-card/80 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <UserAvatar
                  src={u.avatar_url}
                  name={u.username || 'User'}
                  size="lg"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white truncate">
                      {u.username || 'Unnamed'}
                    </span>
                    <Badge variant="default">
                      {roleLabel(u.role || 'user')}
                    </Badge>
                    {status !== 'active' && (
                      <Badge
                        variant={
                          status === 'banned' ? 'purple' : 'default'
                        }
                      >
                        {status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs font-mono text-text-muted mt-1 truncate">
                    {u.id?.slice(0, 8)}… · joined{' '}
                    {formatDate(u.joined_at || u.created_at)}
                  </p>
                  {u.moderation_note && (
                    <p className="text-xs text-text-secondary mt-1">
                      Note: {u.moderation_note}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {u.username && (
                  <Link
                    to={`/u/${u.username}`}
                    className="inline-flex items-center gap-1 text-xs font-mono text-neon-cyan hover:underline px-2"
                  >
                    Profile <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy || status === 'active'}
                  className="gap-1"
                  onClick={() =>
                    runAction(
                      `user-${u.id}`,
                      () =>
                        moderationService.setUserModerationStatus(
                          u.id,
                          'active',
                          null
                        ),
                      'User restored to active'
                    )
                  }
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Active
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || status === 'suspended'}
                  className="gap-1"
                  onClick={() =>
                    runAction(
                      `user-${u.id}`,
                      () =>
                        moderationService.setUserModerationStatus(
                          u.id,
                          'suspended',
                          'Suspended by staff'
                        ),
                      'User suspended'
                    )
                  }
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  Suspend
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || status === 'banned'}
                  className="gap-1 text-red-300 hover:text-red-200"
                  onClick={() => {
                    setConfirmDialog({
                      title: 'Ban user',
                      message: `Ban ${u.username || 'this user'}? They will not be able to participate while banned.`,
                      confirmLabel: 'Ban user',
                      onConfirm: () =>
                        runAction(
                          `user-${u.id}`,
                          () =>
                            moderationService.setUserModerationStatus(
                              u.id,
                              'banned',
                              'Banned by staff'
                            ),
                          'User banned'
                        ),
                    });
                  }}
                >
                  <Ban className="w-3.5 h-3.5" />
                  Ban
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
