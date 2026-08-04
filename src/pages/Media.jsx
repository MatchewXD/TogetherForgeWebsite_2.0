/**
 * Official Media — Together Forge video library only.
 * Routes: /media and /videos
 * Data: Supabase official_videos (managed at /media/edit by staff).
 *
 * A11y / performance:
 * - Grid shows thumbnails only (lazy-loaded); never mounts many YouTube iframes.
 * - Exactly one embed loads when the user opens Watch (modal); unmounted on close.
 * - Keyboard: cards, filters, and actions are focusable buttons/links with visible rings.
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  ExternalLink,
  Youtube,
  Users,
  Film,
  Pencil,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import Modal from '../components/ui/Modal';
import { useIsModerator } from '../hooks/useIsModerator';
import {
  listPublishedOfficialVideos,
} from '../services/officialMediaService';
import {
  youtubeWatchUrl,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
  YOUTUBE_CHANNEL_URL,
  COMMUNITY_SHOWCASE_PATH,
} from '../data/officialVideos';
import {
  categoriesPresentInVideos,
  normalizeOfficialVideoCategory,
} from '../constants/officialVideoCategories';

function formatPublished(iso) {
  if (!iso) return null;
  const d = new Date(String(iso).includes('T') ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Prefer privacy-enhanced domain; still only one iframe at a time */
function embedSrcForVideo(youtubeId) {
  const base = youtubeEmbedUrl(youtubeId);
  if (!base) return '';
  // Swap to youtube-nocookie when using standard embed host
  return base.replace(
    'https://www.youtube.com/embed/',
    'https://www.youtube-nocookie.com/embed/'
  );
}

function thumbnailAlt(video) {
  const title = String(video?.title || 'Video').trim() || 'Video';
  const cat = video?.category ? String(video.category).trim() : '';
  if (cat) return `Thumbnail: ${title} (${cat})`;
  return `Thumbnail: ${title}`;
}

function VideoCardSkeleton() {
  return (
    <li aria-hidden="true">
      <Card className="p-0 overflow-hidden h-full flex flex-col animate-pulse">
        <div className="aspect-video bg-cyber-surface" />
        <div className="p-4 sm:p-5 space-y-3">
          <div className="h-3 w-20 rounded bg-cyber-border/60" />
          <div className="h-5 w-3/4 rounded bg-cyber-border/50" />
          <div className="h-3 w-full rounded bg-cyber-border/40" />
          <div className="h-3 w-2/3 rounded bg-cyber-border/40" />
          <div className="h-9 w-24 rounded-lg bg-cyber-border/50 mt-2" />
        </div>
      </Card>
    </li>
  );
}

const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg';

