/**
 * Community Showcase — approved fan / community content.
 * Official studio videos: /media
 * Route: /showcase
 * Submit: /showcase/submit | Moderators: /showcase/moderate
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Film,
  Users,
  ArrowRight,
  ExternalLink,
  Play,
  Radio,
  Image as ImageIcon,
  FileText,
  Send,
  Shield,
  Flame,
  Loader2,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import UserAvatar from '../components/ui/UserAvatar';
import ProfileLink from '../components/ui/ProfileLink';
import ShowcaseLinkPreview from '../components/showcase/ShowcaseLinkPreview';
import { useIsModerator } from '../hooks/useIsModerator';
import { supabase } from '../lib/supabase';
import { linkHostname } from '../services/linkPreviewService';
import {
  listApprovedShowcasePosts,
  filterGroupsPresentInPosts,
  sortShowcasePosts,
  showcaseHref,
  showcaseThumb,
  SHOWCASE_FILTER_GROUPS,
  SHOWCASE_SORT_OPTIONS,
  getUserLikedShowcasePostIds,
  toggleShowcaseLike,
  isShowcasePostUuid,
  normalizeCredit,
  officialProjectsPresentInPosts,
  postMatchesOfficialProject,
  resolveOfficialProjectLabel,
} from '../services/showcaseService';
import { loadRelatedProjectOptions } from '../utils/relatedToOptions';

const TYPE_ICONS = {
  video: Film,
  stream: Radio,
  art: ImageIcon,
  article: FileText,
};

const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg';

function formatPublished(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function typeBadgeVariant(type) {
  if (type === 'video') return 'neon';
  if (type === 'stream') return 'purple';
  if (type === 'art') return 'gold';
  return 'default';
}

function typeLabel(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'video') return 'Video';
  if (t === 'stream') return 'Stream';
  if (t === 'art') return 'Art';
  if (t === 'article' || t === 'post' || t === 'link') return 'Article';
  return 'Community';
}

function isArticleLike(type) {
  const t = String(type || '').toLowerCase();
  return t === 'article' || t === 'post' || t === 'link';
}

/**
 * Single showcase card. Article/link posts load Open Graph media for the URL.
 * Like control sits outside the external link so it stays clickable.
 */
