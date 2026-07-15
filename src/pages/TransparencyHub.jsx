/**
 * Transparency Hub: legal/governance, financial summaries, roadmaps,
 * volunteer credits teaser, decision logs, State of the Forge, Founders Thoughts.
 * Designed to feel trustworthy and active with clear links into the rest of the site.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
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
  ExternalLink,
  CheckCircle2,
  Hammer,
  Layers,
  Sparkles,
  FileText,
  TrendingUp,
} from 'lucide-react';

import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import UserAvatar from '../components/ui/UserAvatar';

/** Jump links for in-page navigation */
const SECTIONS = [
  { id: 'governance', label: 'Governance' },
  { id: 'financials', label: 'Financials' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'credits', label: 'Credits' },
  { id: 'decisions', label: 'Decisions' },
  { id: 'state', label: 'State of the Forge' },
  { id: 'founders', label: 'Founders' },
];

/** Project roadmap cards (align with Projects directory). */
const ROADMAP = [
  {
    id: 'prototype-systems',
    title: 'Prototype Systems',
    phase: 'Early',
    status: 'In Development',
    progress: 42,
    href: '/projects/prototype-systems',
    summary:
      'Core loop, networking, and claim/credit prototypes. Active board with open volunteer tasks.',
  },
  {
    id: 'core-features',
    title: 'Core Features Sprint',
    phase: 'Mid',
    status: 'Planning',
    progress: 18,
    href: '/projects/core-features',
    summary:
      'Cooperative systems design and early integrations. Planning sprints with public ownership.',
  },
  {
    id: 'polish-playtests',
    title: 'Stability and Polish',
    phase: 'Late',
    status: 'Vision',
    progress: 5,
    href: '/projects/polish-playtests',
    summary:
      'Playtests, polish passes, and hardening for release. Vision stage with early task drafts.',
  },
];

/** Planned usage categories (illustrative until Stripe ledger is live).
 * Support funds projects and operations only. Founder pay is not from donations. */
const USAGE_CATEGORIES = [
  {
    label: 'Project development & tools',
    pct: 40,
    desc: 'Engines, licenses, build pipelines, and software that ship the games.',
  },
  {
    label: 'Assets & creative production',
    pct: 25,
    desc: 'Art, audio, design assets, and other production needs for active projects.',
  },
  {
    label: 'Community infrastructure',
    pct: 20,
    desc: 'Site features, credit systems, moderation tools, and volunteer support systems.',
  },
  {
    label: 'Studio operations & hosting',
    pct: 15,
    desc: 'Hosting, databases, test servers, taxes, and legitimate operating costs.',
  },
];

/** Lightweight public decision log entries */
const DECISION_LOGS = [
  {
    id: 'd1',
    date: '2026-06-20',
    title: 'Support funds projects, not founder pay',
    tag: 'Governance',
    summary:
      'Community support goes toward building projects and running the studio. Founder compensation comes only from future profits once the studio sustains itself, and only at a reasonable level. No bonuses, equity dumps, or investor draws.',
  },
  {
    id: 'd2',
    date: '2026-06-28',
    title: 'Public project workspaces over private silos',
    tag: 'Process',
    summary:
      'Every active project gets a public workspace with kanban, updates, and shoutouts so progress is visible without needing insider access.',
  },
  {
    id: 'd3',
    date: '2026-07-05',
    title: 'Support is not a donation',
    tag: 'Legal',
    summary:
      'Together Forge is a community-supported for-profit studio. Contributions are not tax-deductible. We state this clearly on Support and here.',
  },
  {
    id: 'd4',
    date: '2026-07-10',
    title: 'Five active claims per volunteer',
    tag: 'Community',
    summary:
      'Task claim limit of five active items keeps boards fair and unfinished work from stacking. Completing or releasing a task frees a slot.',
  },
];

