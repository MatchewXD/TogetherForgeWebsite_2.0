/**
 * HomePage — Together Forge landing page
 *
 * Dark cyberpunk / future-tech aesthetic.
 * Navbar + Footer are provided by App.jsx layout (sticky Navbar already mounted).
 *
 * Sections:
 *  1. Hero (headline, mission, primary + secondary CTAs)
 *  2. Scroll transition cue (gradient bridge into content)
 *  3. Mission & Values teaser (4 value cards)
 *  4. Featured Projects (ProjectCard grid)
 *  5. Community Highlights (stats + activity feed)
 *  6. Closing CTA
 *
 * Customize: edit FEATURED_PROJECTS, VALUES, STATS, RECENT_ACTIVITY, DISCORD_URL.
 */

import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  Play,
  MessageCircle,
  Hammer,
  Users,
  Heart,
  Sparkles,
  Eye,
  Shield,
  Globe,
} from 'lucide-react';

import Button from '../components/ui/Buttons';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import ProjectCard from '../components/ui/ProjectCard';
import StatWidget from '../components/ui/StatWidget';
import ActivityItem from '../components/ui/ActivityItem';

// ---------------------------------------------------------------------------
// Content — swap these objects to rebrand or connect to live data later
// ---------------------------------------------------------------------------

const MISSION_BLURB =
  'Together Forge is a community-first independent game studio. We organize and support games built collaboratively by gamers, streamers, and volunteers — with transparent development, fair progression, and real connection at the core.';

/** Four core values shown in the Mission & Values teaser grid */
const VALUES = [
  {
    icon: Users,
    title: 'By the Community',
    desc: 'Games designed and built collaboratively. No corporate agendas — just real teamwork, shared ownership, and fun.',
    accent: 'text-neon-cyan',
  },
  {
    icon: Heart,
    title: 'For the Community',
    desc: 'Experiences that bring people together: streamers with audiences, friends uniting for challenges, massive collabs.',
    accent: 'text-neon-magenta',
  },
  {
    icon: Shield,
    title: 'Transparent & Fair',
    desc: 'Open development, public progress, and a living-wage-only model. Net proceeds reinvest into games and community tools.',
    accent: 'text-neon-purple',
  },
  {
    icon: Sparkles,
    title: 'Early Game Focus',
    desc: 'Start simple with fun multiplayer prototypes that prove systems — then scale into bigger community-driven projects.',
    accent: 'text-neon-green',
  },
];

/** Featured projects for the homepage showcase (placeholder data) */
const FEATURED_PROJECTS = [
  {
    id: 'prototype-systems',
    title: 'Prototype Systems',
    phase: 'Early',
    description:
      'Core loop prototyping and networking tests. Volunteers needed for design, code, and art passes as we validate the multiplayer foundation.',
    tasksCompleted: 12,
    activeVolunteers: 8,
  },
  {
    id: 'core-features',
    title: 'Core Features Sprint',
    phase: 'Mid',
    description:
      'Design work and early integrations. Focused sprints for systems that make cooperative play feel great out of the box.',
    tasksCompleted: 5,
    activeVolunteers: 4,
  },
  {
    id: 'polish-playtests',
    title: 'Stability & Polish',
    phase: 'Late',
    description:
      'Polish passes, optimization, and wider playtests. Help us stress-test builds and report what breaks — or what delights.',
    tasksCompleted: 3,
    activeVolunteers: 6,
  },
];

/** Community stats row — replace with live metrics when available */
const STATS = [
  { label: 'Volunteers', value: '—', icon: '👥' },
  { label: 'Ideas Submitted', value: '—', icon: '💡' },
  { label: 'Active Projects', value: '3', icon: '⚒️' },
  { label: 'Tasks Claimed', value: '—', icon: '✅' },
];

