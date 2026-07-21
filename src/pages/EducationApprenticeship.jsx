/**
 * Education and Apprenticeship Program
 * Late-game initiative: structured mentorship once the studio is sustainable.
 */

import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  GraduationCap,
  Clock,
  Users,
  ShieldCheck,
  Target,
  ArrowRight,
} from 'lucide-react';

import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const LAUNCH_REQUIREMENTS = [
  'Compensation for experienced mentors and instructors.',
  'Dedicated time allocation without compromising active project delivery.',
  'Necessary tools, infrastructure, and oversight.',
];

const RATING_TOPICS = [
  'Teaching effectiveness and knowledge transfer.',
  'Apprentice engagement, reliability, and growth.',
  'Overall experience and professionalism.',
];

const SAFEGUARDS = [
  'Required milestone deliverables and mentor progress reports.',
  'Admin or lead spot-checks on sessions.',
  'Clear program guidelines and a code of conduct for participants.',
];

const BROADER_GOALS = [
  'Expanding the pool of skilled, values-aligned contributors.',
  'Accelerating internal talent development for future projects.',
  'Demonstrating commitment to genuine community uplift beyond short-term task volunteering.',
  'Aligning with the long-term vision of independence from traditional industry gatekeeping by building capability from within the community.',
];

const EducationApprenticeship = () => {
  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.04)_0%,transparent_50%)]"
        aria-hidden="true"
      />

      {/* Header */}
      <div className="border-b border-white/10 bg-cyber-surface py-14 md:py-16 relative z-10">
        <div className="container-custom">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
            BACK TO HOME
          </Link>

          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="section-header mb-0">Education</div>
              <Badge variant="default">Late-game initiative</Badge>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Education and Apprenticeship Program
            </h1>
            <p className="text-lg text-text-secondary leading-relaxed">
              A long-term path for structured mentorship, paid apprenticeships,
              and real skill transfer once the studio can support it sustainably.
            </p>
          </div>
        </div>
      </div>

      <div className="container-custom relative z-10 py-12 md:py-16 max-w-4xl space-y-14 md:space-y-16">
        {/* Overview */}
        <section aria-labelledby="overview-heading">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-5 h-5 text-neon-cyan shrink-0" />
            <h2
              id="overview-heading"
              className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
            >
              Overview and Timing
            </h2>
          </div>

          <div className="space-y-5 text-text-secondary leading-relaxed text-base sm:text-[1.05rem]">
            <p>
              The Together Forge Education and Apprenticeship Program is a
              long-term initiative planned for a mature phase of operations,
              once the studio has achieved sustainable revenue, supports a full
              core development team, and maintains surplus resources. This
              program formalizes on-the-job training and knowledge transfer in
              game development disciplines (art, programming, design, writing,
              sound, production, and more). It directly supports the studio’s
              mission of building community capacity, fostering genuine skill
              development, and creating a pipeline of capable contributors
              aligned with Together Forge values.
            </p>
            <p>
              The program will only launch when the financial model can
              comfortably cover:
            </p>
          </div>

          <ul className="mt-5 space-y-3">
            {LAUNCH_REQUIREMENTS.map((item) => (
              <li
                key={item}
                className="flex gap-3 text-text-secondary leading-relaxed"
              >
                <span
                  className="mt-2 w-1.5 h-1.5 rounded-full bg-neon-cyan shrink-0"
                  aria-hidden="true"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Core Model */}
        <section aria-labelledby="model-heading">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-neon-cyan shrink-0" />
            <h2
              id="model-heading"
              className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
            >
              Core Model: Paid Apprenticeships with Structured Mentorship
            </h2>
          </div>

          <div className="space-y-5 text-text-secondary leading-relaxed text-base sm:text-[1.05rem]">
            <p>
              Apprenticeships pair motivated learners with experienced
              practitioners in specific fields.
            </p>
            <p>
              Teaching occurs primarily through real work: mentors demonstrate
              workflows, decision-making processes, style guides, technical best
              practices, and project-specific techniques while collaborating on
              actual Together Forge tasks or prototypes.
            </p>
          </div>

          <Card className="bg-cyber-card/80 border-neon-cyan/20 mt-6">
            <div className="text-xs font-mono tracking-widest text-neon-cyan mb-2">
              EXAMPLE
            </div>
            <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
              A senior artist mentors an apprentice by sharing screen sessions
              on asset creation pipelines, explaining the studio’s art direction
              principles, optimization techniques for the target engine, and
              iterative feedback processes used on live projects.
            </p>
          </Card>

          <p className="mt-6 text-text-secondary leading-relaxed text-base sm:text-[1.05rem]">
            Apprentices receive structured learning objectives, regular progress
            reviews, and increasing responsibility as skills develop. Successful
            completers earn public recognition, portfolio contributions, and
            priority consideration for paid roles or advanced volunteer
            opportunities.
          </p>
        </section>

        {/* Incentives */}
        <section aria-labelledby="incentives-heading">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="w-5 h-5 text-neon-cyan shrink-0" />
            <h2
              id="incentives-heading"
              className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
            >
              Incentives and Quality Assurance
            </h2>
          </div>

          <div className="space-y-5 text-text-secondary leading-relaxed text-base sm:text-[1.05rem]">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Mentor Compensation
              </h3>
              <p>
                Mentors receive direct payment or equivalent studio credit for
                their teaching time, reflecting the value of knowledge transfer
                alongside production work.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Accountability Mechanisms
              </h3>
              <p className="mb-4">
                To ensure real teaching occurs rather than token participation
                for pay, implement a transparent feedback and rating system.
                Both mentors and apprentices provide structured
                post-apprenticeship evaluations covering:
              </p>
              <ul className="space-y-3 mb-5">
                {RATING_TOPICS.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span
                      className="mt-2 w-1.5 h-1.5 rounded-full bg-neon-cyan shrink-0"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mb-4">
                Ratings are visible in anonymized or aggregated form on public
                mentor and apprentice profiles (with privacy controls).
                Persistent low performance on either side triggers review by
                project leads or admins. This creates natural reputation signals
                similar to established service platforms while remaining
                professional and focused on skill development.
              </p>
              <p className="mb-3">Additional safeguards may include:</p>
              <ul className="space-y-3">
                {SAFEGUARDS.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span
                      className="mt-2 w-1.5 h-1.5 rounded-full bg-neon-cyan shrink-0"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p>
              This dual-rating approach prioritizes accountability and
              continuous improvement without relying solely on subjective
              “social credit.” It rewards effective mentors and committed
              apprentices while protecting studio resources.
            </p>
          </div>
        </section>

        {/* Broader goals */}
        <section aria-labelledby="goals-heading">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-5 h-5 text-neon-cyan shrink-0" />
            <h2
              id="goals-heading"
              className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
            >
              Integration with Broader Goals
            </h2>
          </div>

          <p className="text-text-secondary leading-relaxed text-base sm:text-[1.05rem] mb-5">
            The program strengthens the Together Forge ecosystem by:
          </p>
          <ul className="space-y-3 text-text-secondary leading-relaxed">
            {BROADER_GOALS.map((item) => (
              <li key={item} className="flex gap-3">
                <span
                  className="mt-2 w-1.5 h-1.5 rounded-full bg-neon-cyan shrink-0"
                  aria-hidden="true"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-text-secondary leading-relaxed text-base sm:text-[1.05rem]">
            It will be documented on this Education and Apprenticeships page
            (and related sections within Transparency or Get Involved) that
            outlines eligibility, application processes, current openings (when
            active), success stories, and program guidelines.
          </p>
          <p className="mt-4 text-text-secondary leading-relaxed text-base sm:text-[1.05rem]">
            This initiative represents a natural evolution of the volunteer and
            contributor model into structured professional development once the
            studio reaches the necessary scale and stability.
          </p>
        </section>

        {/* Status / CTAs */}
        <section className="pt-4">
          <Card className="bg-cyber-card/80 border-neon-cyan/25 text-center py-10 px-6">
            <GraduationCap className="w-10 h-10 text-neon-cyan mx-auto mb-4 opacity-90" />
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
              Not open for applications yet
            </h2>
            <p className="text-sm sm:text-base text-text-secondary max-w-xl mx-auto mb-8 leading-relaxed">
              This is a planned late-game program. Until launch, the best way
              to grow with the forge is to contribute on live projects, claim
              tasks, and build with the community.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/get-involved"
                className="btn-primary btn-neon inline-flex items-center justify-center gap-2 px-6 py-3"
              >
                Get Involved
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/transparency"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-mono tracking-widest rounded-lg border border-cyber-border text-text-secondary hover:text-neon-cyan hover:border-neon-cyan transition-colors"
              >
                Transparency Hub
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default EducationApprenticeship;
