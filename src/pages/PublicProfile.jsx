/**
 * Public profile at /u/:username (and /profile/:username).
 * Public fields only. Own-account editing stays on /profile and /profile/edit.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Lightbulb,
  CheckCircle2,
  ListTodo,
  Calendar,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { supabase } from '../lib/supabase';
import UserAvatar from '../components/ui/UserAvatar';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

/** Columns safe to show publicly (no email). moderation_status is checked then stripped. */
const PUBLIC_PROFILE_SELECT = [
  'id',
  'username',
  'avatar_url',
  'banner_url',
  'bio',
  'interests',
  'favorite_games',
  'favorite_game_types',
  'discord',
  'youtube',
  'twitch',
  'x_handle',
  'signature',
  'joined_at',
  'moderation_status',
].join(', ');

const chip = (text) =>
  (text || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

const PublicProfile = () => {
  const { username: rawUsername } = useParams();
  const username = rawUsername ? decodeURIComponent(rawUsername) : '';

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({
    ideas: 0,
    tasksCompleted: 0,
    tasksActive: 0,
  });
  const [recentIdeas, setRecentIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [viewerId, setViewerId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setViewerId(session?.user?.id || null);
    });
  }, []);

  // Always land at top when opening or switching public profiles
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [username]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!username) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      setNotFound(false);

      // Case-insensitive username match when possible
      let { data, error } = await supabase
        .from('profiles')
        .select(PUBLIC_PROFILE_SELECT)
        .ilike('username', username)
        .maybeSingle();

      if (error) {
        // Fallback exact match without optional columns (e.g. no banner_url)
        const fallback = await supabase
          .from('profiles')
          .select(
            'id, username, avatar_url, bio, interests, favorite_games, favorite_game_types, discord, youtube, twitch, x_handle, signature, joined_at'
          )
          .ilike('username', username)
          .maybeSingle();
        data = fallback.data;
        error = fallback.error;
      }

      if (!mounted) return;

      if (error || !data) {
        setNotFound(true);
        setProfile(null);
        setLoading(false);
        return;
      }

      // Reject banned accounts from public view if status present
      if (data.moderation_status === 'banned') {
        setNotFound(true);
        setProfile(null);
        setLoading(false);
        return;
      }

      // Never expose moderation fields in UI state
      const { moderation_status: _ms, moderation_note: _mn, email: _e, ...publicRow } =
        data;
      setProfile(publicRow);

      // Contribution highlights (best-effort; tables may be empty)
      const [ideasRes, completedRes, activeRes, recentRes] = await Promise.all([
        supabase
          .from('ideas')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', data.id),
        supabase
          .from('task_claims')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', data.id)
          .eq('status', 'Completed'),
        supabase
          .from('task_claims')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', data.id)
          .eq('status', 'Active'),
        supabase
          .from('ideas')
          .select('id, title, votes, created_at, status')
          .eq('user_id', data.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      if (!mounted) return;

      setStats({
        ideas: ideasRes.count ?? 0,
        tasksCompleted: completedRes.count ?? 0,
        tasksActive: activeRes.count ?? 0,
      });
      setRecentIdeas(recentRes.data || []);
      setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, [username]);

  if (loading) {
    return (
      <div className="pt-28 min-h-screen text-center text-text-muted font-mono text-sm tracking-widest uppercase">
        Loading profile…
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="pt-20 min-h-screen bg-cyber-bg">
        <div className="container-custom py-12 max-w-3xl">
          <Link
            to="/ideas"
            className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8"
          >
            <ArrowLeft className="w-4 h-4" /> BACK
          </Link>
          <Card className="bg-cyber-card/80 text-center py-12">
            <h1 className="text-2xl font-bold text-white mb-2">
              Profile not found
            </h1>
            <p className="text-text-secondary text-sm">
              That username may not exist or is not public.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const isOwn = viewerId && profile.id === viewerId;
  const memberYear = profile.joined_at
    ? new Date(profile.joined_at).getFullYear()
    : null;

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.04)_0%,transparent_50%)]"
        aria-hidden="true"
      />

      <div className="container-custom relative z-10 py-12 max-w-5xl">
        <Link
          to="/ideas"
          className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />{' '}
          BACK
        </Link>

        {/* Banner + identity */}
        <div className="relative mb-8">
          <div className="h-40 sm:h-48 w-full rounded-xl overflow-hidden bg-cyber-surface border border-cyber-border">
            {profile.banner_url ? (
              <img
                src={profile.banner_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[radial-gradient(circle_at_center,rgba(0,249,255,0.08)_0%,transparent_70%)]" />
            )}
          </div>
          <div className="-mt-14 sm:-mt-16 ml-4 sm:ml-6 relative z-10 flex flex-col sm:flex-row sm:items-end gap-4">
            <UserAvatar
              src={profile.avatar_url}
              name={profile.username}
              username={profile.username}
              linkProfile={false}
              size="xl"
              className="!w-28 !h-28 ring-4 ring-cyber-bg"
              borderClass="border-0"
              alt={`${profile.username}'s avatar`}
            />
            <div className="mb-1 sm:mb-2 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white truncate">
                  {profile.username}
                </h1>
                {isOwn && <Badge variant="neon">You</Badge>}
              </div>
              {memberYear && (
                <p className="text-xs text-text-muted font-mono mt-1 inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Member since {memberYear}
                </p>
              )}
            </div>
            {isOwn && (
              <div className="self-start sm:self-auto flex flex-wrap gap-2">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center justify-center px-4 py-2 text-sm rounded-lg border border-neon-cyan/40 bg-neon-cyan/5 text-neon-cyan hover:border-neon-cyan transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  to="/profile"
                  className="inline-flex items-center justify-center px-4 py-2 text-sm rounded-lg border border-cyber-border bg-cyber-surface text-text-primary hover:border-neon-cyan transition-colors"
                >
                  Edit profile
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Contribution stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="bg-cyber-card/80 text-center py-5">
            <Lightbulb className="w-5 h-5 text-neon-cyan mx-auto mb-2" />
            <div className="text-2xl font-mono font-bold text-neon-cyan">
              {stats.ideas}
            </div>
            <div className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
              Ideas submitted
            </div>
          </Card>
          <Card className="bg-cyber-card/80 text-center py-5">
            <CheckCircle2 className="w-5 h-5 text-neon-purple mx-auto mb-2" />
            <div className="text-2xl font-mono font-bold text-white">
              {stats.tasksCompleted}
            </div>
            <div className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
              Tasks completed
            </div>
          </Card>
          <Card className="bg-cyber-card/80 text-center py-5">
            <ListTodo className="w-5 h-5 text-neon-magenta mx-auto mb-2" />
            <div className="text-2xl font-mono font-bold text-white">
              {stats.tasksActive}
            </div>
            <div className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
              Active claims
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-4 space-y-6">
            <Card className="bg-cyber-card/80">
              <div className="font-mono tracking-widest text-xs text-neon-cyan mb-3">
                LINKS
              </div>
              <div className="space-y-2 text-sm">
                {profile.discord && (
                  <div className="text-text-secondary">
                    Discord:{' '}
                    <span className="text-white">{profile.discord}</span>
                  </div>
                )}
                {profile.youtube && (
                  <a
                    href={`https://youtube.com/@${String(profile.youtube).replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-neon-cyan hover:underline"
                  >
                    YouTube
                  </a>
                )}
                {profile.twitch && (
                  <a
                    href={`https://twitch.tv/${profile.twitch}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-neon-cyan hover:underline"
                  >
                    Twitch
                  </a>
                )}
                {profile.x_handle && (
                  <a
                    href={`https://x.com/${String(profile.x_handle).replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-neon-cyan hover:underline"
                  >
                    X
                  </a>
                )}
                {!profile.discord &&
                  !profile.youtube &&
                  !profile.twitch &&
                  !profile.x_handle && (
                    <div className="text-text-muted">No public links set.</div>
                  )}
              </div>
            </Card>

            {(profile.signature || '').trim() && (
              <Card className="bg-cyber-card/80">
                <div className="font-mono tracking-widest text-xs text-neon-cyan mb-3">
                  SIGNATURE
                </div>
                <div className="text-sm text-text-secondary whitespace-pre-wrap">
                  {profile.signature}
                </div>
              </Card>
            )}
          </div>

          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-cyber-card/80">
              <div className="font-mono tracking-widest text-xs text-neon-cyan mb-3">
                BIO
              </div>
              {profile.bio ? (
                <div className="prose prose-invert max-w-none text-sm sm:text-base">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {profile.bio}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-text-muted text-sm">No bio yet.</p>
              )}
            </Card>

            {[
              { label: 'INTERESTS', key: 'interests' },
              { label: 'FAVORITE GAMES', key: 'favorite_games' },
              { label: 'FAVORITE GAME TYPES', key: 'favorite_game_types' },
            ].map(({ label, key }) => {
              const items = chip(profile[key]);
              if (!items.length) return null;
              return (
                <Card key={key} className="bg-cyber-card/80">
                  <div className="font-mono tracking-widest text-xs text-neon-cyan mb-4">
                    {label}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map((t, i) => (
                      <span
                        key={`${t}-${i}`}
                        className="px-3 py-1 text-sm rounded border border-cyber-border bg-cyber-surface/60"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </Card>
              );
            })}

            <Card className="bg-cyber-card/80">
              <div className="font-mono tracking-widest text-xs text-neon-cyan mb-4">
                RECENT IDEAS
              </div>
              {recentIdeas.length === 0 ? (
                <p className="text-text-muted text-sm">No public ideas yet.</p>
              ) : (
                <ul className="divide-y divide-cyber-border">
                  {recentIdeas.map((idea) => (
                    <li key={idea.id}>
                      <Link
                        to={`/ideas/${idea.id}`}
                        className="flex justify-between gap-3 py-3 text-sm group"
                      >
                        <span className="text-white group-hover:text-neon-cyan transition-colors truncate">
                          {idea.title}
                        </span>
                        <span className="text-xs font-mono text-text-muted shrink-0">
                          {idea.votes ?? 0} votes
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicProfile;
