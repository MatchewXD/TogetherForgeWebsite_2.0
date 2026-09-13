/**
 * Public polls index. Live first, then closed.
 * Staff compose on the Moderation Dashboard, not here.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { supabase } from '../lib/supabase';
import { arePollsEnabled } from '../constants/pollsEnabled';
import {
  POLL_EMPTY_LIVE,
  POLL_INFORM_COPY,
  POLL_PROJECT_TAGS,
  pollsService,
} from '../services/pollsService';
import { useStaffRole } from '../hooks/useStaffRole';
import Card from '../components/ui/Card';
import LoadingScreen from '../components/ui/LoadingScreen';
import PollCard from '../components/polls/PollCard';

export default function Polls() {
  const enabled = arePollsEnabled();
  const { isStaff } = useStaffRole();
  const [user, setUser] = useState(null);
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tag, setTag] = useState('');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUser(data?.user || null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user || null);
    });
    return () => {
      mounted = false;
      data?.subscription?.unsubscribe?.();
    };
  }, []);

  const load = useCallback(async () => {
    if (!enabled) {
      setPolls([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const rows = await pollsService.listPublic({
        viewerUserId: user?.id || null,
      });
      setPolls(rows);
    } catch (err) {
      setError(err?.message || 'Could not load polls.');
      setPolls([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    if (!tag) return polls;
    return polls.filter((p) => p.projectTag === tag);
  }, [polls, tag]);

  const live = visible.filter((p) => p.isLive);
  const closed = visible.filter((p) => !p.isLive);

  if (!enabled) {
    return (
      <div className="min-h-screen bg-cyber-bg text-text-primary">
        <div className="container-custom py-24 max-w-xl">
          <h1 className="text-3xl font-bold text-white">Polls</h1>
          <p className="text-text-secondary mt-4 leading-relaxed">
            Polls are not open on this build.
          </p>
          {isStaff ? (
            <p className="text-sm text-text-muted mt-4">
              Staff can still prepare polls on the{' '}
              <Link to="/moderator?tab=polls" className="text-neon-cyan">
                Moderation Dashboard
              </Link>
              .
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      <header className="relative pt-20 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.08)_0%,transparent_55%)]"
          aria-hidden="true"
        />
        <div className="container-custom relative z-10 py-10 md:py-14">
          <div className="text-center max-w-3xl mx-auto">
            <div className="section-header justify-center">Polls</div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mt-2">
              A short list to pick from
            </h1>
            <p className="text-white/85 mt-4 text-base sm:text-lg leading-relaxed">
              Staff post a directed question with a few options. Accounts pick
              one. {POLL_INFORM_COPY}
            </p>
            {isStaff ? (
              <p className="mt-6 text-sm text-text-muted">
                Create and close polls on the{' '}
                <Link to="/moderator?tab=polls" className="text-neon-cyan">
                  Moderation Dashboard
                </Link>
                . This page is read and vote only.
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="container-custom relative z-10 py-8 md:py-10">
        <div className="flex flex-wrap gap-2 mb-8">
          {POLL_PROJECT_TAGS.map((t) => {
            const value = t.value;
            const active = tag === value;
            return (
              <button
                key={t.label}
                type="button"
                onClick={() => setTag(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono tracking-widest uppercase border ${
                  active
                    ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/10'
                    : 'border-cyber-border text-text-muted hover:border-neon-cyan/40'
                }`}
              >
                {value ? t.label : 'All'}
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="text-sm text-semantic-danger mb-4" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <LoadingScreen variant="section" message="Loading polls…" />
        ) : (
          <div className="space-y-10">
            <section>
              <h2 className="text-sm font-mono tracking-widest uppercase text-text-muted mb-4">
                Live
              </h2>
              {live.length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {live.map((poll) => (
                    <PollCard key={poll.id} poll={poll} />
                  ))}
                </div>
              ) : (
                <Card variant="subtle" className="p-6">
                  <p className="text-text-secondary leading-relaxed">
                    {POLL_EMPTY_LIVE}
                  </p>
                </Card>
              )}
            </section>

            {closed.length ? (
              <section>
                <h2 className="text-sm font-mono tracking-widest uppercase text-text-muted mb-4">
                  Closed
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {closed.map((poll) => (
                    <PollCard key={poll.id} poll={poll} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
