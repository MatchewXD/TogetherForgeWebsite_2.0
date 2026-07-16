/**
 * Transparency Hub (SDD): legal/governance, financial summaries & reinvestment
 * reports, roadmaps, volunteer credits, decision logs, State of the Forge,
 * Founders Thoughts. Placeholders until live ledgers connect.
 */

import { useMemo, useState, useEffect } from 'react';
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
  CheckCircle2,
  Hammer,
  Layers,
  Sparkles,
  FileText,
  TrendingUp,
  RefreshCw,
  Landmark,
} from 'lucide-react';

import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import UserAvatar from '../components/ui/UserAvatar';

const SECTIONS = [
  { id: 'governance', label: 'Governance' },
  { id: 'financials', label: 'Financials' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'credits', label: 'Credits' },
  { id: 'decisions', label: 'Decisions' },
  { id: 'state', label: 'State of the Forge' },
  { id: 'founders', label: 'Founders' },
];

/** Placeholder public financial summary (studio Support, not runway). */
const FINANCIAL_PLACEHOLDERS = {
  periodLabel: 'Q3 2026 (placeholder)',
  totalSupport: 0,
  reinvested: 0,
  operations: 0,
  reserve: 0,
  note: 'Live Stripe aggregates will replace these zeros once reporting is connected.',
};

/** Planned usage of studio support funds. Founder pay is not from support. */
const USAGE_CATEGORIES = [
  {
    label: 'Project development and tools',
    pct: 40,
    desc: 'Engines, licenses, build pipelines, and software that ship games.',
  },
  {
    label: 'Assets and creative production',
    pct: 25,
    desc: 'Art, audio, design assets, and production needs for active projects.',
  },
  {
    label: 'Community infrastructure',
    pct: 20,
    desc: 'Site features, credit systems, moderation tools, volunteer systems.',
  },
  {
    label: 'Studio operations and hosting',
    pct: 15,
    desc: 'Hosting, databases, test servers, taxes, and legitimate operating costs.',
  },
];

/** Placeholder reinvestment reports (public, high-level). */
const REINVESTMENT_REPORTS = [
  {
    id: 'r1',
    period: 'July 2026',
    status: 'Placeholder',
    headline: 'First public reinvestment period',
    summary:
      'Once support volume is meaningful, this card will list what was reinvested into projects, tools, and community systems versus held as operating reserve.',
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
      'Past months will stack here so anyone can audit the pattern over time. No silent rewrites of prior totals.',
    items: [
      { label: 'Reports published', value: '0' },
      { label: 'Open questions', value: 'n/a' },
    ],
  },
];

const ROADMAP = [
  {
    id: 'prototype-systems',
    title: 'Prototype Systems',
    phase: 'Early',
    status: 'In Development',
    progress: 42,
    href: '/projects/prototype-systems',
    summary:
      'Core loop, networking, and claim/credit prototypes. Open volunteer tasks on the board.',
  },
  {
    id: 'core-features',
    title: 'Core Features Sprint',
    phase: 'Mid',
    status: 'Planning',
    progress: 18,
    href: '/projects/core-features',
    summary:
      'Cooperative systems design and early integrations. Public ownership of sprints.',
  },
  {
    id: 'polish-playtests',
    title: 'Stability and Polish',
    phase: 'Late',
    status: 'Vision',
    progress: 5,
    href: '/projects/polish-playtests',
    summary:
      'Playtests, polish passes, and hardening for release. Early task drafts welcome.',
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
      'Together Forge is a community-supported for-profit studio. Contributions are not tax-deductible. Stated clearly on Support and here.',
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
    body: 'Public governance, placeholder financial summaries, project roadmaps, and Founders Thoughts are live. Studio Support and personal runway Support stay clearly separated so money trails stay honest.',
    links: [
      { label: 'Founders Thoughts', to: '/founders-thoughts' },
      { label: 'Studio Support', to: '/support' },
      { label: 'Projects', to: '/projects' },
    ],
  },
  {
    id: 's2',
    date: '2026-06-01',
    title: 'June: Workspaces and claim flows',
    highlight: false,
    body: 'Prototype Systems board opened. Claim and credit flows moved from concept to site features so effort can be tracked publicly.',
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

const formatMoney = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n || 0);

const formatDate = (iso, opts = { year: 'numeric', month: 'short', day: 'numeric' }) => {
  if (!iso) return '';
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, opts);
};

