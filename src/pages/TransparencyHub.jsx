/**
 * Transparency Hub: legal/governance, financial summaries & reinvestment
 * reports, roadmaps, volunteer credits, decision logs, State of the Forge,
 * Founders Thoughts.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Scale,
  Wallet,
  Map,
  Users,
  ScrollText,
  Radio,
  MessageSquareQuote,
  Shield,
  Heart,
  CheckCircle2,
  Hammer,
  Layers,
  Sparkles,
  FileText,
  RefreshCw,
} from 'lucide-react';

import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import UserAvatar from '../components/ui/UserAvatar';
import FinanceDashboard from '../components/transparency/FinanceDashboard';
import {
  getPublicSupportSummary,
  getPublicRecentDonations,
} from '../services/donationsService';

const TRANSPARENCY_BANNER_SRC = '/images/Transparency_Page.webp';

const SECTIONS = [
  { id: 'governance', label: 'Governance' },
  { id: 'financials', label: 'Financials' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'credits', label: 'Credits' },
  { id: 'decisions', label: 'Decisions' },
  { id: 'state', label: 'State of the Forge' },
  { id: 'founders', label: 'Founders' },
];

/** Period reinvestment reports - expand as published. */
const REINVESTMENT_REPORTS = [
  {
    id: 'r1',
    period: 'July 2026',
    status: 'Open',
    headline: 'First public reinvestment period',
    summary:
      'As studio support grows, this report will show what was put into projects, tools, and community systems versus held in reserve.',
    items: [
      { label: 'Reinvested into development', value: '$0' },
      { label: 'Operations and hosting', value: '$0' },
      { label: 'Reserve', value: '$0' },
    ],
  },
  {
    id: 'r2',
    period: 'Prior periods',
    status: 'Coming soon',
    headline: 'Historical reports',
    summary:
      'Earlier months will appear here so anyone can review the pattern over time. Prior totals stay public once published.',
    items: [
      { label: 'Reports published', value: '0' },
      { label: 'Open questions', value: '0' },
    ],
  },
];

const ROADMAP = [
  {
    id: 'prototype-systems',
    title: 'Tether',
    phase: 'Early',
    status: 'In Development',
    open: true,
    progress: 42,
    progressLabel: 'Progress',
    href: '/projects/prototype-systems',
    ctaLabel: 'Open workspace',
    summary:
      'Active Early project: a tethered crew crosses dangerous semi-procedural levels to recover an antimatter generator for a stranded colony. Open volunteer tasks on the board.',
  },
  {
    id: 'core-features',
    title: 'Mid Game Ambitions',
    phase: 'Mid',
    status: 'Planning',
    open: false,
    progress: null,
    progressLabel: 'Planned estimate',
    href: '/projects/mid',
    ctaLabel: 'View plans',
    summary:
      'Next up after Early is completed: cooperative games at the scale of Halo, Horizon Zero Dawn, and Skyrim, with deeper systems, dynamic worlds, and stronger teamwork. Not open for claims yet.',
  },
  {
    id: 'polish-playtests',
    title: 'Stability and Polish',
    phase: 'Late',
    status: 'Vision',
    open: false,
    progress: null,
    progressLabel: 'Planned estimate',
    href: '/projects/late',
    ctaLabel: 'View plans',
    summary:
      'Opens only after Mid is completed: playtests, polish, and hardening. Not open for claims yet.',
  },
];

const DECISION_LOGS = [
  {
    id: 'd1',
    date: '2026-07-15',
    title: 'Studio support builds projects, not founder pay',
    tag: 'Governance',
    summary:
      'Together Forge project support funds development and operations only. Founder living wage comes from profits once the studio can pay all employees a family-supporting wage, or from a separate personal runway path that is not project funds.',
  },
  {
    id: 'd2',
    date: '2026-07-15',
    title: 'Public workspaces over private silos',
    tag: 'Process',
    summary:
      'Every active project gets a public workspace with kanban, updates, and shoutouts so progress does not require insider access.',
  },
  {
    id: 'd3',
    date: '2026-07-15',
    title: 'Support is not a charitable donation',
    tag: 'Legal',
    summary:
      'Together Forge is a community-supported for-profit studio. Contributions are not tax-deductible. That is stated clearly on Support and here.',
  },
  {
    id: 'd4',
    date: '2026-07-15',
    title: 'Five active task claims per volunteer',
    tag: 'Community',
    summary:
      'A cap of five active claims keeps boards fair. Completing or releasing a task frees a slot.',
  },
];

