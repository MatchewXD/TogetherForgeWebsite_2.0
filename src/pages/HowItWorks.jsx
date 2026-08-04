/**
 * How It Works: plain-language path from idea/skill to shipped work at Together Forge.
 */

import { Link, useNavigate } from 'react-router-dom';
import {
  Lightbulb,
  MessageSquare,
  Layers,
  Hammer,
  Award,
  ArrowRight,
  Users,
} from 'lucide-react';

import Button from '../components/ui/Buttons';
import Badge from '../components/ui/Badge';

const STEPS = [
  {
    number: '01',
    title: 'Share an idea or offer a skill',
    paragraphs: [
      'Pitch a game concept, mechanic, system, or improvement on the Ideas board, or jump in with a skill. Code, art, audio, testing, writing, moderation, content creation, and feedback all count. You do not need a finished pitch to help.',
    ],
    icon: Lightbulb,
  },
  {
    number: '02',
    title: 'Discuss and refine in public',
    paragraphs: [
      'The community votes, comments, and pressure-tests ideas. Strong concepts get clearer. Weak ones get honest notes. Everything happens in the open so anyone can follow the conversation.',
    ],
    icon: MessageSquare,
  },
  {
    number: '03',
    title: 'Official projects select from the best ideas',
    paragraphs: [
      'During Early, Mid, and Late Game, Together Forge focuses on a limited number of official games so the community can actually finish and ship them. These game phases are the launch sequence that proves the model.',
      'Project leads and moderators pull the strongest ideas into those live workspaces. Mechanics, systems, art direction, and other ideas also feed into the official games.',
      'After the phases, Together Forge continues making games. The Ideas board itself stays open the whole time. Any developer can take ideas from the board, work with the community the same way we do, and build their own games.',
    ],
    icon: Layers,
  },
  {
    number: '04',
    title: 'Claim tasks and build together',
    paragraphs: [
      'Open boards list real work: features, art, bugs, docs, playtests. Claim a task, leave progress notes, and coordinate with other volunteers. In Early we focus on one game at a time so the community can finish what it starts.',
    ],
    icon: Hammer,
  },
  {
    number: '05',
    title: 'Get credit, then ship',
    paragraphs: [
      'Contributors are named in public credits and shoutouts. Finances and major decisions stay transparent. When a build is ready, we release it for the community that made it.',
    ],
    icon: Award,
  },
];

const HowItWorks = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      {/* Header */}
      <header className="relative pt-20 border-b border-cyber-border bg-cyber-surface/80">
        <div className="container-custom py-10 sm:py-12 md:py-14">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="section-header mb-0">How it works</div>
              <Badge variant="gold">Early open now</Badge>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              From idea to game, with the community
            </h1>
            <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-2xl">
              Together Forge is a community-first studio. Here is how work
              actually moves, so you can see where you fit.
            </p>
          </div>
        </div>
      </header>

      <div className="container-custom py-12 md:py-16 max-w-4xl">
        {/* Quick orientation */}
        <p className="text-sm sm:text-base text-text-muted leading-relaxed mb-10 md:mb-12 max-w-2xl border-l-2 border-neon-cyan/40 pl-4">
          Early is live today: a small number of cooperative games built in
          public. Mid and Late come later. You can share an idea, claim a task,
          or simply follow along. Every skill has a door in.
        </p>

        {/* Steps */}
        <ol className="space-y-8 md:space-y-10 list-none p-0 m-0">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <li
                key={step.number}
                className="flex gap-4 sm:gap-6 items-start"
              >
                <div className="shrink-0 flex flex-col items-center gap-2">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-neon-cyan/10 border border-neon-cyan/25 flex items-center justify-center">
                    <span className="text-lg sm:text-xl font-mono text-neon-cyan font-bold">
                      {step.number}
                    </span>
                  </div>
                </div>
                <div className="min-w-0 pt-0.5 sm:pt-1">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                    <Icon
                      className="w-5 h-5 text-neon-cyan shrink-0"
                      aria-hidden
                    />
                    <h2 className="text-xl sm:text-2xl font-bold text-white">
                      {step.title}
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {step.paragraphs.map((text) => (
                      <p
                        key={text.slice(0, 48)}
                        className="text-sm sm:text-base text-text-secondary leading-relaxed"
                      >
                        {text}
                      </p>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {/* CTA — kept as existing Ready? block */}
        <div className="mt-14 md:mt-16 rounded-2xl border border-cyber-border bg-cyber-card/60 p-6 sm:p-8 text-center">
          <div className="section-header justify-center mx-auto mb-3">
            Ready?
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Pick a door and walk in
          </h2>
          <p className="text-text-secondary text-sm sm:text-base max-w-lg mx-auto mb-6 leading-relaxed">
            Submit a pitch, claim a task, or explore how to help. The forge grows
            when people show up. Credit and progress stay public.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              className="gap-2 w-full sm:w-auto"
              onClick={() => navigate('/ideas/submit')}
            >
              <Lightbulb className="w-4 h-4" />
              Submit an idea
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="gap-2 w-full sm:w-auto"
              onClick={() => navigate('/get-involved')}
            >
              <Users className="w-4 h-4" />
              Get involved
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
          <p className="mt-5 text-xs font-mono tracking-widest text-text-muted">
            <Link
              to="/projects/early"
              className="hover:text-neon-cyan transition-colors"
            >
              Early workspace
            </Link>
            {' · '}
            <Link
              to="/transparency"
              className="hover:text-neon-cyan transition-colors"
            >
              Transparency
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