function ShowcaseCard({
  item,
  eager = false,
  liked = false,
  likeBusy = false,
  onLike,
  userId = null,
  onProjectFilter,
  officialProjects = [],
}) {
  const thumb = showcaseThumb(item);
  const href = showcaseHref(item);
  const when = formatPublished(item.publishedAt);
  const TypeIcon = TYPE_ICONS[item.type] || TYPE_ICONS.article || Users;
  const isVideoLike = item.type === 'video' || item.type === 'stream';
  const isLinkCard = isArticleLike(item.type) && Boolean(href);
  const creatorUsername =
    item.creator?.username ||
    item.creatorUsername ||
    null;
  const creatorName = normalizeCredit(
    creatorUsername || item.creatorDisplayName
  );
  const creatorAvatar =
    item.creator?.avatar_url ||
    item.creator?.avatarUrl ||
    item.creatorAvatarUrl ||
    null;
  const projectLabel = resolveOfficialProjectLabel(
    item.projectTag,
    officialProjects
  );
  const [linkPreview, setLinkPreview] = useState(null);
  const likes = Math.max(0, Number(item.likes) || 0);
  const canPersistLike = isShowcasePostUuid(item.id) && !item._isDemo;

  const host =
    (isLinkCard &&
      (linkPreview?.hostname ||
        linkPreview?.siteName ||
        linkHostname(href))) ||
    null;
  const blurb =
    item.description ||
    (isLinkCard ? linkPreview?.description : null) ||
    '';

  // Media only inside the external link — never nest <button> inside <a>
  // (React 19 treats that as a hard render error).
  const mediaBlock = isLinkCard ? (
    <div className="relative">
      <ShowcaseLinkPreview
        url={href}
        storedThumb={thumb}
        eager={eager}
        onPreview={setLinkPreview}
      />
      {item.isFeatured && (
        <span className="absolute top-2 left-2 z-10 text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded-full border border-forge-gold/50 bg-cyber-bg/80 text-forge-gold">
          Featured
        </span>
      )}
      {item._isDemo && (
        <span className="absolute top-2 right-2 z-10 text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded-full border border-white/20 bg-cyber-bg/70 text-text-muted">
          Demo
        </span>
      )}
    </div>
  ) : (
    <div className="relative aspect-video bg-cyber-surface">
      {thumb ? (
        <img
          src={thumb}
          alt={`Thumbnail: ${item.title} by ${creatorName}`}
          width={480}
          height={270}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-cyber-surface to-cyber-bg"
          aria-hidden
        >
          <TypeIcon className="w-12 h-12 text-text-muted opacity-50" />
        </div>
      )}
      <div
        className="absolute inset-0 bg-gradient-to-t from-cyber-bg/90 via-transparent to-transparent"
        aria-hidden
      />
      {isVideoLike && (
        <span
          className="absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-neon-purple/90 text-white shadow-lg group-hover:scale-105 transition-transform">
            <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
          </span>
        </span>
      )}
      {item.isFeatured && (
        <span className="absolute top-2 left-2 text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded-full border border-forge-gold/50 bg-cyber-bg/80 text-forge-gold">
          Featured
        </span>
      )}
      {item._isDemo && (
        <span className="absolute top-2 right-2 text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded-full border border-white/20 bg-cyber-bg/70 text-text-muted">
          Demo
        </span>
      )}
    </div>
  );

  return (
    <Card className="p-0 overflow-hidden h-full flex flex-col group">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`block min-h-0 ${focusRing} rounded-t-2xl`}
          aria-label={`${item.title} by ${creatorName}${host ? ` · ${host}` : ''}`}
        >
          {mediaBlock}
        </a>
      ) : (
        mediaBlock
      )}

      <div className="p-4 sm:p-5 pb-2 flex flex-col flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge variant={typeBadgeVariant(item.type)}>
            {typeLabel(item.type)}
          </Badge>
          {projectLabel &&
            (typeof onProjectFilter === 'function' ? (
              <button
                type="button"
                onClick={() => onProjectFilter(item.projectTag)}
                className={`inline-flex items-center rounded-full border border-forge-gold/40 bg-forge-gold/10 px-2.5 py-0.5 text-[10px] sm:text-xs font-mono tracking-wide text-forge-gold hover:bg-forge-gold/20 hover:border-forge-gold transition-colors ${focusRing}`}
                title={`Filter: ${projectLabel}`}
              >
                {projectLabel}
              </button>
            ) : (
              <Badge variant="gold">{projectLabel}</Badge>
            ))}
          {when && (
            <time
              dateTime={String(item.publishedAt || '')}
              className="text-[10px] font-mono tracking-widest text-text-muted uppercase"
            >
              {when}
            </time>
          )}
        </div>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`block ${focusRing} rounded-sm`}
          >
            <h3 className="text-lg font-bold text-white leading-snug group-hover:text-neon-cyan transition-colors">
              {item.title}
            </h3>
          </a>
        ) : (
          <h3 className="text-lg font-bold text-white leading-snug">
            {item.title}
          </h3>
        )}
        {isLinkCard &&
          linkPreview?.title &&
          linkPreview.title !== item.title && (
            <p className="mt-1 text-xs text-text-muted line-clamp-2 leading-snug">
              {linkPreview.title}
            </p>
          )}
        {/* Creator — same pattern as idea cards: avatar + username */}
        <div className="mt-2.5 inline-flex items-center gap-2 min-w-0">
          <UserAvatar
            src={creatorAvatar}
            name={creatorName}
            username={creatorUsername}
            size="sm"
            borderClass="border border-neon-cyan/30"
          />
          <span className="text-sm text-text-secondary truncate">
            by{' '}
            <ProfileLink
              username={creatorUsername}
              className="text-neon-cyan font-semibold"
            >
              {creatorName}
            </ProfileLink>
          </span>
        </div>
        {blurb ? (
          <p className="mt-2 text-sm text-text-secondary leading-relaxed line-clamp-3 flex-1">
            {blurb}
          </p>
        ) : (
          <div className="flex-1" />
        )}
      </div>

      {/* Footer: open/watch left, fire like right (matches idea cards) */}
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 flex items-center justify-between gap-3 border-t border-cyber-border/60 mt-auto">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 text-sm font-semibold text-neon-cyan min-w-0 ${focusRing} rounded`}
          >
            <span className="truncate">
              {isVideoLike
                ? 'Watch'
                : isLinkCard
                  ? host
                    ? `Open · ${host}`
                    : 'Open link'
                  : 'Open'}
            </span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden />
          </a>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={() => onLike?.(item)}
          disabled={likeBusy}
          aria-pressed={liked}
          title={
            !userId && canPersistLike
              ? 'Sign in to like'
              : liked
                ? 'Remove like'
                : 'Like this post'
          }
          aria-label={
            liked
              ? `Unlike. ${likes} likes`
              : `Like. ${likes} likes${!userId ? '. Sign in required.' : ''}`
          }
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-mono transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg disabled:opacity-60 shrink-0 ${
            liked
              ? 'border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/15'
              : 'border-cyber-border bg-cyber-surface/60 hover:border-orange-400/40 hover:bg-white/5'
          }`}
        >
          {likeBusy ? (
            <Loader2
              className="w-3.5 h-3.5 animate-spin text-slate-400"
              aria-hidden
            />
          ) : (
            <Flame
              className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                liked
                  ? 'text-orange-500 fill-orange-500/30'
                  : 'text-slate-400'
              }`}
              strokeWidth={liked ? 2.25 : 2}
              aria-hidden
            />
          )}
          <span
            className={`tabular-nums min-w-[1rem] text-center text-xs ${
              liked ? 'text-orange-400' : 'text-text-secondary'
            }`}
          >
            {likes}
          </span>
        </button>
      </div>
    </Card>
  );
}