const STATE_UPDATES = [
  {
    id: 's1',
    date: '2026-07-15',
    title: 'July: Transparency Hub, Founders Thoughts, and Support paths',
    highlight: true,
    body: 'Public governance, financial summaries, project roadmaps, and Founders Thoughts are live. Studio donations and personal runway support stay clearly separated so money trails stay clear.',
    links: [
      { label: 'Founders Thoughts', to: '/founders-thoughts' },
      { label: 'Donate', to: '/donate' },
      { label: 'Projects', to: '/projects' },
    ],
  },
  {
    id: 's2',
    date: '2026-06-01',
    title: 'June: Workspaces and claim flows',
    highlight: false,
    body: 'Tether board opened. Claim and credit flows moved from concept to site features so effort can be tracked publicly.',
    links: [
      { label: 'Get involved', to: '/get-involved' },
      { label: 'How it works', to: '/how-it-works' },
    ],
  },
];

const FOUNDERS_THOUGHTS = [
  {
    id: 'why-i-created-together-forge',
    date: '2026-07-15',
    theme: 'Origin',
    title: 'Why I Created Together Forge',
    excerpt:
      'Game companies have failed us. It is time for players to stand up and make real games that put gamers first.',
    href: '/founders-thoughts#why-i-created-together-forge',
  },
  {
    id: 'founder-compensation',
    date: '2026-07-15',
    theme: 'Compensation',
    title: 'Founder Compensation',
    excerpt:
      'No living expenses from company donations. Living wage only when the studio can pay all employees a family-supporting wage.',
    href: '/founders-thoughts#founder-compensation',
  },
  {
    id: 'why-transparency-matters',
    date: '2026-07-15',
    theme: 'Transparency',
    title: 'Why Transparency Matters',
    excerpt:
      'If money ever flows to the wrong places, the community should see it. Open systems make that possible.',
    href: '/founders-thoughts#why-transparency-matters',
  },
];

const CONTRIBUTOR_TEASERS = [
  { name: 'Alex R.', role: 'Prototype code', initials: 'AR' },
  { name: 'Jordan K.', role: 'Systems design', initials: 'JK' },
  { name: 'Sam V.', role: 'Community ops', initials: 'SV' },
  { name: 'Riley M.', role: 'UI polish', initials: 'RM' },
  { name: 'Casey L.', role: 'Playtest lead', initials: 'CL' },
  { name: 'Morgan T.', role: 'Ideas and feedback', initials: 'MT' },
];

const GOVERNANCE_CARDS = [
  {
    icon: Scale,
    accent: 'text-neon-cyan',
    title: 'Entity and status',
    subtitle: 'For-profit studio',
    body: 'Together Forge is a community-supported independent game studio. Support is business revenue, not a charitable donation. Contributions are not tax-deductible.',
  },
  {
    icon: Shield,
    accent: 'text-neon-purple',
    title: 'Founder compensation',
    subtitle: 'Profits or personal runway only',
    body: 'Studio Support funds projects and operations, not founder living expenses. A living wage from the company starts only when revenue can pay all employees a family-supporting wage. A separate personal runway option exists outside project funds.',
    links: [
      { to: '/founders-thoughts#founder-compensation', label: 'Founders Thoughts' },
      { to: '/support-runway', label: 'Runway Support' },
    ],
  },
  {
    icon: FileText,
    accent: 'text-neon-magenta',
    title: 'Public reporting',
    subtitle: 'This hub',
    body: 'Financial summaries, reinvestment reports, decision logs, roadmaps, and State of the Forge updates live here. Individual donors stay private unless they opt into public credit.',
  },
  {
    icon: Users,
    accent: 'text-neon-green',
    title: 'Community voice',
    subtitle: 'Ideas and boards',
    body: 'Direction is shaped by public ideas, votes, and open task boards. Major process choices are recorded in lightweight decision logs.',
    links: [
      { to: '/about', label: 'About' },
      { to: '/faq', label: 'FAQ' },
    ],
  },
];

const phaseBadgeVariant = (phase) => {
  if (phase === 'Mid') return 'purple';
  if (phase === 'Late') return 'default';
  return 'neon';
};

const formatDate = (iso, opts = { year: 'numeric', month: 'short', day: 'numeric' }) => {
  if (!iso) return '';
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, opts);
};

