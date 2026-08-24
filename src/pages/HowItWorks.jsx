/**
 * How It Works: how work moves from idea to shipped game.
 */

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

const STEPS = [
  {
    number: '01',
    title: 'Share an idea or offer a skill',
    paragraphs: [
      'Post a game concept, mechanic, system, or improvement on the Ideas board, or offer a skill directly. Code, art, audio, design, writing, testing, moderation, and content creation all count. You do not need a polished pitch to start.',
    ],
    icon: Lightbulb,
  },
  {
    number: '02',
    title: 'Discuss and refine in public',
    paragraphs: [
      'The community comments, votes, and pressure-tests ideas in the open. Strong concepts become clearer. Weak ones get honest feedback. Nothing important happens in private channels that the rest of the community cannot see.',
    ],
    icon: MessageSquare,
  },
  {
    number: '03',
    title: 'Strong ideas move into official projects',
    paragraphs: [
      'During Early, Mid, and Late, Together Forge focuses on a limited number of official games so the community can actually finish them. Project leads and moderators pull the strongest ideas into live project workspaces.',
      'The Ideas board itself stays open permanently. Anyone can still take ideas from it and build their own games with the community using the same process.',
    ],
    icon: Layers,
  },
  {
    number: '04',
    title: 'Claim tasks and build',
    paragraphs: [
      'Official projects have open task boards. You can claim real work (features, art, bugs, documentation, playtests, etc.), leave progress updates, and coordinate with others. In Early we deliberately focus on one game at a time so things actually get finished.',
    ],
    icon: Hammer,
  },
  {
    number: '05',
    title: 'Receive credit and ship',
    paragraphs: [
      'Completed work is publicly credited. When a build is ready, it is released for the same community that made it. Finances and major decisions stay transparent throughout.',
    ],
    icon: Award,
  },
];

const HowItWorks = () => {
  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      <header className="relative pt-20 border-b border-cyber-border bg-cyber-surface/80">
        <div className="container-custom py-10 sm:py-12 md:py-14">
          <div className="max-w-3xl">
            <h1 className="section-header dashboard-page-title !mb-4 !text-3xl sm:!text-4xl !font-bold !tracking-tight !normal-case">
              How it Works
            </h1>
            <p className="text-xl sm:text-2xl font-semibold text-white mb-4">
              From idea to shipped game
            </p>
            <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-2xl">
              Together Forge runs on a simple public process. Anyone can follow
              the work, contribute, and see exactly how ideas become real games.
            </p>
          </div>
        </div>
      </header>

      <div className="container-custom py-12 md:py-16 max-w-4xl">
        <ol className="space-y-8 md:space-y-10 list-none p-0 m-0">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <li
                key={step.number}
                className="flex gap-4 sm:gap-6 items-start"
              >
                <div className="shrink-0 flex flex-col items-center">
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

        <section
          aria-labelledby="where-you-fit-heading"
          className="mt-14 md:mt-16 rounded-2xl border border-cyber-border bg-cyber-card/60 p-6 sm:p-8"
        >
          <h2
            id="where-you-fit-heading"
            className="text-2xl sm:text-3xl font-bold text-white mb-3"
          >
            Where you fit
          </h2>
          <p className="text-text-secondary text-sm sm:text-base max-w-2xl mb-6 leading-relaxed">
            Every skill has a way in. The Get Involved page shows the different
            paths (game development, ideas, content creation, moderation,
            platform skills, and optional support). This page simply shows how
            the work itself moves.
          </p>
          <Button
            size="lg"
            className="gap-2"
            to="/get-involved"
          >
            <Users className="w-4 h-4" />
            Get Involved
            <ArrowRight className="w-4 h-4" />
          </Button>
        </section>
      </div>
    </div>
  );
};

export default HowItWorks;
