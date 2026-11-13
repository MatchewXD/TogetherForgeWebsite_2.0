/**
 * Moderator Dashboard: Role management and role change log (Founder only).
 * Presentational: all state and handlers live in ModeratorDashboard and arrive as props.
 */

import Card from '../../components/ui/Card';
import { Search } from 'lucide-react';
import moderationService, { ASSIGNABLE_ROLES, roleLabel } from '../../services/moderationService';
import UserAvatar from '../../components/ui/UserAvatar';
import Badge from '../../components/ui/Badge';
import {
  filterLabel,
  filterControl,
  formatDate,
  formatDateTime,
} from './shared';

export default function RolesTab({
  busyKey,
  filteredRoleUsers,
  loading,
  roleLog,
  roleLogMissing,
  roleSearch,
  runAction,
  setConfirmDialog,
  setRoleSearch,
  userId,
  users,
}) {
  return (
    <section aria-labelledby="roles-heading">
      <div className="mb-4">
        <h2
          id="roles-heading"
          className="text-xl sm:text-2xl font-bold text-white tracking-tight"
        >
          Role Management
        </h2>
        <p className="text-sm text-text-secondary mt-1 max-w-xl">
          Change a user&apos;s role. Only a Founder can do this. There
          can be one Founder.
        </p>
        <p className="text-xs font-mono text-text-muted mt-1">
          Showing {filteredRoleUsers.length}
          {filteredRoleUsers.length !== users.length
            ? ` of ${users.length}`
            : ''}
        </p>
      </div>

      <Card className="bg-cyber-card/80 mb-4 p-4 sm:p-5">
        <label className={filterLabel} htmlFor="mod-role-search">
          Search
        </label>
        <div className="relative max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
            aria-hidden
          />
          <input
            id="mod-role-search"
            type="search"
            className={`${filterControl} pl-9`}
            placeholder="Username, email, id…"
            value={roleSearch}
            onChange={(e) => setRoleSearch(e.target.value)}
          />
        </div>
      </Card>

      <div className="space-y-3">
        {users.length === 0 && !loading && (
          <Card className="bg-cyber-card/80 text-sm text-text-muted">
            No profiles found (or staff read policy not applied yet).
          </Card>
        )}
        {users.length > 0 && filteredRoleUsers.length === 0 && !loading && (
          <Card className="bg-cyber-card/80 text-sm text-text-muted">
            No users match this search.
          </Card>
        )}
        {filteredRoleUsers.map((u) => {
          const current = String(u.role || 'user');
          const busy = busyKey === `role-${u.id}`;
          const isSelf = u.id === userId;
          const locked = isSelf || current === 'founder';
          const extraOption = !ASSIGNABLE_ROLES.includes(current);
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
                    <Badge variant="default">{roleLabel(current)}</Badge>
                  </div>
                  <p className="text-xs font-mono text-text-muted mt-1 truncate">
                    {u.id?.slice(0, 8)}… · joined{' '}
                    {formatDate(u.joined_at || u.created_at)}
                    {isSelf ? ' · you' : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <label className="sr-only" htmlFor={`mod-role-${u.id}`}>
                  Role for {u.username || 'user'}
                </label>
                <select
                  id={`mod-role-${u.id}`}
                  key={`${u.id}-${current}`}
                  className={filterControl + ' w-auto min-w-[10rem]'}
                  value={current}
                  disabled={busy || locked}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === current) return;
                    setConfirmDialog({
                      title: 'Change role',
                      message: `Set ${u.username || 'this user'} from ${roleLabel(current)} to ${roleLabel(next)}?`,
                      confirmLabel: 'Change role',
                      onConfirm: () =>
                        runAction(
                          `role-${u.id}`,
                          () =>
                            moderationService.setUserRole(u.id, next),
                          `${u.username || 'User'} is now ${roleLabel(next)}`
                        ),
                    });
                  }}
                >
                  {extraOption && (
                    <option value={current}>{roleLabel(current)}</option>
                  )}
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-10">
        <h3 className="text-lg font-bold text-white tracking-tight">
          Role changes
        </h3>
        <p className="text-sm text-text-secondary mt-1 mb-4">
          Who changed a role, and when.
        </p>

        {roleLogMissing && (
          <Card className="bg-semantic-warning/10 border-semantic-warning/40">
            <p className="text-sm text-text-secondary leading-relaxed">
              Role audit log is not installed yet. Run{' '}
              <code className="text-neon-cyan text-xs">
                supabase/sql/supabase_role_management.sql
              </code>{' '}
              in the Supabase SQL Editor, then click Refresh.
            </p>
          </Card>
        )}

        {!roleLogMissing && roleLog.length === 0 && !loading && (
          <Card className="bg-cyber-card/80 text-sm text-text-muted">
            No role changes recorded yet.
          </Card>
        )}

        {!roleLogMissing && roleLog.length > 0 && (
          <div className="space-y-2">
            {roleLog.map((entry) => (
              <Card
                key={entry.id}
                className="bg-cyber-card/80 py-3 px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <p className="text-sm text-text-secondary">
                  <span className="text-white font-medium">
                    {entry.changed_by_username || 'Founder'}
                  </span>{' '}
                  set{' '}
                  <span className="text-white font-medium">
                    {entry.username || 'a user'}
                  </span>{' '}
                  from {roleLabel(entry.old_role)} to{' '}
                  {roleLabel(entry.new_role)}
                </p>
                <p className="text-xs font-mono text-text-muted shrink-0">
                  {formatDateTime(entry.created_at)}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