/** State of the Forge monthly-style updates */
const STATE_UPDATES = [
  {
    id: 's1',
    date: '2026-07-01',
    title: 'July: Workspaces, ideas, and Support go live',
    highlight: true,
    body: 'Project workspaces shipped with kanban, idea voting stabilized, and the Support page is ready for Stripe Payment Links. Transparency Hub is the public home for how we operate and spend.',
    links: [
      { label: 'Browse projects', to: '/projects' },
      { label: 'Support the forge', to: '/support' },
    ],
  },
  {
    id: 's2',
    date: '2026-06-01',
    title: 'June: Foundations and claim flows',
    highlight: false,
    body: 'Prototype Systems board opened for early volunteers. Claim and credit flows moved from concept to working site features so effort can be tracked publicly.',
    links: [
      { label: 'Get involved', to: '/get-involved' },
      { label: 'How it works', to: '/how-it-works' },
    ],
  },
];

/** Teasers linking to full essays at /founders-thoughts */
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
    id: 'long-term-vision',
    date: '2026-07-15',
    theme: 'Vision',
    title: 'Long Term Vision',
    excerpt:
      'Gold-standard game development, systems for indies and learners, and games that force the industry toward transparency.',
    href: '/founders-thoughts#long-term-vision',
  },
];

/** Teaser contributors for gallery (placeholder until live credits) */
const CONTRIBUTOR_TEASERS = [
  { name: 'Alex R.', role: 'Prototype code', initials: 'AR' },
  { name: 'Jordan K.', role: 'Systems design', initials: 'JK' },
  { name: 'Sam V.', role: 'Community ops', initials: 'SV' },
  { name: 'Riley M.', role: 'UI polish', initials: 'RM' },
  { name: 'Casey L.', role: 'Playtest lead', initials: 'CL' },
  { name: 'Morgan T.', role: 'Ideas & feedback', initials: 'MT' },
];

const phaseBadgeVariant = (phase) => {
  if (phase === 'Mid') return 'purple';
  if (phase === 'Late') return 'default';
  return 'neon';
};

const formatMoney = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n || 0);

