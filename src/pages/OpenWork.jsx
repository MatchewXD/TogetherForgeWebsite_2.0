/**
 * Open Work — global Task Boards index.
 * Route: /open-work
 * Lists every active project board; entries go to /projects/:id/board.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LayoutGrid, Loader2 } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { listActiveTaskBoards } from '../services/projectsService';

const OpenWork = () => {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await listActiveTaskBoards();
        if (mounted) setBoards(rows || []);
      } catch (err) {
        console.warn('[OpenWork]', err);
        if (mounted) setError('Could not load open boards. Try again shortly.');
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
            <div className="section-header">Contribute</div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4 flex items-center gap-3">
              <LayoutGrid className="w-9 h-9 text-neon-cyan shrink-0 hidden sm:block" />
              Open Work
            </h1>
            <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-2xl">
              Jump straight to a project Task Board. Claim work, track progress,
              and ship wins.
            </p>
          </div>
        </div>
      </header>

      <div className="container-custom py-10 md:py-14 max-w-3xl">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-20 text-text-secondary">
            <Loader2 className="w-5 h-5 animate-spin text-neon-cyan" />
            Loading boards…
          </div>
        )}

        {!loading && error && (
          <Card className="p-6 border-semantic-warning/40 bg-semantic-warning/10">
            <p className="text-sm text-semantic-warning">{error}</p>
          </Card>
        )}

        {!loading && !error && boards.length === 0 && (
          <Card className="p-8 sm:p-10 text-center space-y-4">
            <LayoutGrid className="w-10 h-10 text-text-muted mx-auto" />
            <h2 className="text-xl font-semibold text-white">
              No open boards yet
            </h2>
            <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
              Active projects with Task Boards will appear here. Browse the
              projects pipeline or check Get Involved for other ways to help.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link to="/projects" className="btn-neon text-sm">
                Browse projects
              </Link>
              <Link
                to="/get-involved"
                className="text-sm text-neon-cyan hover:text-white transition-colors"
              >
                Get involved
              </Link>
            </div>
          </Card>
        )}

        {!loading && !error && boards.length > 0 && (
          <section aria-labelledby="boards-list-heading" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
              <h2 id="boards-list-heading" className="sr-only">
                Active task boards
              </h2>
              <p className="text-xs font-mono tracking-widest text-text-muted uppercase">
                {boards.length} open board{boards.length === 1 ? '' : 's'}
              </p>
            </div>

            <ul className="space-y-3">
              {boards.map((board) => (
                <li key={board.id || board.slug}>
                  <Link
                    to={board.boardPath}
                    className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
                  >
                    <Card className="p-5 sm:p-6 bg-cyber-card/80 border-cyber-border group-hover:border-neon-cyan/40 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {board.phase && (
                              <Badge variant="neon">{board.phase}</Badge>
                            )}
                            {board.status && (
                              <Badge variant="default">{board.status}</Badge>
                            )}
                          </div>
                          <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-neon-cyan transition-colors truncate">
                            {board.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-text-muted">
                            {board.openTasks != null && (
                              <span>
                                {board.openTasks} open task
                                {board.openTasks === 1 ? '' : 's'}
                              </span>
                            )}
                            {board.totalTasks != null && board.totalTasks > 0 && (
                              <>
                                <span className="text-white/20" aria-hidden>
                                  ·
                                </span>
                                <span>{board.totalTasks} total</span>
                              </>
                            )}
                            <span className="text-white/20" aria-hidden>
                              ·
                            </span>
                            <span className="truncate">
                              /projects/{board.slug}/board
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2 text-sm font-semibold text-neon-cyan">
                          Open board
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>

            <p className="text-center text-xs text-text-muted pt-6">
              Want the full project story first?{' '}
              <Link
                to="/projects"
                className="text-neon-cyan hover:text-white transition-colors"
              >
                Browse projects
              </Link>
            </p>
          </section>
        )}
      </div>
    </div>
  );
};

export default OpenWork;
