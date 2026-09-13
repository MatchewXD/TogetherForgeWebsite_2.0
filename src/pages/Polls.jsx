/**
 * Public polls index. Live first, then closed collapsed.
 * Staff compose on the dashboard, not here.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { supabase } from '../lib/supabase';
import { arePollsEnabled } from '../constants/pollsEnabled';
import {
  POLL_EMPTY_LIVE,
  POLL_HEADER_BODY,
  POLL_HEADER_SUBTITLE,
  POLL_HEADER_TITLE,
  POLL_LIVE_HOLD_MS,
  POLL_PROJECT_TAGS,
  isHeldOnLiveIndex,
  isPollLive,
  pollClosedAtMs,
  pollsService,
} from '../services/pollsService';
import Card from '../components/ui/Card';
import LoadingScreen from '../components/ui/LoadingScreen';
import PollCard from '../components/polls/PollCard';

export default function Polls() {
  const enabled = arePollsEnabled();
  const [user, setUser] = useState(null);
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tag, setTag] = useState('');
  const [closedOpen, setClosedOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

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

  useEffect(() => {
    const waits = polls
      .filter((p) => isHeldOnLiveIndex(p) && !isPollLive(p))
      .map((p) => {
        const closedAt = pollClosedAtMs(p);
        if (closedAt == null) return null;
        return POLL_LIVE_HOLD_MS - (Date.now() - closedAt);
      })
      .filter((ms) => ms != null && ms > 0);
    if (!waits.length) return undefined;
    const id = window.setTimeout(
      () => setNowMs(Date.now()),
      Math.min(...waits) + 50
    );
    return () => window.clearTimeout(id);
  }, [polls, nowMs]);

  const visible = useMemo(() => {
    if (!tag) return polls;
    return polls.filter((p) => p.projectTag === tag);
  }, [polls, tag]);

  const live = visible.filter((p) => isHeldOnLiveIndex(p, nowMs));
  const closed = visible.filter((p) => !isHeldOnLiveIndex(p, nowMs));

  if (!enabled) {
    return (
      <div className="min-h-screen bg-cyber-bg text-text-primary">
        <div className="container-custom py-24 max-w-xl">
          <h1 className="text-3xl font-bold text-white">{POLL_HEADER_TITLE}</h1>
          <p className="text-text-secondary mt-4 leading-relaxed">
            Polls are not open on this build.
          </p>
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
            <h1 className="section-header section-header--centered dashboard-page-title !mb-8 !text-4xl sm:!text-5xl !font-bold !tracking-tight !normal-case mx-auto">
              {POLL_HEADER_TITLE}
            </h1>
            <p className="text-xl sm:text-2xl text-white/90 mt-3 font-semibold tracking-tight">
              {POLL_HEADER_SUBTITLE}
            </p>
            <p className="text-white/85 mt-4 text-base sm:text-lg leading-relaxed">
              {POLL_HEADER_BODY}
            </p>
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
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neon-cyan mb-4">
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
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 text-left"
                  aria-expanded={closedOpen}
                  onClick={() => setClosedOpen((v) => !v)}
                >
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight text-semantic-success">
                    Closed polls ({closed.length})
                  </span>
                  <ChevronDown
                    className={`w-6 h-6 shrink-0 text-semantic-success transition-transform ${
                      closedOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden
                  />
                </button>
                {closedOpen ? (
                  <div className="grid gap-4 sm:grid-cols-2 mt-4">
                    {closed.map((poll) => (
                      <PollCard key={poll.id} poll={poll} />
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
