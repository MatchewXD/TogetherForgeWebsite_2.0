/**
 * Community Showcase — fan / community videos and posts.
 * Official studio videos live on /media.
 * Route: /showcase
 */

import { Link } from 'react-router-dom';
import { Film, Users, ArrowRight } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Buttons';

const CommunityShowcase = () => {
  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary">
      <header className="relative pt-20 border-b border-cyber-border bg-cyber-surface/80">
        <div className="container-custom py-10 sm:py-12 md:py-14">
          <div className="max-w-3xl">
            <div className="section-header">Community</div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
              Community Showcase
            </h1>
            <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-2xl">
              Community-made videos, streams, and posts that celebrate Together
              Forge. Official studio videos (updates, overviews, how-to-help) live
              on the Media page.
            </p>
          </div>
        </div>
      </header>

      <div className="container-custom py-12 md:py-16 max-w-3xl space-y-8">
        <Card className="p-8 text-center space-y-4">
          <Users className="w-10 h-10 text-neon-purple mx-auto" />
          <h2 className="text-xl font-bold text-white">Coming soon</h2>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed max-w-md mx-auto">
            We are building a home for community clips and posts. Until then,
            share work on Discord and watch official videos on Media.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <Link to="/media">
              <Button className="gap-2 w-full sm:w-auto">
                <Film className="w-4 h-4" />
                Official Media
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/get-involved">
              <Button variant="secondary" className="w-full sm:w-auto">
                Get Involved
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CommunityShowcase;
