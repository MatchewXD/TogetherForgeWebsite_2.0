/**
 * Public poll detail: read, vote, totals. No comments. No compose.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { supabase } from '../lib/supabase';
import { arePollsEnabled } from '../constants/pollsEnabled';
import {
  pollManagePath,
  pollsService,
  projectTagLabel,
} from '../services/pollsService';
import { useStaffRole } from '../hooks/useStaffRole';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import Card from '../components/ui/Card';
import LoadingScreen from '../components/ui/LoadingScreen';
import PollVotePanel from '../components/polls/PollVotePanel';

export default function PollDetail() {
  const { pollId } = useParams();
  const enabled = arePollsEnabled();
  const { isStaff } = useStaffRole();
  const [user, setUser] = useState(null);
  const [poll, setPoll] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

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
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const row = await pollsService.getById(pollId, {
        viewerUserId: user?.id || null,
      });
      setPoll(row);
      setSelectedId(row?.myOptionId || null);
    } catch (err) {
      setError(err?.message || 'Could not load poll.');
      setPoll(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, pollId, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const vote = async (optionId) => {
    if (!user?.id || !optionId) return;
    setBusy(true);
    setError('');
    try {
      const next = await pollsService.vote(pollId, optionId, user.id);
      setPoll(next);
      setSelectedId(next?.myOptionId || optionId);
      setToast('Vote saved.');
      window.setTimeout(() => setToast(''), 4000);
    } catch (err) {
      setError(err?.message || 'Could not save your vote.');
    } finally {
      setBusy(false);
    }
  };

  if (!enabled) {
    return (
      <div className="min-h-screen bg-cyber-bg text-text-primary">
        <div className="container-custom py-24 max-w-xl">
          <h1 className="text-3xl font-bold text-white">Polls</h1>
          <p className="text-text-secondary mt-4">
            Polls are not open on this build.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingScreen message="Loading poll…" />;
  }

  if (!poll) {
    return (
      <div className="min-h-screen bg-cyber-bg text-text-primary">
        <div className="container-custom py-24 max-w-xl">
          <h1 className="text-3xl font-bold text-white">Poll not found</h1>
          <p className="text-text-secondary mt-4">
            {error || 'This poll is missing or still a draft.'}
          </p>
          <Button to="/polls" variant="secondary" className="mt-6">
            Back to Polls
          </Button>
        </div>
      </div>
    );
  }

  const tag = projectTagLabel(poll.projectTag);

  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      <div className="container-custom py-10 md:py-14 max-w-3xl">
        <Link
          to="/polls"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-neon-cyan mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Polls
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            {poll.title}
          </h1>
          <Badge
            variant={poll.isLive ? 'neon' : 'success'}
            className="!normal-case"
          >
            {poll.isLive ? 'Live' : 'Closed'}
          </Badge>
        </div>
        {tag ? (
          <p className="text-xs font-mono text-neon-cyan mb-3">{tag}</p>
        ) : null}
        {poll.context ? (
          <p className="text-text-secondary leading-relaxed mb-6">
            {poll.context}
          </p>
        ) : null}

        {isStaff ? (
          <p className="text-sm mb-6">
            <Link to={pollManagePath(poll.id)} className="text-neon-cyan">
              Manage
            </Link>
          </p>
        ) : null}

        {toast ? (
          <p className="text-sm text-semantic-success mb-4">{toast}</p>
        ) : null}
        {error ? (
          <p className="text-sm text-semantic-danger mb-4" role="alert">
            {error}
          </p>
        ) : null}

        <Card variant="subtle" className="p-5 sm:p-6">
          <PollVotePanel
            poll={poll}
            user={user}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onVote={vote}
            busy={busy}
            canVote={enabled}
          />
        </Card>
      </div>
    </div>
  );
}
