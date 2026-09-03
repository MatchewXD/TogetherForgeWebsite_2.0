/**
 * Per-project Contributors / public credits page.
 * Route: /projects/:id/contributors
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Heart } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import UserAvatar from '../components/ui/UserAvatar';
import UserNameWithBadge from '../components/badges/UserNameWithBadge';
import GrantCreditPanel from '../components/staff/GrantCreditPanel';
import { tasksService } from '../services/tasksService';
import {
  getProjectCredits,
  formatUsdFromCents,
} from '../services/contributorsService';
import { displayProjectTitle } from '../utils/ideaStatus';
import { CONTRIBUTION_CATEGORIES } from '../constants/contributionCategories';
import { isProjectCompleted } from '../services/projectsService';
import { STAFF_CREDIT_PENDING_LABEL } from '../constants/staffCredit';
import useStaffRole from '../hooks/useStaffRole';

function groupBySubcategory(rows, orderedSubs) {
  const map = new Map();
  for (const sub of orderedSubs) map.set(sub, []);
  map.set('Other', map.get('Other') || []);

  for (const row of rows) {
    const sub = row.subcategory && orderedSubs.includes(row.subcategory)
      ? row.subcategory
      : row.subcategory || 'Other';
    if (!map.has(sub)) map.set(sub, []);
    // Dedupe person within subcategory
    const list = map.get(sub);
    const key = row.staffCredited
      ? `sc:${row.id}`
      : row.userId || row.username || row.displayName;
    if (list.some((p) => (p._groupKey || p.userId || p.username || p.displayName) === key)) {
      continue;
    }
    list.push({ ...row, _groupKey: key });
  }

  // People can appear in multiple subcategories (separate rows) — already separate
  return [...map.entries()].filter(([, people]) => people.length > 0);
}

function PersonRow({ person }) {
  const pending = Boolean(person.pendingAccount);
  const name = pending
    ? person.roleLabel || person.displayName || STAFF_CREDIT_PENDING_LABEL
    : person.displayName || person.username || 'Contributor';
  return (
    <li className="flex items-center gap-3 py-2 min-w-0">
      <UserAvatar
        src={person.avatarUrl}
        name={name}
        username={person.username}
        size="md"
      />
      <div className="min-w-0">
        <UserNameWithBadge
          username={pending ? null : person.username}
          displayName={name}
          pinnedBadgeKey={
            pending
              ? null
              : person.pinnedBadgeKey || person.pinned_badge_key || null
          }
          linkClassName="font-semibold text-white truncate"
        />
        {pending ? (
          <p className="text-xs text-text-muted">{STAFF_CREDIT_PENDING_LABEL}</p>
        ) : person.roleLabel ? (
          <p className="text-xs text-text-muted truncate">{person.roleLabel}</p>
        ) : null}
      </div>
    </li>
  );
}

const ProjectContributors = () => {
  const { id: projectSlug } = useParams();
  const { isModerator, loading: roleLoading } = useStaffRole();
  const [project, setProject] = useState(null);
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creditTick, setCreditTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const dbProject = await tasksService.getProjectBySlug(projectSlug);
        if (!mounted) return;
        if (!dbProject) {
          setProject(null);
          setCredits(null);
          setError('Project not found.');
          return;
        }
        setProject(dbProject);
        const data = await getProjectCredits(dbProject.id);
        if (mounted) setCredits(data);
      } catch (err) {
        console.error('[ProjectContributors]', err);
        if (mounted) setError(err?.message || 'Failed to load contributors.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [projectSlug, creditTick]);

  const title = useMemo(
    () => (project ? displayProjectTitle(project) : projectSlug),
    [project, projectSlug]
  );

  const developmentBySub = useMemo(() => {
    const cat = CONTRIBUTION_CATEGORIES.find((c) => c.id === 'development');
    return groupBySubcategory(
      credits?.development || [],
      cat?.subcategories || []
    );
  }, [credits]);

  const marketingBySub = useMemo(() => {
    const cat = CONTRIBUTION_CATEGORIES.find((c) => c.id === 'marketing');
    return groupBySubcategory(
      credits?.marketing || [],
      cat?.subcategories || []
    );
  }, [credits]);

  const communityBySub = useMemo(() => {
    const cat = CONTRIBUTION_CATEGORIES.find((c) => c.id === 'community');
    return groupBySubcategory(
      credits?.community || [],
      cat?.subcategories || []
    );
  }, [credits]);

  const donations = credits?.donations;
  const done = project ? isProjectCompleted(project) : false;

  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      <header className="relative pt-20 border-b border-cyber-border bg-cyber-surface/80">
        <div className="container-custom py-10 sm:py-12">
          <Link
            to="/contributors"
            className="inline-flex items-center gap-1.5 text-xs font-mono tracking-widest text-neon-cyan hover:text-white mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Contributors by project
          </Link>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="section-header mb-0">Contributors</div>
            {project?.phase && (
              <Badge variant="default">{project.phase}</Badge>
            )}
            {done ? (
              <Badge variant="gold">Completed</Badge>
            ) : (
              <Badge variant="neon">{project?.status || 'In Development'}</Badge>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-3">
            {title}
          </h1>
          <p className="text-text-secondary max-w-2xl leading-relaxed">
            Everyone who helped this project: a permanent credit record. When
            the project completes, these names stay here and on All
            Contributors.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to={`/projects/${projectSlug}`}
              className="text-sm font-semibold text-neon-cyan hover:text-white inline-flex items-center gap-1"
            >
              Open workspace
            </Link>
            <Link
              to="/contributors/all"
              className="text-sm text-text-muted hover:text-neon-cyan"
            >
              All Contributors
            </Link>
            <Link
              to="/contributors"
              className="text-sm text-text-muted hover:text-neon-cyan"
            >
              By project
            </Link>
          </div>
        </div>
      </header>

      <div className="container-custom py-12 md:py-16 max-w-4xl space-y-12">
        {loading && (
          <p className="text-sm font-mono tracking-widest text-text-muted">
            Loading credits…
          </p>
        )}

        {error && !loading && (
          <Card className="p-6 text-text-secondary text-sm">{error}</Card>
        )}

        {!roleLoading && isModerator && project?.id && (
          <GrantCreditPanel
            projectId={project.id}
            lockProject
            compact
            onChanged={() => setCreditTick((n) => n + 1)}
          />
        )}

        {!loading && !error && credits && (
          <>
            {/* Donations */}
            <section aria-labelledby="donations-heading">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-4 h-4 text-neon-magenta" />
                <h2
                  id="donations-heading"
                  className="section-header mb-0"
                >
                  Donations
                </h2>
              </div>
              <p className="text-sm text-text-muted mb-4 max-w-xl">
                Support given while this project was active (In Development)
                counts here. After release, new donations no longer add to this
                total. Individual amounts stay private; names appear only when
                the donor chose to be public.
              </p>
              <Card className="p-5 sm:p-6 space-y-5">
                <div>
                  <p className="text-xs font-mono tracking-widest text-text-muted uppercase mb-1">
                    Project total
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-white">
                    {formatUsdFromCents(donations?.projectTotalCents || 0)}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    Attributed while the project was active
                  </p>
                </div>

                {(donations?.anonymousCents || 0) > 0 && (
                  <p className="text-sm text-text-secondary border-l-2 border-cyber-border pl-3">
                    {formatUsdFromCents(donations.anonymousCents)} was donated
                    by anonymous donors
                  </p>
                )}

                <div>
                  <h3 className="font-mono text-xs tracking-widest uppercase text-neon-cyan mb-3">
                    Named supporters
                  </h3>
                  {(donations?.namedDonors || []).length === 0 ? (
                    <p className="text-sm text-text-muted">
                      No public names yet. Anonymous support still counts toward
                      the total above.
                    </p>
                  ) : (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
                      {donations.namedDonors.map((d) => (
                        <PersonRow
                          key={d.userId || d.username || d.displayName}
                          person={d}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            </section>

            {/* Development */}
            <section aria-labelledby="development-heading">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-neon-cyan" />
                <h2
                  id="development-heading"
                  className="section-header mb-0"
                >
                  Development
                </h2>
              </div>
              <p className="text-sm text-text-muted mb-4 max-w-xl">
                Account holders who completed project work. People who helped in
                multiple areas appear under each relevant sub-header.
              </p>
              {developmentBySub.length === 0 ? (
                <Card className="p-5 text-sm text-text-muted">
                  No development credits recorded yet. Completing tasks on the
                  board or adding staff credits will fill this section.
                </Card>
              ) : (
                <div className="space-y-6">
                  {developmentBySub.map(([sub, people]) => (
                    <Card key={sub} className="p-5">
                      <h3 className="font-mono text-xs tracking-widest uppercase text-neon-cyan mb-3">
                        {sub}
                      </h3>
                      <ul className="divide-y divide-cyber-border/60">
                        {people.map((p) => (
                          <PersonRow key={p.id || p.userId} person={p} />
                        ))}
                      </ul>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Marketing / Content */}
            <section aria-labelledby="marketing-heading">
              <h2 id="marketing-heading" className="section-header mb-2">
                Marketing / Content
              </h2>
              <p className="text-sm text-text-muted mb-4 max-w-xl">
                Account holders only. Guests without profiles cannot be listed
                here.
              </p>
              {marketingBySub.length === 0 ? (
                <Card className="p-5 text-sm text-text-muted">
                  No marketing or content credits yet.
                </Card>
              ) : (
                <div className="space-y-6">
                  {marketingBySub.map(([sub, people]) => (
                    <Card key={sub} className="p-5">
                      <h3 className="font-mono text-xs tracking-widest uppercase text-neon-cyan mb-3">
                        {sub}
                      </h3>
                      <ul className="divide-y divide-cyber-border/60">
                        {people.map((p) => (
                          <PersonRow key={p.id || p.userId} person={p} />
                        ))}
                      </ul>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Community */}
            <section aria-labelledby="community-heading">
              <h2 id="community-heading" className="section-header mb-2">
                Community &amp; Support
              </h2>
              <p className="text-sm text-text-muted mb-4 max-w-xl">
                Moderation, playtesting, and community care — including off-site
                help credited by staff.
              </p>
              {communityBySub.length === 0 ? (
                <Card className="p-5 text-sm text-text-muted">
                  No community credits yet.
                </Card>
              ) : (
                <div className="space-y-6">
                  {communityBySub.map(([sub, people]) => (
                    <Card key={sub} className="p-5">
                      <h3 className="font-mono text-xs tracking-widest uppercase text-neon-cyan mb-3">
                        {sub}
                      </h3>
                      <ul className="divide-y divide-cyber-border/60">
                        {people.map((p) => (
                          <PersonRow key={p.id || p.userId} person={p} />
                        ))}
                      </ul>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default ProjectContributors;
