import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import FaqAccordion from '../components/ui/FaqAccordion';

const FAQ = () => {
  const faqs = [
    {
      q: 'Is Together Forge a non-profit?',
      a: 'No. We are a community-first independent studio. Profits are reinvested into growth and making better games.',
    },
    {
      q: 'How can I contribute?',
      a: 'Submit ideas, volunteer your skills (development, content creation, moderation, etc.), or support the studio on the Support page.',
    },
    {
      q: 'Will contributors get credit?',
      a: 'Yes. All contributions are publicly credited. We value transparency and recognition.',
    },
    {
      q: 'What is the Early Game?',
      a: 'A small, fun multiplayer game designed to test our community systems and prove the concept.',
    },
    {
      q: 'How do I submit a game idea?',
      a: 'Go to Game Ideas and use the submission form. The community will see and discuss it.',
    },
  ];

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div className="border-b border-cyber-border bg-cyber-surface/80 py-12 md:py-16">
        <div className="container-custom">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group transition-colors"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />{' '}
            BACK TO HOME
          </Link>

          <div>
            <div className="section-header">FAQ</div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
              Frequently Asked Questions
            </h1>
            <p className="text-text-secondary mt-3 max-w-2xl text-sm sm:text-base">
              Click a question to expand the answer.
            </p>
          </div>
        </div>
      </div>

      <div className="container-custom py-12 max-w-3xl">
        <FaqAccordion items={faqs} />

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