const CommunityShowcase = () => {
  const { isModerator } = useIsModerator();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeGroup, setTypeGroup] = useState(null);
  /** Official project id/slug only (from TF projects table). */
  const [projectFilter, setProjectFilter] = useState(null);
  const [sortMode, setSortMode] = useState('newest');
  const [officialProjects, setOfficialProjects] = useState([]);
  const [userId, setUserId] = useState(null);
  const [likedIds, setLikedIds] = useState(() => new Set());
  const [busyLikeId, setBusyLikeId] = useState(null);
  const [likeMessage, setLikeMessage] = useState('');
  const likeBusyRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, projects] = await Promise.all([
        listApprovedShowcasePosts(),
        loadRelatedProjectOptions(),
      ]);
      setPosts(Array.isArray(rows) ? rows : []);
      setOfficialProjects(Array.isArray(projects) ? projects : []);
    } catch (err) {
      console.warn('[CommunityShowcase]', err);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auth + which posts this user already liked
  useEffect(() => {
    let mounted = true;
    const syncUser = async (sessionUser) => {
      if (!mounted) return;
      const uid = sessionUser?.id || null;
      setUserId(uid);
      if (!uid) {
        setLikedIds(new Set());
        return;
      }
      try {
        const ids = await getUserLikedShowcasePostIds(uid);
        if (mounted) setLikedIds(new Set(ids));
      } catch {
        if (mounted) setLikedIds(new Set());
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      syncUser(session?.user || null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUser(session?.user || null);
    });
    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const handleLike = useCallback(
    async (item) => {
      if (!item?.id || likeBusyRef.current) return;

      // Demo / non-uuid: local-only toggle for UI feedback
      if (!isShowcasePostUuid(item.id) || item._isDemo) {
        setPosts((list) =>
          list.map((p) => {
            if (p.id !== item.id) return p;
            const was = likedIds.has(p.id);
            return {
              ...p,
              likes: Math.max(0, (Number(p.likes) || 0) + (was ? -1 : 1)),
            };
          })
        );
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (next.has(item.id)) next.delete(item.id);
          else next.add(item.id);
          return next;
        });
        return;
      }

      if (!userId) {
        setLikeMessage('Sign in to like showcase posts.');
        return;
      }

      likeBusyRef.current = true;
      setBusyLikeId(item.id);
      setLikeMessage('');
      const prevLiked = likedIds.has(item.id);
      const prevLikes = Math.max(0, Number(item.likes) || 0);

      // Optimistic
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (prevLiked) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
      setPosts((list) =>
        list.map((p) =>
          p.id === item.id
            ? {
                ...p,
                likes: Math.max(0, prevLikes + (prevLiked ? -1 : 1)),
              }
            : p
        )
      );

      try {
        const { liked, likes } = await toggleShowcaseLike(item.id, userId);
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (liked) next.add(item.id);
          else next.delete(item.id);
          return next;
        });
        setPosts((list) =>
          list.map((p) => (p.id === item.id ? { ...p, likes } : p))
        );
      } catch (err) {
        // Revert
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (prevLiked) next.add(item.id);
          else next.delete(item.id);
          return next;
        });
        setPosts((list) =>
          list.map((p) =>
            p.id === item.id ? { ...p, likes: prevLikes } : p
          )
        );
        setLikeMessage(err?.message || 'Could not update like.');
      } finally {
        likeBusyRef.current = false;
        setBusyLikeId(null);
      }
    },
    [userId, likedIds]
  );

  const availableGroups = useMemo(
    () => filterGroupsPresentInPosts(posts),
    [posts]
  );
  /** Only TF-created projects that also appear on at least one post. */
  const availableProjects = useMemo(
    () => officialProjectsPresentInPosts(posts, officialProjects),
    [posts, officialProjects]
  );

  useEffect(() => {
    if (typeGroup && !availableGroups.some((g) => g.id === typeGroup)) {
      setTypeGroup(null);
    }
  }, [typeGroup, availableGroups]);

  useEffect(() => {
    if (
      projectFilter &&
      !availableProjects.some((p) => p.id === projectFilter)
    ) {
      setProjectFilter(null);
    }
  }, [projectFilter, availableProjects]);

  const filtered = useMemo(() => {
    let list = posts;
    if (typeGroup) {
      const group = SHOWCASE_FILTER_GROUPS.find((g) => g.id === typeGroup);
      if (group) {
        list = list.filter((p) => group.types.includes(p.type));
      }
    }
    if (projectFilter) {
      const proj = officialProjects.find((p) => p.id === projectFilter);
      if (proj) {
        list = list.filter((p) => postMatchesOfficialProject(p, proj));
      } else {
        list = [];
      }
    }
    return sortShowcasePosts(list, sortMode);
  }, [posts, typeGroup, projectFilter, sortMode, officialProjects]);

  const showDiscovery = !loading && posts.length > 0;

  const selectProject = useCallback(
    (tagOrId) => {
      const raw = String(tagOrId || '').trim();
      if (!raw) return;
      // Resolve free-text / slug to official project id
      const match = (officialProjects || []).find(
        (p) =>
          p &&
          (postMatchesOfficialProject({ projectTag: raw }, p) || p.id === raw)
      );
      if (!match) return;
      setProjectFilter((prev) => (prev === match.id ? null : match.id));
    },
    [officialProjects]
  );

  const compactSelect =
    'bg-cyber-surface border border-cyber-border rounded-md px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-neon-cyan max-w-[11rem]';

  const sortOptions = Array.isArray(SHOWCASE_SORT_OPTIONS)
    ? SHOWCASE_SORT_OPTIONS
    : [
        { id: 'newest', label: 'Newest' },
        { id: 'featured', label: 'Featured first' },
        { id: 'liked', label: 'Most liked' },
      ];

  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      <header className="relative pt-20 border-b border-cyber-border bg-cyber-surface/80">
        <div className="container-custom py-10 sm:py-12 md:py-14">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="section-header mb-0">Community</div>
              {isModerator && (
                <Link
                  to="/showcase/moderate"
                  className={`inline-flex items-center gap-1.5 text-xs font-mono tracking-widest text-neon-cyan hover:text-white rounded ${focusRing}`}
                >
                  <Shield className="w-3 h-3" />
                  Moderate queue
                </Link>
              )}
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Community Showcase
            </h1>
            <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-2xl">
              Community-made videos, streams, art, and posts about Together
              Forge. Official studio videos stay on the Media page. Everything
              here is moderated before it goes live.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row flex-wrap gap-3">
              <Link to="/showcase/submit" className={`rounded-lg ${focusRing}`}>
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  <Send className="w-4 h-4" aria-hidden />
                  Submit content
                </Button>
              </Link>
              <Link to="/media" className={`rounded-lg ${focusRing}`}>
                <Button
                  size="lg"
                  variant="secondary"
                  className="gap-2 w-full sm:w-auto"
                >
                  <Film className="w-4 h-4" aria-hidden />
                  Official Media
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container-custom py-12 md:py-16 max-w-6xl space-y-14">
        <section aria-label="Community showcase feed">
          {!loading && posts.length > 0 && (
            <div className="flex justify-end mb-3">
              <span
                className="text-xs font-mono tracking-widest text-text-muted uppercase"
                aria-live="polite"
              >
                {filtered.length === posts.length
                  ? `${posts.length} ${posts.length === 1 ? 'post' : 'posts'}`
                  : `${filtered.length} of ${posts.length}`}
              </span>
            </div>
          )}

          {/* Compact sort / project / type — not a large panel */}
          {showDiscovery && (
            <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
              <label className="inline-flex items-center gap-1.5 text-text-muted">
                <span className="font-mono tracking-widest uppercase text-[10px]">
                  Sort
                </span>
                <select
                  className={compactSelect}
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value)}
                  aria-label="Sort posts"
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inline-flex items-center gap-1.5 text-text-muted">
                <span className="font-mono tracking-widest uppercase text-[10px]">
                  Project
                </span>
                <select
                  className={compactSelect}
                  value={projectFilter || ''}
                  onChange={(e) =>
                    setProjectFilter(e.target.value || null)
                  }
                  aria-label="Filter by project"
                  disabled={availableProjects.length === 0}
                >
                  <option value="">All</option>
                  {availableProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>

              {availableGroups.length > 0 && (
                <label className="inline-flex items-center gap-1.5 text-text-muted">
                  <span className="font-mono tracking-widest uppercase text-[10px]">
                    Type
                  </span>
                  <select
                    className={compactSelect}
                    value={typeGroup || ''}
                    onChange={(e) => setTypeGroup(e.target.value || null)}
                    aria-label="Filter by type"
                  >
                    <option value="">All</option>
                    {availableGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {(projectFilter || typeGroup || sortMode !== 'newest') && (
                <button
                  type="button"
                  className="text-[10px] font-mono tracking-widest uppercase text-neon-cyan hover:text-white"
                  onClick={() => {
                    setProjectFilter(null);
                    setTypeGroup(null);
                    setSortMode('newest');
                  }}
                >
                  Reset
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div role="status" aria-live="polite" aria-busy="true">
              <p className="sr-only">Loading showcase…</p>
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 list-none p-0 m-0">
                {[1, 2, 3].map((i) => (
                  <li key={i} aria-hidden>
                    <Card className="p-0 overflow-hidden animate-pulse">
                      <div className="aspect-video bg-cyber-surface" />
                      <div className="p-5 space-y-3">
                        <div className="h-3 w-20 rounded bg-cyber-border/50" />
                        <div className="h-5 w-3/4 rounded bg-cyber-border/40" />
                        <div className="h-3 w-full rounded bg-cyber-border/30" />
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          ) : posts.length === 0 ? (
            <Card className="p-8 sm:p-10 text-center space-y-4 border-dashed max-w-2xl mx-auto">
              <Users className="w-10 h-10 text-neon-purple mx-auto" />
              <h3 className="text-xl font-bold text-white">
                No community posts yet
              </h3>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-md mx-auto">
                Be the first to share a clip, stream, or piece of art.
                Submissions are reviewed before they appear here.
              </p>
              <Link to="/showcase/submit">
                <Button className="gap-2">
                  <Send className="w-4 h-4" />
                  Submit content
                </Button>
              </Link>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center space-y-3 border-dashed">
              <p className="text-white font-semibold">
                No posts match these filters.
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  setTypeGroup(null);
                  setProjectFilter(null);
                  setSortMode('newest');
                }}
              >
                Clear filters
              </Button>
            </Card>
          ) : (
            <>
              {likeMessage && (
                <div
                  role="status"
                  className="mb-4 rounded-lg border border-neon-cyan/35 bg-neon-cyan/10 px-4 py-3 text-sm text-neon-cyan flex flex-wrap items-center justify-between gap-2"
                >
                  <span>{likeMessage}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    {!userId && (
                      <Link
                        to="/profile"
                        className="font-semibold hover:text-white underline-offset-2 hover:underline"
                      >
                        Sign in
                      </Link>
                    )}
                    <button
                      type="button"
                      className="text-xs font-mono tracking-widest uppercase opacity-80 hover:opacity-100"
                      onClick={() => setLikeMessage('')}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 list-none p-0 m-0">
                {filtered.map((item, index) => (
                  <li key={item.id}>
                    <ShowcaseCard
                      item={item}
                      eager={index < 3}
                      liked={likedIds.has(item.id)}
                      likeBusy={busyLikeId === item.id}
                      onLike={handleLike}
                      userId={userId}
                      onProjectFilter={selectProject}
                      officialProjects={officialProjects}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* CTA to submit page */}
        <Card className="p-6 sm:p-8 border-neon-purple/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">
              Share your work
            </h2>
            <p className="text-sm text-text-secondary max-w-lg leading-relaxed">
              Clips, streams, art, and articles go through a short moderation
              review before they appear in the feed.
            </p>
          </div>
          <Link to="/showcase/submit" className={`shrink-0 rounded-lg ${focusRing}`}>
            <Button size="lg" className="gap-2 w-full sm:w-auto">
              <Send className="w-4 h-4" aria-hidden />
              Submit content
            </Button>
          </Link>
        </Card>

      </div>
    </div>
  );
};

export default CommunityShowcase;
