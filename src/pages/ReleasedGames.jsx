/**
 * Released Games listing — permanent home for finished / shipped titles.
 * Route: /released
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ExternalLink,
  Package,
  Lightbulb,
  Users,
  Rocket,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import { listReleasedGames } from '../services/projectsService';
import { displayProjectTitle } from '../utils/ideaStatus';
import {
  sortReleaseLinks,
  phaseBadgeVariant,
  formatReleaseDate,
} from '../utils/releaseMeta';

/** Hero banner */
const RELEASED_BANNER_SRC = '/images/Release_HeroImage.webp';

const ReleasedGames = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await listReleasedGames();
        if (mounted) setGames(rows || []);
      } catch (err) {
        console.warn('[ReleasedGames]', err);
        if (mounted) setGames([]);
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
      {/* Page header banner */}
      <header className="relative pt-20 overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <img
            src={RELEASED_BANNER_SRC}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-[center_40%] sm:object-center"
            decoding="async"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-cyber-bg/55" />
          <div className="absolute inset-0 bg-gradient-to-r from-cyber-bg/96 via-cyber-bg/85 to-cyber-bg/35" />
          <div className="absolute inset-0 bg-gradient-to-b from-cyber-bg/70 via-cyber-bg/25 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgb(var(--tf-forge-gold)/0.1)_0%,transparent_50%)]" />
        </div>
        <div
          className="absolute bottom-0 inset-x-0 h-28 sm:h-32 pointer-events-none z-[5] bg-gradient-to-b from-transparent via-cyber-bg/50 to-cyber-bg"
          aria-hidden="true"
        />

        <div className="container-custom relative z-10 py-10 sm:py-12 md:py-14 min-h-[16rem] sm:min-h-[18rem] md:min-h-[20rem] flex flex-col justify-center">
          <div className="max-w-3xl [text-shadow:0_1px_2px_rgb(0_0_0_/_0.9),0_2px_16px_rgb(0_0_0_/_0.55)]">
            <div className="section-header">Shipped</div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Released Games
            </h1>
            <p className="text-base sm:text-lg text-white/85 leading-relaxed max-w-2xl">
              Games that Together Forge has finished and shipped. Every completed
              project lives here with full credits, links, and the story of how it
              was made.
            </p>
          </div>
        </div>
      </header>

      <div className="container-custom relative z-10 py-12 md:py-16 max-w-5xl">
        {loading ? (
          <p className="text-sm font-mono tracking-widest text-text-muted">
            Loading releases…
          </p>
        ) : games.length === 0 ? (
          <Card className="p-8 sm:p-10 text-center space-y-6 border-dashed">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl border border-forge-gold/40 bg-forge-gold/10 text-forge-gold mx-auto">
              <Package className="w-7 h-7" />
            </div>
            <div className="space-y-3 max-w-xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                No games have been released yet.
              </h2>
              <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
                Early Game is where we are building and proving the model. The
                first finished games will appear here once they ship, complete
                with credits, play links, and the full record of who helped make
                them.
              </p>
              <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
                In the meantime you can follow active work on the Early Phase page
                and help shape what comes next.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 pt-2">
              <Link to="/projects/early">
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  <Rocket className="w-4 h-4" />
                  View Early Projects
                </Button>
              </Link>
              <Link to="/ideas/submit">
                <Button size="lg" variant="secondary" className="gap-2 w-full sm:w-auto">
                  <Lightbulb className="w-4 h-4" />
                  Submit an Idea
                </Button>
              </Link>
              <Link to="/get-involved">
                <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
                  <Users className="w-4 h-4" />
                  Get Involved
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-5 list-none p-0 m-0">
            {games.map((game) => {
              const title = displayProjectTitle(game);
              const slug = game.slug || game.id;
              const when = formatReleaseDate(game.completed_at);
              const links = sortReleaseLinks(game.completion_links || []);
              const summary =
                game.summary ||
                game.completion_notes ||
                game.description ||
                '';

              return (
                <li key={game.id || slug}>
                  <Card
                    interactive
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/released/${slug}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/released/${slug}`);
                      }
                    }}
                    className="p-5 sm:p-6 h-full flex flex-col cyber-card-gold group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge variant={phaseBadgeVariant(game.phase)}>
                        {game.phase || 'Early'}
                      </Badge>
                      <Badge variant="gold">Released</Badge>
                      {game._isDemoRelease && (
                        <Badge variant="purple">Demo preview</Badge>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white group-hover:text-neon-cyan transition-colors">
                      {title}
                    </h2>
                    {when && (
                      <p className="mt-1 text-xs font-mono tracking-widest text-text-muted uppercase">
                        Released {when}
                      </p>
                    )}
                    {summary && (
                      <p className="mt-3 text-sm text-text-secondary leading-relaxed line-clamp-3 flex-1">
                        {summary}
                      </p>
                    )}
                    {links.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {links.slice(0, 4).map((link) => (
                          <a
                            key={`${slug}-${link.url}`}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-mono tracking-wide text-neon-cyan hover:text-white border border-neon-cyan/30 rounded-full px-2.5 py-1 transition-colors relative z-10"
                          >
                            {link.label}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    )}
                    <div className="mt-5 pt-4 border-t border-cyber-border">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-neon-cyan group-hover:text-white transition-colors">
                        View Details
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                      </span>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ReleasedGames;
