/**
 * Projects - clean directory of all Together Forge projects.
 * Each card links to Project Workspace at /projects/:id
 */

import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Hammer,
  Users,
  Zap,
  Layers,
} from 'lucide-react';

import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { useIsModerator } from '../hooks/useIsModerator';
import { phaseImageSrc, phaseImageAlt } from '../utils/phaseImages';

/** Project directory catalog */
const PROJECTS = [
  {
    id: 'prototype-systems',
    title: 'Prototype Systems',
    phase: 'Early',
    status: 'In Development',
    open: true,
    description:
      'Small cooperative games built with the community. Early exists to prove the model works, learn how we build together, and ship focused playable experiences before moving on to larger projects.',
    icon: Hammer,
    tasksOpen: 4,
    volunteers: 8,
  },
  {
    id: 'core-features',
    title: 'Core Features Sprint',
    phase: 'Mid',
    status: 'Planning',
    open: false,
    description:
      'Opens after Early is completed: design and integrations for cooperative play. View plans - not open for claims yet.',
    icon: Users,
    tasksOpen: null,
    volunteers: null,
  },
  {
    id: 'polish-playtests',
    title: 'Stability & Polish',
    phase: 'Late',
    status: 'Vision',
    open: false,
    description:
      'Opens after Mid is completed: polish, optimization, and wider playtests. View plans - not open for claims yet.',
    icon: Zap,
    tasksOpen: null,
    volunteers: null,
  },
];

const phaseBadgeVariant = (phase) => {
  if (phase === 'Mid') return 'purple';
  if (phase === 'Late') return 'default';
  return 'neon';
};

const Projects = () => {
  const { isModerator } = useIsModerator();

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      {/* Atmosphere */}
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.05)_0%,transparent_55%)]"
        aria-hidden="true"
      />

      <div className="container-custom relative z-10 py-12 md:py-16">
        {/* Back */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-10 group transition-colors"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
          BACK TO HOME
        </Link>

        {/* Header */}
        <header className="mb-12 md:mb-14 max-w-3xl">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mb-4">
            Projects
          </h1>
          <p className="text-text-secondary text-base sm:text-lg leading-relaxed">
            Browse the pipeline. Early is open now for community collaboration
            and real work. Mid and Late come after Early is complete.
          </p>

          {isModerator && (
            <div className="mt-5">
              <Link
                to="/projects/edit"
                className="text-xs font-mono tracking-widest px-3 py-1.5 rounded-full border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
              >
                Edit Page
              </Link>
            </div>
          )}
        </header>

        {/* Project grid */}
        <section aria-labelledby="directory-heading">
          <div className="flex items-center gap-2 mb-6">
            <Layers className="w-4 h-4 text-neon-cyan" />
            <h2
              id="directory-heading"
              className="font-mono text-xs tracking-widest uppercase text-text-muted"
            >
              All projects
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6">
            {PROJECTS.map((project) => {
              const Icon = project.icon;
              const coverSrc = phaseImageSrc(project.phase);
              const isOpen = Boolean(project.open);
              const href = isOpen
                ? `/projects/${project.id}`
                : project.phase === 'Mid'
                  ? '/projects/mid'
                  : project.phase === 'Late'
                    ? '/projects/late'
                    : `/projects/${project.id}`;

              return (
                <Link
                  key={project.id}
                  to={href}
                  className="group block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg"
                >
                  <Card
                    interactive
                    variant={isOpen ? 'panel' : 'subtle'}
                    className="h-full flex flex-col overflow-hidden p-0"
                  >
                    <div className="relative h-40 sm:h-44 overflow-hidden border-b border-cyber-border bg-cyber-surface">
                      {coverSrc ? (
                        <img
                          src={coverSrc}
                          alt={phaseImageAlt(project.phase, project.title)}
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
                        className="absolute inset-0 bg-gradient-to-t from-cyber-card via-cyber-card/20 to-transparent pointer-events-none"
                        aria-hidden="true"
                      />
                      <div className="absolute top-3 left-3 right-3 flex flex-wrap justify-between gap-2 z-10">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={phaseBadgeVariant(project.phase)}>
                            {project.phase}
                          </Badge>
                          {!isOpen && (
                            <Badge variant="default">Coming Soon</Badge>
                          )}
                        </div>
                        <Badge variant="default">{project.status}</Badge>
                      </div>
                    </div>

                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-neon-cyan transition-colors">
                        {project.title}
                      </h3>
                      <p className="text-sm text-text-secondary leading-relaxed flex-1 line-clamp-4 mb-6">
                        {project.description}
                      </p>

                      <div className="pt-4 border-t border-cyber-border flex items-center justify-between gap-3">
                        {isOpen ? (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-sans text-text-muted">
                            <span>
                              <span className="text-neon-cyan tabular-nums">
                                {project.tasksOpen ?? 0}
                              </span>{' '}
                              open tasks
                            </span>
                            <span>
                              <span className="text-neon-cyan tabular-nums">
                                {project.volunteers ?? 0}
                              </span>{' '}
                              active
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-sans text-text-muted tracking-wide">
                            Planned phase
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-sans font-semibold tracking-widest shrink-0 ${
                            isOpen ? 'text-neon-cyan' : 'text-text-muted'
                          }`}
                        >
                          {isOpen ? 'Open workspace' : 'View plans'}
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

        {/* Light footer hint */}
        <p className="mt-12 text-center text-xs font-mono tracking-widest text-text-muted">
          More projects will appear here as the forge grows
        </p>
      </div>
    </div>
  );
};

export default Projects;
