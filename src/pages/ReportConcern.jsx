/**
 * Dedicated Report a concern page (also available as a modal from Contact / footer).
 */
import { Link } from 'react-router-dom';
import ReportConcernForm from '../components/report/ReportConcernForm';

export default function ReportConcern() {
  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div className="border-b border-white/10 bg-cyber-surface py-12 md:py-16">
        <div className="container-custom">
          <div className="section-header !block mb-3">Community</div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
            Report a concern
          </h1>
          <p className="text-text-secondary mt-3 max-w-2xl text-sm sm:text-base">
            Private reports about moderation or community behavior. These are
            not posted on the site.
          </p>
        </div>
      </div>

      <div className="container-custom py-10 max-w-2xl">
        <div className="rounded-2xl border border-cyber-border bg-cyber-surface/80 p-6 sm:p-8">
          <ReportConcernForm />
        </div>
        <p className="mt-6 text-sm text-text-muted">
          Site or account problems?{' '}
          <Link to="/bugs/report" className="text-neon-cyan hover:underline">
            Report a bug
          </Link>
          {' · '}
          <Link to="/contact" className="text-neon-cyan hover:underline">
            Contact
          </Link>
        </p>
      </div>
    </div>
  );
}
