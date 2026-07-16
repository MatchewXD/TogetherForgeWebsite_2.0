/**
 * IdeaDetail — single idea page
 * - Workflow status badges (Proposed / Under Review / Adopted / Archived)
 * - Idea upvoting (fire)
 * - guided_data + legacy structured fields
 * - Threaded comments with likes
 */

import {
  ArrowLeft,
  MessageCircle,
  Flame,
  ExternalLink,
  Hammer,
  Pencil,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import UserAvatar from '../components/ui/UserAvatar';
import ProfileLink from '../components/ui/ProfileLink';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import Card from '../components/ui/Card';
import { ideasService } from '../services/ideasService';
import { tasksService } from '../services/tasksService';
import {
  deriveIdeaStatus,
  getWorkflowStatus,
  extractIdeaFeatures,
  extractIdeaNotes,
  extractIdeaTextSections,
  parseGuidedData,
  parseTags,
  statusChipClasses,
  statusLabel,
} from '../utils/ideaStatus';
import {
  buildGuidedDisplayItems,
  GUIDED_GRID_CLASS,
} from '../utils/guidedLayout';

const IdeaDetail = () => {
  const { id } = useParams();
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [idea, setIdea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');
  const [commentSortMode, setCommentSortMode] = useState('popular');
  const [userCommentVotes, setUserCommentVotes] = useState(new Set());
  const [userVotedIdea, setUserVotedIdea] = useState(false);
  const [voting, setVoting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [collapsed, setCollapsed] = useState(new Set());
  const [linkedProject, setLinkedProject] = useState(null);
  const voteBusyRef = useRef(false);

  const ideaId = Number.parseInt(String(id), 10);

  // Load user + whether they already voted (server truth)
  useEffect(() => {
    let mounted = true;

    const loadAuthAndVotes = async (sessionUser) => {
      if (!mounted) return;
      setUser(sessionUser || null);
      if (!sessionUser) {
        setUserVotedIdea(false);
        setUserCommentVotes(new Set());
        return;
      }
      if (voteBusyRef.current) return;

      try {
        const voted = await ideasService.userHasVoted(ideaId, sessionUser.id);
        if (!mounted || voteBusyRef.current) return;
        console.log('[IdeaDetail] loaded vote state', { ideaId, voted });
        setUserVotedIdea(!!voted);
      } catch (err) {
        console.warn('[IdeaDetail] load vote state failed', err);
        if (mounted && !voteBusyRef.current) setUserVotedIdea(false);
      }

      try {
        const { data: commentLikeRows } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', sessionUser.id);
        if (mounted && commentLikeRows) {
          setUserCommentVotes(
            new Set(commentLikeRows.map((r) => r.comment_id))
          );
        }
      } catch {
        /* optional */
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      loadAuthAndVotes(session?.user || null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserVotedIdea(false);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        loadAuthAndVotes(session?.user || null);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [ideaId]);

  // Load idea + live vote count from votes table
  useEffect(() => {
    let mounted = true;
    const fetchIdea = async () => {
      if (!Number.isFinite(ideaId)) {
        if (mounted) {
          setIdea(null);
          setLoading(false);
        }
        return;
      }
      try {
        const data = await ideasService.getIdeaWithCreator(ideaId);
        if (!mounted) return;
        if (data) {
          let votes = Math.max(0, Number(data.votes) || 0);
          try {
            const live = await ideasService.getIdeaVoteCount(data.id ?? ideaId);
            if (typeof live === 'number') votes = Math.max(0, live);
          } catch {
            /* keep denormalized */
          }
          console.log('[IdeaDetail] loaded idea', {
            id: data.id,
            votes,
            hasGuided: !!data.guided_data,
          });
          setIdea({ ...data, votes });
        } else {
          setIdea({
            id: ideaId,
            title: 'Idea not found',
            summary: 'This idea does not exist or could not be loaded.',
            category: 'Unknown',
            votes: 0,
            status: 'Proposed',
            creator: null,
          });
        }
      } catch (err) {
        console.error('[IdeaDetail] fetchIdea', err);
        if (!mounted) return;
        setIdea({
          id: ideaId,
          title: 'Idea not found',
          summary: 'This idea does not exist or could not be loaded.',
          category: 'Unknown',
          votes: 0,
          status: 'Proposed',
          creator: null,
        });
      }
      if (mounted) setLoading(false);
    };
    fetchIdea();
    return () => {
      mounted = false;
    };
  }, [ideaId]);

  // Resolve project_id → workspace
  useEffect(() => {
    let cancelled = false;
    const resolveProject = async () => {
      const raw = idea?.project_id || idea?.projectId || null;
      if (!raw) {
        setLinkedProject(null);
        return;
      }
      const key = String(raw).trim();
      try {
        const bySlug = await tasksService.getProjectBySlug(key);
        if (!cancelled && bySlug) {
          setLinkedProject({
            slug: bySlug.slug || key,
            title: bySlug.title || bySlug.slug || key,
          });
          return;
        }
      } catch {
        /* fall through */
      }

      try {
        const { data } = await supabase
          .from('projects')
          .select('slug, title, id')
          .eq('id', key)
          .maybeSingle();
        if (!cancelled && data) {
          setLinkedProject({
            slug: data.slug || key,
            title: data.title || data.slug || key,
          });
          return;
        }
      } catch {
        /* fall through */
      }

      if (!cancelled) {
        setLinkedProject({ slug: key, title: key });
      }
    };
    resolveProject();
    return () => {
      cancelled = true;
    };
  }, [idea?.project_id, idea?.projectId]);

  const projectPath = useMemo(() => {
    if (!linkedProject?.slug) return null;
    return `/projects/${linkedProject.slug}`;
  }, [linkedProject]);

  const tags = useMemo(() => parseTags(idea?.tags), [idea?.tags]);

  const chipStatus = useMemo(
    () => (idea ? deriveIdeaStatus(idea) : 'Proposed'),
    [idea]
  );
  const workflowStatus = useMemo(
    () => (idea ? getWorkflowStatus(idea) : 'Proposed'),
    [idea]
  );

  /**
   * Additional Details content from guided_data + legacy flat columns.
   * Robust parsing so edit-visible data also shows on detail.
   * Wrapped in try/catch so bad JSON never blanks the whole page.
   */
  const guidedGroups = useMemo(() => {
    const empty = { features: [], texts: [], notes: [], all: [] };
    if (!idea) return empty;
    try {
      // Ensure guided_data is parseable (also used by extractors)
      parseGuidedData(idea.guided_data);
      const features = extractIdeaFeatures(idea);
      const notes = extractIdeaNotes(idea);
      const textSections = extractIdeaTextSections(idea);
      return buildGuidedDisplayItems({
        features,
        textSections,
        notes,
      });
    } catch (err) {
      console.error('[IdeaDetail] guidedGroups', err);
      return empty;
    }
  }, [idea]);

  const hasAdditionalDetails =
    (guidedGroups?.features?.length || 0) > 0 ||
    (guidedGroups?.texts?.length || 0) > 0 ||
    (guidedGroups?.notes?.length || 0) > 0;

  const textOrNull = (v) => {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s || s === '[]' || s === '{}') return null;
    return s;
  };

  const renderDetailCard = (item) => (
    <Card
      key={item.key}
      className={`bg-cyber-card/80 min-w-0 flex flex-col h-full ${item.gridClass || item.spanClass || ''}`}
    >
      <div className="font-mono text-xs sm:text-sm tracking-widest text-neon-cyan mb-3 uppercase break-words">
        {item.label}
      </div>
      {item.kind === 'feature' &&
        item.title &&
        item.body !== item.title && (
          <h4 className="font-semibold text-white mb-2 break-words">
            {item.title}
          </h4>
        )}
      <p className="text-sm sm:text-base text-text-secondary whitespace-pre-wrap break-words leading-relaxed flex-1">
        {item.body}
      </p>
    </Card>
  );

  const fetchComments = useCallback(async () => {
    try {
      const enriched = await ideasService.getCommentsWithProfiles(ideaId);
      setComments(enriched || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  }, [ideaId]);

  useEffect(() => {
    if (ideaId) fetchComments();
  }, [ideaId, fetchComments]);

  const handleIdeaVote = async () => {
    if (!user) {
      setMessage('Sign in to vote on ideas.');
      return;
    }
    if (voting || voteBusyRef.current || !idea) return;

    voteBusyRef.current = true;
    setVoting(true);
    console.log('[IdeaDetail] vote click', {
      ideaId,
      beforeVoted: userVotedIdea,
      beforeCount: idea.votes,
    });

    try {
      // Single server round-trip: insert or delete + recount
      const { voted, votes } = await ideasService.toggleVote(ideaId, user.id);
      console.log('[IdeaDetail] vote server result', { voted, votes });
      setUserVotedIdea(!!voted);
      setIdea((prev) =>
        prev ? { ...prev, votes: Math.max(0, Number(votes) || 0) } : prev
      );
    } catch (err) {
      console.error('[IdeaDetail] vote failed', err);
      setMessage(err?.message || 'Could not update vote.');
      // Reload truth from server so UI is not stuck
      try {
        const [voted, votes] = await Promise.all([
          ideasService.userHasVoted(ideaId, user.id),
          ideasService.getIdeaVoteCount(ideaId),
        ]);
        setUserVotedIdea(!!voted);
        setIdea((prev) =>
          prev ? { ...prev, votes: Math.max(0, Number(votes) || 0) } : prev
        );
      } catch {
        /* keep prior UI */
      }
    } finally {
      voteBusyRef.current = false;
      setVoting(false);
    }
  };

  const postComment = async () => {
    if (!comment.trim() || !user) return;

    const { error } = await supabase.from('comments').insert({
      idea_id: ideaId,
      user_id: user.id,
      content: comment.trim(),
    });

    if (!error) {
      setComment('');
      fetchComments();
    } else {
      setMessage(error.message);
    }
  };

  const postReply = async () => {
    if (!replyText.trim() || !user || !replyTo) return;
    const { error } = await supabase.from('comments').insert({
      idea_id: ideaId,
      user_id: user.id,
      content: replyText.trim(),
      parent_id: replyTo.id,
    });
    if (!error) {
      setReplyText('');
      setReplyTo(null);
      fetchComments();
    } else {
      setMessage(error.message);
    }
  };

  const toggleCollapse = (cid) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid);
      else next.add(cid);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="pt-20 min-h-screen flex items-center justify-center text-text-secondary">
        Loading idea...
      </div>
    );
  }

  if (!idea) {
    return (
      <div className="pt-20 min-h-screen text-center text-text-secondary">
        Idea not found.
      </div>
    );
  }

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.04)_0%,transparent_50%)]"
        aria-hidden="true"
      />

      <div className="container-custom relative z-10 py-12 max-w-4xl">
        <Link
          to="/ideas"
          className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group transition-colors"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
          BACK TO IDEAS
        </Link>

        {message && (
          <div
            role="status"
            className="mb-6 rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 px-4 py-3 text-sm text-text-secondary flex justify-between gap-3"
          >
            <span>{message}</span>
            <button
              type="button"
              className="text-neon-cyan text-xs font-mono shrink-0"
              onClick={() => setMessage('')}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {idea.category && (
              <Badge variant="default" className="!normal-case tracking-wide">
                {idea.category}
              </Badge>
            )}
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono tracking-wide border ${statusChipClasses(
                workflowStatus
              )}`}
            >
              {statusLabel(workflowStatus)}
            </span>
            {chipStatus !== workflowStatus && chipStatus === 'Linked' && (
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono tracking-wide border ${statusChipClasses(
                  'Linked'
                )}`}
              >
                Linked
              </span>
            )}
            {(chipStatus === 'Hot' || chipStatus === 'Promising') && (
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono tracking-wide border ${statusChipClasses(
                  chipStatus
                )}`}
              >
                {statusLabel(chipStatus)}
              </span>
            )}
            {linkedProject && (
              <Badge variant="purple" className="!normal-case tracking-wide">
                Project · {linkedProject.title}
              </Badge>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-4 break-words">
                {idea.title}
              </h1>
              <p className="text-lg sm:text-xl text-text-secondary leading-relaxed break-words whitespace-pre-wrap">
                {idea.summary}
              </p>
            </div>

            {/* Vote + owner actions */}
            <div className="flex sm:flex-col items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                className="gap-2 min-w-[5.5rem]"
                disabled={voting}
                onClick={handleIdeaVote}
                aria-pressed={userVotedIdea}
                title={userVotedIdea ? 'Remove vote' : 'Vote for this idea'}
              >
                <Flame
                  className={`w-4 h-4 ${
                    userVotedIdea
                      ? 'text-orange-500 fill-orange-500/30'
                      : 'text-slate-400'
                  }`}
                />
                <span
                  className={`font-mono tabular-nums ${
                    userVotedIdea ? 'text-orange-400' : 'text-text-secondary'
                  }`}
                >
                  {Number(idea.votes) > 0 ? idea.votes : 0}
                </span>
              </Button>
              {user && idea.user_id === user.id && (
                <Link
                  to={`/ideas/${ideaId}/edit`}
                  className="inline-flex items-center gap-1.5 text-xs font-mono tracking-widest text-neon-cyan hover:text-white border border-neon-cyan/40 px-3 py-2 rounded-lg"
                >
                  <Pencil className="w-3.5 h-3.5" /> EDIT
                </Link>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-neon-cyan min-w-0">
            <div className="inline-flex items-center gap-3 min-w-0">
              <UserAvatar
                src={idea.creator?.avatar_url || idea.creator?.avatarUrl}
                name={idea.creator?.username || 'Community'}
                username={idea.creator?.username}
                size="md"
              />
              <div className="min-w-0">
                <div className="text-[10px] font-mono tracking-widest text-text-muted uppercase">
                  Submitted by
                </div>
                <div className="truncate text-text-primary">
                  <ProfileLink username={idea.creator?.username}>
                    {idea.creator?.username || 'Community'}
                  </ProfileLink>
                </div>
              </div>
            </div>
            {projectPath && (
              <Link
                to={projectPath}
                className="inline-flex items-center gap-2 rounded-lg border border-neon-cyan/40 bg-cyber-surface/80 px-3 py-2 text-sm text-neon-cyan hover:bg-neon-cyan/10 hover:border-neon-cyan transition-colors"
              >
                <Hammer className="w-4 h-4 shrink-0" />
                <span className="font-mono tracking-wide">View Project</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70" />
              </Link>
            )}
          </div>

          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="px-3 py-1 text-xs rounded-full bg-white/5 border border-white/10 text-white/80 font-mono"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Description */}
        {textOrNull(idea.description) && (
          <Card className="mb-8 bg-cyber-card/80 w-full">
            <div className="font-mono text-sm tracking-widest text-neon-cyan mb-3">
              DESCRIPTION
            </div>
            <p className="text-text-secondary whitespace-pre-wrap break-words leading-relaxed text-base sm:text-lg">
              {idea.description}
            </p>
          </Card>
        )}

        {/* Additional details: subsections + auto-fit card grid */}
        {hasAdditionalDetails && (
          <section
            className="mb-10 max-w-5xl mx-auto"
            aria-labelledby="additional-details-heading"
          >
            <div className="section-header mb-8 w-full flex flex-col items-center text-center">
              Additional Details
            </div>
            <h2 id="additional-details-heading" className="sr-only">
              Additional Details
            </h2>

            <div className="space-y-10">
              {guidedGroups.features.length > 0 && (
                <div>
                  <h3 className="font-mono text-sm tracking-widest uppercase text-neon-cyan mb-4 text-center sm:text-left">
                    Key Features
                  </h3>
                  <div className={GUIDED_GRID_CLASS}>
                    {guidedGroups.features.map(renderDetailCard)}
                  </div>
                </div>
              )}

              {guidedGroups.texts.length > 0 && (
                <div>
                  {guidedGroups.features.length > 0 && (
                    <h3 className="font-mono text-sm tracking-widest uppercase text-text-muted mb-4 text-center sm:text-left">
                      Other details
                    </h3>
                  )}
                  <div className={GUIDED_GRID_CLASS}>
                    {guidedGroups.texts.map(renderDetailCard)}
                  </div>
                </div>
              )}

              {guidedGroups.notes.length > 0 && (
                <div>
                  <h3 className="font-mono text-sm tracking-widest uppercase text-neon-cyan mb-4 text-center sm:text-left">
                    Additional Notes
                  </h3>
                  <div className={GUIDED_GRID_CLASS}>
                    {guidedGroups.notes.map(renderDetailCard)}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Discussion */}
        <section className="border-t border-white/10 pt-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="font-mono tracking-widest text-sm text-neon-cyan flex items-center gap-2">
              <MessageCircle className="w-5 h-5" /> DISCUSSION THREAD
            </div>
            <select
              value={commentSortMode}
              onChange={(e) => setCommentSortMode(e.target.value)}
              className="bg-cyber-surface border border-cyber-border px-3 py-2 text-xs text-white rounded-lg w-full sm:w-auto"
              aria-label="Sort comments"
            >
              <option value="popular">Most Popular</option>
              <option value="likes">Most Likes</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>

          <div className="space-y-4 mb-8">
            {comments.length === 0 && (
              <p className="text-text-muted text-sm">
                No comments yet. Start the discussion below.
              </p>
            )}
            {(() => {
              const now = Date.now();
              const DECAY = 0.0000005;
              const topLevel = comments.filter((c) => !c.parent_id);
              const childrenMap = {};
              comments.forEach((c) => {
                if (c.parent_id) {
                  (childrenMap[c.parent_id] ||= []).push(c);
                }
              });

              const sortFn = (a, b) => {
                if (commentSortMode === 'popular') {
                  const va =
                    (a.votes || 0) *
                    Math.exp(
                      -DECAY *
                        (now -
                          (a.created_at ? Date.parse(a.created_at) : now))
                    );
                  const vb =
                    (b.votes || 0) *
                    Math.exp(
                      -DECAY *
                        (now -
                          (b.created_at ? Date.parse(b.created_at) : now))
                    );
                  return vb - va;
                }
                if (commentSortMode === 'likes')
                  return (b.votes || 0) - (a.votes || 0);
                if (commentSortMode === 'newest')
                  return new Date(b.created_at) - new Date(a.created_at);
                return new Date(a.created_at) - new Date(b.created_at);
              };

              const renderComment = (c, depth = 0) => {
                const replies = (childrenMap[c.id] || []).sort(sortFn);
                const isCollapsed = collapsed.has(c.id);
                return (
                  <div
                    key={c.id}
                    className="bg-cyber-surface/60 p-4 rounded-xl border border-cyber-border"
                    style={{ marginLeft: Math.min(depth * 16, 64) + 'px' }}
                  >
                    <div className="flex items-center gap-2 text-sm text-neon-cyan mb-1 min-w-0">
                      <UserAvatar
                        src={
                          c.profiles?.avatar_url || c.profiles?.avatarUrl
                        }
                        name={c.profiles?.username || 'Anonymous'}
                        username={c.profiles?.username}
                        size="sm"
                      />
                      <ProfileLink
                        username={c.profiles?.username}
                        className="truncate min-w-0 text-text-primary"
                      >
                        {c.profiles?.username || 'Anonymous'}
                      </ProfileLink>
                      <button
                        type="button"
                        onClick={() => toggleCollapse(c.id)}
                        className="ml-auto text-[10px] text-text-muted hover:text-white shrink-0"
                      >
                        {isCollapsed ? 'Expand' : 'Collapse'}
                      </button>
                    </div>
                    {!isCollapsed && (
                      <>
                        <div className="text-white text-sm leading-relaxed">
                          {c.content}
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-text-muted mt-2">
                          <span>
                            {new Date(c.created_at).toLocaleString()}
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!user) {
                                  setMessage('Sign in to like comments.');
                                  return;
                                }
                                const liked = userCommentVotes.has(c.id);
                                if (liked) {
                                  setComments((prev) =>
                                    prev.map((x) =>
                                      x.id === c.id
                                        ? {
                                            ...x,
                                            votes: Math.max(
                                              0,
                                              (x.votes || 0) - 1
                                            ),
                                          }
                                        : x
                                    )
                                  );
                                  setUserCommentVotes((prev) => {
                                    const n = new Set(prev);
                                    n.delete(c.id);
                                    return n;
                                  });
                                  await supabase
                                    .from('comment_likes')
                                    .delete()
                                    .eq('comment_id', c.id)
                                    .eq('user_id', user.id);
                                } else {
                                  setComments((prev) =>
                                    prev.map((x) =>
                                      x.id === c.id
                                        ? {
                                            ...x,
                                            votes: (x.votes || 0) + 1,
                                          }
                                        : x
                                    )
                                  );
                                  setUserCommentVotes((prev) =>
                                    new Set(prev).add(c.id)
                                  );
                                  await supabase
                                    .from('comment_likes')
                                    .insert([
                                      {
                                        comment_id: c.id,
                                        user_id: user.id,
                                      },
                                    ]);
                                }
                              }}
                              className="flex items-center gap-1 hover:text-white"
                              title={
                                userCommentVotes.has(c.id)
                                  ? 'Remove like'
                                  : 'Like'
                              }
                            >
                              <Flame
                                className={`w-4 h-4 ${
                                  userCommentVotes.has(c.id)
                                    ? 'text-orange-500'
                                    : 'text-text-muted'
                                }`}
                              />
                              <span>{c.votes || 0}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReplyTo({
                                  id: c.id,
                                  username:
                                    c.profiles?.username || 'User',
                                });
                                setReplyText('');
                              }}
                              className="hover:text-white"
                            >
                              Reply
                            </button>
                          </div>
                        </div>
                        {replyTo && replyTo.id === c.id && (
                          <div className="mt-3 pl-4 border-l border-white/10">
                            <div className="text-xs text-neon-cyan mb-1">
                              Replying to @{replyTo.username}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                className="flex-1 bg-cyber-surface border border-cyber-border px-3 py-2 text-sm text-white rounded-lg"
                                placeholder="Write a reply..."
                                value={replyText}
                                onChange={(e) =>
                                  setReplyText(e.target.value)
                                }
                                onKeyDown={(e) =>
                                  e.key === 'Enter' && postReply()
                                }
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={postReply}>
                                  Send
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setReplyTo(null);
                                    setReplyText('');
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {!isCollapsed && replies.length > 0 && (
                      <div className="mt-3 space-y-3 border-l border-white/10 pl-4">
                        {replies.map((r) => renderComment(r, depth + 1))}
                      </div>
                    )}
                  </div>
                );
              };

              return topLevel.sort(sortFn).map((c) => renderComment(c));
            })()}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                user ? 'Write a comment…' : 'Log in to comment'
              }
              className="flex-1 bg-cyber-surface border border-cyber-border px-5 py-4 text-white focus:border-neon-cyan outline-none rounded-lg"
              onKeyDown={(e) => e.key === 'Enter' && postComment()}
              disabled={!user}
            />
            <Button
              onClick={postComment}
              disabled={!user}
              className="sm:px-8 disabled:opacity-50"
            >
              Post
            </Button>
          </div>
          {!user && (
            <p className="text-xs text-text-muted mt-2">
              You must be logged in to post comments.{' '}
              <Link to="/profile" className="text-neon-cyan hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </section>
      </div>
    </div>
  );
};

export default IdeaDetail;
