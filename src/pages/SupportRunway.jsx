/**
 * Founder Runway — personal support for Matthew Seagren.
 * Funding URL stays in constants/runway.js (not named on the page).
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import RunwayTransparency from '../components/ui/RunwayTransparency';
import RecentDonationsList from '../components/support/RecentDonationsList';
import FundContributorsCard from '../components/support/FundContributorsCard';
import KofiRunwayButton from '../components/support/KofiRunwayButton';
import PaymentsComingSoon from '../components/support/PaymentsComingSoon';
import { getPublicRecentDonations } from '../services/donationsService';
import { areRunwayEnabled } from '../constants/donationsEnabled';

const SupportRunway = () => {
  const runwayEnabled = areRunwayEnabled();
  const [recentItems, setRecentItems] = useState([]);
  const [recentSource, setRecentSource] = useState('empty');
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setRecentLoading(true);
      try {
        const recent = await getPublicRecentDonations(12, {
          fundType: 'runway',
        });
        if (!mounted) return;
        setRecentItems(recent.items || []);
        setRecentSource(recent.source || 'empty');
      } catch (e) {
        console.warn('[SupportRunway] recent', e?.message || e);
      } finally {
        if (mounted) setRecentLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(192,38,211,0.06)_0%,transparent_55%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 border-b border-cyber-border bg-cyber-surface/80">
        <div className="container-custom py-12 md:py-16">
          <div className="max-w-3xl">
            <h1 className="section-header dashboard-page-title !mb-4 !text-3xl sm:!text-4xl !font-bold !tracking-tight !normal-case">
              Founder Runway
            </h1>
            <p className="mt-4 text-sm sm:text-base text-text-secondary leading-relaxed">
              As Founder I refuse to take Together Forge donations as wages.
              Money given to the studio stays with the studio. This page is
              different. If you support the runway, you are supporting me,
              personally, so I can leave my day job and work on Together Forge
              full time. Those two kinds of support never mix.
            </p>
            <div className="mt-6">
              {runwayEnabled ? (
                <KofiRunwayButton className="w-full sm:w-auto min-w-[14rem] px-6 py-3" />
              ) : (
                <PaymentsComingSoon variant="runway" />
              )}
            </div>
            <p className="mt-5 text-sm sm:text-base leading-relaxed">
              <Link
                to="/founders-thoughts#founder-compensation"
                className="inline-flex items-center gap-1 font-semibold text-neon-cyan hover:underline"
              >
                Read the full explanation of founder compensation and why this
                separation exists
                <span aria-hidden="true"> → </span>
                Founders Thoughts
              </Link>
            </p>
            <p className="mt-3 text-sm sm:text-base leading-relaxed">
              <Link
                to="/payments"
                className="inline-flex items-center gap-1 font-semibold text-neon-cyan hover:underline"
              >
                Payments and refunds
              </Link>
            </p>
          </div>
        </div>
      </div>

      <div className="container-custom relative z-10 py-12 md:py-16 max-w-2xl space-y-6">
        <RecentDonationsList
          items={recentItems}
          loading={recentLoading}
          source={recentSource}
          title="Recent contributions"
          headingId="recent-runway-heading"
          emptyTitle="No public runway support yet"
          emptyBody="Runway payments appear here."
          creditNote="Named support can appear below. Private payments still count toward the total without a public name or message."
        />

        <FundContributorsCard fundType="runway" />

        <RunwayTransparency />
      </div>
    </div>
  );
};

export default SupportRunway;
