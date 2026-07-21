/**
 * Founders Thoughts: personal notes with backend-backed likes.
 * Route: /founders-thoughts
 * SQL: supabase/sql/supabase_founders_thoughts.sql
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Heart,
  Compass,
  Scale,
  Eye,
  Sparkles,
  Loader2,
  Wallet,
  ArrowRight,
} from 'lucide-react';

import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import RunwayTransparency from '../components/ui/RunwayTransparency';
import { supabase } from '../lib/supabase';
import foundersThoughtsService from '../services/foundersThoughtsService';

const THEME_VARIANT = {
  Origin: 'purple',
  Compensation: 'neon',
  Transparency: 'default',
  Philosophy: 'purple',
  Vision: 'default',
  Reflection: 'purple',
};

const THEME_ICON = {
  Origin: Sparkles,
  Compensation: Scale,
  Transparency: Eye,
  Philosophy: Heart,
  Vision: Compass,
  Reflection: Sparkles,
};

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const FoundersThoughts = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [thoughts, setThoughts] = useState([]);
  const [fromDb, setFromDb] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [user, setUser] = useState(null);
  const [likedIds, setLikedIds] = useState(() => new Set());
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  // Auth session
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) setUser(session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  // Load thoughts + user likes
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { thoughts: rows, fromDb: db, error } = await foundersThoughtsService.listThoughts();
      setThoughts(rows);
      setFromDb(db);
      if (error && !db) setLoadError(error);

      if (user?.id && db) {
        const ids = await foundersThoughtsService.getUserLikedThoughtIds(user.id);
        setLikedIds(new Set(ids));
      } else {
        setLikedIds(new Set());
      }
    } catch (e) {
      console.error('[FoundersThoughts] load', e);
      setLoadError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Hash scroll after content is ready
  useEffect(() => {
    if (loading || !location.hash) return;
    const id = location.hash.replace('#', '');
    const el = document.getElementById(id);
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [location.hash, loading, thoughts]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  const themes = useMemo(() => {
    const seen = new Set();
    return thoughts.filter((th) => {
      if (!th.theme || seen.has(th.theme)) return false;
      seen.add(th.theme);
      return true;
    });
  }, [thoughts]);

  const handleLike = async (thought) => {
    if (!thought?.id) {
      setToast('Likes need the founders_thoughts table. Run the SQL in Supabase.');
      return;
    }
    if (!user?.id) {
      setToast('Sign in to like a note.');
      return;
    }
    if (busyId === thought.id) return;

    const wasLiked = likedIds.has(thought.id);
    const prevLikes = thought.likes;

    // Optimistic
    setBusyId(thought.id);
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (wasLiked) next.delete(thought.id);
      else next.add(thought.id);
      return next;
    });
    setThoughts((list) =>
      list.map((t) =>
        t.id === thought.id
          ? { ...t, likes: Math.max(0, prevLikes + (wasLiked ? -1 : 1)) }
          : t
      )
    );

    try {
      const { liked, likes } = await foundersThoughtsService.toggleLike(
        thought.id,
        user.id
      );
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (liked) next.add(thought.id);
        else next.delete(thought.id);
        return next;
      });
      setThoughts((list) =>
        list.map((t) => (t.id === thought.id ? { ...t, likes } : t))
      );
    } catch (e) {
      console.error('[FoundersThoughts] like', e);
      // Rollback
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.add(thought.id);
        else next.delete(thought.id);
        return next;
      });
      setThoughts((list) =>
        list.map((t) =>
          t.id === thought.id ? { ...t, likes: prevLikes } : t
        )
      );
      setToast(e?.message || 'Could not save like. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(192,132,252,0.06)_0%,transparent_55%)]"
        aria-hidden="true"
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg border border-cyber-border bg-cyber-surface text-sm text-text-primary shadow-lg max-w-md text-center"
        >
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="relative z-10 border-b border-cyber-border bg-cyber-surface/80">
        <div className="container-custom py-12 md:py-16">
          <Link
            to="/transparency"
            className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group transition-colors"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
            BACK TO TRANSPARENCY HUB
          </Link>

          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="section-header mb-0">Founders Thoughts</div>
              <Badge variant="purple">Personal</Badge>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Founders Thoughts
            </h1>
            <p className="text-lg sm:text-xl text-text-secondary leading-relaxed">
              Why Together Forge exists, how founder pay works, why transparency
              matters, and the long-term vision. Like a note if it resonates.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
              <Button
                size="lg"
                className="gap-2 w-full sm:w-auto"
                onClick={() => navigate('/transparency')}
              >
                Transparency Hub
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="gap-2 w-full sm:w-auto"
                onClick={() => navigate('/about')}
              >
                About the studio
              </Button>
            </div>
          </div>

          {!loading && themes.length > 0 && (
            <nav
              aria-label="Essay topics"
              className="mt-10 flex flex-wrap gap-2"
            >
              {themes.map((th) => (
                <a
                  key={th.slug}
                  href={`#${th.slug}`}
                  className="px-3 py-1.5 rounded-full text-xs font-mono tracking-widest uppercase border border-cyber-border text-text-muted hover:border-neon-purple/50 hover:text-neon-purple transition-colors bg-cyber-card/40"
                >
                  {th.theme}
                </a>
              ))}
            </nav>
          )}
        </div>
      </div>

      <div className="container-custom relative z-10 py-12 md:py-16 space-y-10 md:space-y-12 max-w-3xl">
        {!fromDb && !loading && (
          <Card className="bg-cyber-surface/60 border-dashed border-amber-500/30">
            <p className="text-sm text-text-secondary leading-relaxed">
              Showing local copies of these notes. Run{' '}
              <code className="text-neon-cyan font-mono text-xs">
                supabase/sql/supabase_founders_thoughts.sql
              </code>{' '}
              in Supabase so likes persist for everyone.
              {loadError ? (
                <span className="block mt-2 text-text-muted text-xs font-mono">
                  {loadError}
                </span>
              ) : null}
            </p>
          </Card>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-text-muted">
            <Loader2 className="w-5 h-5 animate-spin text-neon-purple" />
            <span className="text-sm font-mono tracking-widest uppercase">
              Loading notes
            </span>
          </div>
        )}

        {/* Note cards */}
        {!loading &&
          thoughts.map((thought) => {
            const Icon = THEME_ICON[thought.theme] || Sparkles;
            const paragraphs = foundersThoughtsService.paragraphsFromContent(
              thought.content
            );
            const liked = thought.id != null && likedIds.has(thought.id);
            const busy = busyId === thought.id;

            return (
              <article
                key={thought.slug || thought.id}
                id={thought.slug}
                className="scroll-mt-24"
                aria-labelledby={`${thought.slug}-title`}
              >
                <Card className="bg-cyber-card/80">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-cyber-surface border border-cyber-border flex items-center justify-center text-neon-purple">
                        <Icon className="w-5 h-5" />
                      </div>
                      <Badge variant={THEME_VARIANT[thought.theme] || 'default'}>
                        {thought.theme}
                      </Badge>
                      {thought.published_at && (
                        <time
                          dateTime={thought.published_at}
                          className="text-xs font-mono tracking-widest text-text-muted uppercase"
                        >
                          {formatDate(thought.published_at)}
                        </time>
                      )}
                    </div>

                    {/* Like control */}
                    <button
                      type="button"
                      onClick={() => handleLike(thought)}
                      disabled={busy}
                      aria-pressed={liked}
                      aria-label={
                        liked
                          ? `Unlike. ${thought.likes} likes`
                          : `Like. ${thought.likes} likes`
                      }
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-mono transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg disabled:opacity-60 ${
                        liked
                          ? 'border-neon-magenta/60 bg-neon-magenta/15 text-neon-magenta shadow-sm'
                          : 'border-cyber-border bg-cyber-surface text-text-secondary hover:border-neon-magenta/40 hover:text-neon-magenta'
                      }`}
                    >
                      {busy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Heart
                          className={`w-4 h-4 ${liked ? 'fill-current' : ''}`}
                        />
                      )}
                      <span className="tabular-nums min-w-[1.25rem] text-center">
                        {thought.likes}
                      </span>
                      <span className="sr-only sm:not-sr-only sm:inline text-xs tracking-widest uppercase opacity-80">
                        {liked ? 'Liked' : 'Like'}
                      </span>
                    </button>
                  </div>

                  <h2
                    id={`${thought.slug}-title`}
                    className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3"
                  >
                    {thought.title}
                  </h2>

                  {thought.lead ? (
                    <p className="text-base sm:text-lg text-neon-cyan/90 leading-relaxed mb-6 border-l-2 border-neon-purple/50 pl-4">
                      {thought.lead}
                    </p>
                  ) : null}

                  <div className="space-y-4">
                    {paragraphs.map((p, i) => (
                      <p
                        key={i}
                        className="text-sm sm:text-base text-text-secondary leading-relaxed"
                      >
                        {p}
                      </p>
                    ))}
                  </div>

                  {thought.slug === 'founder-compensation' && (
                    <div className="mt-6">
                      <Button
                        size="lg"
                        className="gap-2 w-full sm:w-auto"
                        onClick={() => navigate('/support-runway')}
                      >
                        <Wallet className="w-4 h-4" />
                        Support my Runway
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {/* Footer like strip for longer notes */}
                  <div className="mt-8 pt-5 border-t border-cyber-border flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-text-muted font-mono tracking-widest uppercase">
                      {thought.likes === 1
                        ? '1 like'
                        : `${thought.likes} likes`}
                      {!user ? ' · sign in to like' : ''}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleLike(thought)}
                      disabled={busy}
                      className={`inline-flex items-center gap-2 text-sm transition-colors ${
                        liked
                          ? 'text-neon-magenta'
                          : 'text-text-muted hover:text-neon-magenta'
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 ${liked ? 'fill-current' : ''}`}
                      />
                      {liked ? 'You liked this' : 'Like this note'}
                    </button>
                  </div>
                </Card>
              </article>
            );
          })}

        <RunwayTransparency
          footer={
            <Button
              className="gap-2 w-full sm:w-auto"
              onClick={() => navigate('/support-runway')}
            >
              <Wallet className="w-4 h-4" />
              Support my Runway
            </Button>
          }
        />

        {/* Closing */}
        <Card className="bg-cyber-surface/60 text-center py-8 px-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
            Keep the conversation open
          </h2>
          <p className="text-sm sm:text-base text-text-secondary max-w-lg mx-auto mb-6 leading-relaxed">
            Questions, corrections, or a different take? Check the public rules,
            or reach out. New thoughts will land here as the forge grows.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center">
            <Button className="gap-2" onClick={() => navigate('/transparency')}>
              Transparency Hub
            </Button>
            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => navigate('/contact')}
            >
              Contact
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate('/support')}
            >
              <Heart className="w-4 h-4" />
              Studio Support
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default FoundersThoughts;
