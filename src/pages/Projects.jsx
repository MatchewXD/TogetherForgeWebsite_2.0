/**
 * Projects - pipeline landing page.
 * Vision intro → three phase cards → featured Early project → closing line.
 */

import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Hammer,
  Layers,
  Rocket,
  Globe2,
  Sparkles,
} from 'lucide-react';

import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import BannerImage from '../components/ui/BannerImage';
import { useIsModerator } from '../hooks/useIsModerator';
import { phaseImageSrc, phaseImageAlt } from '../utils/phaseImages';
import { SHOW_RELEASED_GAMES } from '../constants/featureFlags';

/** Phase cards: keep existing destination routes. */
const PHASES = [
  {
    id: 'early',
    label: 'Early',
    status: 'Open now',
    open: true,
    summary:
      'A series of smaller cooperative games built with the community. The goal is to learn how we create together, ship real playable experiences, and prove the Together Forge model works.',
    href: '/projects/early',
    cta: 'Open workspace',
    icon: Hammer,
    badgeVariant: 'gold',
    frameClass: 'cyber-card-gold',
    accentClass: 'text-forge-gold',
    titleHoverClass: 'group-hover:text-forge-gold',
  },
  {
    id: 'mid',
    label: 'Mid',
    status: 'Coming Soon',
    open: false,
    summary:
      'Next up after Early is completed: cooperative games at the scale of Halo, Horizon Zero Dawn, and Skyrim, with deeper systems, dynamic worlds, and stronger teamwork. Not open for claims yet.',
    href: '/projects/mid',
    cta: 'View plans',
    icon: Rocket,
    badgeVariant: 'purple',
    frameClass: 'cyber-card-purple',
    accentClass: 'text-neon-purple',
    titleHoverClass: 'group-hover:text-neon-purple',
  },
  {
    id: 'late',
    label: 'Late',
    status: 'Coming Soon',
    open: false,
    summary:
      'The magnum opus. After Early and Mid prove the model, we build the best cooperative MMORPG in the world. Not a clone of existing systems, but a living world with evolving threats, player colonies, large-scale cooperation, and systems that push past what current games offer. The game will keep growing for years with dedicated support.',
    href: '/projects/late',
    cta: 'View plans',
    icon: Globe2,
    badgeVariant: 'gold',
    frameClass: '',
    accentClass: 'text-forge-gold',
    titleHoverClass: 'group-hover:text-forge-gold',
  },
];

const FEATURED_PROJECT = {
  id: 'tether',
  title: 'Tether',
  phase: 'Early',
  status: 'In Development',
  description:
    'A tethered crew crosses dangerous semi-procedural levels to reach a destroyed orbital station. Linked by a shared energy tether, players must coordinate movement, manage tension and momentum, collect critical resources for their stranded colony, and ultimately recover an antimatter generator that will let the colony survive on its own. Teamwork tools grow stronger when used together, while simple enemies try to break the tether. The tone is serious and the stakes are real: the people waiting below are counting on the crew.',
  href: '/projects/tether/board',
};

const PROJECTS_BANNER_SRC = '/images/Projects_Page.webp';

