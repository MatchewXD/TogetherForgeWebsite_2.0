/**
 * Public badge catalog — goals and how to earn each award.
 */
import { Link } from 'react-router-dom';
import { Award } from 'lucide-react';
import { listCatalogByCategory } from '../constants/badges';
import BadgeIcon from '../components/badges/BadgeIcon';
import Card from '../components/ui/Card';

const Badges = () => {
  const sections = listCatalogByCategory();

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg">
      <div className="border-b border-white/10 bg-cyber-surface/90 py-12 sm:py-16">
        <div className="container-custom max-w-4xl">
          <div className="section-header text-neon-purple">RECOGNITION</div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mt-1">
            Badges
          </h1>
          <p className="text-text-secondary mt-3 text-sm max-w-2xl leading-relaxed">
            Earn status for first steps, impact on posts, giving back,
            collaboration, support, and shipped work. Pin one badge on your
            profile so it appears next to your name across the site. Your full
            collection lives on your public profile. Thresholds are listed on
            each badge.
          </p>
          <p className="text-xs text-text-muted mt-3 font-mono">
            <Link to="/donate" className="text-neon-cyan hover:underline">
              Support the studio
            </Link>
            {' · '}
            <Link to="/projects" className="text-neon-cyan hover:underline">
              Ship tasks
            </Link>
          </p>
        </div>
      </div>

      <div className="container-custom max-w-4xl py-10 space-y-10">
        {sections.map((section) => (
          <section key={section.category} aria-labelledby={`badges-${section.category}`}>
            <h2
              id={`badges-${section.category}`}
              className="text-sm font-mono tracking-widest text-neon-cyan uppercase mb-4 flex items-center gap-2"
            >
              <Award className="w-4 h-4" />
              {section.label}
            </h2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {section.badges.map((b) => (
                <li key={b.key}>
                  <Card className="bg-cyber-card/80 p-3 sm:p-4 h-full border border-white/10 hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-3 sm:gap-4 min-h-[6.5rem]">
                      <div className="shrink-0 w-[7.5rem] h-[7.5rem] sm:w-36 sm:h-36">
                        <BadgeIcon def={b} fill showTooltip={false} />
                      </div>
                      <div className="min-w-0 flex-1 py-1">
                        <h3 className="text-sm sm:text-base font-semibold text-white">
                          {b.name}
                        </h3>
                        <p className="text-xs sm:text-sm text-text-secondary mt-1.5 leading-relaxed">
                          {b.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
};

export default Badges;
