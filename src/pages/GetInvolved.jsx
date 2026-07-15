/**
 * GetInvolved - volunteer hub for Together Forge.
 * Overview of contribution paths, task boards, recognition teaser,
 * onboarding steps, and strong CTAs.
 */

import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Users,
  Hammer,
  Video,
  Heart,
  Lightbulb,
  ListTodo,
  Award,
  HandHeart,
  UserPlus,
  MessageCircle,
  CheckCircle2,
  Sparkles,
  Layers,
} from 'lucide-react';

import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';

/** Ways people can contribute */
const CONTRIBUTION_WAYS = [
  {
    icon: Hammer,
    title: 'Game Development',
    desc: 'Code, design, art, audio, or testing. Claim tasks on project boards and ship real work on Early, Mid, and Late phase games.',
    accent: 'text-neon-cyan',
  },
  {
    icon: Lightbulb,
    title: 'Ideas and Feedback',
    desc: 'Submit game concepts, vote, and join discussions. Strong ideas move into projects with public credit.',
    accent: 'text-neon-purple',
  },
  {
    icon: Video,
    title: 'Content Creation',
    desc: 'Videos, thumbnails, social posts, or streams that grow the forge. Paid opportunities open when income is stable.',
    accent: 'text-neon-magenta',
  },
  {
    icon: Users,
    title: 'Community and Moderation',
    desc: 'Welcome newcomers, help review ideas, keep discussions healthy, and support volunteers day to day.',
    accent: 'text-neon-cyan',
  },
  {
    icon: Heart,
    title: 'Other Skills',
    desc: 'Writing, translation, marketing, tooling, bug reports. If you have a skill, there is a place for it.',
    accent: 'text-neon-green',
  },
  {
    icon: HandHeart,
    title: 'Support the Studio',
    desc: 'Support funds development tools and living-wage work. Not tax-deductible; full transparency on how funds are used.',
    accent: 'text-neon-magenta',
  },
];

/** Global + per-project task board entry points */
const TASK_BOARDS = [
  {
    id: 'global',
    title: 'All Projects Hub',
    subtitle: 'Browse every workspace',
    href: '/projects',
    badge: 'Directory',
    desc: 'See active projects, open a workspace, and jump into kanban boards from one place.',
  },
  {
    id: 'prototype-systems',
    title: 'Prototype Systems',
    subtitle: 'Early phase',
    href: '/projects/prototype-systems',
    badge: 'Early',
    desc: 'Core loop, networking, and claim/credit prototypes. Good first tasks for new volunteers.',
  },
  {
    id: 'core-features',
    title: 'Core Features Sprint',
    subtitle: 'Mid phase',
    href: '/projects/core-features',
    badge: 'Mid',
    desc: 'Design and systems work that makes cooperative play feel solid.',
  },
  {
    id: 'polish-playtests',
    title: 'Stability and Polish',
    subtitle: 'Late phase',
    href: '/projects/polish-playtests',
    badge: 'Late',
    desc: 'Playtests, polish passes, and bug reports that harden builds for release.',
  },
];

/** Simple volunteer onboarding */
const ONBOARDING_STEPS = [
  {
    step: '01',
    title: 'Create a profile',
    desc: 'Sign in and set a username so contributions can be credited publicly.',
    cta: { label: 'Open profile', to: '/profile' },
    icon: UserPlus,
  },
  {
    step: '02',
    title: 'Pick a path',
    desc: 'Submit an idea, claim a task, join Discord, or support the studio. Start small if you prefer.',
    cta: { label: 'Browse ideas', to: '/ideas' },
    icon: Sparkles,
  },
  {
    step: '03',
    title: 'Claim work or join a thread',
    desc: 'Open a project workspace, take a To Do task, or add your take on an open question.',
    cta: { label: 'View projects', to: '/projects' },
    icon: ListTodo,
  },
  {
    step: '04',
    title: 'Ship and get credit',
    desc: 'Complete tasks, leave progress notes, and show up on shoutouts and credits as the forge grows.',
    cta: { label: 'How it works', to: '/how-it-works' },
    icon: Award,
  },
];