const TransparencyHub = () => {
  const navigate = useNavigate();
  const [donations, setDonations] = useState([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('tf_donations') || '[]');
      if (Array.isArray(stored)) {
        setDonations(stored);
        setTotal(stored.reduce((acc, d) => acc + (Number(d.amount) || 0), 0));
      }
    } catch {
      setDonations([]);
      setTotal(0);
    }
  }, []);

  const supportCount = donations.length;
  const hasDemoLedger = supportCount > 0;

  const usageRows = useMemo(() => USAGE_CATEGORIES, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="section-header mb-0">Transparency Hub</div>
              <Badge variant="neon">Open by design</Badge>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Trust you can verify
            </h1>
            <p className="text-lg sm:text-xl text-text-secondary leading-relaxed">
              Legal structure, how support is used, project progress, decisions,
              and founder notes. In one public place. We would rather show an
              incomplete ledger than hide behind marketing copy.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
              <Button
                size="lg"
                className="gap-2 w-full sm:w-auto"
                onClick={() => scrollTo('financials')}
              >
                <Wallet className="w-4 h-4" />
                Financial summary
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="gap-2 w-full sm:w-auto"
                onClick={() => navigate('/support')}
              >
                <Heart className="w-4 h-4" />
                Support the forge
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 w-full sm:w-auto"
                onClick={() => navigate('/projects')}
              >
                <Layers className="w-4 h-4" />
                View projects
              </Button>
            </div>
          </div>

          {/* Section jump nav */}
          <nav
            aria-label="Transparency sections"
            className="mt-10 flex flex-wrap gap-2"
          >
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollTo(s.id)}
                className="px-3 py-1.5 rounded-full text-xs font-mono tracking-widest uppercase border border-cyber-border text-text-muted hover:border-neon-cyan/50 hover:text-neon-cyan transition-colors bg-cyber-card/40"
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="container-custom relative z-10 py-12 md:py-16 space-y-16 md:space-y-20">
        {/* ---------- Legal & Governance ---------- */}
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
              Clear rules beat vague promises. Here is what we commit to publicly.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 md:gap-5">
            <Card className="bg-cyber-card/80 h-full">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-cyber-surface border border-cyber-border flex items-center justify-center text-neon-cyan shrink-0">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Entity and status</h3>
                  <p className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
                    For-profit studio
                  </p>
                </div>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                Together Forge operates as a community-supported independent game
                studio. Support and payments are business revenue, not charitable
                donations. Contributions are not tax-deductible.
              </p>
            </Card>

            <Card className="bg-cyber-card/80 h-full">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-cyber-surface border border-cyber-border flex items-center justify-center text-neon-purple shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Founder Compensation</h3>
                  <p className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
                    From profits only
                  </p>
                </div>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                Support and donations fund project development and studio
                operations, not founder pay. The founder takes reasonable
                compensation only from profits once the studio sustains itself.
                No bonuses, investor payouts, or silent equity windfalls.
              </p>
            </Card>

            <Card className="bg-cyber-card/80 h-full">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-cyber-surface border border-cyber-border flex items-center justify-center text-neon-magenta shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Public reporting</h3>
                  <p className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
                    This hub
                  </p>
                </div>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                Aggregate support totals, usage categories, decision logs, and
                monthly State of the Forge notes live here. Individual donor
                privacy is respected; only aggregates and voluntary public credits appear.
              </p>
            </Card>

            <Card className="bg-cyber-card/80 h-full">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-cyber-surface border border-cyber-border flex items-center justify-center text-neon-green shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Community voice</h3>
                  <p className="text-xs font-mono tracking-widest text-text-muted uppercase mt-1">
                    Ideas and boards
                  </p>
                </div>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                Direction is shaped by public ideas, votes, and open task boards.
                Lightweight decision logs explain why major process choices were made.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/about"
                  className="text-xs font-mono tracking-widest text-neon-cyan hover:underline inline-flex items-center gap-1"
                >
                  About the studio <ArrowRight className="w-3 h-3" />
                </Link>
                <Link
                  to="/faq"
                  className="text-xs font-mono tracking-widest text-neon-cyan hover:underline inline-flex items-center gap-1"
                >
                  FAQ <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </Card>
          </div>
        </section>

        {/* ---------- Financial Summary ---------- */}
        <section id="financials" aria-labelledby="financials-heading" className="scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div className="max-w-2xl">
              <div className="section-header">Financial summary</div>
              <h2
                id="financials-heading"
                className="text-2xl sm:text-3xl font-bold text-white"
              >
                Aggregate support and usage
              </h2>
              <p className="text-text-secondary mt-2 text-sm sm:text-base">
                High-level totals only. When Stripe is live, monthly aggregates
                will replace demo ledger entries automatically.
              </p>
            </div>
            <Button
              variant="secondary"
              className="gap-2 self-start sm:self-auto shrink-0"
              onClick={() => navigate('/support')}
            >
              <Heart className="w-4 h-4" />
              Contribute
            </Button>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 md:gap-5 mb-6">
            <Card className="bg-cyber-card/80 lg:col-span-1 border-neon-cyan/20">
              <div className="flex items-center gap-2 text-text-muted mb-3">
                <Wallet className="w-4 h-4 text-neon-cyan" />
                <span className="text-xs font-mono tracking-widest uppercase">
                  Recorded support
                </span>
              </div>
              <div className="text-4xl sm:text-5xl font-mono font-bold text-neon-cyan mb-1">
                {formatMoney(total)}
              </div>
              <p className="text-sm text-text-muted mb-4">
                {hasDemoLedger
                  ? `${supportCount} local demo entr${supportCount === 1 ? 'y' : 'ies'}`
                  : 'No ledger entries yet. Baseline is $0.'}
              </p>
              <Badge variant="default">
                {hasDemoLedger ? 'Demo ledger' : 'Awaiting first support'}
              </Badge>
            </Card>

            <Card className="bg-cyber-card/80 lg:col-span-2">
              <div className="flex items-center gap-2 text-text-muted mb-4">
                <TrendingUp className="w-4 h-4 text-neon-purple" />
                <span className="text-xs font-mono tracking-widest uppercase">
                  Planned usage split
                </span>
              </div>
              <p className="text-sm text-text-secondary mb-5">
                Target allocation for support funds. Project development, tools,
                assets, community infrastructure, and operations. Founder pay is
                not part of this split. Actual percentages will be published after
                each reporting period once volume is meaningful.
              </p>
              <ul className="space-y-4">
                {usageRows.map((row) => (
                  <li key={row.label}>
                    <div className="flex justify-between gap-3 text-sm mb-1.5">
                      <span className="text-white font-medium">{row.label}</span>
                      <span className="font-mono text-neon-cyan shrink-0">{row.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-cyber-surface border border-cyber-border overflow-hidden mb-1">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-neon-cyan/80 to-neon-purple/80"
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-text-muted">{row.desc}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm text-text-secondary leading-relaxed border-t border-cyber-border pt-4">
                Founder takes reasonable compensation only from profits once the
                studio sustains itself. Your support builds the forge, not a
                founder salary line.
              </p>
            </Card>
          </div>

          <Card className="bg-cyber-card/80">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold text-white">Recent ledger (demo)</h3>
              <p className="text-xs font-mono tracking-widest text-text-muted uppercase">
                Local browser only until Stripe reports
              </p>
            </div>
            {hasDemoLedger ? (
              <ul className="divide-y divide-cyber-border">
                {donations.slice(0, 8).map((d, i) => (
                  <li
                    key={`${d.timestamp || i}-${i}`}
                    className="flex justify-between gap-4 py-3 text-sm"
                  >
                    <span className="text-text-secondary truncate">
                      {d.label || 'Support'}
                    </span>
                    <span className="flex items-center gap-4 shrink-0 font-mono">
                      <span className="text-neon-cyan">{formatMoney(d.amount)}</span>
                      <span className="text-text-muted text-xs">
                        {d.timestamp
                          ? new Date(d.timestamp).toLocaleDateString()
                          : 'n/a'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-cyber-border bg-cyber-surface/50 p-6 text-center">
                <p className="text-sm text-text-secondary mb-4">
                  No support recorded in this browser yet. When people contribute
                  via Support (and reporting is wired), aggregates appear here.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  onClick={() => navigate('/support')}
                >
                  Open Support page
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            <p className="mt-4 text-xs text-text-muted leading-relaxed">
              Disclaimer: Support is not a charitable donation. Funds go toward
              building projects and studio operations. Founder compensation comes
              only from future profits, not from support. See{' '}
              <Link to="/support" className="text-neon-cyan hover:underline">
                Support
              </Link>{' '}
              for tiers and payment flow.
            </p>
          </Card>
        </section>

        {/* ---------- Project Roadmaps ---------- */}
        <section id="roadmap" aria-labelledby="roadmap-heading" className="scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div className="max-w-2xl">
              <div className="section-header">Project roadmaps</div>
              <h2
                id="roadmap-heading"
                className="text-2xl sm:text-3xl font-bold text-white"
              >
                Progress you can open
              </h2>
              <p className="text-text-secondary mt-2 text-sm sm:text-base">
                Each phase links to a live workspace. Progress bars are public
                estimates until task metrics feed this view automatically.
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
            {ROADMAP.map((project) => (
              <Link
                key={project.id}
                to={project.href}
                className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg rounded-xl"
              >
                <Card className="bg-cyber-card/80 h-full border-cyber-border group-hover:border-neon-cyan/50 group-hover:shadow-neon-glow transition-all">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <Badge variant={phaseBadgeVariant(project.phase)}>
                      {project.phase}
                    </Badge>
                    <span className="text-xs font-mono text-text-muted">
                      {project.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-neon-cyan transition-colors mb-2">
                    {project.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed mb-4">
                    {project.summary}
                  </p>
                  <div className="mb-3">
                    <div className="flex justify-between text-xs font-mono text-text-muted mb-1">
                      <span>Progress</span>
                      <span className="text-neon-cyan">{project.progress}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-cyber-surface border border-cyber-border overflow-hidden">
                      <div
                        className="h-full rounded-full bg-neon-cyan/80"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-mono tracking-widest text-neon-cyan">
                    Open workspace
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                  </span>
                </Card>
              </Link>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link
              to="/projects/early"
              className="text-neon-cyan hover:underline font-mono text-xs tracking-widest"
            >
              Early phase list
            </Link>
            <span className="text-text-muted">·</span>
            <Link
              to="/projects/mid"
              className="text-neon-cyan hover:underline font-mono text-xs tracking-widest"
            >
              Mid phase list
            </Link>
            <span className="text-text-muted">·</span>
            <Link
              to="/projects/late"
              className="text-neon-cyan hover:underline font-mono text-xs tracking-widest"
            >
              Late phase list
            </Link>
          </div>
        </section>

        {/* ---------- Volunteer Credits teaser ---------- */}
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
                  People who ship work deserve public credit. This gallery will
                  grow from task completions, shoutouts, and opt-in supporter
                  names. Placeholder faces below show the layout; live profiles
                  connect as credit data stabilizes.
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
                    Opt-in supporters list from Support tiers
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

        {/* ---------- Decision Logs ---------- */}
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
              Lightweight archive of process and policy choices. Not a legal
              filing. A public notebook so the community is not left guessing.
            </p>
          </div>

          <div className="space-y-3">
            {DECISION_LOGS.map((entry) => (
              <Card key={entry.id} className="bg-cyber-card/80">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                  <div className="flex items-start gap-3">
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
                          {new Date(entry.date + 'T12:00:00').toLocaleDateString(
                            undefined,
                            { year: 'numeric', month: 'short', day: 'numeric' }
                          )}
                        </time>
                      </div>
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

        {/* ---------- State of the Forge ---------- */}
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
              Monthly snapshots of what shipped, what is blocked, and where
              energy is going next. Newest first.
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
                    {new Date(update.date + 'T12:00:00').toLocaleDateString(
                      undefined,
                      { year: 'numeric', month: 'long' }
                    )}
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
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>

        {/* ---------- Founders Thoughts ---------- */}
        <section id="founders" aria-labelledby="founders-heading" className="scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div className="max-w-2xl">
              <div className="section-header">Founders Thoughts</div>
              <h2
                id="founders-heading"
                className="text-2xl sm:text-3xl font-bold text-white"
              >
                Notes from the people building this
              </h2>
              <p className="text-text-secondary mt-2 text-sm sm:text-base">
                Personal reflections on pay, trust, community, and long-term vision.
                Full essays live on a dedicated page. Highlights below.
              </p>
            </div>
            <Button
              variant="secondary"
              className="gap-2 self-start sm:self-auto shrink-0"
              onClick={() => navigate('/founders-thoughts')}
            >
              <MessageSquareQuote className="w-4 h-4" />
              Read all thoughts
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
                      {new Date(note.date + 'T12:00:00').toLocaleDateString(
                        undefined,
                        { year: 'numeric', month: 'short', day: 'numeric' }
                      )}
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

          <Card className="mt-5 bg-cyber-surface/60 border-dashed">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-neon-cyan shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Full archive
                  </h3>
                  <p className="text-sm text-text-secondary mt-1">
                    Philosophy, living-wage rules from profits only, long-term vision,
                    and more. New entries post as the forge grows.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  onClick={() => navigate('/founders-thoughts')}
                >
                  Open Founders Thoughts
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  onClick={() => navigate('/contact')}
                >
                  Contact
                </Button>
              </div>
            </div>
          </Card>
        </section>

        {/* ---------- Bottom CTA ---------- */}
        <section className="pt-4 border-t border-cyber-border">
          <Card className="bg-cyber-card/80 text-center py-10 px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Help keep the forge open
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto mb-8 text-sm sm:text-base">
              Ship a task, share an idea, or support the studio. Every path is
              public enough that progress does not depend on insider access.
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
                onClick={() => navigate('/support')}
              >
                <Heart className="w-4 h-4" />
                Support
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2"
                onClick={() => navigate('/ideas')}
              >
                Browse ideas
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default TransparencyHub;
