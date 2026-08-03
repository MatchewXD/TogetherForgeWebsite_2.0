/**
 * Official Media / Videos hub.
 * Routes: /media and /videos
 * Community content → /showcase (separate page).
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  ExternalLink,
  Youtube,
  Users,
  Film,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import Modal from '../components/ui/Modal';
import {
  getOfficialVideosSorted,
  youtubeWatchUrl,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
  YOUTUBE_CHANNEL_URL,
  COMMUNITY_SHOWCASE_PATH,
} from '../data/officialVideos';

function formatPublished(iso) {
  if (!iso) return null;
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const Media = () => {
  const videos = useMemo(() => getOfficialVideosSorted(), []);
  const [active, setActive] = useState(null);

  const openWatch = (video) => {
    const embed = youtubeEmbedUrl(video.youtubeId);
    if (embed) {
      setActive(video);
      return;
    }
    // No id yet — open channel
    window.open(YOUTUBE_CHANNEL_URL, '_blank', 'noopener,noreferrer');
  };

  const closeWatch = () => setActive(null);
  const embedSrc = active ? youtubeEmbedUrl(active.youtubeId) : '';

  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      <header className="relative pt-20 border-b border-cyber-border bg-cyber-surface/80">
        <div className="container-custom py-10 sm:py-12 md:py-14">
          <div className="max-w-3xl">
            <div className="section-header">Official</div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Media
            </h1>
            <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-2xl">
              Official Together Forge videos that are not tied to a single page:
              studio overviews, progress reports, and how-to-help guides. Project
              or page-specific clips still live on Home, About, Get Involved, and
              project hubs. Fan and community videos live in the Showcase.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row flex-wrap gap-3">
              <a
                href={YOUTUBE_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  <Youtube className="w-4 h-4" />
                  YouTube channel
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </Button>
              </a>
              <Link to={COMMUNITY_SHOWCASE_PATH}>
                <Button
                  size="lg"
                  variant="secondary"
                  className="gap-2 w-full sm:w-auto"
                >
                  <Users className="w-4 h-4" />
                  Community Showcase
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container-custom py-12 md:py-16 max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
          <div>
            <h2 className="section-header mb-1">Official videos</h2>
            <p className="text-sm text-text-muted">
              Newest first. Thumbnails open a player when a video id is set.
            </p>
          </div>
          <span className="text-xs font-mono tracking-widest text-text-muted">
            {videos.length} {videos.length === 1 ? 'video' : 'videos'}
          </span>
        </div>

        {videos.length === 0 ? (
          <Card className="p-8 text-center space-y-4">
            <Film className="w-10 h-10 text-neon-cyan mx-auto opacity-80" />
            <p className="text-text-secondary max-w-md mx-auto">
              Official videos will appear here soon. Meanwhile, visit the YouTube
              channel or browse community posts in the Showcase.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href={YOUTUBE_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-neon-cyan hover:text-white"
              >
                Open YouTube channel
              </a>
              <Link
                to={COMMUNITY_SHOWCASE_PATH}
                className="text-sm text-text-muted hover:text-neon-cyan"
              >
                Community Showcase
              </Link>
            </div>
          </Card>
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 list-none p-0 m-0">
            {videos.map((video) => {
              const thumb = youtubeThumbnailUrl(video);
              const when = formatPublished(video.publishedAt);
              const hasId = Boolean(youtubeEmbedUrl(video.youtubeId));

              return (
                <li key={video.id}>
                  <Card className="p-0 overflow-hidden h-full flex flex-col">
                    <button
                      type="button"
                      onClick={() => openWatch(video)}
                      className="relative block w-full aspect-video bg-cyber-surface group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
                      aria-label={`Watch ${video.title}`}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-cyber-surface to-cyber-bg">
                          <Film className="w-12 h-12 text-text-muted opacity-50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-cyber-bg/90 via-transparent to-transparent" />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-neon-cyan/90 text-cyber-bg shadow-lg group-hover:scale-105 transition-transform">
                          <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
                        </span>
                      </span>
                    </button>

                    <div className="p-4 sm:p-5 flex flex-col flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {video.category && (
                          <Badge variant="default">{video.category}</Badge>
                        )}
                        {when && (
                          <span className="text-[10px] font-mono tracking-widest text-text-muted uppercase">
                            {when}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-white leading-snug">
                        {video.title}
                      </h3>
                      {video.description && (
                        <p className="mt-2 text-sm text-text-secondary leading-relaxed line-clamp-2 flex-1">
                          {video.description}
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => openWatch(video)}
                        >
                          <Play className="w-3.5 h-3.5" />
                          Watch
                        </Button>
                        {hasId && (
                          <a
                            href={youtubeWatchUrl(video.youtubeId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex"
                          >
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="gap-1.5"
                            >
                              YouTube
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-14 rounded-2xl border border-cyber-border bg-cyber-card/50 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">
              See community-made videos and posts
            </h2>
            <p className="text-sm text-text-secondary max-w-lg">
              Fan clips, streams, and community highlights live on the Showcase —
              separate from this official media library.
            </p>
          </div>
          <Link to={COMMUNITY_SHOWCASE_PATH} className="shrink-0">
            <Button variant="secondary" className="gap-2 w-full sm:w-auto">
              <Users className="w-4 h-4" />
              Community Showcase
            </Button>
          </Link>
        </div>
      </div>

      <Modal
        isOpen={Boolean(active && embedSrc)}
        onClose={closeWatch}
        title={active?.title || 'Watch'}
        size="xl"
      >
        {embedSrc && (
          <div className="space-y-4">
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
              <iframe
                title={active?.title || 'YouTube video'}
                src={embedSrc}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
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
              className="inline-flex items-center gap-1.5 text-sm text-neon-cyan hover:text-white"
            >
              Open on YouTube
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Media;