const Projects = () => {
  const { isModerator } = useIsModerator();

  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      {/* Page header banner — taller so the image can dissolve into the page */}
      <header className="relative pt-20 overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <BannerImage
            src={PROJECTS_BANNER_SRC}
            className="absolute inset-0 w-full h-full object-cover object-[center_35%] sm:object-center"
            fetchPriority="high"
          />
          <div className="tf-banner-scrim" />
        </div>
        <div className="tf-banner-fade h-40 sm:h-48 md:h-56" aria-hidden="true" />

        <div className="container-custom relative z-10 flex flex-col justify-center min-h-[20rem] sm:min-h-[22rem] md:min-h-[26rem] pt-10 sm:pt-12 md:pt-14 pb-20 sm:pb-24 md:pb-28">
          <div className="max-w-3xl [text-shadow:0_1px_3px_rgb(0_0_0_/_0.95),0_4px_24px_rgb(0_0_0_/_0.7)]">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <div className="section-header">Studio pipeline</div>
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white">
                  Projects
                </h1>
              </div>
              {isModerator && (
                <Link
                  to="/projects/edit"
                  className="shrink-0 text-xs font-mono tracking-widest px-3 py-1.5 rounded-full border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10 transition-colors bg-cyber-bg/90 sm:mt-6 [text-shadow:none]"
                >
                  Edit Page
                </Link>
              )}
            </div>
            <p className="text-base sm:text-lg text-white/85 leading-relaxed max-w-3xl">
              Together Forge has three major phases on the path to becoming the
              best &ldquo;By the Community, For the Community&rdquo; game company
              in the world.
            </p>
          </div>
        </div>
      </header>

      {/* Overlap the fade slightly so content continues the dissolve */}
      <div className="container-custom relative z-10 -mt-6 sm:-mt-8 pb-16 md:pb-20 pt-2 md:pt-4">
        {/* Divider: intro → phase vision */}
        <div
          className="mb-10 md:mb-12 flex items-center gap-4"
          role="separator"
          aria-label="Studio stages"
        >
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyber-border to-cyber-border" />
          <span className="shrink-0 text-[10px] font-mono tracking-[0.2em] uppercase text-text-muted">
            The path
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-cyber-border to-cyber-border" />
        </div>

        {/* 2. Early / Mid / Late vision cards */}
        <section
          aria-labelledby="vision-heading"
          className="mb-14 md:mb-16 w-full"
        >
          <h2 id="vision-heading" className="sr-only">
            Early, Mid, and Late Game
          </h2>
          <div className="grid md:grid-cols-3 gap-5 md:gap-6">
            <Card className="cyber-card-gold bg-cyber-card/80 p-5 sm:p-6 h-full">
              <h3 className="font-mono text-xs tracking-widest uppercase text-forge-gold mb-3 flex items-center gap-2">
                <Hammer className="w-3.5 h-3.5" />
                Early
              </h3>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                A series of smaller cooperative games built with the community.
                The goal is to learn how we create together, ship real playable
                experiences, and prove the Together Forge model works.
              </p>
            </Card>

            <Card className="cyber-card-purple bg-cyber-card/80 p-5 sm:p-6 h-full">
              <h3 className="font-mono text-xs tracking-widest uppercase text-neon-purple mb-3 flex items-center gap-2">
                <Rocket className="w-3.5 h-3.5" />
                Mid
              </h3>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                Next up after Early is completed: cooperative games at the scale
                of Halo, Horizon Zero Dawn, and Skyrim, with deeper systems,
                dynamic worlds, and stronger teamwork. Not open for claims yet.
              </p>
            </Card>

            <Card className="bg-cyber-card/80 border-cyber-border p-5 sm:p-6 h-full">
              <h3 className="font-mono text-xs tracking-widest uppercase text-forge-gold mb-3 flex items-center gap-2">
                <Globe2 className="w-3.5 h-3.5" />
                Late
              </h3>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                The magnum opus. After Early and Mid prove the model, we build
                the best cooperative MMORPG in the world. Not a clone of
                existing systems, but a living world with evolving threats,
                player colonies, large-scale cooperation, and systems that push
                past what current games offer. The game will keep growing for
                years with dedicated support.
              </p>
            </Card>
          </div>

          <p className="mt-8 text-sm sm:text-base text-text-secondary leading-relaxed max-w-3xl">
            Right now, in Early, Together Forge only has the capacity to work on
            one game at a time. As the company grows we will expand to multiple
            projects running in parallel.
          </p>
        </section>

        {/* 3. Three phase cards */}
        <section aria-labelledby="phases-heading" className="mb-12 md:mb-14">
          <div className="flex items-center gap-2 mb-6">
            <Layers className="w-4 h-4 text-neon-cyan" />
            <h2
              id="phases-heading"
              className="font-mono text-xs tracking-widest uppercase text-text-muted"
            >
              Studio phases
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6">
            {PHASES.map((phase) => {
              const Icon = phase.icon;
              const coverSrc = phaseImageSrc(phase.label);

              return (
                <Link
                  key={phase.id}
                  to={phase.href}
                  className="group block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg"
                >
                  <Card
                    interactive
                    variant={phase.open ? 'panel' : 'subtle'}
                    className={`h-full flex flex-col overflow-hidden p-0 ${phase.frameClass || ''}`}
                  >
                    <div className="relative h-36 sm:h-40 overflow-hidden border-b border-cyber-border bg-cyber-surface">
                      {coverSrc ? (
                        <BannerImage
                          src={coverSrc}
                          alt={phaseImageAlt(phase.label)}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          loading="lazy"
                          sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Icon
                            className={`w-10 h-10 opacity-40 ${phase.accentClass}`}
                          />
                        </div>
                      )}
                      <div
                        className="absolute inset-0 bg-gradient-to-t from-cyber-card via-cyber-card/30 to-transparent pointer-events-none"
                        aria-hidden="true"
                      />
                      {/* Status only on image — phase name appears once as the card title */}
                      <div className="absolute top-3 left-3 right-3 flex flex-wrap justify-end gap-2 z-10">
                        <Badge
                          variant={phase.badgeVariant}
                          className={
                            phase.badgeVariant === 'gold'
                              ? phase.id === 'early'
                                ? '!bg-forge-gold/15 !text-forge-gold !border-forge-gold/50 !shadow-none'
                                : ''
                              : phase.badgeVariant === 'purple'
                                ? '!bg-neon-purple/30 !text-purple-100 !border-neon-purple/70 !shadow-none'
                                : ''
                          }
                        >
                          {phase.status}
                        </Badge>
                      </div>
                      <div className="absolute bottom-3 left-3 z-10">
                        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-white/15 bg-cyber-bg/80">
                          <Icon className={`w-4 h-4 ${phase.accentClass}`} />
                        </span>
                      </div>
                    </div>

                    <div className="p-5 sm:p-6 flex flex-col flex-1">
                      <h3
                        className={`text-xl font-bold text-white mb-2 transition-colors ${phase.titleHoverClass}`}
                      >
                        {phase.label}
                      </h3>
                      <p className="text-sm text-text-secondary leading-relaxed flex-1 mb-6">
                        {phase.summary}
                      </p>

                      <div className="pt-4 border-t border-cyber-border flex items-center justify-between gap-3">
                        <span className="text-xs font-sans text-text-muted tracking-wide">
                          {phase.open ? 'Live workspace' : 'Planned phase'}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-sans font-semibold tracking-widest shrink-0 ${
                            phase.id === 'early' || phase.id === 'mid'
                              ? phase.accentClass
                              : 'text-text-muted'
                          }`}
                        >
                          {phase.cta}
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 4. Featured current project (one game at a time) */}
        <section
          aria-labelledby="featured-heading"
          className="mb-12 md:mb-14"
        >
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-4 h-4 text-neon-cyan" />
            <h2
              id="featured-heading"
              className="font-mono text-xs tracking-widest uppercase text-text-muted"
            >
              Active project · Early
            </h2>
          </div>

          <Link
            to={FEATURED_PROJECT.href}
            className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg"
          >
            <Card
              interactive
              variant="panel"
              className="overflow-hidden p-0 md:grid md:grid-cols-12"
            >
              <div className="relative md:col-span-5 min-h-[12rem] md:min-h-full border-b md:border-b-0 md:border-r border-cyber-border bg-cyber-surface">
                {phaseImageSrc(FEATURED_PROJECT.phase) ? (
                  <BannerImage
                    src={phaseImageSrc(FEATURED_PROJECT.phase)}
                    alt={phaseImageAlt(
                      FEATURED_PROJECT.phase,
                      FEATURED_PROJECT.title
                    )}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    loading="lazy"
                    sizes="(min-width: 768px) 42vw, 100vw"
                  />
                ) : null}
                <div
                  className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-cyber-card via-cyber-card/40 to-transparent pointer-events-none"
                  aria-hidden="true"
                />
                <div className="absolute top-3 left-3 flex flex-wrap gap-2 z-10">
                  <Badge variant="gold">Featured</Badge>
                  <Badge variant="neon">{FEATURED_PROJECT.phase}</Badge>
                </div>
              </div>

              <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-center">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge variant="default">{FEATURED_PROJECT.status}</Badge>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3 group-hover:text-neon-cyan transition-colors">
                  {FEATURED_PROJECT.title}
                </h3>
                <p className="text-sm sm:text-base text-text-secondary leading-relaxed mb-6 max-w-2xl">
                  {FEATURED_PROJECT.description}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-neon-cyan">
                    Open task board
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                  </span>
                  <span className="text-xs text-text-muted font-mono">
                    /projects/{FEATURED_PROJECT.id}/board
                  </span>
                </div>
              </div>
            </Card>
          </Link>
        </section>

        {/* 5. Released catalog (when public) + closing */}
        <div className="mt-10 mb-4 text-center space-y-3">
          {SHOW_RELEASED_GAMES ? (
            <Link
              to="/released"
              className="inline-flex items-center gap-2 text-sm font-semibold text-neon-cyan hover:text-white"
            >
              Released Games
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : null}
          <p className="text-xs font-mono tracking-widest text-text-muted">
            More projects will appear here as the forge grows.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Projects;
