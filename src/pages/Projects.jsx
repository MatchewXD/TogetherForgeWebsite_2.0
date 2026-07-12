/**
 * Projects — clean directory of all Together Forge projects.
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

/** Placeholder catalog — replace with Supabase later */
const PROJECTS = [
  {
    id: 'prototype-systems',
    title: 'Prototype Systems',
    phase: 'Early',
    status: 'In Development',
    description:
      'Core loop prototyping and networking tests. Volunteers for design, code, and art as we validate the multiplayer foundation and claim/credit flows.',
    icon: Hammer,
    tasksOpen: 4,
    volunteers: 8,
  },
  {
    id: 'core-features',
    title: 'Core Features Sprint',
    phase: 'Mid',
    status: 'Planning',
    description:
      'Design work and early integrations for systems that make cooperative play feel great. Focused sprints with clear ownership and public progress.',
    icon: Users,
    tasksOpen: 6,
    volunteers: 4,
  },
  {
    id: 'polish-playtests',
    title: 'Stability & Polish',
    phase: 'Late',
    status: 'Vision',
    description:
      'Polish passes, optimization, and wider playtests. Help stress-test builds and report what breaks — or what delights.',
    icon: Zap,
    tasksOpen: 3,
    volunteers: 6,
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
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="section-header mb-0">Projects</div>
            <Badge variant="neon">{PROJECTS.length} active</Badge>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
            Forge directory
          </h1>
          <p className="text-text-secondary text-base sm:text-lg leading-relaxed">
            Browse every community project. Open a workspace to claim tasks,
            follow pulse metrics, and ship wins with the team.
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

              return (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="group block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg rounded-xl"
                >
                  <Card className="h-full flex flex-col bg-cyber-card/80 border-cyber-border group-hover:border-neon-cyan/50 group-hover:shadow-neon-glow transition-all duration-300">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3 mb-5">
                      <div className="w-12 h-12 rounded-xl bg-cyber-surface border border-cyber-border flex items-center justify-center group-hover:border-neon-cyan/40 transition-colors">
                        <Icon className="w-5 h-5 text-neon-cyan" />
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge variant={phaseBadgeVariant(project.phase)}>
                          {project.phase}
                        </Badge>
                        <Badge variant="default">{project.status}</Badge>
                      </div>
                    </div>

                    {/* Title + body */}
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-neon-cyan transition-colors">
                      {project.title}
                    </h3>
                    <p className="text-sm text-text-secondary leading-relaxed flex-1 line-clamp-4 mb-6">
                      {project.description}
                    </p>

                    {/* Meta footer */}
                    <div className="pt-4 border-t border-cyber-border flex items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-text-muted">
                        <span>
                          <span className="text-neon-cyan">{project.tasksOpen}</span>{' '}
                          open tasks
                        </span>
                        <span>
                          <span className="text-neon-cyan">{project.volunteers}</span>{' '}
                          active
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-mono tracking-widest text-neon-cyan shrink-0">
                        Workspace
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                      </span>
                    </div>

                    <p className="mt-3 text-[10px] font-mono tracking-widest text-text-muted/70">
                      /projects/{project.id}
                    </p>
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
