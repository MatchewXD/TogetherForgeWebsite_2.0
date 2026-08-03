/**
 * Contributors landing — why public credit matters + project cards.
 * Route: /contributors
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
              people who make the games possible.
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
              Named donors appear without dollar amounts. Anonymous support is
              rolled into a single total so privacy stays optional.
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
            Active and completed projects. Open a card to see who helped on that
            build.
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

        <p className="text-center text-xs font-mono tracking-widest text-text-muted">
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
