/**
 * HomePage - Tier 1 Exploration surface
 *
 * Classic: previous cyber look.
 * Forge: Dark Future Atmospheric Forge - logo-led cinematic hero,
 * selective gold/ember, quieter denser sections.
 */

import { useEffect, useState } from 'react';
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
import ScrollProgress, {
  SectionContinueCue,
} from '../components/ScrollProgress';
import { getHomeCommunityStats } from '../services/communityStatsService';

const TF_LOGO_SRC = '/images/TF_Logo_Ideas_V2.png';
const HERO_BG_SRC = '/images/Hero_Background.webp';

const MISSION_BLURB =
  'Together Forge is a community-first independent game studio. We organize and support games built collaboratively by gamers, streamers, and volunteers. Transparent development, fair progression, and real connection.';

const VALUES = [
  {
    icon: Users,
    title: 'By the Community',
    desc: 'Games designed and built collaboratively. No corporate agendas. Just real teamwork, shared ownership, and fun.',
    accent: 'text-neon-cyan',
    iconBorder: 'border-neon-cyan/30',
    featured: false,
  },
  {
    icon: Heart,
    title: 'For the Community',
    desc: 'Experiences that bring people together: streamers with audiences, friends uniting for challenges, massive collabs.',
    accent: 'text-neon-purple',
    iconBorder: 'border-neon-purple/30',
    featured: false,
  },
  {
    icon: Shield,
    title: 'Transparent & Fair',
    desc: 'Open development, public progress, and a living-wage-only model. Net proceeds reinvest into games and community tools.',
    accent: 'text-semantic-success',
    iconBorder: 'border-semantic-success/30',
    featured: false,
  },
  {
    icon: Sparkles,
    title: 'Early Game Focus',
    desc: 'Start simple with fun multiplayer prototypes that prove systems. Then scale into bigger community-driven projects.',
    accent: 'text-semantic-achievement',
    iconBorder: 'border-semantic-achievement/35',
    featured: true,
  },
];

const FEATURED_PROJECTS = [
  {
    id: 'prototype-systems',
    title: 'Tether',
    phase: 'Early',
    status: 'active',
    description:
      'A tethered crew crosses dangerous semi-procedural levels to reach a destroyed orbital station. Linked by a shared energy tether, players coordinate movement, collect resources for their stranded colony, and recover an antimatter generator so the colony can survive on its own.',
    // Live stats only when real data is wired; omit or set numbers from the board
    tasksCompleted: 12,
    activeVolunteers: 8,
    href: '/projects/prototype-systems',
    ctaLabel: 'View Project',
  },
  {
    id: 'core-features',
    title: 'Core Features Sprint',
    phase: 'Mid',
    status: 'planned',
    description:
      'Next up after Early is completed: design work and integrations for systems that make cooperative play feel great. Not open for claims yet.',
    href: '/projects/mid',
    ctaLabel: 'View Plans',
    statusNote: 'after Early is completed',
  },
  {
    id: 'polish-playtests',
    title: 'Stability & Polish',
    phase: 'Late',
    status: 'planned',
    description:
      'Opens only after Mid is completed: polish, optimization, and wider playtests. Not open for claims yet.',
    href: '/projects/late',
    ctaLabel: 'View Plans',
    statusNote: 'after Mid is completed',
  },
];

const STAT_META = [
  { key: 'volunteers', label: 'Volunteers', icon: '👥', tone: 'live' },
  { key: 'ideasSubmitted', label: 'Ideas Submitted', icon: '💡', tone: 'default' },
  {
    key: 'activeProjects',
    label: 'Active Projects',
    icon: '⚒️',
    tone: 'achievement',
  },
  { key: 'tasksClaimed', label: 'Tasks Claimed', icon: '✅', tone: 'success' },
];

const EMPTY_STATS = {
  volunteers: 0,
  ideasSubmitted: 0,
  activeProjects: 0,
  tasksClaimed: 0,
};

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
    target: 'Tether',
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

const DISCORD_URL = 'https://discord.gg/togetherforge';
const INTRO_VIDEO_URL = 'https://www.youtube.com/@MXDGameGuides';

