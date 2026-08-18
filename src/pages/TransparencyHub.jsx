/**
 * Transparency Hub: verify studio structure and how money is handled.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Wallet,
  Heart,
  Hammer,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import FinanceDashboard from '../components/transparency/FinanceDashboard';
import {
  getPublicSupportSummary,
  getPublicRecentDonations,
} from '../services/donationsService';

const TRANSPARENCY_BANNER_SRC = '/images/Transparency_Page.webp';

/** Period reinvestment reports. Expand as published. */
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

const GOVERNANCE_ROWS = [
  {
    title: 'Entity status',
    body: 'Together Forge is a community-supported independent for-profit studio. Support is business revenue, not a charitable donation. Contributions are not tax-deductible.',
  },
  {
    title: 'Founder compensation',
    paragraphs: [
      'Studio support (donations) will never go to me as personal income.',
      'I will only take a living wage from the company once the studio is generating enough revenue to pay every employee a family-supporting wage. That living wage will be set at a level that can support a family of five.',
      'Until that point, any personal funding I need comes from a completely separate personal runway path that is kept outside of project and studio support funds.',
    ],
  },
  {
    title: 'Outside capital',
    paragraphs: [
      'Together Forge will not sell ownership or decision-making power.',
      'If outside capital is ever accepted, it will be structured as pure funding with a defined repayment (for example, a fixed return of the original amount plus a clear multiple, paid only from profits). Once that amount is repaid, the obligation ends. No equity, no board seats, and no ongoing influence over the studio or its community.',
    ],
  },
  {
    title: 'Public reporting',
    body: 'Financial summaries, reinvestment reports, decision logs, and phase focus live on this page. Individual donors stay private unless they opt into public credit.',
  },
  {
    title: 'Community voice',
    body: 'Direction is shaped by public ideas, votes, and open task boards. Major process choices are recorded in the decision log below.',
  },
];

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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

  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.05)_0%,transparent_55%)]"
        aria-hidden="true"
      />

      <header className="relative pt-20 overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <img
            src={TRANSPARENCY_BANNER_SRC}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-[center_40%] sm:object-center"
            decoding="async"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-cyber-bg/55" />
          <div className="absolute inset-0 bg-gradient-to-r from-cyber-bg/96 via-cyber-bg/85 to-cyber-bg/35" />
          <div className="absolute inset-0 bg-gradient-to-b from-cyber-bg/70 via-cyber-bg/25 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgb(var(--tf-neon-cyan)/0.08)_0%,transparent_50%)]" />
        </div>
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
          </div>
        </div>
      </header>

      <div className="container-custom relative z-10 py-12 md:py-16 space-y-14 md:space-y-16">
        <section id="governance" aria-labelledby="governance-heading">
          <div className="max-w-3xl mb-6">
            <div className="section-header">Legal and governance</div>
            <h2
              id="governance-heading"
              className="text-2xl sm:text-3xl font-bold text-white"
            >
              How the studio is structured
            </h2>
          </div>

          <dl className="divide-y divide-cyber-border border-y border-cyber-border">
            {GOVERNANCE_ROWS.map((row) => (
              <div
                key={row.title}
                className="grid sm:grid-cols-[11rem_1fr] gap-2 sm:gap-6 py-4"
              >
                <dt className="text-sm font-semibold text-white">{row.title}</dt>
                <dd className="text-sm text-text-secondary leading-relaxed space-y-3">
                  {row.paragraphs
                    ? row.paragraphs.map((p) => <p key={p}>{p}</p>)
                    : row.body}
                </dd>
              </div>
            ))}
            <div className="grid sm:grid-cols-[11rem_1fr] gap-2 sm:gap-6 py-4">
              <dt className="text-sm font-semibold text-white">Public policies</dt>
              <dd className="text-sm text-text-secondary leading-relaxed">
                <span className="flex flex-wrap gap-x-4 gap-y-1">
                  <Link to="/terms" className="text-neon-cyan hover:underline">
                    Terms of Service
                  </Link>
                  <Link to="/privacy" className="text-neon-cyan hover:underline">
                    Privacy Policy
                  </Link>
                  <Link
                    to="/guidelines"
                    className="text-neon-cyan hover:underline"
                  >
                    Community Guidelines
                  </Link>
                </span>
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-xs text-text-muted">
            <Link
              to="/founders-thoughts"
              className="text-text-muted hover:text-neon-cyan transition-colors"
            >
              Why this studio exists → Founders Thoughts
            </Link>
          </p>
        </section>

        <section id="financials" aria-labelledby="financials-heading">
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

        <section id="decisions" aria-labelledby="decisions-heading">
          <div className="max-w-2xl mb-6">
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

          <ul className="divide-y divide-cyber-border border-y border-cyber-border">
            {DECISION_LOGS.map((entry) => (
              <li key={entry.id} className="py-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1.5">
                  <h3 className="text-base font-semibold text-white">
                    {entry.title}
                  </h3>
                  <span className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
                    {entry.tag}
                  </span>
                  <time
                    dateTime={entry.date}
                    className="text-xs font-mono text-text-muted"
                  >
                    {formatDate(entry.date)}
                  </time>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {entry.summary}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-start">
          <section id="credits" aria-labelledby="credits-heading">
            <div className="section-header">Credits</div>
            <h2
              id="credits-heading"
              className="text-2xl sm:text-3xl font-bold text-white mb-3"
            >
              Public credit for shipped work
            </h2>
            <p className="text-sm sm:text-base text-text-secondary leading-relaxed mb-4">
              Task completions, ideas, Showcase posts, and opt-in supporter
              names are recorded on a public contributor list. Credit is
              permanent. It is not removed when a project finishes.
            </p>
            <Link
              to="/contributors/all"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-neon-cyan hover:text-white"
            >
              Full contributor gallery
              <ArrowRight className="w-4 h-4" />
            </Link>
          </section>

          <section id="roadmap" aria-labelledby="roadmap-heading">
            <div className="section-header" id="roadmap-heading">
              Roadmap at a glance
            </div>
            <p className="text-text-secondary mt-2 text-sm sm:text-base mb-5">
              Early is the active focus. Mid and Late are the planned next
              steps. Project pages hold the live boards and detail.
            </p>

            <ul className="divide-y divide-cyber-border border-y border-cyber-border">
              <li className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                <div>
                  <span className="text-sm font-semibold text-white">Early</span>
                  <span className="ml-2 text-xs font-mono tracking-widest uppercase text-neon-cyan">
                    Active
                  </span>
                </div>
                <Link
                  to="/projects/early"
                  className="text-sm text-neon-cyan hover:underline"
                >
                  Early projects
                </Link>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                <div>
                  <span className="text-sm font-semibold text-white">Mid</span>
                  <span className="ml-2 text-xs font-mono tracking-widest uppercase text-text-muted">
                    Next
                  </span>
                </div>
                <Link
                  to="/projects/mid"
                  className="text-sm text-neon-cyan hover:underline"
                >
                  Mid plans
                </Link>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                <div>
                  <span className="text-sm font-semibold text-white">Late</span>
                  <span className="ml-2 text-xs font-mono tracking-widest uppercase text-text-muted">
                    Later
                  </span>
                </div>
                <Link
                  to="/projects/late"
                  className="text-sm text-neon-cyan hover:underline"
                >
                  Late plans
                </Link>
              </li>
            </ul>
          </section>
        </div>

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
                <Hammer className="w-4 h-4" />
                Get involved
              </Button>
              <Button
                size="lg"
                variant="gold"
                className="gap-2"
                onClick={() => navigate('/donate')}
              >
                <Wallet className="w-4 h-4" />
                Donate
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default TransparencyHub;
