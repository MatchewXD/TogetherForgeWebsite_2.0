/**
 * Early Phase Project Hub — series of proof-of-concept games.
 * Staff can edit descriptive content via /projects/early/edit (page_content).
 */

import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useIsModerator } from '../hooks/useIsModerator';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import PhaseIdeasSection from '../components/phase/PhaseIdeasSection';
import { phasePageService } from '../services/phasePageService';
import { EARLY_PHASE_DEFAULTS } from '../utils/phasePageContent';

const ProjectsEarly = () => {
  const { isModerator } = useIsModerator();
  const [content, setContent] = useState(EARLY_PHASE_DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await phasePageService.getPageContent('early');
        if (mounted && data) setContent(data);
      } catch (err) {
        console.warn('[ProjectsEarly] load content', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const c = content || EARLY_PHASE_DEFAULTS;
  const tetherHref = c.activeProjectHref || '/projects/prototype-systems';

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
          {isModerator && (
            <div className="mt-5">
              <Link
                to="/projects/early/edit"
                className="text-xs font-mono tracking-widest px-3 py-1.5 rounded-full border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
              >
                Edit Page
              </Link>
            </div>
          )}
        </header>

        {loading ? (
          <p className="text-sm font-mono tracking-widest text-text-muted mb-10">
            Loading…
          </p>
        ) : null}

        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10">
          {/* Main column */}
          <div className="lg:col-span-8 space-y-10">
            {/* Early Game Goals */}
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

            {/* Active Project */}
            <section aria-labelledby="active-project-heading">
              <h2 id="active-project-heading" className="section-header mb-4">
                Active Project
              </h2>
              <Link
                to={tetherHref}
                className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg"
              >
                <Card
                  interactive
                  variant="panel"
                  className="cyber-card-gold p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Badge
                      variant="neon"
                      className="!bg-neon-cyan/15 !text-neon-cyan !border-neon-cyan/50 !shadow-none"
                    >
                      Featured
                    </Badge>
                    <Badge variant="default">
                      {c.activeProjectStatus || 'In Development'}
                    </Badge>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-neon-cyan transition-colors">
                    {c.activeProjectTitle || 'Tether'}
                  </h3>
                  <p className="mt-3 text-sm sm:text-base text-text-secondary leading-relaxed">
                    {c.activeProjectSummary}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-neon-cyan tracking-wide">
                    Open workspace
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                  </span>
                </Card>
              </Link>
            </section>

            {/* Game Overviews */}
            <section aria-labelledby="game-overviews-heading">
              <h2 id="game-overviews-heading" className="section-header mb-4">
                Game Overviews
              </h2>
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <Link
                  to={tetherHref}
                  className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg"
                >
                  <Card interactive className="p-5 h-full">
                    <h3 className="font-bold text-white text-lg group-hover:text-neon-cyan transition-colors">
                      {c.activeProjectTitle || 'Tether'}
                    </h3>
                    <p className="text-text-secondary mt-2 text-sm">
                      {c.activeProjectStatus || 'In Development'}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm text-neon-cyan">
                      View Project
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                    </span>
                  </Card>
                </Link>
              </div>
              {c.gameOverviewsNote && (
                <p className="text-sm text-text-muted leading-relaxed">
                  {c.gameOverviewsNote}
                </p>
              )}
            </section>

            {/* Target Style */}
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

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-8">
            <section aria-labelledby="about-early-heading">
              <h2 id="about-early-heading" className="section-header mb-4">
                About Early Game
              </h2>
              <Card className="bg-cyber-card/80 border-cyber-border p-5 space-y-4 text-text-secondary text-sm sm:text-base leading-relaxed">
                {(c.aboutParagraphs || []).map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
              </Card>
            </section>

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

        {/* Early Phase Ideas — reusable pattern for Mid/Late */}
        <PhaseIdeasSection phase="early" />
      </div>
    </div>
  );
};

export default ProjectsEarly;
