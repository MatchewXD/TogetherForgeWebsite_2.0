/**
 * All Contributors — public recognition directory across the forge.
 * Route: /contributors/all
 * Landing (by project): /contributors
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Heart,
  Hammer,
  MessageCircle,
  Film,
  Wrench,
  Shield,
} from 'lucide-react';
import Card from '../components/ui/Card';
import UserAvatar from '../components/ui/UserAvatar';
import UserNameWithBadge from '../components/badges/UserNameWithBadge';
import { listAllContributorsGrouped } from '../services/contributorsService';
import { isDemoContributorsEnabled } from '../data/demoAllContributors';
import { STAFF_CREDIT_PENDING_LABEL } from '../constants/staffCredit';

const SECTIONS = [
  {
    id: 'projectContributors',
    title: 'Project Contributors',
    description: 'People who shipped development work on official projects.',
    icon: Hammer,
    accent: 'text-neon-cyan',
  },
  {
    id: 'donors',
    title: 'Donors',
    description:
      'Named supporters. Individual amounts stay private.',
    icon: Heart,
    accent: 'text-neon-magenta',
  },
  {
    id: 'communityModeration',
    title: 'Community & Moderation',
    description: 'Moderation, playtesting, and community care.',
    icon: Shield,
    accent: 'text-forge-gold',
  },
  {
    id: 'ideasFeedback',
    title: 'Ideas & Feedback',
    description: 'Idea authors and people who shared structured feedback.',
    icon: MessageCircle,
    accent: 'text-neon-purple',
  },
  {
    id: 'contentShowcase',
    title: 'Content & Showcase',
    description:
      'Marketing and video credits, plus creators with approved Community Showcase posts.',
    icon: Film,
    accent: 'text-neon-cyan',
  },
  {
    id: 'otherSkills',
    title: 'Other Skills',
    description: 'Help that does not fit a single category above.',
    icon: Wrench,
    accent: 'text-text-secondary',
  },
];

function PersonRow({ person }) {
  const pending = Boolean(person.pendingAccount);
  const name = pending
    ? person.roleLabel || person.displayName || STAFF_CREDIT_PENDING_LABEL
    : person.displayName || person.username || 'Contributor';
  const context = pending
    ? STAFF_CREDIT_PENDING_LABEL
    : Array.isArray(person.contexts) && person.contexts.length > 0
      ? person.contexts.slice(0, 2).join(' · ')
      : person.roleLabel || null;

  return (
    <li className="flex items-center gap-3 py-2.5 min-w-0">
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
        {context && (
          <p className="text-xs text-text-muted truncate" title={context}>
            {context}
          </p>
        )}
      </div>
    </li>
  );
}

const AllContributors = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const grouped = await listAllContributorsGrouped();
        if (mounted) setData(grouped);
      } catch (err) {
        console.error('[AllContributors]', err);
        if (mounted) setError(err?.message || 'Failed to load contributors.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleSections = useMemo(() => {
    if (!data) return [];
    return SECTIONS.filter((s) => (data[s.id] || []).length > 0).map((s) => ({
      ...s,
      people: data[s.id],
    }));
  }, [data]);

  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      <header className="relative pt-20 border-b border-cyber-border bg-cyber-surface/80">
        <div className="container-custom py-10 sm:py-12 md:py-14">
          <Link
            to="/contributors"
            className="inline-flex items-center gap-1.5 text-xs font-mono tracking-widest text-neon-cyan hover:text-white mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Contributors by project
          </Link>
          <div className="max-w-3xl">
            <div className="section-header">Recognition</div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              All Contributors
            </h1>
            <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-2xl">
              A lasting memorial of everyone who has helped build Together
              Forge. Credits are kept permanently. Finishing a project does not
              remove anyone from this list. Public credit is part of how we
              work.
            </p>
            {!loading && data && (
              <p className="mt-3 text-xs font-mono tracking-widest text-text-muted uppercase">
                {data.totalPeople}{' '}
                {data.totalPeople === 1 ? 'person' : 'people'} credited
                {isDemoContributorsEnabled()
                  ? ' · includes demo preview people'
                  : ''}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="container-custom py-12 md:py-16 max-w-5xl space-y-12">
        {loading && (
          <p className="text-sm font-mono tracking-widest text-text-muted">
            Loading contributors…
          </p>
        )}

        {error && !loading && (
          <Card className="p-6 text-sm text-text-secondary">{error}</Card>
        )}

        {!loading && !error && visibleSections.length === 0 && (
          <Card className="p-8 sm:p-10 text-center space-y-4 border-dashed">
            <Users className="w-10 h-10 text-neon-cyan mx-auto opacity-80" />
            <h2 className="text-xl font-bold text-white">
              No public credits yet
            </h2>
            <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
              As people complete tasks, donate with public credit, and help in
              community roles, their names will appear here.
            </p>
            <Link
              to="/get-involved"
              className="inline-flex text-sm font-semibold text-neon-cyan hover:text-white"
            >
              Get involved
            </Link>
          </Card>
        )}

        {!loading &&
          visibleSections.map((section) => {
            const Icon = section.icon;
            return (
              <section
                key={section.id}
                aria-labelledby={`section-${section.id}`}
              >
                <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${section.accent}`}
                      aria-hidden
                    />
                    <h2
                      id={`section-${section.id}`}
                      className="section-header mb-0"
                    >
                      {section.title}
                    </h2>
                  </div>
                  <p className="text-xs font-mono tracking-widest text-text-muted uppercase">
                    {section.people.length}{' '}
                    {section.people.length === 1 ? 'person' : 'people'}
                  </p>
                </div>
                <p className="text-sm text-text-muted mb-4 max-w-2xl">
                  {section.description}
                </p>
                <Card className="p-4 sm:p-5">
                  <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 list-none p-0 m-0">
                    {section.people.map((person) => (
                      <PersonRow
                        key={
                          person.userId ||
                          person.username ||
                          person.displayName
                        }
                        person={person}
                      />
                    ))}
                  </ul>
                </Card>
              </section>
            );
          })}

        <p className="text-center text-xs font-mono tracking-widest text-text-muted">
          <Link to="/contributors" className="hover:text-neon-cyan">
            By project
          </Link>
          {' · '}
          <Link to="/get-involved" className="hover:text-neon-cyan">
            Get involved
          </Link>
          {' · '}
          <Link to="/donate" className="hover:text-neon-cyan">
            Donate
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AllContributors;
