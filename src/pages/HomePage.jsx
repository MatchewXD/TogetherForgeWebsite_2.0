/**
 * HomePage - Tier 1 Exploration surface
 *
 * Classic: previous cyber look.
 * Forge: Dark Future Atmospheric Forge - logo-led cinematic hero,
 * selective gold/ember, quieter denser sections.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Play,
  MessageCircle,
  Hammer,
  Users,
  Sparkles,
  Eye,
  Shield,
  Globe,
  Lightbulb,
  MessageSquare,
  Layers,
  Award,
  Film,
  Wrench,
} from 'lucide-react';

import Button from '../components/ui/Buttons';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { phaseImageSrc, phaseImageAlt } from '../utils/phaseImages';
import { EARLY_PHASE_DEFAULTS } from '../utils/phasePageContent';
import ActivityItem from '../components/ui/ActivityItem';
import ScrollProgress, {
  SectionContinueCue,
  HeroContinueCue,
} from '../components/ScrollProgress';
import {
  getHomeCommunityStats,
  getHomeRecentActivity,
} from '../services/communityStatsService';
import { DISCORD_URL, DISCORD_LABELS } from '../constants/communityLinks';
import DiscordLink from '../components/ui/DiscordLink';
import BannerImage from '../components/ui/BannerImage';

const TF_LOGO_SRC = '/images/TF_Logo_Ideas_V2.webp';
const HERO_BG_SRC = '/images/Hero_Background.webp';

const sectionTitleClass =
  'section-header dashboard-page-title !mb-4 !text-3xl sm:!text-4xl !font-bold !tracking-tight !normal-case';

const HOW_IT_WORKS_STEPS = [
  { title: 'Share an idea or offer a skill', icon: Lightbulb },
  { title: 'Discuss and refine in public', icon: MessageSquare },
  { title: 'Official projects select from the strongest ideas', icon: Layers },
  { title: 'Claim tasks and build together', icon: Hammer },
  { title: 'Get public credit, then ship', icon: Award },
];

const INVOLVE_PATHS = [
  {
    title: 'Game Development',
    icon: Hammer,
    body: 'Claim real tasks on live project boards. Code, art, audio, design, testing, and more. Completed work receives public credit.',
  },
  {
    title: 'Ideas',
    icon: Lightbulb,
    body: 'Share game concepts, mechanics, and improvements. The community discusses them in the open. Strong ideas can move into official projects.',
  },
  {
    title: 'Content Creation',
    icon: Film,
    body: 'Help grow the studio through media. Share community work in the Showcase or apply to join the official Content Creators Team.',
  },
  {
    title: 'Community & Moderation',
    icon: Shield,
    body: 'Help keep the spaces welcoming and useful. Greet new people, surface good ideas, and support healthy discussion.',
  },
  {
    title: 'Other Skills & Support',
    icon: Wrench,
    body: 'Documentation, tooling, translations, design help, and optional financial support are also open.',
  },
];

const TRUST_VISIBLE = [
  { label: 'Public finances', icon: Eye },
  { label: 'Decision logs', icon: Layers },
  { label: 'Credits', icon: Award },
  { label: 'Founder compensation rules', icon: Shield },
];

const PATH_FORWARD = [
  {
    id: 'early',
    phase: 'Early',
    title: 'Early Game Foundation',
    href: '/projects/early',
    linkLabel: 'Explore Early Game',
    paragraphs: EARLY_PHASE_DEFAULTS.aboutParagraphs,
  },
  {
    id: 'mid',
    phase: 'Mid',
    title: 'Mid Game Ambitions',
    href: '/projects/mid',
    linkLabel: 'Explore Mid Game',
    paragraphs: [
      'Mid Game is where we take the foundation built in Early and aim much higher.',
      'In Mid we build substantial cooperative games with deeper systems, stronger teamwork, and higher ambition, still driven by a lean core team and a growing community. This is the first major step toward becoming one of the most capable game-making forces in the world through community power rather than investors or agendas.',
    ],
  },
  {
    id: 'late',
    phase: 'Late',
    title: 'Late Game Masterpiece',
    href: '/projects/late',
    linkLabel: 'Explore Late Game',
    paragraphs: [
      'Late Game is the highest ambition of Together Forge.',
      'After Early Game proves the model and Mid Game proves we can deliver substantial cooperative titles, Late Game is where we attempt to make the best MMORPG in the world. Not a clone of systems that already feel safe and familiar, but a new foundation: cooperative combat, evolving world-level threats, a story that the entire player base shapes together, and deep support for both creators and fighters.',
      'Once this scale of game is established and successful, Together Forge will be positioned to expand far beyond a single title. That growth will come from community power, not from investors or political agendas.',
      'This stage only opens when the Forge has earned it through earlier success.',
    ],
  },
];

const STAT_META = [
  {
    key: 'members',
    label: 'Members',
    iconSrc: '/images/community-pulse/Members.png',
    accent: 'cyan',
  },
  {
    key: 'ideasSubmitted',
    label: 'Ideas Submitted',
    iconSrc: '/images/community-pulse/Ideas_Submitted.png',
    accent: 'gold',
  },
  {
    key: 'supporters',
    label: 'Supporters',
    iconSrc: '/images/community-pulse/Supporters.png',
    accent: 'magenta',
  },
  {
    key: 'tasksCompleted',
    label: 'Tasks Completed',
    iconSrc: '/images/community-pulse/Contributions.png',
    accent: 'purple',
  },
];

const EMPTY_STATS = {
  members: 0,
  ideasSubmitted: 0,
  supporters: 0,
  tasksCompleted: 0,
};

function formatPulseValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-US');
}

const INTRO_VIDEO_URL = 'https://www.youtube.com/@MXDGameGuides';

const HomePage = () => {
  const [communityStats, setCommunityStats] = useState(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      setActivityLoading(true);
      try {
        const [live, feed] = await Promise.all([
          getHomeCommunityStats(),
          getHomeRecentActivity({ limit: 6 }).catch((err) => {
            console.warn('[HomePage] activity failed:', err);
            return [];
          }),
        ]);
        if (!cancelled && live) {
          setCommunityStats({
            members: live.members ?? 0,
            ideasSubmitted: live.ideasSubmitted ?? 0,
            supporters: live.supporters ?? 0,
            tasksCompleted: live.tasksCompleted ?? 0,
          });
        }
        if (!cancelled) {
          setRecentActivity(Array.isArray(feed) ? feed : []);
        }
      } catch (err) {
        console.warn('[HomePage] community stats failed:', err);
        if (!cancelled) {
          setCommunityStats(EMPTY_STATS);
          setRecentActivity([]);
        }
      } finally {
        if (!cancelled) {
          setStatsLoading(false);
          setActivityLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);



  return (
    <div className="home-page bg-cyber-bg text-text-primary">
      <ScrollProgress />
      <HeroContinueCue targetId="mission" />

      {/* ================================================================
          HERO - Tier 1: logo-led, cinematic, sparse
          ================================================================ */}
      <section className="home-hero relative min-h-[100dvh] flex flex-col overflow-hidden">
        {/* Hero background image */}
        <div className="absolute inset-0" aria-hidden="true">
          <BannerImage
            src={HERO_BG_SRC}
            className="home-hero-bg-img absolute inset-0 w-full h-full object-cover object-center"
            fetchPriority="high"
          />
          <div className="home-hero-overlay absolute inset-0" />
        </div>

        <div className="relative z-10 flex-1 flex items-center justify-center pt-24 pb-28 sm:pb-32">
          <div className="container-custom text-center px-6 w-full">
            <div className="max-w-3xl mx-auto relative">
              <div
                className="home-hero-copy-glow pointer-events-none absolute -inset-x-6 sm:-inset-x-12 -inset-y-4 sm:-inset-y-8 rounded-[2rem]"
                aria-hidden="true"
              />
              <div className="relative [text-shadow:0_1px_2px_rgb(0_0_0_/_0.95),0_6px_22px_rgb(0_0_0_/_0.75)]">
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
                  />
                </div>
              </div>

              <h1 className="home-hero-title font-mono text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[0.98] tracking-tight font-bold text-white mb-5">
                Together{' '}
                <span className="home-hero-accent text-neon-purple">Forge</span>
              </h1>

              <p className="max-w-xl mx-auto text-lg sm:text-xl text-white mb-8 tracking-tight font-medium">
                By the Community, For the Community
              </p>

              <div className="max-w-xl mx-auto mb-10 sm:mb-12 space-y-4">
                <p className="text-xl sm:text-2xl md:text-[1.65rem] font-semibold text-white leading-snug tracking-tight">
                  No investors.
                  <br />
                  No third-party ownership.
                  <br />
                  No ideological agendas.
                </p>
                <p className="text-base sm:text-lg text-white/90 leading-relaxed">
                  Just game development driven by the people who actually care.
                </p>
              </div>

              {/* One clear primary; supporting actions quieter */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-8">
                <Button
                  size="lg"
                  className="home-hero-cta-primary w-full sm:w-auto gap-2 min-w-[13rem] text-base"
                  to="/projects"
                >
                  <Hammer className="w-4 h-4" />
                  Explore Projects
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full sm:w-auto gap-2 min-w-[13rem]"
                  to="/get-involved"
                >
                  <Users className="w-4 h-4" />
                  Get Involved
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-12 text-xs sm:text-sm font-mono tracking-widest text-white/80">
                <Link
                  to="/ideas/submit"
                  className="inline-flex items-center gap-1.5 hover:text-neon-cyan transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Submit an idea
                </Link>
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
                  {DISCORD_LABELS.join}
                </a>
              </div>

              <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-[10px] font-mono tracking-[0.22em] text-white/70 mb-6 sm:mb-8">
                <span>COMMUNITY SUPPORTED</span>
                <span>NO VENTURE CAPITAL</span>
                <span>TRANSPARENT DEV</span>
              </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="absolute bottom-0 inset-x-0 h-32 pointer-events-none z-10 bg-gradient-to-b from-transparent via-cyber-bg/40 to-cyber-surface"
          aria-hidden="true"
        />
      </section>

      {/* Soft handoff - no neon jewelry */}
      <div className="h-6 sm:h-8 bg-cyber-surface border-t border-cyber-border/30" />

      {/* ================================================================
          IDENTITY / MISSION
          ================================================================ */}
      <section
        id="mission"
        className="home-section-quiet py-16 md:py-24 border-t border-cyber-border/40"
      >
        <div className="container-custom max-w-3xl">
          <h2 className={sectionTitleClass}>
            Built by the community. Owned by no one else.
          </h2>
          <div className="mt-6 space-y-4 text-sm sm:text-base leading-relaxed text-text-secondary">
            <p>
              Together Forge is a community-first independent game studio. We
              make cooperative games with gamers, streamers, and volunteers.
              Development happens in the open. Credit is public. Money that
              comes in goes back into the games and the people making them.
            </p>
            <p>
              Together Forge will not take outside investors. We will not sell
              ownership, decision-making power, or any form of ongoing control
              to third parties. The studio is structured to remain independent
              and accountable to the community that builds and supports it, not
              to external capital.
            </p>
            <p>
              Most large companies have stopped experimenting. They reduce risk
              and ship safer versions of what already worked. We exist to go
              the other direction.
            </p>
            <p>
              Our path is deliberate: start with focused cooperative games that
              prove the model, then grow into much larger ambitions through the
              combined power of the community.
            </p>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
            <Button
              className="gap-2"
              to="/get-involved"
            >
              Get Involved
            </Button>
            <Button
              variant="secondary"
              className="gap-2"
              to="/how-it-works"
            >
              How it works
            </Button>
          </div>
          <SectionContinueCue />
        </div>
      </section>

      {/* ================================================================
          THE PATH FORWARD
          ================================================================ */}
      <section
        id="path-forward"
        className="relative py-16 md:py-24 border-t border-cyber-border overflow-hidden"
      >
        <div
          className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgb(var(--tf-semantic-achievement)/0.05)_0%,transparent_45%)]"
          aria-hidden="true"
        />

        <div className="container-custom relative z-10 max-w-6xl">
          <div className="mb-10 md:mb-14 max-w-3xl">
            <h2 className={sectionTitleClass}>The Path Forward</h2>
            <p className="text-text-secondary mt-4 text-sm sm:text-base leading-relaxed">
              Together Forge is taking a different road from most large
              studios: one built on real challenge, steady growth, and the
              ambition to become a leading force in games through community
              power instead of investors or agendas.
            </p>
          </div>

          <div className="space-y-16 md:space-y-24">
            {PATH_FORWARD.map((stage, index) => {
              const imageSrc = phaseImageSrc(stage.phase);
              const imageFirst = index % 2 === 0;
              return (
                <article
                  key={stage.id}
                  id={stage.id}
                  className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center"
                >
                  <div
                    className={`lg:col-span-5 ${
                      imageFirst ? 'lg:order-1' : 'lg:order-2'
                    }`}
                  >
                    <div className="relative rounded-xl overflow-hidden border border-cyber-border aspect-[16/10] bg-cyber-surface">
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={phaseImageAlt(stage.phase, stage.title)}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : null}
                      <div className="absolute top-3 left-3 z-10">
                        <Badge variant="neon">{stage.phase}</Badge>
                      </div>
                    </div>
                  </div>
                  <div
                    className={`lg:col-span-7 min-w-0 ${
                      imageFirst ? 'lg:order-2' : 'lg:order-1'
                    }`}
                  >
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white mb-4">
                      {stage.title}
                    </h3>
                    <div className="space-y-3 text-sm sm:text-base leading-relaxed">
                      {stage.paragraphs.map((p, i) => (
                        <p
                          key={`${stage.id}-${i}`}
                          className={
                            i === 0
                              ? 'text-white font-medium'
                              : 'text-text-secondary'
                          }
                        >
                          {p}
                        </p>
                      ))}
                    </div>
                    <Link
                      to={stage.href}
                      className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold text-neon-cyan hover:underline"
                    >
                      {stage.linkLabel}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
          <SectionContinueCue />
        </div>
      </section>

      {/* ================================================================
          HOW IT WORKS
          ================================================================ */}
      <section
        id="how-it-works"
        className="home-section-quiet py-16 md:py-24 border-t border-cyber-border/40"
      >
        <div className="container-custom max-w-6xl">
          <div className="mb-8 md:mb-10 max-w-3xl">
            <h2 className={sectionTitleClass}>
              From idea to game, with the community
            </h2>
            <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
              Together Forge is a community-first studio. Here is how work
              actually moves:
            </p>
          </div>
          <ol className="home-how-steps grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 md:gap-4 list-none p-0 m-0">
            {HOW_IT_WORKS_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="min-w-0">
                  <Card
                    variant="subtle"
                    className="home-how-step h-full p-5"
                  >
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <span className="font-mono text-xs tracking-[0.2em] text-neon-cyan">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="shrink-0 w-8 h-8 rounded-md border border-cyber-border bg-cyber-surface flex items-center justify-center text-neon-cyan">
                        <Icon className="w-4 h-4" aria-hidden />
                      </span>
                    </div>
                    <p className="text-sm sm:text-[15px] text-white font-medium leading-snug">
                      {step.title}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ol>
          <div className="mt-8">
            <Button
              className="gap-2"
              to="/how-it-works"
            >
              Full How It Works <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
          <SectionContinueCue />
        </div>
      </section>

      {/* ================================================================
          TRUST & TRANSPARENCY
          ================================================================ */}
      <section
        id="trust"
        className="home-section-quiet py-16 md:py-24 border-t border-cyber-border/40"
      >
        <div className="container-custom max-w-6xl">
          <Card
            variant="panel"
            className="home-trust-panel p-8 sm:p-10 md:p-12"
          >
            <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
              <div className="lg:col-span-6 min-w-0 flex flex-col justify-center">
                <h2 className={sectionTitleClass}>Trust &amp; transparency</h2>
                <p className="text-white text-base sm:text-lg font-medium leading-relaxed mb-3">
                  Open by design.
                </p>
                <p className="text-text-secondary text-base sm:text-lg leading-relaxed mb-6">
                  Public finances, decision logs, credits, and founder
                  compensation rules are all visible on this site. We would
                  rather show real numbers than publish polished marketing that
                  hides the truth.
                </p>
                <Link
                  to="/transparency"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-neon-cyan hover:underline"
                >
                  Transparency Hub
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <ul className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3 list-none p-0 m-0">
                {TRUST_VISIBLE.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li
                      key={item.label}
                      className="flex items-center gap-3 rounded-lg border border-cyber-border/80 bg-cyber-surface/60 px-4 py-5 min-h-[5.5rem]"
                    >
                      <span className="shrink-0 w-9 h-9 rounded-md border border-cyber-border bg-cyber-bg/70 flex items-center justify-center text-neon-cyan">
                        <Icon className="w-4 h-4" aria-hidden />
                      </span>
                      <span className="text-sm font-medium text-white leading-snug">
                        {item.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Card>
        </div>
      </section>

      {/* ================================================================
          GET INVOLVED
          ================================================================ */}
      <section
        id="join"
        className="relative py-16 md:py-24 border-t border-cyber-border"
      >
        <div className="container-custom max-w-6xl">
          <div className="mb-8 md:mb-10 max-w-3xl">
            <h2 className={sectionTitleClass}>Get Involved</h2>
            <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
              Every skill has a way in. Here’s where most people start:
            </p>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3 md:gap-4 list-none p-0 m-0">
            {INVOLVE_PATHS.map((path, i) => {
              const Icon = path.icon;
              return (
                <li
                  key={path.title}
                  className={`min-w-0 ${
                    i >= 3 ? 'xl:col-span-3' : 'xl:col-span-2'
                  }`}
                >
                  <Card
                    variant="subtle"
                    className="home-value-card h-full p-5 sm:p-6"
                  >
                    <span className="shrink-0 w-10 h-10 rounded-lg border border-cyber-border bg-cyber-surface flex items-center justify-center text-neon-cyan mb-4">
                      <Icon className="w-5 h-5" aria-hidden />
                    </span>
                    <h3 className="text-base sm:text-lg font-semibold text-white tracking-tight">
                      {path.title}
                    </h3>
                    <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-text-secondary">
                      {path.body}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
          <div className="mt-8">
            <Button
              className="gap-2"
              to="/get-involved"
            >
              Get Involved <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
          <SectionContinueCue />
        </div>
      </section>

      {/* ================================================================
          COMMUNITY PULSE
          ================================================================ */}
      <section
        id="community"
        className="home-section-quiet py-16 md:py-24 border-t border-cyber-border"
      >
        <div className="container-custom max-w-6xl">
          <div className="mb-10 md:mb-14">
            <h2 className={sectionTitleClass}>Community Pulse</h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-12 md:mb-16">
            {STAT_META.map((stat) => (
              <Card
                key={stat.key}
                variant="subtle"
                data-accent={stat.accent}
                className={`home-pulse-stat h-full text-center px-4 py-7 sm:px-6 sm:py-8 ${
                  statsLoading ? 'opacity-80' : ''
                }`}
              >
                <div className="home-pulse-icon mx-auto mb-5" aria-hidden="true">
                  <img
                    src={stat.iconSrc}
                    alt=""
                    width={96}
                    height={96}
                    className="home-pulse-icon-img"
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden';
                    }}
                  />
                </div>
                <div className="home-pulse-value font-mono font-bold tracking-tight mb-2">
                  {statsLoading
                    ? '…'
                    : formatPulseValue(communityStats[stat.key] ?? 0)}
                </div>
                <div className="home-pulse-label font-mono uppercase">
                  {stat.label}
                </div>
              </Card>
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
                {!activityLoading && recentActivity.length > 0 ? (
                  <Badge variant="default">Live</Badge>
                ) : null}
              </div>
              {activityLoading ? (
                <p className="text-sm text-text-muted py-4">Loading activity…</p>
              ) : recentActivity.length === 0 ? (
                <p className="text-sm text-text-muted py-4">
                  No public activity yet. Submitted ideas and claimed tasks will
                  show up here.
                </p>
              ) : (
                recentActivity.map((activity) => (
                  <ActivityItem
                    key={activity.id || `${activity.user}-${activity.createdAt}`}
                    activity={activity}
                  />
                ))
              )}
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
              <div className="flex flex-col gap-2">
                <Button
                  className="w-full gap-2 home-hero-cta-primary"
                  to="/get-involved"
                >
                  Join the work <ArrowRight className="w-4 h-4" />
                </Button>
                <DiscordLink
                  variant="button"
                  labelKey="join"
                  className="w-full"
                />
              </div>
            </Card>
          </div>
          <SectionContinueCue />
        </div>
      </section>

      {/* ================================================================
          CLOSING - sparse hearth
          ================================================================ */}
      <section
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
              to="/ideas/submit"
            >
              Submit an Idea <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="w-full sm:w-auto gap-2"
              to="/get-involved"
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
