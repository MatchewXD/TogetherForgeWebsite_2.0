/**
 * 404 / Not Found - Dark Future Atmospheric Forge
 */

import { Link } from 'react-router-dom';
import {
  Home,
  Hammer,
  Lightbulb,
  Users,
  Compass,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Buttons';

const TF_LOGO_SRC = '/images/TF_Logo_Ideas_V2.png';

const NAV_LINKS = [
  {
    to: '/',
    label: 'Home',
    desc: 'Return to the forge hearth',
    icon: Home,
  },
  {
    to: '/projects',
    label: 'Projects',
    desc: 'Browse workspaces and phases',
    icon: Hammer,
  },
  {
    to: '/ideas',
    label: 'Ideas',
    desc: 'Explore the idea forge',
    icon: Lightbulb,
  },
  {
    to: '/get-involved',
    label: 'Get Involved',
    desc: 'Find your path in',
    icon: Users,
  },
];

const NotFound = () => {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-cyber-bg text-text-primary overflow-hidden">
      {/* Atmospheric background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgb(var(--tf-neon-cyan)/0.1)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,rgb(var(--tf-neon-purple)/0.08)_0%,transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgb(var(--tf-forge-gold)/0.05)_0%,transparent_40%)]" />
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-cyber-bg/40 via-transparent to-cyber-bg" />
      </div>

      <div className="container-custom relative z-10 pt-28 pb-16 md:pt-32 md:pb-24 flex flex-col items-center text-center">
        <div className="relative mb-8">
          <div
            className="absolute inset-[-25%] rounded-full bg-neon-cyan/10 blur-2xl pointer-events-none"
            aria-hidden="true"
          />
          <img
            src={TF_LOGO_SRC}
            alt="Together Forge"
            width={160}
            height={160}
            className="relative w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 object-contain select-none"
            decoding="async"
          />
        </div>

        <div className="status-bar text-xs mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-semantic-warning animate-pulse" />
          ERROR // 404 // PATH NOT FOUND
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mb-3">
          Page not found
        </h1>
        <p className="text-text-secondary text-base sm:text-lg max-w-lg leading-relaxed mb-10">
          This path does not exist in the forge. The route may have moved, or
          the link is broken. Use the map below to get back on track.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 md:gap-4 w-full max-w-2xl mb-10 text-left">
          {NAV_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className="group block h-full">
                <Card
                  interactive
                  variant="subtle"
                  className="h-full p-4 sm:p-5 flex items-start gap-3 group-hover:border-neon-cyan/40 transition-colors"
                >
                  <div className="w-10 h-10 shrink-0 rounded-lg bg-cyber-surface border border-cyber-border flex items-center justify-center text-neon-cyan group-hover:border-neon-cyan/50 transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-white group-hover:text-neon-cyan transition-colors">
                      {item.label}
                    </div>
                    <p className="text-sm text-text-secondary mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link to="/" className="w-full sm:w-auto">
            <Button size="lg" className="gap-2 w-full pointer-events-none">
              <Compass className="w-4 h-4" />
              Return Home
            </Button>
          </Link>
          <Link
            to="/contact"
            className="text-sm font-sans tracking-wide text-text-muted hover:text-neon-cyan transition-colors"
          >
            Report a broken link
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
