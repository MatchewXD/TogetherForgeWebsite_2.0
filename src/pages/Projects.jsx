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
import { useIsModerator } from '../hooks/useIsModerator';
import { phaseImageSrc, phaseImageAlt } from '../utils/phaseImages';

/** Phase cards: keep existing destination routes. */
const PHASES = [
  {
    id: 'early',
    label: 'Early',
    status: 'Open now',
    open: true,
    summary:
      'Smaller cooperative games built with the community. Prove the model, ship playable experiences, learn how we create together.',
    href: '/projects/early',
    cta: 'Open workspace',
    icon: Hammer,
    badgeVariant: 'neon',
  },
  {
    id: 'mid',
    label: 'Mid',
    status: 'Coming Soon',
    open: false,
    summary:
      'Larger cooperative games on the scale of Halo, Horizon Zero Dawn, and Palworld. Opens after Early is complete.',
    href: '/projects/mid',
    cta: 'View plans',
    icon: Rocket,
    badgeVariant: 'purple',
  },
  {
    id: 'late',
    label: 'Late',
    status: 'Coming Soon',
    open: false,
    summary:
      'The long-term goal: a completely new kind of MMORPG built and evolved with the community. Opens after Mid.',
    href: '/projects/late',
    cta: 'View plans',
    icon: Globe2,
    badgeVariant: 'gold',
  },
];

const FEATURED_PROJECT = {
  id: 'prototype-systems',
  title: 'Tether',
  phase: 'Early',
  status: 'In Development',
  description:
    'A tethered crew crosses dangerous semi-procedural levels to reach a destroyed orbital station. Linked by a shared energy tether, players must coordinate movement, manage tension and momentum, collect critical resources for their stranded colony, and ultimately recover an antimatter generator that will let the colony survive on its own. Teamwork tools grow stronger when used together, while simple enemies try to break the tether. The tone is serious and the stakes are real: the people waiting below are counting on the crew.',
  href: '/projects/prototype-systems',
};

