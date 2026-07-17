/**
 * Mechanic Lab (/demos): informational hub for testing, sharing, and voting
 * on game mechanics. MVP is static cards + vision; interactive demos later.
 */

import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  FlaskConical,
  Lightbulb,
  Users,
  MessageCircle,
  Vote,
  Play,
  Layers,
  Hammer,
  CheckCircle2,
  Rocket,
  Beaker,
} from 'lucide-react';

import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';

const PAGE_TITLE = 'Mechanic Lab | Together Forge';
const PAGE_DESCRIPTION =
  'Collaborative lab for sharing, discussing, and voting on game mechanics. Community-first testing ground before full prototypes and Unreal integration.';

/** Static featured demos for MVP (no backend yet). */
const FEATURED_DEMOS = [
  {
    id: 'shared-inventory',
    title: 'Shared Inventory Loop',
    description:
      'One backpack for the whole squad. Stress-tests scarcity, communication, and role clarity in co-op.',
    status: 'Concept',
    statusVariant: 'default',
    accent: 'from-neon-cyan/20 to-transparent',
  },
  {
    id: 'chat-event-vote',
    title: 'Chat Event Votes',
    description:
      'Stream viewers push world events. Explores latency, fairness, and readable outcomes for players on stream.',
    status: 'Prototype',
    statusVariant: 'purple',
    accent: 'from-neon-purple/25 to-transparent',
  },
  {
    id: 'claim-credit-flow',
    title: 'Claim and Credit Flow',
    description:
      'Volunteer claim, progress, and public credit. The same pattern used on site task boards, ready for game hooks.',
    status: 'Playable',
    statusVariant: 'neon',
    accent: 'from-neon-magenta/20 to-transparent',
  },
  {
    id: 'extraction-timer',
    title: 'Extraction Pressure Timer',
    description:
      'A simple tension clock for co-op exits. Tests communication under time pressure without full combat AI.',
    status: 'Concept',
    statusVariant: 'default',
    accent: 'from-neon-cyan/15 to-transparent',
  },
];

const PARTICIPATE_STEPS = [
  {
    step: '01',
    title: 'Submit a mechanic idea',
    desc: 'Use the Ideas board or Idea Wizard. Tag it clearly as a mechanic so the lab can pick it up later.',
    cta: { label: 'Open Ideas', to: '/ideas' },
    icon: Lightbulb,
  },
  {
    step: '02',
    title: 'Volunteer to test',
    desc: 'Claim lab-related tasks on project boards when playtests or prototype work open up.',
    cta: { label: 'Get Involved', to: '/get-involved' },
    icon: Users,
  },
  {
    step: '03',
    title: 'Discuss and vote',
    desc: 'Vote on ideas, leave feedback on feasibility, and help decide what is ready for a real build.',
    cta: { label: 'Browse Ideas', to: '/ideas' },
    icon: MessageCircle,
  },
];

const ROADMAP_PHASES = [
  {
    phase: 'Phase 1',
    title: 'Informational Lab',
    status: 'Now',
    desc: 'This page. Vision, featured mechanics, and clear paths to submit and discuss.',
    icon: FlaskConical,
  },
  {
    phase: 'Phase 2',
    title: 'Interactive Prototypes',
    status: 'Next',
    desc: 'Browser or lightweight builds you can try. Votes and notes attach to each demo.',
    icon: Beaker,
  },
  {
    phase: 'Phase 3',
    title: 'Full Lab + Unreal',
    status: 'Later',
    desc: 'Standardized Unreal template, shared tooling, and smoother handoff into live projects.',
    icon: Rocket,
  },
];

const PURPOSE_POINTS = [
  {
    icon: Layers,
    title: 'Share prototype mechanics',
    desc: 'Isolate one loop at a time so the community can judge fun without a full game attached.',
  },
  {
    icon: Vote,
    title: 'Vote and prioritize',
    desc: 'Public votes and discussion decide what deserves more engineering time.',
  },
  {
    icon: Hammer,
    title: 'Prep for real projects',
    desc: 'Promising mechanics move toward project workspaces and, later, builds like Forge Unity.',
  },
];