const TransparencyHub = () => {
  const navigate = useNavigate();
  const [demoTotal, setDemoTotal] = useState(0);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('tf_donations') || '[]');
      if (Array.isArray(stored) && stored.length) {
        setDemoTotal(stored.reduce((acc, d) => acc + (Number(d.amount) || 0), 0));
      }
    } catch {
      setDemoTotal(0);
    }
  }, []);

  const usageRows = useMemo(() => USAGE_CATEGORIES, []);
  const displayTotal =
    FINANCIAL_PLACEHOLDERS.totalSupport > 0
      ? FINANCIAL_PLACEHOLDERS.totalSupport
      : demoTotal;

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
                className="px-3 py-1.5 rounded-full text-xs font-mono tracking-widest uppercase border border-cyber-border text-text-muted hover:border-neon-cyan/50 hover:text-neon-cyan transition-colors bg-cyber-card/40"
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

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

        {/* Financial summaries & reinvestment */}
        <section id="financials" aria-labelledby="financials-heading" className="scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div className="max-w-2xl">
              <div className="section-header">Financial summaries</div>
              <h2
                id="financials-heading"
                className="text-2xl sm:text-3xl font-bold text-white"
              >
                Public money trails
              </h2>
              <p className="text-text-secondary mt-2 text-sm sm:text-base">
                Studio Support totals, planned usage, and reinvestment reports.
                Placeholders until Stripe reporting is live. Personal runway is
                tracked separately on{' '}
                <Link to="/support-runway" className="text-neon-cyan hover:underline">
                  Runway Support
                </Link>
                .
              </p>
            </div>
            <Button
              variant="secondary"
              className="gap-2 self-start sm:self-auto shrink-0"
              onClick={() => navigate('/support')}
            >
              <Heart className="w-4 h-4" />
              Studio Support
            </Button>
          </div>

          {/* Snapshot stats */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-cyber-card/80 border-neon-cyan/20">
              <div className="flex items-center gap-2 text-text-muted mb-2">
                <Wallet className="w-4 h-4 text-neon-cyan" />
                <span className="text-xs font-mono tracking-widest uppercase">
                  Total support
                </span>
              </div>
              <div className="text-3xl font-mono font-bold text-neon-cyan">
                {formatMoney(displayTotal)}
              </div>
              <p className="text-xs text-text-muted mt-2">
                {FINANCIAL_PLACEHOLDERS.periodLabel}
              </p>
            </Card>
            <Card className="bg-cyber-card/80">
              <div className="flex items-center gap-2 text-text-muted mb-2">
                <RefreshCw className="w-4 h-4 text-neon-purple" />
                <span className="text-xs font-mono tracking-widest uppercase">
                  Reinvested
                </span>
              </div>
              <div className="text-3xl font-mono font-bold text-white">
                {formatMoney(FINANCIAL_PLACEHOLDERS.reinvested)}
              </div>
              <p className="text-xs text-text-muted mt-2">Into projects and systems</p>
            </Card>
            <Card className="bg-cyber-card/80">
              <div className="flex items-center gap-2 text-text-muted mb-2">
                <Landmark className="w-4 h-4 text-neon-magenta" />
                <span className="text-xs font-mono tracking-widest uppercase">
                  Operations
                </span>
              </div>
              <div className="text-3xl font-mono font-bold text-white">
                {formatMoney(FINANCIAL_PLACEHOLDERS.operations)}
              </div>
              <p className="text-xs text-text-muted mt-2">Hosting, tools, taxes</p>
            </Card>
            <Card className="bg-cyber-card/80">
              <div className="flex items-center gap-2 text-text-muted mb-2">
                <Shield className="w-4 h-4 text-neon-cyan" />
                <span className="text-xs font-mono tracking-widest uppercase">
                  Reserve
                </span>
              </div>
              <div className="text-3xl font-mono font-bold text-white">
                {formatMoney(FINANCIAL_PLACEHOLDERS.reserve)}
              </div>
              <p className="text-xs text-text-muted mt-2">Held for stability</p>
            </Card>
          </div>

          <p className="text-xs font-mono text-text-muted mb-6">
            {FINANCIAL_PLACEHOLDERS.note}
          </p>

          <div className="grid lg:grid-cols-2 gap-4 md:gap-5 mb-6">
            <Card className="bg-cyber-card/80">
              <div className="flex items-center gap-2 text-text-muted mb-4">
                <TrendingUp className="w-4 h-4 text-neon-purple" />
                <span className="text-xs font-mono tracking-widest uppercase">
                  Planned usage split
                </span>
              </div>
              <p className="text-sm text-text-secondary mb-5 leading-relaxed">
                Target allocation for studio Support. Founder pay is not in this
                split.
              </p>
              <ul className="space-y-4">
                {usageRows.map((row) => (
                  <li key={row.label}>
                    <div className="flex justify-between gap-3 text-sm mb-1.5">
                      <span className="text-white font-medium">{row.label}</span>
                      <span className="font-mono text-neon-cyan shrink-0">
                        {row.pct}%
                      </span>
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
            </Card>

            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="w-4 h-4 text-neon-cyan" />
                <h3 className="text-lg font-semibold text-white">
                  Reinvestment reports
                </h3>
                <Badge variant="default">Placeholder</Badge>
              </div>
              {REINVESTMENT_REPORTS.map((report) => (
                <Card key={report.id} className="bg-cyber-card/80">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs font-mono tracking-widest text-text-muted uppercase">
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
                        <span className="font-mono text-neon-cyan">{item.value}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </div>

          <Card className="bg-cyber-surface/60 border-dashed">
            <p className="text-xs text-text-muted leading-relaxed">
              Disclaimer: Studio Support is not a charitable donation. Funds go
              toward building projects and studio operations. Founder compensation
              from the company comes only from future profits under the rules
              above. See{' '}
              <Link to="/support" className="text-neon-cyan hover:underline">
                Support
              </Link>{' '}
              and{' '}
              <Link
                to="/founders-thoughts#founder-compensation"
                className="text-neon-cyan hover:underline"
              >
                Founder Compensation
              </Link>
              .
            </p>
          </Card>
        </section>

        {/* Project roadmaps */}
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
                Each card links to a live workspace. Progress bars are estimates
                until task metrics feed this view.
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
                  Layout teaser below until live credit data connects.
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
                onClick={() => navigate('/support')}
              >
                <Heart className="w-4 h-4" />
                Studio Support
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