const TransparencyHub = () => {
  const navigate = useNavigate();
  const [supportSummary, setSupportSummary] = useState({
    studioTotalCents: 0,
    studioPaymentCount: 0,
    studioMrrCents: 0,
    runwayTotalCents: 0,
    runwayPaymentCount: 0,
    source: 'empty',
    lastPaymentAt: null,
  });
  const [recentSupport, setRecentSupport] = useState([]);
  const [financeLoading, setFinanceLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setFinanceLoading(true);
      try {
        const [summary, recent] = await Promise.all([
          getPublicSupportSummary(),
          getPublicRecentDonations(24),
        ]);
        if (!mounted) return;
        setSupportSummary(
          summary && typeof summary === 'object'
            ? summary
            : {
                studioTotalCents: 0,
                studioPaymentCount: 0,
                source: 'empty',
              }
        );
        setRecentSupport(Array.isArray(recent?.items) ? recent.items : []);
      } catch (err) {
        console.warn('[TransparencyHub] finance load failed', err);
        if (mounted) {
          setSupportSummary({
            studioTotalCents: 0,
            studioPaymentCount: 0,
            source: 'empty',
          });
          setRecentSupport([]);
        }
      } finally {
        if (mounted) setFinanceLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.05)_0%,transparent_55%)]"
        aria-hidden="true"
      />

      {/* Page header banner */}
      <header className="relative pt-20 overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <img
            src={TRANSPARENCY_BANNER_SRC}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-[center_40%] sm:object-center"
            decoding="async"
            fetchPriority="high"
          />
          {/* Readability: base dim + left-weighted panel + top shade */}
          <div className="absolute inset-0 bg-cyber-bg/55" />
          <div className="absolute inset-0 bg-gradient-to-r from-cyber-bg/96 via-cyber-bg/85 to-cyber-bg/35" />
          <div className="absolute inset-0 bg-gradient-to-b from-cyber-bg/70 via-cyber-bg/25 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgb(var(--tf-neon-cyan)/0.08)_0%,transparent_50%)]" />
        </div>
        {/* Soft fade into page background (matches home hero) */}
        <div
          className="absolute bottom-0 inset-x-0 h-28 sm:h-32 pointer-events-none z-[5] bg-gradient-to-b from-transparent via-cyber-bg/50 to-cyber-bg"
          aria-hidden="true"
        />

        <div className="container-custom relative z-10 py-10 sm:py-12 md:py-14 min-h-[16rem] sm:min-h-[18rem] md:min-h-[20rem] flex flex-col justify-center">
          <div className="max-w-3xl [text-shadow:0_1px_2px_rgb(0_0_0_/_0.9),0_2px_16px_rgb(0_0_0_/_0.55)]">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="section-header mb-0">Transparency Hub</div>
              <Badge variant="neon">Open by design</Badge>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Trust you can verify
            </h1>
            <p className="text-lg sm:text-xl text-white/85 leading-relaxed">
              Legal structure, public finances, roadmaps, credits, decisions, and
              founder notes. Incomplete ledgers beat marketing copy that hides the
              truth.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
              <Button
                size="lg"
                className="gap-2 w-full sm:w-auto"
                onClick={() => scrollTo('financials')}
              >
                <Wallet className="w-4 h-4" />
                Financials
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="gap-2 w-full sm:w-auto"
                onClick={() => navigate('/founders-thoughts')}
              >
                <MessageSquareQuote className="w-4 h-4" />
                Founders Thoughts
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 w-full sm:w-auto"
                onClick={() => navigate('/projects')}
              >
                <Layers className="w-4 h-4" />
                Projects
              </Button>
            </div>
          </div>

          <nav
            aria-label="Transparency sections"
            className="mt-10 flex flex-wrap gap-2"
          >
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollTo(s.id)}
                className="px-3 py-1.5 rounded-full text-xs font-mono tracking-widest uppercase border border-cyber-border text-text-muted hover:border-neon-cyan/50 hover:text-neon-cyan transition-colors bg-cyber-card/50 backdrop-blur-sm"
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="container-custom relative z-10 py-12 md:py-16 space-y-16 md:space-y-20">
        {/* Legal & governance */}
        <section id="governance" aria-labelledby="governance-heading" className="scroll-mt-24">
          <div className="max-w-2xl mb-8">
            <div className="section-header">Legal and governance</div>
            <h2
              id="governance-heading"
              className="text-2xl sm:text-3xl font-bold text-white"
            >
              How the studio is structured
            </h2>
            <p className="text-text-secondary mt-2 text-sm sm:text-base">
              Public rules so nobody has to guess who we are or how money is treated.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 md:gap-5">
            {GOVERNANCE_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="bg-cyber-card/80 h-full flex flex-col">
                  <div className="flex items-start gap-3 mb-4">
                    <div
                      className={`w-11 h-11 rounded-xl bg-cyber-surface border border-cyber-border flex items-center justify-center shrink-0 ${card.accent}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                      <p className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
                        {card.subtitle}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed flex-1">
                    {card.body}
                  </p>
                  {card.links?.length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-4">
                      {card.links.map((l) => (
                        <Link
                          key={l.to}
                          to={l.to}
                          className="text-xs font-mono tracking-widest text-neon-cyan hover:underline inline-flex items-center gap-1"
                        >
                          {l.label}
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>

        {/* Financial cyber dashboard */}
        <section id="financials" aria-labelledby="financials-heading" className="scroll-mt-24">
          <div className="mb-4 flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={() => navigate('/donate')}
            >
              <Heart className="w-3.5 h-3.5" />
              Support
            </Button>
          </div>

          <div className="mb-8 max-w-2xl">
            <div className="section-header" id="financials-heading">
              Financial dashboard
            </div>
            <p className="text-text-secondary mt-2 text-sm sm:text-base">
              What is available right now, what is reserved for taxes and
              obligations, and how support has been received and used over
              time. Personal runway stays separate on{' '}
              <Link to="/support-runway" className="text-neon-cyan hover:underline">
                Runway Support
              </Link>
              .
            </p>
          </div>

          <FinanceDashboard
            summary={supportSummary}
            recentItems={recentSupport}
            loading={financeLoading}
          />

          {/* Period reinvestment reports */}
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-neon-cyan" />
              <h3 className="text-lg font-semibold text-white">
                Reinvestment reports
              </h3>
              <Badge variant="default">Public</Badge>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {REINVESTMENT_REPORTS.map((report) => (
                <Card key={report.id} className="bg-cyber-card/80">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs font-sans tracking-widest text-text-muted uppercase">
                      {report.period}
                    </span>
                    <Badge variant="default">{report.status}</Badge>
                  </div>
                  <h4 className="text-base font-semibold text-white mb-2">
                    {report.headline}
                  </h4>
                  <p className="text-sm text-text-secondary leading-relaxed mb-4">
                    {report.summary}
                  </p>
                  <ul className="divide-y divide-cyber-border">
                    {report.items.map((item) => (
                      <li
                        key={item.label}
                        className="flex justify-between gap-3 py-2 text-sm"
                      >
                        <span className="text-text-muted">{item.label}</span>
                        <span className="font-sans font-semibold tabular-nums text-neon-cyan">
                          {item.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Project roadmaps */}
        <section id="roadmap" aria-labelledby="roadmap-heading" className="scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div className="max-w-2xl">
              <div className="section-header" id="roadmap-heading">
                Project roadmaps
              </div>
              <p className="text-text-secondary mt-2 text-sm sm:text-base">
                Early is the active focus with a live workspace. Mid and Late are
                planned next steps - plans only, not open claim boards yet.
              </p>
            </div>
            <Button
              variant="secondary"
              className="gap-2 self-start sm:self-auto shrink-0"
              onClick={() => navigate('/projects')}
            >
              <Map className="w-4 h-4" />
              Full directory
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-5">
            {ROADMAP.map((project) => {
              const isOpen = Boolean(project.open);
              return (
                <Link
                  key={project.id}
                  to={project.href}
                  className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg h-full"
                >
                  <Card
                    interactive
                    variant={isOpen ? 'panel' : 'subtle'}
                    className={`h-full flex flex-col ${
                      isOpen
                        ? 'border-neon-cyan/30'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={phaseBadgeVariant(project.phase)}>
                          {project.phase}
                        </Badge>
                        {!isOpen && (
                          <Badge variant="default">Coming Soon</Badge>
                        )}
                      </div>
                      <span className="text-xs font-sans tracking-widest text-text-muted uppercase shrink-0">
                        {project.status}
                      </span>
                    </div>
                    <h3
                      className={`text-lg font-bold mb-2 transition-colors ${
                        isOpen
                          ? 'text-white group-hover:text-neon-cyan'
                          : 'text-white group-hover:text-neon-purple'
                      }`}
                    >
                      {project.title}
                    </h3>
                    <p className="text-sm text-text-secondary leading-relaxed mb-4 flex-1">
                      {project.summary}
                    </p>

                    {isOpen && typeof project.progress === 'number' ? (
                      <div className="mb-4">
                        <div className="flex justify-between text-xs font-sans text-text-muted mb-1 tracking-wide">
                          <span>{project.progressLabel || 'Progress'}</span>
                          <span className="text-neon-cyan tabular-nums">
                            {project.progress}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-cyber-surface border border-cyber-border overflow-hidden tf-hud-bar-track">
                          <div
                            className="h-full bg-neon-cyan/80"
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 text-xs font-sans tracking-wide text-text-muted">
                        <span className="text-neon-purple/90">Planned phase</span>
                        <span>
                          {project.phase === 'Late'
                            ? ' · after Mid is completed'
                            : ' · after Early is completed'}
                        </span>
                      </div>
                    )}

                    <span
                      className={`inline-flex items-center gap-1 text-xs font-sans font-semibold tracking-widest mt-auto ${
                        isOpen ? 'text-neon-cyan' : 'text-text-muted'
                      }`}
                    >
                      {project.ctaLabel}
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                    </span>
                  </Card>
                </Link>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link
              to="/projects/early"
              className="text-neon-cyan hover:underline font-mono text-xs tracking-widest"
            >
              Early phase
            </Link>
            <span className="text-text-muted">·</span>
            <Link
              to="/projects/mid"
              className="text-neon-cyan hover:underline font-mono text-xs tracking-widest"
            >
              Mid phase
            </Link>
            <span className="text-text-muted">·</span>
            <Link
              to="/projects/late"
              className="text-neon-cyan hover:underline font-mono text-xs tracking-widest"
            >
              Late phase
            </Link>
          </div>
        </section>

        {/* Volunteer credits */}
        <section id="credits" aria-labelledby="credits-heading" className="scroll-mt-24">
          <Card className="bg-cyber-card/80 border-neon-purple/30 overflow-hidden relative">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(192,132,252,0.08)_0%,transparent_55%)]"
              aria-hidden="true"
            />
            <div className="relative grid md:grid-cols-5 gap-8 items-center">
              <div className="md:col-span-3">
                <div className="section-header mb-2">Volunteer credits</div>
                <h2
                  id="credits-heading"
                  className="text-2xl sm:text-3xl font-bold text-white mb-3"
                >
                  Contributor gallery
                </h2>
                <p className="text-text-secondary text-sm sm:text-base leading-relaxed mb-4">
                  People who ship work deserve public credit. This gallery grows
                  from task completions, shoutouts, and opt-in supporter names.
                </p>
                <ul className="space-y-2 text-sm text-text-muted mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-neon-cyan shrink-0" />
                    Task claim and completion credit
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-neon-cyan shrink-0" />
                    Workspace shoutouts for major wins
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-neon-cyan shrink-0" />
                    Opt-in names from Support tiers
                  </li>
                </ul>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="secondary"
                    className="gap-2"
                    onClick={() => navigate('/get-involved')}
                  >
                    <Hammer className="w-4 h-4" />
                    Get involved
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

              <div className="md:col-span-2">
                <div className="grid grid-cols-3 gap-3">
                  {CONTRIBUTOR_TEASERS.map((c) => (
                    <div
                      key={c.name}
                      className="rounded-xl border border-cyber-border bg-cyber-surface/80 p-3 text-center"
                    >
                      <UserAvatar
                        name={c.name}
                        initials={c.initials}
                        size="lg"
                        className="mx-auto mb-2"
                      />
                      <div className="text-xs font-medium text-white truncate">
                        {c.name}
                      </div>
                      <div className="text-[10px] font-mono text-text-muted truncate">
                        {c.role}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-center text-[10px] font-mono tracking-widest uppercase text-text-muted">
                  Teaser layout · live gallery soon
                </p>
              </div>
            </div>
          </Card>
        </section>

        {/* Decision logs */}
        <section id="decisions" aria-labelledby="decisions-heading" className="scroll-mt-24">
          <div className="max-w-2xl mb-8">
            <div className="section-header">Decision logs</div>
            <h2
              id="decisions-heading"
              className="text-2xl sm:text-3xl font-bold text-white"
            >
              Why we chose this path
            </h2>
            <p className="text-text-secondary mt-2 text-sm sm:text-base">
              Lightweight public notes on process and policy. Not legal filings.
            </p>
          </div>

          <div className="space-y-3">
            {DECISION_LOGS.map((entry) => (
              <Card key={entry.id} className="bg-cyber-card/80">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-cyber-surface border border-cyber-border flex items-center justify-center text-neon-cyan shrink-0 mt-0.5">
                    <ScrollText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-white">
                      {entry.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="default">{entry.tag}</Badge>
                      <time
                        dateTime={entry.date}
                        className="text-xs font-mono text-text-muted"
                      >
                        {formatDate(entry.date)}
                      </time>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed sm:pl-12">
                  {entry.summary}
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* State of the Forge */}
        <section id="state" aria-labelledby="state-heading" className="scroll-mt-24">
          <div className="max-w-2xl mb-8">
            <div className="section-header">State of the Forge</div>
            <h2
              id="state-heading"
              className="text-2xl sm:text-3xl font-bold text-white"
            >
              Regular public updates
            </h2>
            <p className="text-text-secondary mt-2 text-sm sm:text-base">
              What shipped, what is open, and where energy is going. Newest first.
            </p>
          </div>

          <div className="space-y-4">
            {STATE_UPDATES.map((update) => (
              <Card
                key={update.id}
                className={`bg-cyber-card/80 ${
                  update.highlight ? 'border-neon-cyan/30' : ''
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Radio
                    className={`w-4 h-4 ${
                      update.highlight ? 'text-neon-cyan' : 'text-text-muted'
                    }`}
                  />
                  <time
                    dateTime={update.date}
                    className="text-xs font-mono tracking-widest text-text-muted uppercase"
                  >
                    {formatDate(update.date, { year: 'numeric', month: 'long' })}
                  </time>
                  {update.highlight && <Badge variant="neon">Latest</Badge>}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{update.title}</h3>
                <p className="text-sm sm:text-base text-text-secondary leading-relaxed mb-4">
                  {update.body}
                </p>
                {update.links?.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {update.links.map((link) => (
                      <Link
                        key={link.to}
                        to={link.to}
                        className="inline-flex items-center gap-1 text-xs font-mono tracking-widest text-neon-cyan hover:underline"
                      >
                        {link.label}
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>

        {/* Founders Thoughts */}
        <section id="founders" aria-labelledby="founders-heading" className="scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div className="max-w-2xl">
              <div className="section-header">Founders Thoughts</div>
              <h2
                id="founders-heading"
                className="text-2xl sm:text-3xl font-bold text-white"
              >
                Notes from building the forge
              </h2>
              <p className="text-text-secondary mt-2 text-sm sm:text-base">
                Origin story, compensation rules, transparency philosophy, and
                long-term vision. Full essays on a dedicated page.
              </p>
            </div>
            <Button
              variant="secondary"
              className="gap-2 self-start sm:self-auto shrink-0"
              onClick={() => navigate('/founders-thoughts')}
            >
              <MessageSquareQuote className="w-4 h-4" />
              Open Founders Thoughts
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-5">
            {FOUNDERS_THOUGHTS.map((note) => (
              <Link
                key={note.id}
                to={note.href}
                className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg rounded-xl"
              >
                <Card className="bg-cyber-card/80 h-full flex flex-col border-cyber-border group-hover:border-neon-purple/50 transition-all">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <MessageSquareQuote className="w-4 h-4 text-neon-purple" />
                    <Badge variant="default">{note.theme}</Badge>
                    <time
                      dateTime={note.date}
                      className="text-xs font-mono tracking-widest text-text-muted uppercase"
                    >
                      {formatDate(note.date)}
                    </time>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3 group-hover:text-neon-purple transition-colors">
                    {note.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed flex-1 mb-4">
                    {note.excerpt}
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs font-mono tracking-widest text-neon-cyan">
                    Read essay
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="pt-4 border-t border-cyber-border">
          <Card className="bg-cyber-card/80 text-center py-10 px-6">
            <Sparkles className="w-8 h-8 text-neon-cyan mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Help keep the forge open
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto mb-8 text-sm sm:text-base">
              Ship a task, share an idea, or support the studio. Progress should
              never depend on insider access.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center">
              <Button
                size="lg"
                className="gap-2"
                onClick={() => navigate('/get-involved')}
              >
                Get involved
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="gap-2"
                onClick={() => navigate('/donate')}
              >
                <Heart className="w-4 h-4" />
                Donate
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2"
                onClick={() => navigate('/founders-thoughts')}
              >
                Founders Thoughts
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default TransparencyHub;