const GetInvolved = () => {
  const navigate = useNavigate();

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.05)_0%,transparent_55%)]"
        aria-hidden="true"
      />

      {/* Header */}
      <div className="relative z-10 border-b border-cyber-border bg-cyber-surface/80">
        <div className="container-custom py-12 md:py-16">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group transition-colors"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
            BACK TO HOME
          </Link>

          <div className="max-w-3xl">
            <div className="section-header">Get Involved</div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Be part of the Forge
            </h1>
            <p className="text-lg sm:text-xl text-text-secondary leading-relaxed">
              Together Forge is built by volunteers and community members.
              Whether you ship code, art, ideas, moderation, or support, there is
              a clear way in.
            </p>

            {/* Hero CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
              <Button
                size="lg"
                className="gap-2 w-full sm:w-auto"
                onClick={() => navigate('/ideas/submit')}
              >
                <Lightbulb className="w-4 h-4" />
                Submit Idea
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="gap-2 w-full sm:w-auto"
                onClick={() => navigate('/projects')}
              >
                <ListTodo className="w-4 h-4" />
                Browse Tasks
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 w-full sm:w-auto"
                onClick={() => navigate('/support')}
              >
                <Heart className="w-4 h-4" />
                Support
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container-custom relative z-10 py-12 md:py-16 space-y-16 md:space-y-20">
        {/* ---------- Ways to contribute ---------- */}
        <section aria-labelledby="ways-heading">
          <div className="max-w-2xl mb-8">
            <div className="section-header">Contribution paths</div>
            <h2
              id="ways-heading"
              className="text-2xl sm:text-3xl font-bold text-white"
            >
              How you can help
            </h2>
            <p className="text-text-secondary mt-2 text-sm sm:text-base">
              Pick one path or mix several. No corporate resume required. Just
              show up and ship.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {CONTRIBUTION_WAYS.map((way) => {
              const Icon = way.icon;
              return (
                <Card
                  key={way.title}
                  className="bg-cyber-card/80 h-full flex flex-col"
                >
                  <div
                    className={`w-11 h-11 mb-4 rounded-xl bg-cyber-surface border border-cyber-border flex items-center justify-center ${way.accent}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {way.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed flex-1">
                    {way.desc}
                  </p>
                </Card>
              );
            })}
          </div>
        </section>

        {/* ---------- Task boards ---------- */}
        <section aria-labelledby="boards-heading">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div className="max-w-2xl">
              <div className="section-header">Task boards</div>
              <h2
                id="boards-heading"
                className="text-2xl sm:text-3xl font-bold text-white"
              >
                Jump into open work
              </h2>
              <p className="text-text-secondary mt-2 text-sm sm:text-base">
                Global directory plus per-project workspaces with To Do, In
                Progress, and Completed columns. Claim a task and start.
              </p>
            </div>
            <Button
              variant="secondary"
              className="gap-2 self-start sm:self-auto shrink-0"
              onClick={() => navigate('/projects')}
            >
              <Layers className="w-4 h-4" />
              All projects
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 md:gap-5">
            {TASK_BOARDS.map((board) => (
              <Link
                key={board.id}
                to={board.href}
                className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg rounded-xl"
              >
                <Card className="bg-cyber-card/80 h-full border-cyber-border group-hover:border-neon-cyan/50 group-hover:shadow-neon-glow transition-all">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="text-xs font-mono tracking-widest text-text-muted uppercase mb-1">
                        {board.subtitle}
                      </div>
                      <h3 className="text-lg font-bold text-white group-hover:text-neon-cyan transition-colors">
                        {board.title}
                      </h3>
                    </div>
                    <Badge
                      variant={
                        board.badge === 'Early'
                          ? 'neon'
                          : board.badge === 'Mid'
                            ? 'purple'
                            : 'default'
                      }
                    >
                      {board.badge}
                    </Badge>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed mb-4">
                    {board.desc}
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs font-mono tracking-widest text-neon-cyan">
                    Open board
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* ---------- Recognition teaser ---------- */}
        <section aria-labelledby="credits-heading">
          <Card className="bg-cyber-card/80 border-neon-purple/30 overflow-hidden relative">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_right,rgba(192,132,252,0.08)_0%,transparent_60%)]"
              aria-hidden="true"
            />
            <div className="relative grid md:grid-cols-5 gap-8 items-center">
              <div className="md:col-span-3">
                <div className="section-header mb-2">Recognition</div>
                <h2
                  id="credits-heading"
                  className="text-2xl sm:text-3xl font-bold text-white mb-3"
                >
                  Credits that follow the work
                </h2>
                <p className="text-text-secondary text-sm sm:text-base leading-relaxed mb-4">
                  Contributors show up on project shoutouts, task history, and
                  future game credits. Public profiles track what you ship so
                  effort is never anonymous busywork.
                </p>
                <ul className="space-y-2 text-sm text-text-muted mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-neon-cyan shrink-0" />
                    Task claim and completion credit
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-neon-cyan shrink-0" />
                    Workspace shoutouts for big wins
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-neon-cyan shrink-0" />
                    Transparent progress anyone can follow
                  </li>
                </ul>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="secondary"
                    className="gap-2"
                    onClick={() => navigate('/transparency')}
                  >
                    Transparency Hub
                  </Button>
                  <Button
                    variant="ghost"
                    className="gap-2"
                    onClick={() => navigate('/how-it-works')}
                  >
                    How credit works
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="md:col-span-2 flex justify-center md:justify-end">
                <div className="w-full max-w-xs rounded-2xl border border-cyber-border bg-cyber-surface/80 p-6 text-center">
                  <Award className="w-10 h-10 text-neon-purple mx-auto mb-3" />
                  <div className="font-mono text-xs tracking-widest text-text-muted uppercase mb-2">
                    Coming online
                  </div>
                  <p className="text-sm text-text-secondary">
                    Full contributor leaderboards and public credit pages roll
                    out as task claiming stabilizes.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* ---------- Onboarding steps ---------- */}
        <section aria-labelledby="onboard-heading">
          <div className="max-w-2xl mb-8">
            <div className="section-header">Onboarding</div>
            <h2
              id="onboard-heading"
              className="text-2xl sm:text-3xl font-bold text-white"
            >
              Four steps to start
            </h2>
            <p className="text-text-secondary mt-2 text-sm sm:text-base">
              A short path from new account to first contribution.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 md:gap-5">
            {ONBOARDING_STEPS.map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.step}
                  className="bg-cyber-card/80 h-full flex flex-col"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center shrink-0">
                      <span className="font-mono text-lg font-bold text-neon-cyan">
                        {item.step}
                      </span>
                    </div>
                    <div className="min-w-0 pt-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4 text-neon-cyan shrink-0" />
                        <h3 className="text-lg font-semibold text-white">
                          {item.title}
                        </h3>
                      </div>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto pt-2">
                    <Link
                      to={item.cta.to}
                      className="inline-flex items-center gap-1.5 text-sm font-mono tracking-widest text-neon-cyan hover:underline"
                    >
                      {item.cta.label}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* ---------- Closing CTAs ---------- */}
        <section
          id="join"
          className="relative rounded-2xl border border-cyber-border bg-cyber-surface/60 overflow-hidden"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,249,255,0.08)_0%,transparent_65%)]"
            aria-hidden="true"
          />
          <div className="relative px-6 py-12 md:px-12 md:py-16 text-center max-w-3xl mx-auto">
            <div className="section-header justify-center mx-auto">Ready?</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Pick a door and walk in
            </h2>
            <p className="text-text-secondary text-sm sm:text-base mb-8 leading-relaxed">
              Submit an idea, claim a task, or support the studio. The forge
              grows one contribution at a time.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                className="gap-2 w-full sm:w-auto"
                onClick={() => navigate('/ideas/submit')}
              >
                <Lightbulb className="w-4 h-4" />
                Submit Idea
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="gap-2 w-full sm:w-auto"
                onClick={() => navigate('/projects')}
              >
                <ListTodo className="w-4 h-4" />
                Browse Tasks
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 w-full sm:w-auto"
                onClick={() => navigate('/support')}
              >
                <Heart className="w-4 h-4" />
                Support
              </Button>
            </div>
            <p className="mt-6 text-xs font-mono tracking-widest text-text-muted">
              Questions?{' '}
              <Link to="/faq" className="text-neon-cyan hover:underline">
                FAQ
              </Link>
              {' · '}
              <Link to="/contact" className="text-neon-cyan hover:underline">
                Contact
              </Link>
              {' · '}
              <a
                href="https://discord.gg/togetherforge"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-neon-cyan hover:underline"
              >
                <MessageCircle className="w-3 h-3" />
                Discord
              </a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default GetInvolved;