/** Recent activity feed samples */
const RECENT_ACTIVITY = [
  {
    user: 'Alex R.',
    userInitials: 'AR',
    action: 'submitted an idea',
    target: 'Co-op Base Builder',
    time: '2h ago',
  },
  {
    user: 'Jordan K.',
    userInitials: 'JK',
    action: 'claimed a task on',
    target: 'Prototype Systems',
    time: '5h ago',
  },
  {
    user: 'Sam T.',
    userInitials: 'ST',
    action: 'completed art for',
    target: 'Core Features Sprint',
    time: '1d ago',
  },
  {
    user: 'Riley M.',
    userInitials: 'RM',
    action: 'joined the forge on',
    target: 'Get Involved',
    time: '1d ago',
  },
];

// External links
// Placeholder invite — replace with the real Discord server URL when ready
const DISCORD_URL = 'https://discord.gg/togetherforge';
const INTRO_VIDEO_URL = 'https://www.youtube.com/@MXDGameGuides';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const HomePage = () => {
  const navigate = useNavigate();

  const handleViewProject = (projectId) => {
    navigate(`/projects/${projectId}`);
  };

  return (
    <div className="bg-cyber-bg text-text-primary">
      {/* ================================================================
          HERO
          ================================================================ */}
      <section className="relative min-h-[100dvh] flex flex-col overflow-hidden">
        {/* Animated cyber grid + radial glows */}
        <div className="absolute inset-0 cyber-grid" aria-hidden="true" />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,249,255,0.08)_0%,transparent_70%)]"
          aria-hidden="true"
        />
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[min(90vw,700px)] h-[300px] bg-neon-magenta/10 blur-[120px] rounded-full pointer-events-none"
          aria-hidden="true"
        />

        {/* Main hero content — grows to fill space; mobile stack preserved */}
        <div className="relative z-10 flex-1 flex items-center justify-center pt-20 pb-28 sm:pb-32">
          <div className="container-custom text-center px-6 w-full">
            <div className="max-w-5xl mx-auto">
              {/* Status pill */}
              <div className="flex justify-center mb-8">
                <div className="status-bar text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
                  PROTOCOL ACTIVE // COMMUNITY FUNDING OPEN // v0.4
                </div>
              </div>

              {/* Headline */}
              <h1 className="font-mono text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] leading-[0.95] tracking-tight font-bold text-white mb-4">
                Together <span className="neon-magenta">Forge</span>
              </h1>

              {/* Tagline */}
              <p className="max-w-3xl mx-auto text-lg sm:text-xl md:text-2xl text-text-secondary mb-6 tracking-tight">
                We are not just a game company. We are a community that is making
                the world a better place.
              </p>

              {/* Mission paragraph */}
              <p className="max-w-2xl mx-auto text-sm sm:text-base text-text-muted mb-10 leading-relaxed">
                {MISSION_BLURB}
              </p>

              {/* Primary CTAs — stacked on mobile (kept as preferred) */}
              <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 sm:gap-4 mb-6">
                <Button
                  size="lg"
                  className="w-full sm:w-auto gap-2"
                  onClick={() => navigate('/projects')}
                >
                  <Hammer className="w-4 h-4" />
                  Explore Projects
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto gap-2"
                  onClick={() => navigate('/ideas/submit')}
                >
                  <Sparkles className="w-4 h-4" />
                  Submit an Idea
                </Button>

                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full sm:w-auto gap-2"
                  onClick={() => navigate('/get-involved')}
                >
                  <Users className="w-4 h-4" />
                  Get Involved
                </Button>
              </div>

              {/* Secondary actions */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 mb-14">
                <a
                  href={INTRO_VIDEO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-text-secondary hover:text-neon-cyan transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Watch Intro Video
                </a>
                <span className="hidden sm:inline text-cyber-border" aria-hidden="true">
                  |
                </span>
                <a
                  href={DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-text-secondary hover:text-neon-magenta transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Join Discord
                </a>
              </div>

              {/* Trust strip */}
              <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-[10px] sm:text-xs font-mono tracking-[2px] text-text-secondary/70">
                <div>COMMUNITY SUPPORTED</div>
                <div>NO VENTURE CAPITAL</div>
                <div>TRANSPARENT DEVELOPMENT</div>
                <div>PIXELS → PEOPLE</div>
              </div>
            </div>
          </div>
        </div>

        {/*
          Scroll hint — full-width flex row so text is truly centered on every
          viewport (avoids left-1/2 + translate quirks with motion + long labels).
        */}
        <div className="absolute bottom-6 sm:bottom-8 inset-x-0 z-20 flex justify-center pointer-events-none px-4">
          <motion.a
            href="#mission"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-auto flex flex-col items-center gap-1.5 text-center no-underline"
            aria-label="Scroll to mission section"
          >
            <span className="text-[10px] sm:text-[11px] tracking-[0.25em] sm:tracking-[0.3em] text-neon-cyan/70 font-mono uppercase whitespace-nowrap">
              Scroll to begin
            </span>
            <span className="block h-px w-8 bg-gradient-to-r from-transparent via-neon-cyan/60 to-transparent" />
            <ChevronDown className="w-4 h-4 text-neon-cyan/60" aria-hidden="true" />
          </motion.a>
        </div>

        {/* Fade hero into next band so the void never drops to a flat cut */}
        <div
          className="absolute bottom-0 inset-x-0 h-32 sm:h-40 pointer-events-none z-10 bg-gradient-to-b from-transparent via-cyber-bg/80 to-cyber-surface"
          aria-hidden="true"
        />
      </section>

      {/* ================================================================
          SCROLL TRANSITION — neon bridge so users know more content awaits
          ================================================================ */}
      <div
        className="relative z-10 -mt-px border-t border-neon-cyan/10"
        aria-hidden="true"
      >
        {/* Soft cyan → magenta wash */}
        <div className="h-16 sm:h-20 bg-gradient-to-b from-cyber-surface via-cyber-card/40 to-cyber-surface" />

        {/* Neon hairline + glow nodes */}
        <div className="relative flex items-center justify-center px-6 -mt-8 sm:-mt-10 mb-2">
          <div className="w-full max-w-md h-px bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" />
          <div className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-neon-cyan shadow-neon-cyan" />
          <div className="absolute left-[calc(50%-3rem)] w-1 h-1 rounded-full bg-neon-magenta/70 shadow-neon-magenta" />
          <div className="absolute left-[calc(50%+3rem)] w-1 h-1 rounded-full bg-neon-purple/70 shadow-neon-purple" />
        </div>

        <p className="text-center text-[10px] font-mono tracking-[0.35em] uppercase text-text-muted pb-6 sm:pb-8">
          Explore the forge
        </p>
      </div>

      {/* ================================================================
          MISSION & VALUES TEASER
          ================================================================ */}
      <section
        id="mission"
        className="py-20 md:py-28 border-t border-cyber-border/60 bg-cyber-surface"
      >
        <div className="container-custom">
          <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
            <div className="section-header">Mission & Values</div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
              By the Community,
              <br className="hidden sm:block" /> For the Community
            </h2>
            <p className="text-text-secondary text-base sm:text-lg leading-relaxed">
              Four principles guide every decision — from how we fund builds to
              how volunteers get credit for their work.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
            {VALUES.map((value) => {
              const Icon = value.icon;
              return (
                <Card
                  key={value.title}
                  className="flex flex-col h-full bg-cyber-card/80"
                >
                  <div
                    className={`w-11 h-11 mb-5 rounded-xl bg-cyber-surface border border-cyber-border flex items-center justify-center ${value.accent}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-mono text-sm tracking-widest uppercase text-white mb-3">
                    {value.title}
                  </h3>
                  <p className="text-text-secondary text-sm leading-relaxed flex-1">
                    {value.desc}
                  </p>
                </Card>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <Link
              to="/about"
              className="inline-flex items-center gap-2 text-neon-cyan font-mono text-sm tracking-widest hover:underline"
            >
              Read our full mission <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================
          FEATURED PROJECTS
          ================================================================ */}
      <section
        id="projects"
        className="relative py-20 md:py-28 border-t border-cyber-border overflow-hidden"
      >
        {/* Subtle page-depth glow so flat black never returns mid-scroll */}
        <div
          className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(192,38,211,0.06)_0%,transparent_55%)]"
          aria-hidden="true"
        />

        <div className="container-custom relative z-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10 md:mb-14 max-w-6xl mx-auto">
            <div>
              <div className="section-header">Featured Projects</div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                What we&apos;re building
              </h2>
              <p className="text-text-secondary mt-2 max-w-xl">
                From early prototypes to polish sprints — pick a project and see
                where you can jump in.
              </p>
            </div>
            <Badge variant="neon">Live pipeline</Badge>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {FEATURED_PROJECTS.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onView={handleViewProject}
              />
            ))}
          </div>

          <div className="text-center mt-10">
            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => navigate('/projects')}
            >
              View all projects <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ================================================================
          COMMUNITY HIGHLIGHTS — stats + recent activity
          ================================================================ */}
      <section
        id="community"
        className="py-20 md:py-28 border-t border-cyber-border bg-cyber-surface"
      >
        <div className="container-custom max-w-6xl">
          <div className="text-center mb-12 md:mb-14">
            <div className="section-header">Community Highlights</div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              The forge is alive
            </h2>
            <p className="text-text-secondary mt-2 max-w-xl mx-auto">
              A snapshot of momentum across volunteers, ideas, and open work.
              Stats will wire up to live data as the platform grows.
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {STATS.map((stat) => (
              <StatWidget
                key={stat.label}
                label={stat.label}
                value={stat.value}
                icon={stat.icon}
              />
            ))}
          </div>

          {/* Activity feed + side promo */}
          <div className="grid lg:grid-cols-5 gap-6">
            <Card className="lg:col-span-3 bg-cyber-card/80" glow={false}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono text-sm tracking-widest uppercase text-neon-cyan">
                  Recent Activity
                </h3>
                <Badge variant="default">Feed</Badge>
              </div>
              <div>
                {RECENT_ACTIVITY.map((activity, i) => (
                  <ActivityItem key={`${activity.user}-${i}`} activity={activity} />
                ))}
              </div>
            </Card>

            <Card className="lg:col-span-2 flex flex-col justify-between bg-cyber-card/80 border-neon-purple/30">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-5 h-5 text-neon-purple" />
                  <h3 className="font-mono text-sm tracking-widest uppercase text-white">
                    Open the Forge
                  </h3>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed mb-6">
                  Browse ideas, claim tasks, or just hang out on Discord. Every
                  skill level is welcome — code, art, design, testing, or
                  community support.
                </p>
                <ul className="space-y-2 text-sm text-text-muted mb-6">
                  <li className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-neon-cyan" />
                    Transparent progress & credit
                  </li>
                  <li className="flex items-center gap-2">
                    <Hammer className="w-3.5 h-3.5 text-neon-cyan" />
                    Real tasks with clear ownership
                  </li>
                  <li className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-neon-cyan" />
                    Streamers, gamers & builders
                  </li>
                </ul>
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  className="w-full gap-2"
                  onClick={() => navigate('/get-involved')}
                >
                  Join the work <ArrowRight className="w-4 h-4" />
                </Button>
                <a
                  href={DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 text-sm font-mono tracking-widest text-text-secondary hover:text-neon-magenta transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Join Discord
                </a>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ================================================================
          CLOSING CTA
          ================================================================ */}
      <section
        id="join"
        className="relative py-20 md:py-28 border-t border-cyber-border overflow-hidden"
      >
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,249,255,0.08)_0%,transparent_65%)]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(192,38,211,0.06)_0%,transparent_50%)]"
          aria-hidden="true"
        />
        <div className="container-custom relative z-10 text-center max-w-3xl mx-auto">
          <div className="section-header">Ready?</div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
            Build the next game <span className="neon-cyan">together</span>
          </h2>
          <p className="text-text-secondary text-base sm:text-lg mb-10 leading-relaxed">
            Whether you ship pixels, prototypes, or pure enthusiasm — there is a
            place for you at Together Forge. Start with an idea, a task, or a
            conversation.
          </p>

          {/* Mobile: stacked full-width CTAs (kept); sm+: row */}
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 sm:gap-4">
            <Button
              size="lg"
              className="w-full sm:w-auto gap-2"
              onClick={() => navigate('/ideas/submit')}
            >
              Submit an Idea <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto gap-2"
              onClick={() => navigate('/get-involved')}
            >
              Get Involved
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="w-full sm:w-auto gap-2"
              onClick={() => navigate('/about')}
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