const HomePage = () => {
  const navigate = useNavigate();
  const [communityStats, setCommunityStats] = useState(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      try {
        const live = await getHomeCommunityStats();
        if (!cancelled && live) {
          setCommunityStats({
            volunteers: live.volunteers ?? 0,
            ideasSubmitted: live.ideasSubmitted ?? 0,
            activeProjects: live.activeProjects ?? 0,
            tasksClaimed: live.tasksClaimed ?? 0,
          });
        }
      } catch (err) {
        console.warn('[HomePage] community stats failed:', err);
        if (!cancelled) setCommunityStats(EMPTY_STATS);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleViewProject = (project) => {
    if (!project) return;
    // Active: live workspace. Planned Mid/Late: phase overview only (not a claim board).
    if (project.href) {
      navigate(project.href);
      return;
    }
    if (project.status === 'planned') {
      const phase = String(project.phase || '').toLowerCase();
      if (phase === 'mid' || phase === 'late') {
        navigate(`/projects/${phase}`);
        return;
      }
    }
    if (project.id != null) navigate(`/projects/${project.id}`);
  };

  return (
    <div className="home-page bg-cyber-bg text-text-primary">
      <ScrollProgress />

      {/* ================================================================
          HERO - Tier 1: logo-led, cinematic, sparse
          ================================================================ */}
      <section className="home-hero relative min-h-[100dvh] flex flex-col overflow-hidden">
        {/* Hero background image */}
        <div className="absolute inset-0" aria-hidden="true">
          <img
            src={HERO_BG_SRC}
            alt=""
            className="home-hero-bg-img absolute inset-0 w-full h-full object-cover object-center"
            decoding="async"
            fetchPriority="high"
          />
          {/* Readability scrim - keeps logo + copy legible */}
          <div className="home-hero-bg-scrim absolute inset-0 bg-cyber-bg/55" />
          <div className="home-hero-atmosphere absolute inset-0" />
          <div className="home-hero-vignette absolute inset-0" />
          {/* Classic: light grid on top of image; Forge nearly hides it via CSS */}
          <div className="absolute inset-0 cyber-grid opacity-40" />
        </div>

        <div className="relative z-10 flex-1 flex items-center justify-center pt-24 pb-28 sm:pb-32">
          <div className="container-custom text-center px-6 w-full">
            <div className="max-w-3xl mx-auto">
              {/* Focal emblem */}
              <div className="flex justify-center mb-8 sm:mb-10">
                <div className="home-hero-logo-wrap relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52">
                  <div
                    className="home-hero-logo-ember absolute inset-[-20%] rounded-full pointer-events-none"
                    aria-hidden="true"
                  />
                  <img
                    src={TF_LOGO_SRC}
                    alt="Together Forge"
                    width={208}
                    height={208}
                    className="relative z-10 w-full h-full object-contain select-none"
                    decoding="async"
                    fetchPriority="high"
                  />
                </div>
              </div>

              <div className="flex justify-center mb-6 sm:mb-8">
                <div className="home-hero-status status-bar text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
                  LIVE // COMMUNITY FORGE // v0.4
                </div>
              </div>

              <h1 className="home-hero-title font-mono text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[0.98] tracking-tight font-bold text-white mb-5">
                Together{' '}
                <span className="home-hero-accent text-neon-purple">Forge</span>
              </h1>

              <p className="max-w-xl mx-auto text-lg sm:text-xl text-text-secondary mb-5 tracking-tight font-medium">
                By the Community, For the Community
              </p>

              <p className="max-w-md mx-auto text-sm text-text-muted mb-10 sm:mb-12 leading-relaxed">
                {MISSION_BLURB}
              </p>

              {/* One clear primary; supporting actions quieter */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-8">
                <Button
                  size="lg"
                  className="home-hero-cta-primary w-full sm:w-auto gap-2 min-w-[13rem] text-base"
                  onClick={() => navigate('/projects')}
                >
                  <Hammer className="w-4 h-4" />
                  Explore Projects
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full sm:w-auto gap-2 min-w-[13rem]"
                  onClick={() => navigate('/get-involved')}
                >
                  <Users className="w-4 h-4" />
                  Get Involved
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-12 text-xs sm:text-sm font-mono tracking-widest text-text-muted">
                <button
                  type="button"
                  onClick={() => navigate('/ideas/submit')}
                  className="inline-flex items-center gap-1.5 hover:text-neon-cyan transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Submit an idea
                </button>
                <a
                  href={INTRO_VIDEO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-neon-cyan transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  Watch intro
                </a>
                <a
                  href={DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-neon-purple transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Discord
                </a>
              </div>

              <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-[10px] font-mono tracking-[0.22em] text-text-muted/70">
                <span>COMMUNITY SUPPORTED</span>
                <span>NO VENTURE CAPITAL</span>
                <span>TRANSPARENT DEV</span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-5 sm:bottom-7 inset-x-0 z-20 flex justify-center pointer-events-none">
          <motion.a
            href="#mission"
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            className="pointer-events-auto flex flex-col items-center gap-1 no-underline"
            aria-label="Scroll to mission"
          >
            <span className="text-[10px] tracking-[0.28em] text-neon-cyan/55 font-mono uppercase">
              Enter the workshop
            </span>
            <ChevronDown className="w-4 h-4 text-neon-cyan/45" aria-hidden />
          </motion.a>
        </div>

        <div
          className="absolute bottom-0 inset-x-0 h-32 pointer-events-none z-10 bg-gradient-to-b from-transparent via-cyber-bg/40 to-cyber-surface"
          aria-hidden="true"
        />
      </section>

      {/* Soft handoff - no neon jewelry */}
      <div className="h-6 sm:h-8 bg-cyber-surface border-t border-cyber-border/30" />

      {/* ================================================================
          MISSION - quieter supporting section
          ================================================================ */}
      <section
        id="mission"
        className="home-section-quiet py-16 md:py-24 border-t border-cyber-border/40"
      >
        <div className="container-custom">
          <div className="max-w-xl mb-10 md:mb-14">
            <div className="section-header">Mission & Values</div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white mb-3">
              By the Community, For the Community
            </h2>
            <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
              Four principles guide funding, credit, and how we build together.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 max-w-6xl">
            {VALUES.map((value) => {
              const Icon = value.icon;
              return (
                <Card
                  key={value.title}
                  variant={value.featured ? 'panel' : 'default'}
                  className={`home-value-card flex flex-col h-full bg-cyber-card/80 ${
                    value.featured ? 'home-value-card--featured' : ''
                  }`}
                >
                  <div
                    className={`w-10 h-10 mb-4 rounded-lg bg-cyber-surface border flex items-center justify-center ${value.iconBorder} ${value.accent}`}
                  >
                    <Icon className="w-4.5 h-4.5 w-5 h-5" />
                  </div>
                  <h3 className="font-mono text-xs tracking-widest uppercase text-white mb-2">
                    {value.title}
                  </h3>
                  <p className="text-text-secondary text-sm leading-relaxed flex-1">
                    {value.desc}
                  </p>
                  {value.featured && (
                    <div className="mt-3">
                      <Badge variant="gold" className="!normal-case">
                        Core path
                      </Badge>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <div className="mt-8">
            <Link
              to="/about"
              className="inline-flex items-center gap-2 text-neon-cyan font-mono text-xs tracking-widest hover:underline"
            >
              Full mission <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <SectionContinueCue />
        </div>
      </section>

      {/* ================================================================
          PROJECTS - featured takes the stage
          ================================================================ */}
      <section
        id="projects"
        className="relative py-16 md:py-24 border-t border-cyber-border overflow-hidden"
      >
        <div
          className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgb(var(--tf-semantic-achievement)/0.05)_0%,transparent_45%)]"
          aria-hidden="true"
        />

        <div className="container-custom relative z-10 max-w-6xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 md:mb-10">
            <div>
              <div className="section-header">Featured Projects</div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white">
                What we&apos;re building
              </h2>
              <p className="text-text-secondary mt-2 max-w-lg text-sm">
                Early is the active focus - claim real work there. Mid opens
                after Early is completed; Late opens after Mid is completed.
              </p>
            </div>
            <Badge variant="neon">Early focus</Badge>
          </div>

          {/* Equal-height panels: Early live; Mid/Late planned only */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-5 items-stretch">
            {FEATURED_PROJECTS.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onView={handleViewProject}
                featured={project.status === 'active'}
                className="home-project-card h-full"
              />
            ))}
          </div>

          <div className="text-center mt-8">
            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => navigate('/projects')}
            >
              View all projects <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
          <SectionContinueCue />
        </div>
      </section>

      {/* ================================================================
          COMMUNITY - utility-quiet density on exploration page
          ================================================================ */}
      <section
        id="community"
        className="home-section-quiet py-16 md:py-24 border-t border-cyber-border"
      >
        <div className="container-custom max-w-6xl">
          <div className="mb-10 max-w-lg">
            <div className="section-header">Community</div>
            <p className="text-text-secondary text-sm">
              Momentum across volunteers, ideas, and open work.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
            {STAT_META.map((stat) => (
              <StatWidget
                key={stat.key}
                label={stat.label}
                value={
                  statsLoading
                    ? '…'
                    : communityStats[stat.key] ?? 0
                }
                icon={stat.icon}
                tone={stat.tone}
                className={`home-stat ${statsLoading ? 'opacity-80' : ''}`}
              />
            ))}
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            <Card
              className="home-activity-panel lg:col-span-3 bg-cyber-card/80"
              glow={false}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-mono text-xs tracking-widest uppercase text-neon-cyan">
                  Recent Activity
                </h3>
                <Badge variant="default">Live</Badge>
              </div>
              {RECENT_ACTIVITY.map((activity, i) => (
                <ActivityItem
                  key={`${activity.user}-${i}`}
                  activity={activity}
                />
              ))}
            </Card>

            <Card className="home-promo-panel lg:col-span-2 flex flex-col justify-between bg-cyber-card/80 border-neon-cyan/25">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-4 h-4 text-neon-cyan" />
                  <h3 className="font-mono text-xs tracking-widest uppercase text-white">
                    Open the Forge
                  </h3>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed mb-5">
                  Claim tasks, ship wins, or hang on Discord. Every skill level
                  welcome.
                </p>
                <ul className="space-y-2 text-sm text-text-muted mb-6">
                  <li className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-semantic-success shrink-0" />
                    Transparent progress &amp; credit
                  </li>
                  <li className="flex items-center gap-2">
                    <Hammer className="w-3.5 h-3.5 text-neon-cyan shrink-0" />
                    Clear task ownership
                  </li>
                  <li className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-semantic-achievement shrink-0" />
                    Streamers, gamers &amp; builders
                  </li>
                </ul>
              </div>
              <Button
                className="w-full gap-2 home-hero-cta-primary"
                onClick={() => navigate('/get-involved')}
              >
                Join the work <ArrowRight className="w-4 h-4" />
              </Button>
            </Card>
          </div>
          <SectionContinueCue />
        </div>
      </section>

      {/* ================================================================
          CLOSING - sparse hearth
          ================================================================ */}
      <section
        id="join"
        className="home-closing relative py-20 md:py-28 border-t border-cyber-border overflow-hidden"
      >
        <div className="container-custom relative z-10 text-center max-w-xl mx-auto">
          <div className="section-header mx-auto">Ready?</div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
            Build the next game{' '}
            <span className="home-closing-accent text-neon-purple">together</span>
          </h2>
          <p className="text-text-secondary text-sm sm:text-base mb-10 leading-relaxed">
            Pixels, prototypes, or pure enthusiasm. Start with an idea, a task,
            or a conversation.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              className="w-full sm:w-auto gap-2 home-hero-cta-primary"
              onClick={() => navigate('/ideas/submit')}
            >
              Submit an Idea <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="w-full sm:w-auto gap-2"
              onClick={() => navigate('/get-involved')}
            >
              Get Involved
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