const Projects = () => {
  const { isModerator } = useIsModerator();

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      {/* Atmosphere */}
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.06)_0%,transparent_50%),radial-gradient(ellipse_at_bottom_right,rgb(var(--tf-forge-gold)/0.04)_0%,transparent_45%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,249,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,249,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden="true"
      />

      <div className="container-custom relative z-10 py-12 md:py-16">
        {/* 1. Page title — cyan color + accent bar (from former "Pipeline" label) */}
        <header className="mb-12 md:mb-14 max-w-3xl">
          <h1 className="relative w-fit max-w-full text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-neon-cyan pb-2 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-[60px] after:h-0.5 after:bg-gradient-to-r after:from-neon-cyan after:to-neon-magenta">
            Projects
          </h1>
          {isModerator && (
            <div className="mt-6">
              <Link
                to="/projects/edit"
                className="text-xs font-mono tracking-widest px-3 py-1.5 rounded-full border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
              >
                Edit Page
              </Link>
            </div>
          )}
        </header>

        {/* 2. Vision intro — full content width */}
        <section
          aria-labelledby="vision-heading"
          className="mb-14 md:mb-16 w-full"
        >
          <div className="relative w-full rounded-2xl border border-cyber-border bg-cyber-card/50 p-6 sm:p-8 md:p-10 lg:p-12 overflow-hidden">
            <div
              className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-neon-cyan/5 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-12 w-56 h-56 rounded-full bg-neon-purple/5 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative space-y-8 md:space-y-10">
              <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-5xl">
                Together Forge has three major phases on the path to becoming
                the best &ldquo;By the Community, For the Community&rdquo; game
                company in the world.
              </p>

              <div className="grid md:grid-cols-3 gap-6 md:gap-8">
                <div>
                  <h2
                    id="vision-heading"
                    className="font-mono text-xs tracking-widest uppercase text-neon-cyan mb-3 flex items-center gap-2"
                  >
                    <Hammer className="w-3.5 h-3.5" />
                    Early
                  </h2>
                  <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                    A series of smaller cooperative games built with the
                    community. The goal is to learn how we create together, ship
                    real playable experiences, and prove the Together Forge model
                    works.
                  </p>
                </div>

                <div>
                  <h3 className="font-mono text-xs tracking-widest uppercase text-neon-purple mb-3 flex items-center gap-2">
                    <Rocket className="w-3.5 h-3.5" />
                    Mid
                  </h3>
                  <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                    Once the model is proven, we scale up. These will be
                    competing games on the level of Halo, Horizon Zero Dawn, and
                    Palworld. They will still be fully cooperative and still
                    built by the community, just much larger in scope and
                    systems.
                  </p>
                </div>

                <div>
                  <h3 className="font-mono text-xs tracking-widest uppercase text-forge-gold mb-3 flex items-center gap-2">
                    <Globe2 className="w-3.5 h-3.5" />
                    Late
                  </h3>
                  <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                    After shipping multiple strong games with the community, we
                    go all the way. The goal is the number one MMORPG in the
                    world. Not another clone, but a completely new experience.
                    We will use the mechanics and cooperative loops discovered
                    in Early and Mid, plus new technology developed along the
                    way, to create something more advanced than anything that
                    has come before. With ongoing community participation the
                    game will keep evolving for years, scaling with both the
                    players and the developers.
                  </p>
                </div>
              </div>

              <p className="text-sm sm:text-base text-text-secondary leading-relaxed border-t border-cyber-border pt-6 max-w-5xl">
                Right now, in Early, Together Forge only has the capacity to
                work on one game at a time. As the company grows we will expand
                to multiple projects running in parallel.
              </p>
            </div>
          </div>
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
                    className="h-full flex flex-col overflow-hidden p-0"
                  >
                    <div className="relative h-36 sm:h-40 overflow-hidden border-b border-cyber-border bg-cyber-surface">
                      {coverSrc ? (
                        <img
                          src={coverSrc}
                          alt={phaseImageAlt(phase.label)}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Icon className="w-10 h-10 text-neon-cyan opacity-40" />
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
                            phase.badgeVariant === 'neon'
                              ? '!bg-neon-cyan/15 !text-neon-cyan !border-neon-cyan/50 !shadow-none'
                              : phase.badgeVariant === 'purple'
                                ? '!bg-neon-purple/30 !text-purple-100 !border-neon-purple/70 !shadow-none backdrop-blur-sm'
                                : ''
                          }
                        >
                          {phase.status}
                        </Badge>
                      </div>
                      <div className="absolute bottom-3 left-3 z-10">
                        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-white/15 bg-cyber-bg/60 backdrop-blur-sm">
                          <Icon
                            className={`w-4 h-4 ${
                              phase.open
                                ? 'text-neon-cyan'
                                : phase.id === 'mid'
                                  ? 'text-neon-purple'
                                  : 'text-forge-gold'
                            }`}
                          />
                        </span>
                      </div>
                    </div>

                    <div className="p-5 sm:p-6 flex flex-col flex-1">
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-neon-cyan transition-colors">
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
                            phase.open ? 'text-neon-cyan' : 'text-text-muted'
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
                  <img
                    src={phaseImageSrc(FEATURED_PROJECT.phase)}
                    alt={phaseImageAlt(
                      FEATURED_PROJECT.phase,
                      FEATURED_PROJECT.title
                    )}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    loading="lazy"
                    decoding="async"
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
                    /projects/{FEATURED_PROJECT.id}
                  </span>
                </div>
              </div>
            </Card>
          </Link>
        </section>

        {/* 5. Closing line */}
        <p className="mt-4 text-center text-xs font-mono tracking-widest text-text-muted">
          More projects will appear here as the forge grows.
        </p>
      </div>
    </div>
  );
};

export default Projects;