const Media = () => {
  const { isModerator } = useIsModerator();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  /** null = all published videos */
  const [categoryFilter, setCategoryFilter] = useState(null);
  /** Return focus to the control that opened the player */
  const lastTriggerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await listPublishedOfficialVideos();
        if (mounted) setVideos(Array.isArray(rows) ? rows : []);
      } catch (err) {
        console.warn('[Media] load videos', err);
        if (mounted) setVideos([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const availableCategories = useMemo(
    () => categoriesPresentInVideos(videos),
    [videos]
  );

  useEffect(() => {
    if (categoryFilter && !availableCategories.includes(categoryFilter)) {
      setCategoryFilter(null);
    }
  }, [categoryFilter, availableCategories]);

  const filteredVideos = useMemo(() => {
    if (!categoryFilter) return videos;
    return videos.filter(
      (v) => normalizeOfficialVideoCategory(v.category) === categoryFilter
    );
  }, [videos, categoryFilter]);

  const openWatch = useCallback((video, triggerEl) => {
    if (triggerEl instanceof HTMLElement) {
      lastTriggerRef.current = triggerEl;
    } else {
      lastTriggerRef.current = document.activeElement;
    }
    const embed = embedSrcForVideo(video?.youtubeId);
    if (embed) {
      setActive(video);
      return;
    }
    window.open(YOUTUBE_CHANNEL_URL, '_blank', 'noopener,noreferrer');
  }, []);

  const closeWatch = useCallback(() => {
    setActive(null);
    // Return focus after unmount so the grid remains keyboard-usable
    requestAnimationFrame(() => {
      const el = lastTriggerRef.current;
      if (el && typeof el.focus === 'function') {
        try {
          el.focus();
        } catch {
          /* ignore */
        }
      }
      lastTriggerRef.current = null;
    });
  }, []);

  // Single embed only while modal is open
  const embedSrc = active ? embedSrcForVideo(active.youtubeId) : '';
  const playerOpen = Boolean(active && embedSrc);
  const showFilters =
    !loading && videos.length > 0 && availableCategories.length > 0;

  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      <header className="relative pt-20 border-b border-cyber-border bg-cyber-surface/80">
        <div className="container-custom py-10 sm:py-12 md:py-14">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <p className="section-header mb-0">Studio library</p>
              {isModerator && (
                <Link
                  to="/media/edit"
                  className={`inline-flex items-center gap-1.5 text-xs font-mono tracking-widest text-neon-cyan hover:text-white rounded ${focusRing}`}
                >
                  <Pencil className="w-3 h-3" aria-hidden />
                  Manage videos
                </Link>
              )}
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Official Media
            </h1>
            <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-2xl">
              Official Together Forge videos: studio overviews, progress
              reports, and how-to-help guides. Community and fan videos live in
              the Showcase.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row flex-wrap gap-3">
              <a
                href={YOUTUBE_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-lg ${focusRing}`}
              >
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  <Youtube className="w-4 h-4" aria-hidden />
                  YouTube channel
                  <ExternalLink
                    className="w-3.5 h-3.5 opacity-80"
                    aria-hidden
                  />
                </Button>
              </a>
              <Link
                to={COMMUNITY_SHOWCASE_PATH}
                className={`rounded-lg ${focusRing}`}
              >
                <Button
                  size="lg"
                  variant="secondary"
                  className="gap-2 w-full sm:w-auto"
                >
                  <Users className="w-4 h-4" aria-hidden />
                  Community Showcase
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container-custom py-12 md:py-16 max-w-6xl">
        <section aria-labelledby="official-videos-heading">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
            <div>
              <h2
                id="official-videos-heading"
                className="section-header mb-0"
              >
                Official videos
              </h2>
            </div>
            {!loading && videos.length > 0 && (
              <span
                className="text-xs font-mono tracking-widest text-text-muted uppercase"
                aria-live="polite"
              >
                {categoryFilter
                  ? `${filteredVideos.length} of ${videos.length}`
                  : videos.length}{' '}
                {videos.length === 1 ? 'video' : 'videos'}
              </span>
            )}
          </div>

          {showFilters && (
            <div
              className="mb-8 flex flex-wrap items-center gap-2"
              role="toolbar"
              aria-label="Filter videos by category"
            >
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                aria-pressed={categoryFilter === null}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-mono tracking-wide uppercase transition-colors ${focusRing} ${
                  categoryFilter === null
                    ? 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan'
                    : 'border-cyber-border bg-cyber-surface/60 text-text-muted hover:border-neon-cyan/40 hover:text-white'
                }`}
              >
                All
              </button>
              {availableCategories.map((cat) => {
                const activeChip = categoryFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() =>
                      setCategoryFilter(activeChip ? null : cat)
                    }
                    aria-pressed={activeChip}
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-mono tracking-wide transition-colors ${focusRing} ${
                      activeChip
                        ? 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan'
                        : 'border-cyber-border bg-cyber-surface/60 text-text-secondary hover:border-neon-cyan/40 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}

          {loading ? (
            <div role="status" aria-live="polite" aria-busy="true">
              <p className="sr-only">Loading official videos…</p>
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 list-none p-0 m-0">
                <VideoCardSkeleton />
                <VideoCardSkeleton />
                <VideoCardSkeleton />
              </ul>
            </div>
          ) : filteredVideos.length === 0 ? (
            <Card className="p-8 sm:p-10 text-center space-y-5 border-dashed">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl border border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan mx-auto">
                <Film className="w-7 h-7" aria-hidden />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="text-xl sm:text-2xl font-bold text-white">
                  {videos.length === 0
                    ? 'No official videos yet.'
                    : 'No videos in this category.'}
                </h3>
                <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                  {videos.length === 0
                    ? 'Visit the YouTube channel or browse community posts in the Showcase while we publish the first ones.'
                    : 'Try another filter or view all videos.'}
                </p>
              </div>
              {videos.length > 0 && categoryFilter ? (
                <Button
                  variant="secondary"
                  onClick={() => setCategoryFilter(null)}
                >
                  Show all videos
                </Button>
              ) : null}
              {videos.length === 0 ? (
                <>
                  <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 pt-1">
                    <a
                      href={YOUTUBE_CHANNEL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`rounded-lg ${focusRing}`}
                    >
                      <Button className="gap-2 w-full sm:w-auto">
                        <Youtube className="w-4 h-4" aria-hidden />
                        Open YouTube channel
                        <ExternalLink
                          className="w-3.5 h-3.5 opacity-80"
                          aria-hidden
                        />
                      </Button>
                    </a>
                    <Link
                      to={COMMUNITY_SHOWCASE_PATH}
                      className={`rounded-lg ${focusRing}`}
                    >
                      <Button
                        variant="secondary"
                        className="gap-2 w-full sm:w-auto"
                      >
                        <Users className="w-4 h-4" aria-hidden />
                        Community Showcase
                      </Button>
                    </Link>
                  </div>
                  {isModerator && (
                    <p className="text-xs text-text-muted pt-2">
                      Staff:{' '}
                      <Link
                        to="/media/edit"
                        className={`text-neon-cyan hover:text-white rounded ${focusRing}`}
                      >
                        manage videos
                      </Link>{' '}
                      or run{' '}
                      <code className="text-neon-cyan/90">
                        supabase_official_videos.sql
                      </code>{' '}
                      for demo rows.
                    </p>
                  )}
                </>
              ) : null}
            </Card>
          ) : (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 list-none p-0 m-0">
              {filteredVideos.map((video, index) => {
                const thumb = youtubeThumbnailUrl(video);
                const when = formatPublished(video.publishedAt);
                const watchHref = youtubeWatchUrl(video.youtubeId);
                const titleId = `video-title-${video.id}`;
                const descId = video.description
                  ? `video-desc-${video.id}`
                  : undefined;
                // Eager-load first few thumbs above the fold; lazy the rest
                const eagerThumb = index < 3;

                return (
                  <li key={video.id}>
                    <article
                      className="h-full"
                      aria-labelledby={titleId}
                      aria-describedby={descId}
                    >
                      <Card className="p-0 overflow-hidden h-full flex flex-col group">
                        {/* Thumbnail = lightweight poster; no iframe until Watch */}
                        <button
                          type="button"
                          onClick={(e) => openWatch(video, e.currentTarget)}
                          className={`relative block w-full aspect-video bg-cyber-surface text-left ${focusRing} focus-visible:ring-inset`}
                          aria-label={`Watch ${video.title}`}
                          aria-haspopup="dialog"
                        >
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={thumbnailAlt(video)}
                              width={480}
                              height={270}
                              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              loading={eagerThumb ? 'eager' : 'lazy'}
                              decoding="async"
                              fetchPriority={eagerThumb ? 'low' : undefined}
                            />
                          ) : (
                            <div
                              className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-cyber-surface to-cyber-bg"
                              aria-hidden
                            >
                              <Film className="w-12 h-12 text-text-muted opacity-50" />
                            </div>
                          )}
                          <div
                            className="absolute inset-0 bg-gradient-to-t from-cyber-bg/90 via-transparent to-transparent"
                            aria-hidden
                          />
                          <span
                            className="absolute inset-0 flex items-center justify-center"
                            aria-hidden
                          >
                            <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-neon-cyan/90 text-cyber-bg shadow-lg group-hover:scale-105 transition-transform">
                              <Play
                                className="w-6 h-6 ml-0.5"
                                fill="currentColor"
                              />
                            </span>
                          </span>
                        </button>

                        <div className="p-4 sm:p-5 flex flex-col flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2 min-h-[1.25rem]">
                            {video.category && (
                              <Badge variant="default">
                                {video.category}
                              </Badge>
                            )}
                            {when && (
                              <time
                                dateTime={String(video.publishedAt || '')}
                                className="text-[10px] font-mono tracking-widest text-text-muted uppercase"
                              >
                                {when}
                              </time>
                            )}
                          </div>
                          <h3
                            id={titleId}
                            className="text-lg font-bold text-white leading-snug"
                          >
                            {video.title}
                          </h3>
                          {video.description ? (
                            <p
                              id={descId}
                              className="mt-2 text-sm text-text-secondary leading-relaxed line-clamp-3 flex-1"
                            >
                              {video.description}
                            </p>
                          ) : (
                            <div className="flex-1" />
                          )}
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="gap-1.5"
                              onClick={(e) =>
                                openWatch(video, e.currentTarget)
                              }
                              aria-haspopup="dialog"
                              aria-label={`Watch ${video.title}`}
                            >
                              <Play className="w-3.5 h-3.5" aria-hidden />
                              Watch
                            </Button>
                            {/* Real link (not nested button) for keyboard + open-in-new-tab */}
                            <a
                              href={watchHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-sm font-semibold tracking-wide text-text-secondary hover:bg-cyber-surface hover:text-text-primary transition-all ${focusRing}`}
                              aria-label={`Open ${video.title} on YouTube (new tab)`}
                            >
                              YouTube
                              <ExternalLink
                                className="w-3 h-3"
                                aria-hidden
                              />
                            </a>
                          </div>
                        </div>
                      </Card>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside
          className="mt-14 rounded-2xl border border-cyber-border bg-cyber-card/50 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          aria-labelledby="showcase-callout-heading"
        >
          <div>
            <h2
              id="showcase-callout-heading"
              className="text-lg font-bold text-white mb-1"
            >
              See community-made videos and posts
            </h2>
            <p className="text-sm text-text-secondary max-w-lg leading-relaxed">
              Fan clips, streams, and community highlights live on the Showcase
              — separate from this official media library.
            </p>
          </div>
          <Link
            to={COMMUNITY_SHOWCASE_PATH}
            className={`shrink-0 rounded-lg ${focusRing}`}
          >
            <Button variant="secondary" className="gap-2 w-full sm:w-auto">
              <Users className="w-4 h-4" aria-hidden />
              Community Showcase
            </Button>
          </Link>
        </aside>
      </div>

      {/* At most one YouTube iframe in the whole page — only while player is open */}
      <Modal
        isOpen={playerOpen}
        onClose={closeWatch}
        title={active?.title || 'Watch'}
        size="xl"
      >
        {playerOpen && embedSrc ? (
          <div className="space-y-4">
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
              <iframe
                key={active.id}
                title={`YouTube player: ${active.title || 'Video'}`}
                src={embedSrc}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            {active?.description && (
              <p className="text-sm text-text-secondary leading-relaxed">
                {active.description}
              </p>
            )}
            <a
              href={youtubeWatchUrl(active?.youtubeId)}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 text-sm text-neon-cyan hover:text-white rounded ${focusRing}`}
            >
              Open on YouTube
              <ExternalLink className="w-3.5 h-3.5" aria-hidden />
            </a>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default Media;