const MechanicLab = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const prevTitle = document.title;
    document.title = PAGE_TITLE;
    let meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute('content') || '';
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', PAGE_DESCRIPTION);

    window.scrollTo(0, 0);

    return () => {
      document.title = prevTitle;
      if (meta) meta.setAttribute('content', prevDesc);
    };
  }, []);

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.05)_0%,transparent_55%)]"
        aria-hidden="true"
      />

      {/* Hero */}
      <header className="relative z-10 border-b border-cyber-border bg-cyber-surface/80">
        <div className="container-custom py-12 md:py-16">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group transition-colors"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
            BACK TO HOME
          </Link>

          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="section-header mb-0">Mechanic Lab</div>
              <Badge variant="neon">Informational MVP</Badge>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Mechanic Lab: Test, Share, Forge Mechanics Together
            </h1>
            <p className="text-lg sm:text-xl text-text-secondary leading-relaxed">
              A collaborative testing ground for game mechanics. Not isolated
              corporate silos. Real community input so better gameplay rises on
              merit, not marketing decks.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
              <Button
                size="lg"
                className="gap-2 w-full sm:w-auto"
                onClick={() => navigate('/ideas/wizard')}
              >
                <Lightbulb className="w-4 h-4" />
                Submit a mechanic
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="gap-2 w-full sm:w-auto"
                onClick={() => navigate('/ideas')}
              >
                <Vote className="w-4 h-4" />
                Vote on ideas
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 w-full sm:w-auto"
                onClick={() => navigate('/get-involved')}
              >
                <Users className="w-4 h-4" />
                Get involved
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container-custom relative z-10 py-12 md:py-16 space-y-16 md:space-y-20">
        {/* Vision */}
        <section aria-labelledby="vision-heading">
          <div className="max-w-2xl mb-8">
            <div className="section-header">Vision</div>
            <h2
              id="vision-heading"
              className="text-2xl sm:text-3xl font-bold text-white"
            >
              Why this lab exists
            </h2>
            <p className="text-text-secondary mt-2 text-sm sm:text-base leading-relaxed">
              Share prototype mechanics, vote on what feels fun, discuss what is
              feasible, and prepare winners for integration into real projects.
              Today the lab is informational. Next it becomes interactive demos.
              Later, a full Unreal-backed pipeline.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 md:gap-5">
            {PURPOSE_POINTS.map((p) => {
              const Icon = p.icon;
              return (
                <Card key={p.title} className="bg-cyber-card/80 h-full">
                  <div className="w-11 h-11 mb-4 rounded-xl bg-cyber-surface border border-cyber-border flex items-center justify-center text-neon-cyan">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {p.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {p.desc}
                  </p>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Featured demos */}
        <section aria-labelledby="demos-heading">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div className="max-w-2xl">
              <div className="section-header">Featured demos</div>
              <h2
                id="demos-heading"
                className="text-2xl sm:text-3xl font-bold text-white"
              >
                Current mechanics in focus
              </h2>
              <p className="text-text-secondary mt-2 text-sm sm:text-base">
                Static cards for now. Learn more and vote through the Ideas
                board. Playable embeds arrive in a later phase.
              </p>
            </div>
            <Badge variant="default">MVP placeholders</Badge>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 md:gap-5">
            {FEATURED_DEMOS.map((demo) => (
              <Card
                key={demo.id}
                className="bg-cyber-card/80 flex flex-col h-full overflow-hidden p-0"
              >
                {/* Thumbnail placeholder */}
                <div
                  className={`relative h-36 sm:h-40 bg-cyber-surface border-b border-cyber-border bg-gradient-to-br ${demo.accent}`}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Play
                      className="w-10 h-10 text-neon-cyan/40"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="absolute top-3 right-3">
                    <Badge variant={demo.statusVariant}>{demo.status}</Badge>
                  </div>
                </div>
                <div className="p-5 sm:p-6 flex flex-col flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">
                    {demo.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed flex-1 mb-5">
                    {demo.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1.5"
                      onClick={() => navigate(`/ideas?q=${encodeURIComponent(demo.title)}`)}
                    >
                      Learn more
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => navigate('/ideas')}
                    >
                      <Vote className="w-3.5 h-3.5" />
                      Vote
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5"
                      onClick={() => navigate('/ideas')}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Discuss
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* How to participate */}
        <section aria-labelledby="participate-heading">
          <div className="max-w-2xl mb-8">
            <div className="section-header">How to participate</div>
            <h2
              id="participate-heading"
              className="text-2xl sm:text-3xl font-bold text-white"
            >
              Three clear ways in
            </h2>
            <p className="text-text-secondary mt-2 text-sm sm:text-base">
              No corporate resume required. Start with an idea, a vote, or a
              volunteer task.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 md:gap-5">
            {PARTICIPATE_STEPS.map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.step}
                  className="bg-cyber-card/80 h-full flex flex-col"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="font-mono text-2xl text-neon-cyan/80">
                      {item.step}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-cyber-surface border border-cyber-border flex items-center justify-center text-neon-purple">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed flex-1 mb-4">
                    {item.desc}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-2 self-start"
                    onClick={() => navigate(item.cta.to)}
                  >
                    {item.cta.label}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Card>
              );
            })}
          </div>

          <Card className="mt-6 bg-cyber-surface/60 border-dashed">
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-neon-cyan shrink-0 mt-0.5" />
                Prefer guided questions? Use the{' '}
                <Link
                  to="/ideas/wizard"
                  className="text-neon-cyan hover:underline mx-1"
                >
                  Idea Wizard
                </Link>{' '}
                and pick a mechanic-focused category.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-neon-cyan shrink-0 mt-0.5" />
                Project boards and claim flows live under{' '}
                <Link
                  to="/projects"
                  className="text-neon-cyan hover:underline mx-1"
                >
                  Projects
                </Link>{' '}
                when a mechanic is ready for real work.
              </li>
            </ul>
          </Card>
        </section>

        {/* Roadmap */}
        <section aria-labelledby="roadmap-heading">
          <div className="max-w-2xl mb-8">
            <div className="section-header">Roadmap</div>
            <h2
              id="roadmap-heading"
              className="text-2xl sm:text-3xl font-bold text-white"
            >
              From info page to full lab
            </h2>
            <p className="text-text-secondary mt-2 text-sm sm:text-base">
              Honest phases. No vaporware promises. Each step ships only when the
              forge can support it.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-5">
            {ROADMAP_PHASES.map((phase, idx) => {
              const Icon = phase.icon;
              return (
                <Card
                  key={phase.phase}
                  className={`bg-cyber-card/80 h-full ${
                    idx === 0 ? 'border-neon-cyan/30' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="text-xs font-mono tracking-widest text-text-muted uppercase">
                      {phase.phase}
                    </span>
                    <Badge variant={idx === 0 ? 'neon' : 'default'}>
                      {phase.status}
                    </Badge>
                  </div>
                  <div className="w-10 h-10 mb-3 rounded-xl bg-cyber-surface border border-cyber-border flex items-center justify-center text-neon-cyan">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">
                    {phase.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {phase.desc}
                  </p>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="pt-4 border-t border-cyber-border">
          <Card className="bg-cyber-card/80 text-center py-10 px-6">
            <FlaskConical className="w-8 h-8 text-neon-cyan mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Bring a mechanic to the forge
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto mb-8 text-sm sm:text-base">
              The lab grows when people ship ideas, votes, and honest playtest
              notes. Start small. One clear mechanic is enough.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center">
              <Button
                size="lg"
                className="gap-2"
                onClick={() => navigate('/ideas/wizard')}
              >
                Idea Wizard
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="gap-2"
                onClick={() => navigate('/get-involved')}
              >
                Get Involved
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2"
                onClick={() => navigate('/projects')}
              >
                View Projects
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default MechanicLab;
