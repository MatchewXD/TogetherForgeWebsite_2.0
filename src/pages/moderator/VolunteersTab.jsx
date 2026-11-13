/**
 * Moderator Dashboard: Volunteer applications and apply blocks.
 * Presentational: all state and handlers live in ModeratorDashboard and arrive as props.
 */

import Button from '../../components/ui/Buttons';
import Card from '../../components/ui/Card';
import { Search, Ban } from 'lucide-react';
import { VOLUNTEER_STATUSES, VOLUNTEER_STATUS_LABELS, applicationMatchesBlock } from '../../services/volunteerService';
import Badge from '../../components/ui/Badge';
import {
  filterLabel,
  filterControl,
  volunteerSkillLabel,
  volunteerTypeLabel,
  formatDate,
  volunteerRoleLabel,
  volunteerNeedLabel,
  volunteerTimeLabel,
} from './shared';

export default function VolunteersTab({
  busyKey,
  filteredVolunteers,
  handleVolunteerBlock,
  handleVolunteerStatus,
  handleVolunteerUnblock,
  loading,
  setVolunteerSearch,
  setVolunteerSort,
  setVolunteerStatusFilter,
  setVolunteerTypeFilter,
  volunteerBlocks,
  volunteers,
  volunteerSearch,
  volunteersMissing,
  volunteerSort,
  volunteerStatusFilter,
  volunteerTypeFilter,
}) {
  return (
    <section aria-labelledby="volunteers-heading">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <h2
            id="volunteers-heading"
            className="text-xl sm:text-2xl font-bold text-white tracking-tight"
          >
            Volunteer applications
          </h2>
          <p className="text-sm text-text-secondary mt-1 max-w-xl">
            Private Get Involved offers. New and reviewing stay pinned.
            Block stops further applications from the same account, email,
            or Discord username.
          </p>
          <p className="text-xs font-mono text-text-muted mt-1">
            Showing {filteredVolunteers.length}
            {filteredVolunteers.length !== volunteers.length
              ? ` of ${volunteers.length}`
              : ''}
          </p>
        </div>
        {(volunteerSearch ||
          volunteerStatusFilter !== 'open' ||
          volunteerTypeFilter !== 'all' ||
          volunteerSort !== 'newest') && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setVolunteerSearch('');
              setVolunteerStatusFilter('open');
              setVolunteerTypeFilter('all');
              setVolunteerSort('newest');
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <Card className="bg-cyber-card/80 mb-4 p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className={filterLabel} htmlFor="mod-vol-search">
              Search
            </label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
                aria-hidden
              />
              <input
                id="mod-vol-search"
                type="search"
                className={`${filterControl} pl-9`}
                placeholder="Handle, email, Discord, skills…"
                value={volunteerSearch}
                onChange={(e) => setVolunteerSearch(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={filterLabel} htmlFor="mod-vol-status">
              Status
            </label>
            <select
              id="mod-vol-status"
              className={filterControl}
              value={volunteerStatusFilter}
              onChange={(e) => setVolunteerStatusFilter(e.target.value)}
            >
              <option value="open">Open (new + reviewing)</option>
              <option value="all">All statuses</option>
              {VOLUNTEER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {VOLUNTEER_STATUS_LABELS[s]}
                </option>
              ))}
              <option value="blocked">Blocked contacts</option>
            </select>
          </div>
          <div>
            <label className={filterLabel} htmlFor="mod-vol-type">
              Type
            </label>
            <select
              id="mod-vol-type"
              className={filterControl}
              value={volunteerTypeFilter}
              onChange={(e) => setVolunteerTypeFilter(e.target.value)}
            >
              <option value="all">All types</option>
              <option value="skill_offer">Skill offer</option>
              <option value="moderation_role">Community moderator</option>
              <option value="open_need">Open need</option>
            </select>
          </div>
          <div>
            <label className={filterLabel} htmlFor="mod-vol-sort">
              Sort
            </label>
            <select
              id="mod-vol-sort"
              className={filterControl}
              value={volunteerSort}
              onChange={(e) => setVolunteerSort(e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="handle">Handle A–Z</option>
            </select>
          </div>
        </div>
      </Card>

      {volunteersMissing && (
        <Card className="bg-cyber-card/80 border-amber-500/30 mb-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Volunteer applications are not set up yet. Run{' '}
            <code className="text-neon-cyan text-xs font-mono">
              supabase/sql/supabase_volunteer_applications.sql
            </code>{' '}
            in Supabase, then refresh.
          </p>
        </Card>
      )}

      {!volunteersMissing &&
        filteredVolunteers.length === 0 &&
        !loading && (
          <Card className="bg-cyber-card/80 text-sm text-text-muted">
            {volunteers.length === 0
              ? 'No volunteer applications yet.'
              : 'No applications match this view.'}
          </Card>
        )}

      <div className="space-y-3">
        {filteredVolunteers.map((app) => {
          const busy = busyKey === `vol-${app.id}`;
          const blocked = volunteerBlocks.some((b) =>
            applicationMatchesBlock(app, b)
          );
          const skills = [
            ...app.skillAreas.map(volunteerSkillLabel),
            app.skillOther ? `Other: ${app.skillOther}` : null,
          ].filter(Boolean);
          return (
            <Card key={app.id} className="bg-cyber-card/80">
              <div className="grid gap-4 lg:grid-cols-12">
                <div className="lg:col-span-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-white">
                      {app.handle}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="warning">
                        {volunteerTypeLabel(app.applicationType)}
                      </Badge>
                      {blocked ? (
                        <Badge variant="danger">Blocked</Badge>
                      ) : null}
                    </div>
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
                        Submitted
                      </dt>
                      <dd className="text-text-secondary">
                        {app.createdAt ? formatDate(app.createdAt) : 'n/a'}
                      </dd>
                    </div>
                    {app.email ? (
                      <div>
                        <dt className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
                          Email
                        </dt>
                        <dd className="text-text-secondary break-all">
                          {app.email}
                        </dd>
                      </div>
                    ) : null}
                    {app.discordUsername ? (
                      <div>
                        <dt className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
                          Discord
                        </dt>
                        <dd className="text-text-secondary">
                          {app.discordUsername}
                        </dd>
                      </div>
                    ) : null}
                    {app.roleId ? (
                      <div>
                        <dt className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
                          Role
                        </dt>
                        <dd className="text-text-secondary">
                          {volunteerRoleLabel(app.roleId)}
                        </dd>
                      </div>
                    ) : null}
                    {app.openNeedId ? (
                      <div>
                        <dt className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
                          Open need
                        </dt>
                        <dd className="text-text-secondary">
                          {volunteerNeedLabel(app.openNeedId)}
                        </dd>
                      </div>
                    ) : null}
                    {app.timeCommitment ? (
                      <div>
                        <dt className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
                          Time
                        </dt>
                        <dd className="text-text-secondary">
                          {volunteerTimeLabel(app.timeCommitment)}
                        </dd>
                      </div>
                    ) : null}
                    {app.portfolioUrl ? (
                      <div className="sm:col-span-2 lg:col-span-1">
                        <dt className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
                          Portfolio
                        </dt>
                        <dd>
                          <a
                            href={app.portfolioUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-neon-cyan hover:underline break-all text-sm"
                          >
                            {app.portfolioUrl}
                          </a>
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
                <div className="lg:col-span-8 space-y-3 min-w-0">
                  <div>
                    <div className="text-[10px] font-mono tracking-widest uppercase text-text-muted mb-1">
                      How they can help
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                      {app.description}
                    </p>
                  </div>
                  {skills.length ? (
                    <div>
                      <div className="text-[10px] font-mono tracking-widest uppercase text-text-muted mb-1.5">
                        Skills
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {skills.map((s) => (
                          <Badge key={s} variant="default">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/10 mt-4">
                <select
                  className="bg-cyber-surface border border-cyber-border rounded-lg px-2 py-1.5 text-xs text-white"
                  value={app.status}
                  disabled={busy}
                  onChange={(e) =>
                    void handleVolunteerStatus(app.id, e.target.value)
                  }
                  aria-label={`Status for ${app.handle}`}
                >
                  {VOLUNTEER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {VOLUNTEER_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                {blocked ? (
                  <span className="text-xs text-semantic-danger">
                    This contact is blocked from applying again.
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-red-300"
                    disabled={busy}
                    onClick={() => handleVolunteerBlock(app)}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Block from applying
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {volunteerBlocks.length > 0 &&
        volunteerStatusFilter !== 'blocked' && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-white mb-2">
              Blocked contacts
            </h3>
            <p className="text-xs text-text-muted mb-3">
              These people cannot submit another Get Involved application.
            </p>
            <div className="space-y-2">
              {volunteerBlocks.map((block) => {
                const busy = busyKey === `volblock-${block.id}`;
                return (
                  <Card
                    key={block.id}
                    className="bg-cyber-card/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="text-sm text-text-secondary min-w-0">
                      <p className="text-white font-medium">
                        {block.email ||
                          block.discordUsername ||
                          'Blocked contact'}
                      </p>
                      <p className="text-xs font-mono text-text-muted mt-0.5">
                        {[
                          block.email,
                          block.discordUsername
                            ? `Discord ${block.discordUsername}`
                            : null,
                          block.createdAt
                            ? formatDate(block.createdAt)
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => handleVolunteerUnblock(block)}
                    >
                      Lift block
                    </Button>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
    </section>
  );
}
