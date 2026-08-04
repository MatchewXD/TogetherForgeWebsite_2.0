/**
 * Released Game Detail — permanent public record for a shipped title.
 * Route: /released/:slug (slug or project UUID)
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Users,
  Package,
  Calendar,
  Layers,
  Gamepad2,
  Heart,
  CheckCircle2,
  Star,
  Monitor,
  Image as ImageIcon,
  BookOpen,
  Lightbulb,
  HandHeart,
  Rocket,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import UserAvatar from '../components/ui/UserAvatar';
import ProfileLink from '../components/ui/ProfileLink';
import {
  getReleasedGameBySlug,
  isProjectCompleted,
} from '../services/projectsService';
import {
  getProjectCredits,
  formatUsdFromCents,
} from '../services/contributorsService';
import { tasksService } from '../services/tasksService';
import { ideasService } from '../services/ideasService';
import { displayProjectTitle } from '../utils/ideaStatus';
import { CONTRIBUTION_CATEGORIES } from '../constants/contributionCategories';
import {
  sortReleaseLinks,
  phaseBadgeVariant,
  formatReleaseDate,
  emptyReleaseMeta,
  hasSteamReviews,
  formatSteamRecentLine,
  formatSteamOverallLine,
} from '../utils/releaseMeta';
import {
  isDemoReleaseKey,
  getDemoReleaseIdeas,
} from '../data/demoReleasedGame';

const RELEASED_BANNER_SRC = '/images/Release_HeroImage.webp';

function groupBySubcategory(rows, orderedSubs) {
  const map = new Map();
  for (const sub of orderedSubs) map.set(sub, []);
  map.set('Other', map.get('Other') || []);

  for (const row of rows || []) {
    const sub =
      row.subcategory && orderedSubs.includes(row.subcategory)
        ? row.subcategory
        : row.subcategory || 'Other';
    if (!map.has(sub)) map.set(sub, []);
    const list = map.get(sub);
    const key = row.userId || row.username || row.displayName;
    if (list.some((p) => (p.userId || p.username || p.displayName) === key)) {
      continue;
    }
    list.push(row);
  }

  return [...map.entries()].filter(([, people]) => people.length > 0);
}

function PersonChip({ person }) {
  const name = person.displayName || person.username || 'Contributor';
  return (
    <li className="flex items-center gap-2.5 py-1.5 min-w-0">
      <UserAvatar
        src={person.avatarUrl}
        name={name}
        username={person.username}
        size="sm"
      />
      <div className="min-w-0">
        <ProfileLink
          username={person.username}
          className="font-semibold text-white text-sm truncate block"
        >
          {name}
        </ProfileLink>
        {person.roleLabel && (
          <p className="text-[11px] text-text-muted truncate">
            {person.roleLabel}
          </p>
        )}
        {!person.roleLabel && person.subcategory && (
          <p className="text-[11px] text-text-muted truncate">
            {person.subcategory}
          </p>
        )}
      </div>
    </li>
  );
}

function FactCell({
  icon: Icon,
  label,
  value,
  emptyLabel = 'Not listed yet',
  /** Emphasize short stats (funding, task counts, phase) */
  emphasize = false,
}) {
  const hasValue =
    value != null &&
    value !== '' &&
    !(Array.isArray(value) && value.length === 0);

  const isPlain =
    typeof value === 'string' || typeof value === 'number';
  const text = isPlain ? String(value) : '';
  // Short values read better large; longer labels stay a step smaller
  const isShort = isPlain && text.length <= 18;
  const valueClass = emphasize || isShort
    ? 'text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight'
    : 'text-lg sm:text-xl font-semibold text-white leading-snug';

  return (
    <div className="rounded-xl border border-cyber-border bg-cyber-surface/60 px-4 py-6 sm:px-5 sm:py-7 min-h-[9rem] sm:min-h-[10rem] flex flex-col items-center justify-center text-center gap-3">
      <div className="flex flex-col items-center gap-2">
        {Icon && (
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-forge-gold/35 bg-forge-gold/10 text-forge-gold">
            <Icon className="w-4 h-4" aria-hidden />
          </span>
        )}
        <p className="text-[11px] font-mono tracking-widest uppercase text-text-muted">
          {label}
        </p>
      </div>
      {hasValue ? (
        isPlain ? (
          <p className={`${valueClass} max-w-[16rem]`}>{text}</p>
        ) : (
          <div className="w-full flex justify-center">{value}</div>
        )
      ) : (
        <p className="text-sm text-text-muted italic max-w-[14rem]">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}

const ReleasedGameDetail = () => {
  const { slug } = useParams();
  const [project, setProject] = useState(null);
  const [credits, setCredits] = useState(null);
  const [pulse, setPulse] = useState(null);
  const [relatedIdeas, setRelatedIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError('');
      setProject(null);
      setCredits(null);
      setPulse(null);
      setRelatedIdeas([]);
      try {
        const row = await getReleasedGameBySlug(slug);
        if (!mounted) return;
        if (!row) {
          setError('Release not found.');
          return;
        }
        setProject(row);

        if (row._isDemoRelease || isDemoReleaseKey(row.slug) || isDemoReleaseKey(row.id)) {
          const [creditsData, pulseData] = await Promise.all([
            getProjectCredits(row.id),
            tasksService.getProjectPulse(row.id),
          ]);
          if (!mounted) return;
          setCredits(creditsData);
          setPulse(pulseData);
          setRelatedIdeas(getDemoReleaseIdeas());
        } else {
          const [creditsData, pulseData, ideasData] = await Promise.all([
            getProjectCredits(row.id).catch((err) => {
              console.warn('[ReleasedGameDetail] credits', err);
              return null;
            }),
            tasksService.getProjectPulse(row.id).catch((err) => {
              console.warn('[ReleasedGameDetail] pulse', err);
              return null;
            }),
            ideasService
              .getIdeasForProject({
                slug: row.slug,
                id: row.id,
                project_id: row.slug,
              })
              .catch((err) => {
                console.warn('[ReleasedGameDetail] ideas', err);
                return [];
              }),
          ]);

          if (!mounted) return;
          setCredits(creditsData);
          setPulse(pulseData);
          setRelatedIdeas(Array.isArray(ideasData) ? ideasData : []);
        }
      } catch (err) {
        if (mounted) setError(err?.message || 'Failed to load release.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [slug]);

  const title = project ? displayProjectTitle(project) : slug;
  const meta = project?.release_meta || emptyReleaseMeta();
  const when = formatReleaseDate(project?.completed_at);
  const links = sortReleaseLinks(project?.completion_links || []);
  const shipped = project ? isProjectCompleted(project) : false;

  const tagline =
    meta.tagline ||
    project?.summary ||
    null;

  const overview =
    project?.description ||
    project?.summary ||
    null;

  const developmentStory =
    meta.developmentStory ||
    project?.completion_notes ||
    null;

  const media = meta.media || [];
  const coverImage = meta.coverImage || null;
  const fundingCents = credits?.donations?.projectTotalCents ?? null;
  const tasksCompleted = pulse?.tasksCompleted;

  const developmentBySub = useMemo(() => {
    const cat = CONTRIBUTION_CATEGORIES.find((c) => c.id === 'development');
    return groupBySubcategory(
      credits?.development || [],
      cat?.subcategories || []
    );
  }, [credits]);

  const marketingBySub = useMemo(() => {
    const cat = CONTRIBUTION_CATEGORIES.find((c) => c.id === 'marketing');
    return groupBySubcategory(
      credits?.marketing || [],
      cat?.subcategories || []
    );
  }, [credits]);

  const communityBySub = useMemo(() => {
    const cat = CONTRIBUTION_CATEGORIES.find((c) => c.id === 'community');
    return groupBySubcategory(
      credits?.community || [],
      cat?.subcategories || []
    );
  }, [credits]);

  const creditPreview = useMemo(() => {
    const people = [];
    const seen = new Set();
    const push = (row) => {
      const key = row.userId || row.username || row.displayName;
      if (!key || seen.has(key)) return;
      seen.add(key);
      people.push(row);
    };
    for (const [, list] of developmentBySub) list.forEach(push);
    for (const [, list] of marketingBySub) list.forEach(push);
    for (const [, list] of communityBySub) list.forEach(push);
    for (const d of credits?.donations?.namedDonors || []) {
      push({
        ...d,
        subcategory: 'Supporter',
        roleLabel: d.roleLabel || 'Supporter',
      });
    }
    return people.slice(0, 12);
  }, [developmentBySub, marketingBySub, communityBySub, credits]);

  const totalCreditCount = useMemo(() => {
    const seen = new Set();
    const add = (row) => {
      const key = row.userId || row.username || row.displayName;
      if (key) seen.add(key);
    };
    for (const r of credits?.development || []) add(r);
    for (const r of credits?.marketing || []) add(r);
    for (const r of credits?.community || []) add(r);
    for (const d of credits?.donations?.namedDonors || []) add(d);
    return seen.size;
  }, [credits]);

  const platformsLabel =
    meta.platforms.length > 0 ? meta.platforms.join(' · ') : null;
  const genreLabel = meta.genre.length > 0 ? meta.genre.join(' · ') : null;

  const steamReviews = meta.steamReviews || emptyReleaseMeta().steamReviews;
  const hasSteamData = hasSteamReviews(steamReviews);
  const steamRecentLine = formatSteamRecentLine(steamReviews.recent);
  const steamOverallLine = formatSteamOverallLine(steamReviews.overall);

  const projectSlug = project?.slug || slug;

  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      {/* Header banner */}
      <header className="relative pt-20 overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <img
            src={coverImage || RELEASED_BANNER_SRC}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-[center_40%] sm:object-center"
            decoding="async"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-cyber-bg/55" />
          <div className="absolute inset-0 bg-gradient-to-r from-cyber-bg/96 via-cyber-bg/85 to-cyber-bg/40" />
          <div className="absolute inset-0 bg-gradient-to-b from-cyber-bg/70 via-cyber-bg/25 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgb(var(--tf-forge-gold)/0.12)_0%,transparent_55%)]" />
        </div>
        <div
          className="absolute bottom-0 inset-x-0 h-24 sm:h-28 pointer-events-none z-[5] bg-gradient-to-b from-transparent via-cyber-bg/50 to-cyber-bg"
          aria-hidden="true"
        />

        <div className="container-custom relative z-10 py-10 sm:py-12 md:py-14 min-h-[16rem] sm:min-h-[18rem] flex flex-col justify-center">
          <Link
            to="/released"
            className="inline-flex items-center gap-1.5 text-xs font-mono tracking-widest text-neon-cyan hover:text-white mb-5 w-fit [text-shadow:0_1px_2px_rgb(0_0_0_/_0.9)]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All released games
          </Link>

          {loading ? (
            <p className="text-sm font-mono tracking-widest text-white/70">
              Loading release…
            </p>
          ) : (
            <div className="max-w-3xl [text-shadow:0_1px_2px_rgb(0_0_0_/_0.9),0_2px_16px_rgb(0_0_0_/_0.55)]">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="section-header mb-0">Released</div>
                {project?.phase && (
                  <Badge variant={phaseBadgeVariant(project.phase)}>
                    {project.phase}
                  </Badge>
                )}
                {shipped && <Badge variant="gold">Shipped</Badge>}
                {(project?._isDemoRelease || isDemoReleaseKey(project?.slug)) && (
                  <Badge variant="purple">Demo preview</Badge>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-3">
                {title}
              </h1>
              {tagline && (
                <p className="text-base sm:text-lg text-white/85 leading-relaxed max-w-2xl mb-4">
                  {tagline}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/75">
                {when && (
                  <span className="inline-flex items-center gap-1.5 font-mono tracking-wide uppercase text-xs">
                    <Calendar className="w-3.5 h-3.5 text-forge-gold" />
                    Released {when}
                  </span>
                )}
                {project?.phase && (
                  <span className="inline-flex items-center gap-1.5 font-mono tracking-wide uppercase text-xs">
                    <Layers className="w-3.5 h-3.5 text-neon-cyan" />
                    Origin: {project.phase} phase
                  </span>
                )}
              </div>

              {links.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2.5">
                  {links.map((link, i) => {
                    const primary = i === 0;
                    return (
                      <a
                        key={`${link.url}-${link.label}`}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          size="lg"
                          variant={primary ? 'primary' : 'secondary'}
                          className="gap-2"
                        >
                          <Gamepad2 className="w-4 h-4" />
                          {link.label}
                          <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                        </Button>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="container-custom relative z-10 py-12 md:py-16 max-w-5xl space-y-12 md:space-y-16">
        {error && (
          <Card className="p-5 sm:p-6 text-sm text-text-secondary border-dashed">
            <p>{error}</p>
            {!shipped && project && (
              <p className="mt-2 text-text-muted">
                This project is not marked complete yet. You can still open the{' '}
                <Link
                  to={`/projects/${projectSlug}`}
                  className="text-neon-cyan hover:text-white"
                >
                  workspace
                </Link>
                .
              </p>
            )}
            <div className="mt-4">
              <Link to="/released">
                <Button variant="secondary" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Released Games
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {!loading && project && (
          <>
            {/* Overview */}
            <section aria-labelledby="overview-heading">
              <h2 id="overview-heading" className="section-header mb-4">
                Overview
              </h2>
              {overview ? (
                <Card className="p-5 sm:p-7">
                  <p className="text-text-secondary leading-relaxed whitespace-pre-wrap text-sm sm:text-base">
                    {overview}
                  </p>
                </Card>
              ) : (
                <Card className="p-5 sm:p-6 border-dashed">
                  <p className="text-sm text-text-muted">
                    Full description coming soon.
                  </p>
                </Card>
              )}
            </section>

            {/* Media gallery */}
            <section aria-labelledby="media-heading">
              <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                <h2 id="media-heading" className="section-header mb-0">
                  Media
                </h2>
                {media.length > 0 && (
                  <p className="text-xs font-mono tracking-widest text-text-muted uppercase">
                    {media.length} image{media.length === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              {media.length > 0 ? (
                <ul className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 list-none p-0 m-0">
                  {media.map((item, i) => (
                    <li key={`${item.url}-${i}`}>
                      <button
                        type="button"
                        onClick={() => setLightbox(item)}
                        className="group relative block w-full aspect-video rounded-xl overflow-hidden border border-cyber-border bg-cyber-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
                      >
                        <img
                          src={item.url}
                          alt={item.alt || `Screenshot ${i + 1}`}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          loading="lazy"
                          decoding="async"
                        />
                        <span className="absolute inset-0 bg-cyber-bg/0 group-hover:bg-cyber-bg/25 transition-colors" />
                      </button>
                      {item.caption && (
                        <p className="mt-1.5 text-xs text-text-muted px-0.5">
                          {item.caption}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <Card className="p-6 sm:p-8 border-dashed flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl border border-cyber-border bg-cyber-surface text-text-muted shrink-0">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-white mb-1">
                      Screenshots coming soon
                    </p>
                    <p className="text-sm text-text-muted leading-relaxed">
                      Key art and gameplay shots will appear here once they are
                      added for this release.
                    </p>
                  </div>
                </Card>
              )}
            </section>

            {/* Key facts */}
            <section aria-labelledby="facts-heading">
              <h2 id="facts-heading" className="section-header mb-4">
                Key Facts
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <FactCell
                  icon={Monitor}
                  label="Platforms"
                  value={platformsLabel}
                />
                <FactCell
                  icon={Gamepad2}
                  label="Genre"
                  value={genreLabel}
                />
                <FactCell
                  icon={Heart}
                  label="Community funding"
                  emphasize
                  value={
                    fundingCents != null && fundingCents > 0
                      ? formatUsdFromCents(fundingCents)
                      : null
                  }
                  emptyLabel="No attributed funding yet"
                />
                <FactCell
                  icon={CheckCircle2}
                  label="Tasks completed"
                  emphasize
                  value={
                    tasksCompleted != null && tasksCompleted > 0
                      ? String(tasksCompleted)
                      : null
                  }
                  emptyLabel="Not tracked yet"
                />
                <FactCell
                  icon={Layers}
                  label="Studio phase"
                  emphasize
                  value={project.phase || null}
                />
              </div>

              {/* Steam Reviews — dedicated row so Recent + Overall stay readable */}
              <div className="mt-3 sm:mt-4">
                <div className="rounded-xl border border-cyber-border bg-cyber-surface/60 px-4 py-6 sm:px-6 sm:py-8">
                  <div className="flex flex-col items-center text-center gap-2 mb-6">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-forge-gold/35 bg-forge-gold/10 text-forge-gold">
                      <Star className="w-4 h-4" aria-hidden />
                    </span>
                    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                      <p className="text-[11px] font-mono tracking-widest uppercase text-text-muted">
                        Steam Reviews
                      </p>
                      {steamReviews?.url && (
                        <a
                          href={steamReviews.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-mono tracking-wide text-neon-cyan hover:text-white"
                        >
                          Store page
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {hasSteamData ? (
                    <dl className="grid sm:grid-cols-2 gap-6 sm:gap-8">
                      <div className="flex flex-col items-center text-center gap-2 sm:border-r sm:border-cyber-border/70 sm:pr-4">
                        <dt className="text-[11px] font-mono tracking-widest uppercase text-text-muted">
                          Recent
                        </dt>
                        <dd className="text-xl sm:text-2xl font-bold text-white leading-snug max-w-sm">
                          {steamRecentLine || (
                            <span className="text-base font-normal italic text-text-muted">
                              Not yet available
                            </span>
                          )}
                        </dd>
                      </div>
                      <div className="flex flex-col items-center text-center gap-2">
                        <dt className="text-[11px] font-mono tracking-widest uppercase text-text-muted">
                          Overall
                        </dt>
                        <dd className="text-xl sm:text-2xl font-bold text-white leading-snug max-w-sm">
                          {steamOverallLine || (
                            <span className="text-base font-normal italic text-text-muted">
                              Not yet available
                            </span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-center text-sm sm:text-base text-text-muted italic py-2">
                      Not yet available
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* How it was made */}
            {developmentStory && (
              <section aria-labelledby="story-heading">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-4 h-4 text-forge-gold" />
                  <h2 id="story-heading" className="section-header mb-0">
                    How it was made
                  </h2>
                </div>
                <Card className="p-5 sm:p-7 cyber-card-gold">
                  <p className="text-text-secondary leading-relaxed whitespace-pre-wrap text-sm sm:text-base">
                    {developmentStory}
                  </p>
                </Card>
              </section>
            )}

            {/* Related / origin ideas — fixed height, scroll for long lists */}
            {relatedIdeas.length > 0 && (
              <section aria-labelledby="ideas-heading">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-neon-cyan" />
                    <h2 id="ideas-heading" className="section-header mb-0">
                      Community ideas
                    </h2>
                  </div>
                  <p className="text-xs font-mono tracking-widest text-text-muted uppercase">
                    {relatedIdeas.length} idea
                    {relatedIdeas.length === 1 ? '' : 's'}
                  </p>
                </div>
                <p className="text-sm text-text-muted mb-4 max-w-2xl">
                  Ideas linked to this project while it was in development.
                </p>
                <div className="relative rounded-xl border border-cyber-border bg-cyber-surface/40 overflow-hidden">
                  <div
                    className="max-h-[22rem] sm:max-h-[26rem] overflow-y-auto overscroll-contain p-3 sm:p-4 scroll-smooth [scrollbar-gutter:stable]"
                    role="region"
                    aria-label="Community ideas list"
                    tabIndex={0}
                  >
                    <ul className="grid sm:grid-cols-2 gap-3 list-none p-0 m-0">
                      {relatedIdeas.map((idea) => {
                        const isDemoIdea =
                          String(idea.id || '').startsWith('demo-');
                        const inner = (
                          <Card
                            interactive={!isDemoIdea}
                            className={`p-4 h-full ${
                              isDemoIdea
                                ? ''
                                : 'hover:border-neon-cyan/40 transition-colors'
                            }`}
                          >
                            <p className="font-semibold text-white line-clamp-2">
                              {idea.title || 'Untitled idea'}
                            </p>
                            {(idea.summary || idea.description) && (
                              <p className="mt-1.5 text-xs text-text-muted line-clamp-2">
                                {idea.summary || idea.description}
                              </p>
                            )}
                            {!isDemoIdea && (
                              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-neon-cyan">
                                View idea
                                <ArrowRight className="w-3 h-3" />
                              </span>
                            )}
                            {isDemoIdea && (
                              <span className="mt-3 inline-block text-[11px] font-mono tracking-widest uppercase text-text-muted">
                                Demo sample
                              </span>
                            )}
                          </Card>
                        );
                        return (
                          <li key={idea.id}>
                            {isDemoIdea ? (
                              inner
                            ) : (
                              <Link to={`/ideas/${idea.id}`}>{inner}</Link>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  {/* Soft edge hint when content can scroll */}
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-cyber-bg/90 to-transparent"
                    aria-hidden="true"
                  />
                </div>
              </section>
            )}

            {/* Credits */}
            <section aria-labelledby="credits-heading">
              <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-neon-cyan" />
                  <h2 id="credits-heading" className="section-header mb-0">
                    Credits
                  </h2>
                </div>
                {totalCreditCount > 0 && (
                  <p className="text-xs font-mono tracking-widest text-text-muted uppercase">
                    {totalCreditCount} people credited
                  </p>
                )}
              </div>
              <p className="text-sm text-text-muted mb-5 max-w-2xl">
                Everyone who helped ship this title. Roles appear when recorded.
                Full breakdown lives on the project Contributors page.
              </p>

              {creditPreview.length === 0 ? (
                <Card className="p-5 sm:p-6 border-dashed space-y-4">
                  <p className="text-sm text-text-muted">
                    Credits will appear here as task completions, donations, and
                    staff-curated contributions are recorded for this project.
                  </p>
                  <Link to={`/projects/${projectSlug}/contributors`}>
                    <Button variant="secondary" className="gap-2">
                      <Users className="w-4 h-4" />
                      Project Contributors
                    </Button>
                  </Link>
                </Card>
              ) : (
                <div className="space-y-6">
                  {/* Named supporters strip when funding exists */}
                  {(credits?.donations?.namedDonors || []).length > 0 && (
                    <Card className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Heart className="w-3.5 h-3.5 text-neon-magenta" />
                        <h3 className="font-mono text-xs tracking-widest uppercase text-neon-cyan">
                          Named supporters
                        </h3>
                      </div>
                      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1">
                        {credits.donations.namedDonors
                          .slice(0, 9)
                          .map((d) => (
                            <PersonChip
                              key={d.userId || d.username || d.displayName}
                              person={{
                                ...d,
                                roleLabel: 'Supporter',
                              }}
                            />
                          ))}
                      </ul>
                      {(fundingCents || 0) > 0 && (
                        <p className="mt-4 text-xs text-text-muted border-t border-cyber-border pt-3">
                          Community funding attributed while active:{' '}
                          <span className="text-white font-semibold">
                            {formatUsdFromCents(fundingCents)}
                          </span>
                          {(credits.donations.anonymousCents || 0) > 0 && (
                            <>
                              {' '}
                              (includes{' '}
                              {formatUsdFromCents(
                                credits.donations.anonymousCents
                              )}{' '}
                              anonymous)
                            </>
                          )}
                        </p>
                      )}
                    </Card>
                  )}

                  {/* Development by role */}
                  {developmentBySub.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-mono text-xs tracking-widest uppercase text-neon-cyan">
                        Development
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {developmentBySub.map(([sub, people]) => (
                          <Card key={sub} className="p-4 sm:p-5">
                            <h4 className="text-xs font-mono tracking-widest uppercase text-text-muted mb-2">
                              {sub}
                            </h4>
                            <ul>
                              {people.map((p) => (
                                <PersonChip
                                  key={p.id || p.userId || p.username}
                                  person={p}
                                />
                              ))}
                            </ul>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {marketingBySub.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-mono text-xs tracking-widest uppercase text-neon-cyan">
                        Marketing / Content
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {marketingBySub.map(([sub, people]) => (
                          <Card key={sub} className="p-4 sm:p-5">
                            <h4 className="text-xs font-mono tracking-widest uppercase text-text-muted mb-2">
                              {sub}
                            </h4>
                            <ul>
                              {people.map((p) => (
                                <PersonChip
                                  key={p.id || p.userId || p.username}
                                  person={p}
                                />
                              ))}
                            </ul>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {communityBySub.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-mono text-xs tracking-widest uppercase text-neon-cyan">
                        Community &amp; Support
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {communityBySub.map(([sub, people]) => (
                          <Card key={sub} className="p-4 sm:p-5">
                            <h4 className="text-xs font-mono tracking-widest uppercase text-text-muted mb-2">
                              {sub}
                            </h4>
                            <ul>
                              {people.map((p) => (
                                <PersonChip
                                  key={p.id || p.userId || p.username}
                                  person={p}
                                />
                              ))}
                            </ul>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
                    <p className="text-sm text-text-muted max-w-md">
                      See every category, subcategory, and supporter on this
                      project&apos;s Contributors page.
                    </p>
                    <Link to={`/projects/${projectSlug}/contributors`}>
                      <Button className="gap-2 w-full sm:w-auto">
                        <Users className="w-4 h-4" />
                        Project Contributors
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </section>

            {/* Bottom CTAs */}
            <section
              aria-labelledby="next-heading"
              className="pt-4 border-t border-cyber-border"
            >
              <h2 id="next-heading" className="section-header mb-5">
                What&apos;s next
              </h2>
              <div className="grid sm:grid-cols-3 gap-4">
                <Link to="/released" className="block h-full">
                  <Card
                    interactive
                    className="p-5 h-full flex flex-col cyber-card-gold"
                  >
                    <Package className="w-5 h-5 text-forge-gold mb-3" />
                    <h3 className="font-semibold text-white mb-1">
                      All Released Games
                    </h3>
                    <p className="text-sm text-text-muted flex-1">
                      Browse every finished title with credits and play links.
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-neon-cyan">
                      View catalog
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </Card>
                </Link>
                <Link to="/donate" className="block h-full">
                  <Card interactive className="p-5 h-full flex flex-col">
                    <HandHeart className="w-5 h-5 text-neon-magenta mb-3" />
                    <h3 className="font-semibold text-white mb-1">
                      Donate to Together Forge
                    </h3>
                    <p className="text-sm text-text-muted flex-1">
                      Help fund the next ship. Donations keep independent work
                      moving.
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-neon-cyan">
                      Support the forge
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </Card>
                </Link>
                <Link to="/get-involved" className="block h-full">
                  <Card interactive className="p-5 h-full flex flex-col">
                    <Rocket className="w-5 h-5 text-neon-cyan mb-3" />
                    <h3 className="font-semibold text-white mb-1">
                      Get Involved
                    </h3>
                    <p className="text-sm text-text-muted flex-1">
                      Claim tasks, submit ideas, and help build what ships next.
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-neon-cyan">
                      Join in
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </Card>
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <Link
                  to={`/projects/${projectSlug}`}
                  className="text-text-muted hover:text-neon-cyan"
                >
                  Project workspace
                </Link>
                <span className="text-cyber-border">·</span>
                <Link
                  to={`/projects/${projectSlug}/contributors`}
                  className="text-text-muted hover:text-neon-cyan"
                >
                  Contributors
                </Link>
                <span className="text-cyber-border">·</span>
                <Link
                  to="/released"
                  className="text-text-muted hover:text-neon-cyan"
                >
                  All releases
                </Link>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Simple lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cyber-bg/90 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.alt || 'Screenshot'}
          onClick={() => setLightbox(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setLightbox(null);
          }}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-sm font-mono tracking-widest text-white/80 hover:text-white uppercase"
            onClick={() => setLightbox(null)}
          >
            Close
          </button>
          <img
            src={lightbox.url}
            alt={lightbox.alt || 'Screenshot'}
            className="max-w-full max-h-[85vh] rounded-xl border border-cyber-border shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {lightbox.caption && (
            <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-white/80 text-center max-w-lg px-4">
              {lightbox.caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ReleasedGameDetail;
