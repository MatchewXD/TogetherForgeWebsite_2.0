/**
 * Early Phase Project Hub.
 * Static sections (Goals, Target Style, About, How to Help) come from page_content.
 * Active / completed projects load from the projects table.
 */

import { useEffect, useState } from 'react';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useIsModerator } from '../hooks/useIsModerator';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import PhaseIdeasSection from '../components/phase/PhaseIdeasSection';
import PhaseAboutCard from '../components/phase/PhaseAboutCard';
import { phasePageService } from '../services/phasePageService';
import {
  listProjectsByPhase,
  isProjectCompleted,
  isProjectInDevelopment,
} from '../services/projectsService';
import { EARLY_PHASE_DEFAULTS } from '../utils/phasePageContent';
import { SHOW_RELEASED_GAMES } from '../constants/featureFlags';

/** Local fallback when projects table is empty or offline */
const FALLBACK_ACTIVE = {
  id: 'fallback-tether',
  slug: 'tether',
  title: 'Tether',
  status: 'In Development',
  summary:
    'A tethered crew crosses dangerous semi-procedural levels. Teamwork tools grow stronger when used together.',
  description: '',
};

function projectHref(p) {
  return `/projects/${p.slug || p.id}`;
}

function projectBlurb(p, contentFallback) {
  return (
    p.summary ||
    p.description ||
    contentFallback?.activeProjectSummary ||
    ''
  );
}

function formatCompletedDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const ProjectsEarly = () => {
  const { isModerator } = useIsModerator();
  const [content, setContent] = useState(EARLY_PHASE_DEFAULTS);
  const [activeProjects, setActiveProjects] = useState([]);
  const [plannedProjects, setPlannedProjects] = useState([]);
  const [completedProjects, setCompletedProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectsFromDb, setProjectsFromDb] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [pageData, allEarly] = await Promise.all([
          phasePageService.getPageContent('early'),
          listProjectsByPhase('Early', { includeCompleted: true }).catch(
            (err) => {
              console.warn('[ProjectsEarly] load projects', err);
              return [];
            }
          ),
        ]);
        if (!mounted) return;
        if (pageData) setContent(pageData);

        const rows = Array.isArray(allEarly) ? allEarly : [];
        setProjectsFromDb(rows.length > 0);
        // Active = In Development only (not Planning / On Hold / Completed)
        const inDev = rows.filter((p) => isProjectInDevelopment(p));
        const planned = rows.filter(
          (p) => !isProjectCompleted(p) && !isProjectInDevelopment(p)
        );
        setActiveProjects(inDev);
        setPlannedProjects(planned);
        setCompletedProjects(rows.filter((p) => isProjectCompleted(p)));
      } catch (err) {
        console.warn('[ProjectsEarly] load', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const c = content || EARLY_PHASE_DEFAULTS;

  // Prefer DB projects; if none, use CMS active card or hard-coded Tether
  const displayActive =
    activeProjects.length > 0
      ? activeProjects
      : projectsFromDb
        ? []
        : [
            {
              ...FALLBACK_ACTIVE,
              title: c.activeProjectTitle || FALLBACK_ACTIVE.title,
              status: c.activeProjectStatus || FALLBACK_ACTIVE.status,
              summary:
                c.activeProjectSummary || FALLBACK_ACTIVE.summary,
              slug: (c.activeProjectHref || '/projects/tether')
                .replace(/^\/projects\//, '')
                .replace(/^\//, '')
                .replace(/^prototype-systems$/i, 'tether') || 'tether',
            },
          ];

  // Projects section: In Development + Planned (not completed)
  const displayProjectsList =
    projectsFromDb || activeProjects.length > 0 || plannedProjects.length > 0
      ? [...activeProjects, ...plannedProjects]
      : displayActive;

  const activeHeading =
    displayActive.length > 1 ? 'Active Projects' : 'Active Project';

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.05)_0%,transparent_50%)]"
        aria-hidden="true"
      />

      <div className="container-custom relative z-10 py-12 md:py-14">
        {/* Hero */}
        <header className="mb-12 md:mb-14 max-w-3xl">
          <h1 className="relative w-fit max-w-full text-4xl sm:text-5xl font-bold tracking-tight text-neon-cyan pb-2 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-[60px] after:h-0.5 after:bg-gradient-to-r after:from-neon-cyan after:to-neon-magenta">
            {c.heroTitle}
          </h1>
          <div className="mt-6 space-y-3 text-text-secondary text-base sm:text-lg leading-relaxed">
            {c.heroSeriesLabel && (
              <p className="font-semibold text-white">{c.heroSeriesLabel}</p>
            )}
            {c.heroBody && <p>{c.heroBody}</p>}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              to="/contributors"
              className="text-xs font-mono tracking-widest px-3 py-1.5 rounded-full border border-cyber-border text-text-secondary hover:border-neon-cyan hover:text-neon-cyan transition-colors"
            >
              All Contributors
            </Link>
            {isModerator && (
              <Link
                to="/projects/early/edit"
                className="text-xs font-mono tracking-widest px-3 py-1.5 rounded-full border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
              >
                Edit Page
              </Link>
            )}
          </div>
        </header>

        {loading ? (
          <p className="text-sm font-mono tracking-widest text-text-muted mb-10">
            Loading…
          </p>
        ) : null}

        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10">
          {/* Main column */}
          <div className="lg:col-span-8 space-y-10">
            {/* Early Game Goals — static CMS section */}
            <section aria-labelledby="early-goals-heading">
              <h2 id="early-goals-heading" className="section-header mb-4">
                Early Game Goals
              </h2>
              <Card className="bg-cyber-card/80 border-cyber-border p-5 sm:p-6">
                {c.goalsIntro && (
                  <p className="font-semibold text-white mb-4">{c.goalsIntro}</p>
                )}
                <ul className="list-disc pl-5 space-y-2 text-text-secondary text-sm sm:text-base leading-relaxed">
                  {(c.goals || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {c.successMetric && (
                  <p className="mt-5 pt-4 border-t border-cyber-border text-sm text-text-muted leading-relaxed">
                    <span className="text-neon-cyan font-mono text-xs tracking-widest uppercase mr-2">
                      Success metric
                    </span>
                    {c.successMetric}
                  </p>
                )}
              </Card>
            </section>

            {/* Active projects from DB */}
            <section aria-labelledby="active-project-heading">
              <h2 id="active-project-heading" className="section-header mb-4">
                {activeHeading}
              </h2>
              {displayActive.length === 0 ? (
                <Card className="p-5 sm:p-6 text-text-secondary text-sm">
                  No active Early projects right now. Check completed work below
                  or watch for the next build.
                </Card>
              ) : (
                <div className="space-y-4">
                  {displayActive.map((p, idx) => (
                    <Link
                      key={p.id || p.slug}
                      to={projectHref(p)}
                      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg"
                    >
                      <Card
                        interactive
                        variant="panel"
                        className={`${idx === 0 ? 'cyber-card-gold ' : ''}p-5 sm:p-6`}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          {idx === 0 && (
                            <Badge
                              variant="neon"
                              className="!bg-neon-cyan/15 !text-neon-cyan !border-neon-cyan/50 !shadow-none"
                            >
                              Featured
                            </Badge>
                          )}
                          <Badge variant="default">
                            {p.status || 'In Development'}
                          </Badge>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-neon-cyan transition-colors">
                          {p.title}
                        </h3>
                        <p className="mt-3 text-sm sm:text-base text-text-secondary leading-relaxed">
                          {projectBlurb(p, c)}
                        </p>
                        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-neon-cyan tracking-wide">
                          Open workspace
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                        </span>
                      </Card>
                    </Link>
                  ))}
                  {displayActive.length === 1 && displayActive[0]?.slug && (
                    <p className="text-sm">
                      <Link
                        to={`/projects/${displayActive[0].slug}/contributors`}
                        className="text-neon-cyan hover:text-white font-mono text-xs tracking-widest"
                      >
                        View contributors for {displayActive[0].title}
                      </Link>
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Projects — In Development + Planned (click → workspace) */}
            <section aria-labelledby="early-projects-heading">
              <h2 id="early-projects-heading" className="section-header mb-4">
                Projects
              </h2>
              {displayProjectsList.length === 0 ? (
                <Card className="p-5 text-sm text-text-secondary">
                  No In Development or Planned projects yet.
                </Card>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  {displayProjectsList.map((p) => {
                    const inDev = isProjectInDevelopment(p);
                    const slug = p.slug || p.id;
                    return (
                      <Card
                        key={`proj-${p.id || p.slug}`}
                        className={`p-5 h-full flex flex-col ${inDev ? 'cyber-card-gold' : ''}`}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge
                            variant={inDev ? 'neon' : 'default'}
                            className={
                              inDev
                                ? '!bg-neon-cyan/15 !text-neon-cyan !border-neon-cyan/50 !shadow-none'
                                : ''
                            }
                          >
                            {p.status || (inDev ? 'In Development' : 'Planning')}
                          </Badge>
                        </div>
                        <h3 className="font-bold text-white text-lg">
                          {p.title}
                        </h3>
                        {(p.summary || p.description) && (
                          <p className="text-text-secondary mt-2 text-sm leading-relaxed line-clamp-3 flex-1">
                            {p.summary || p.description}
                          </p>
                        )}
                        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                          <Link
                            to={projectHref(p)}
                            className="inline-flex items-center gap-1 text-sm text-neon-cyan hover:text-white font-semibold"
                          >
                            {inDev ? 'Open workspace' : 'View project'}
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                          <Link
                            to={`/projects/${slug}/contributors`}
                            className="inline-flex text-xs font-mono tracking-widest text-text-muted hover:text-neon-cyan"
                          >
                            Contributors
                          </Link>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
              {c.gameOverviewsNote && (
                <p className="text-sm text-text-muted leading-relaxed">
                  {c.gameOverviewsNote}
                </p>
              )}
            </section>

            {/* Completed in this phase */}
            <section aria-labelledby="completed-early-heading">
              <h2
                id="completed-early-heading"
                className="section-header mb-4"
              >
                Completed in this phase
              </h2>
              {completedProjects.length === 0 ? (
                <Card className="bg-cyber-card/60 border-cyber-border border-dashed p-5 sm:p-6 space-y-3">
                  <p className="text-sm text-text-muted leading-relaxed">
                    Finished Early work will be listed here with release links
                    {SHOW_RELEASED_GAMES
                      ? '. The permanent home for shipped titles is Released Games.'
                      : ' once projects ship.'}
                  </p>
                  {SHOW_RELEASED_GAMES ? (
                    <Link
                      to="/released"
                      className="inline-flex text-xs font-mono tracking-widest text-neon-cyan hover:text-white"
                    >
                      View Released Games →
                    </Link>
                  ) : null}
                </Card>
              ) : (
                <Card className="bg-cyber-card/60 border-cyber-border p-5 sm:p-6 space-y-4">
                  <p className="text-sm text-text-muted leading-relaxed">
                    Finished Early work listed here
                    {SHOW_RELEASED_GAMES ? (
                      <>
                        . Full catalog on{' '}
                        <Link
                          to="/released"
                          className="text-neon-cyan hover:text-white"
                        >
                          Released Games
                        </Link>
                      </>
                    ) : null}
                    .
                  </p>
                  <ul className="space-y-4">
                    {completedProjects.map((p) => {
                      const when = formatCompletedDate(p.completed_at);
                      const links = p.completion_links || [];
                      return (
                        <li
                          key={p.id}
                          className="border-t border-cyber-border pt-4 first:border-t-0 first:pt-0"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <Link
                              to={`/released/${p.slug || p.id}`}
                              className="font-semibold text-white hover:text-neon-cyan transition-colors"
                            >
                              {p.title}
                            </Link>
                            <span className="text-xs font-mono tracking-widest text-text-muted uppercase">
                              {when || 'Completed'}
                            </span>
                          </div>
                          {p.completion_notes && (
                            <p className="mt-1 text-sm text-text-secondary">
                              {p.completion_notes}
                            </p>
                          )}
                          {links.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {links.map((link) => (
                                <a
                                  key={`${p.id}-${link.url}`}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-mono tracking-wide text-neon-cyan hover:text-white border border-neon-cyan/30 rounded-full px-2.5 py-1 transition-colors"
                                >
                                  {link.label}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}
            </section>

            {/* Target Style — static CMS section */}
            <section aria-labelledby="target-style-heading">
              <h2 id="target-style-heading" className="section-header mb-4">
                Target Style for Early Game Projects
              </h2>
              <Card className="bg-cyber-card/80 border-cyber-border p-5 sm:p-6">
                {c.targetIntro && (
                  <p className="text-text-secondary text-sm sm:text-base leading-relaxed mb-4">
                    {c.targetIntro}
                  </p>
                )}
                {c.targetExamplesHeading && (
                  <p className="text-white font-semibold text-sm mb-2">
                    {c.targetExamplesHeading}
                  </p>
                )}
                <ul className="list-disc pl-5 space-y-2 text-text-secondary text-sm sm:text-base leading-relaxed">
                  {(c.targetExamples || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Card>
            </section>

            <div>
              <Link
                to={`/ideas/submit?project=early&tag=early`}
                className="btn-neon inline-flex items-center"
              >
                Submit Ideas for Early Game
              </Link>
            </div>
          </div>

          {/* Sidebar — About (featured) + How to Help */}
          <aside className="lg:col-span-4 space-y-8">
            <PhaseAboutCard
              phase="early"
              title="About Early Game"
              headingId="about-early-heading"
              paragraphs={c.aboutParagraphs || []}
            />

            <section aria-labelledby="how-to-help-heading">
              <h2 id="how-to-help-heading" className="section-header mb-4">
                How to Help
              </h2>
              <Card className="bg-cyber-card/80 border-cyber-border p-5">
                <ul className="list-disc pl-5 space-y-2 text-text-secondary text-sm leading-relaxed">
                  {(c.howToHelp || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {c.howToHelpNote && (
                  <p className="mt-4 text-sm text-text-muted leading-relaxed">
                    {c.howToHelpNote}
                  </p>
                )}
                <div className="mt-5">
                  <Link to="/get-involved" className="btn-primary inline-flex">
                    Get Involved
                  </Link>
                </div>
              </Card>
            </section>
          </aside>
        </div>

        <PhaseIdeasSection phase="early" />
      </div>
    </div>
  );
};

export default ProjectsEarly;
