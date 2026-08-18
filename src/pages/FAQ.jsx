import { Link } from 'react-router-dom';
import FaqAccordion from '../components/ui/FaqAccordion';
import { DISCORD_URL } from '../constants/communityLinks';

const linkClass = 'text-neon-cyan hover:underline';

const FAQ = () => {
  const faqs = [
    {
      q: 'What is Together Forge?',
      a: 'Together Forge is a community-first independent game studio. We build games in public with clear credit, open task boards, and full financial transparency. The goal is to make games that put players and the people who create them first.',
    },
    {
      q: 'Is Together Forge a non-profit?',
      a: 'No. We are a for-profit, community-supported independent studio. Support is business revenue, not a charitable donation. Contributions are not tax-deductible. Profits are reinvested into the studio and the games.',
    },
    {
      q: 'How is money used?',
      a: 'Studio Support funds projects, tools, hosting, and operations. A portion is reserved for taxes and legal obligations. The founder does not take living expenses from studio support. A living wage only begins once the studio can pay all employees a family-supporting wage. Personal runway support is tracked separately.',
    },
    {
      q: 'Will I get credit for my work?',
      a: 'Yes. All meaningful contributions (tasks, ideas, Showcase posts, and opt-in support) are publicly credited. We treat credit as a core part of the system, not an afterthought.',
    },
    {
      q: 'How can I contribute?',
      a: (
        <>
          <p>You can:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Submit game ideas</li>
            <li>Claim and complete open tasks on project boards</li>
            <li>
              Offer skills (development, art, audio, writing, moderation,
              content creation, etc.)
            </li>
            <li>Support the studio financially</li>
            <li>Share work in the Community Showcase</li>
          </ul>
        </>
      ),
    },
    {
      q: 'What is the Early / Mid / Late system?',
      a: (
        <>
          <p>We work in clear phases.</p>
          <p className="mt-2">
            Early is the current focus. These are smaller cooperative games that
            prove the model, test our systems, and generate the resources to go
            further (currently Tether).
          </p>
          <p className="mt-2">
            Mid is the next major step. Using the foundation built in Early, we
            aim to make substantial cooperative games that push the medium
            instead of playing it safe. The goal is not to become another
            mid-sized studio.
          </p>
          <p className="mt-2">
            Late is the highest ambition: attempting to create the best MMORPG
            in the world, with cooperative combat, evolving world-level threats,
            and a story shaped by the entire player base. Late only opens when
            the earlier phases have earned it.
          </p>
          <p className="mt-2">Only Early currently has open task boards.</p>
        </>
      ),
    },
    {
      q: 'How do I submit a game idea?',
      a: (
        <>
          Go to the{' '}
          <Link to="/ideas" className={linkClass}>
            Ideas
          </Link>{' '}
          page and use the submission form. Ideas are public. The community can
          discuss them, and strong ones can be adopted into official projects.
        </>
      ),
    },
    {
      q: 'What are Forge Marks?',
      a: 'Forge Marks are used to place awards on Idea posts and Showcase posts. Right now they can only be obtained through donations. We are considering also awarding them for completed claims in the future.',
    },
    {
      q: 'Why does Together Forge exist?',
      a: (
        <>
          Game companies have repeatedly put shareholders and executives ahead
          of players and the people who make the games. Together Forge is an
          attempt to build something different: open, fair, and driven by the
          people who actually care.
          <span className="block mt-2">
            You can read the full reasoning here:{' '}
            <Link to="/founders-thoughts" className={linkClass}>
              Founders Thoughts
            </Link>
          </span>
        </>
      ),
    },
    {
      q: 'Is there a Discord?',
      a: (
        <>
          Yes. The Discord is the main place for real-time discussion,
          coordination, and community.{' '}
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            Discord
          </a>
        </>
      ),
    },
    {
      q: 'How is moderation handled?',
      a: (
        <>
          Moderation follows the published{' '}
          <Link to="/guidelines" className={linkClass}>
            Community Guidelines
          </Link>
          . Decisions are based on observable conduct, not private preference.
          The guidelines are public so everyone can see the same rules.
        </>
      ),
    },
  ];

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div className="border-b border-cyber-border bg-cyber-surface/80 py-12 md:py-16">
        <div className="container-custom">
          <div>
            <h1 className="section-header dashboard-page-title !mb-0 !text-3xl sm:!text-5xl !font-bold !tracking-tight !normal-case">
              Frequently Asked Questions
            </h1>
          </div>
        </div>
      </div>

      <div className="container-custom py-12 max-w-5xl">
        <FaqAccordion items={faqs} columns={2} />

        <div className="mt-12 text-center text-text-muted text-sm">
          Have more questions?{' '}
          <Link to="/get-involved" className="text-neon-cyan hover:underline">
            Get Involved
          </Link>{' '}
          or{' '}
          <Link to="/contact" className="text-neon-cyan hover:underline">
            contact us
          </Link>
          .
        </div>
      </div>
    </div>
  );
};

export default FAQ;
