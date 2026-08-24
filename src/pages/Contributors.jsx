/**
 * Contributors landing — why public credit matters + project cards.
 * Route: /contributors
 * All people directory: /contributors/all
 * Per-project: /projects/:slug/contributors
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Users, Award, Heart } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import {
  listContributorProjects,
  isProjectInDevelopment,
  isProjectCompleted,
} from '../services/contributorsService';
import { displayProjectTitle } from '../utils/ideaStatus';

function projectContributorsPath(p) {
  const slug = p.slug || p.id;
  return `/projects/${slug}/contributors`;
}

const Contributors = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await listContributorProjects();
        if (mounted) setProjects(rows);
      } catch (err) {
        console.warn('[Contributors]', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      <header className="relative pt-20 border-b border-cyber-border bg-cyber-surface/80">
        <div className="container-custom py-10 sm:py-12 md:py-14">
          <div className="max-w-3xl">
            <div className="section-header">Community</div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Contributors
            </h1>
            <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-2xl">
              Together Forge is built in public. Every idea, task, playtest note,
              stream, and dollar of support deserves a name next to the work.
              Public credit is not a perk. It is how we show respect for the
              people who make the games possible. Browse by project below, or
              see everyone on All Contributors.
            </p>
          </div>
        </div>
      </header>

      <div className="container-custom py-12 md:py-16 space-y-12 max-w-5xl">
        <section className="grid sm:grid-cols-3 gap-4">
          <Card className="p-5 bg-cyber-card/70">
            <Award className="w-5 h-5 text-forge-gold mb-3" />
            <h2 className="font-semibold text-white mb-2">Named in the open</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              Credits live on the site, not in a private doc. When a game ships,
              the same records can feed the released-game credits page.
            </p>
          </Card>
          <Card className="p-5 bg-cyber-card/70">
            <Users className="w-5 h-5 text-neon-cyan mb-3" />
            <h2 className="font-semibold text-white mb-2">Many ways to help</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              Development, content, moderation, playtests, and support. If you
              contributed in more than one way, you show up in every matching
              list.
            </p>
          </Card>
          <Card className="p-5 bg-cyber-card/70">
            <Heart className="w-5 h-5 text-neon-magenta mb-3" />
            <h2 className="font-semibold text-white mb-2">Support counts too</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              Named donors appear on project Contributors and All Contributors
              without dollar amounts. Anonymous support is rolled into totals.
            </p>
          </Card>
        </section>

        <section aria-labelledby="projects-credits-heading">
          <h2
            id="projects-credits-heading"
            className="section-header mb-2"
          >
            Projects
          </h2>
          <p className="text-sm text-text-muted mb-6 max-w-2xl">
            Active and completed projects. Open a card for that project&apos;s
            Contributors page to see who helped on that build.
          </p>

          {loading ? (
            <p className="text-sm font-mono tracking-widest text-text-muted">
              Loading projects…
            </p>
          ) : projects.length === 0 ? (
            <Card className="p-6 text-text-secondary text-sm">
              No active or completed projects yet. When Early work is underway,
              contributor pages will appear here.
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => {
                const title = displayProjectTitle(p);
                const active = isProjectInDevelopment(p);
                const done = isProjectCompleted(p);
                return (
                  <Link
                    key={p.id || p.slug}
                    to={projectContributorsPath(p)}
                    className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg"
                  >
                    <Card
                      interactive
                      className={`p-5 h-full ${active ? 'cyber-card-gold' : ''}`}
                    >
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge variant="default">{p.phase || 'Early'}</Badge>
                        <Badge variant={done ? 'gold' : 'neon'}>
                          {done
                            ? 'Completed'
                            : p.status || 'In Development'}
                        </Badge>
                      </div>
                      <h3 className="text-lg font-bold text-white group-hover:text-neon-cyan transition-colors">
                        {title}
                      </h3>
                      {(p.summary || p.description) && (
                        <p className="mt-2 text-sm text-text-secondary leading-relaxed line-clamp-3">
                          {p.summary || p.description}
                        </p>
                      )}
                      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-neon-cyan">
                        View contributors
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                      </span>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Prominent CTA to All Contributors directory */}
        <section aria-labelledby="all-contributors-cta">
          <Link
            to="/contributors/all"
            className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg rounded-2xl"
          >
            <Card
              interactive
              className="p-6 sm:p-8 md:p-10 border-forge-gold/40 cyber-card-gold relative overflow-hidden"
            >
              <div
                className="pointer-events-none absolute -right-8 -top-8 w-40 h-40 rounded-full bg-forge-gold/10"
                aria-hidden
              />
              <div className="relative flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">
                <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border border-forge-gold/40 bg-forge-gold/10 text-forge-gold shrink-0">
                  <Users className="w-7 h-7 sm:w-8 sm:h-8" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-mono tracking-widest uppercase text-forge-gold mb-2">
                    Recognition
                  </p>
                  <h2
                    id="all-contributors-cta"
                    className="text-2xl sm:text-3xl font-bold text-white group-hover:text-neon-cyan transition-colors"
                  >
                    All Contributors
                  </h2>
                  <p className="mt-2 text-sm sm:text-base text-text-secondary leading-relaxed max-w-xl">
                    See everyone who has helped build Together Forge — project
                    work, named donors, community roles, ideas, and more. Public
                    credit in one place.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 text-base sm:text-lg font-semibold text-neon-cyan shrink-0">
                  See everyone
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
                </span>
              </div>
            </Card>
          </Link>
        </section>

        <p className="text-center text-xs font-mono tracking-widest text-text-muted">
          <Link to="/contributors/all" className="hover:text-neon-cyan">
            All Contributors
          </Link>
          {' · '}
          <Link to="/get-involved" className="hover:text-neon-cyan">
            Get involved
          </Link>
          {' · '}
          <Link to="/projects/early" className="hover:text-neon-cyan">
            Early workspace
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Contributors;
