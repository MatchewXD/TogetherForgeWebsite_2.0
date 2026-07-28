import Button from './Buttons';
import Badge from './Badge';
import { phaseImageSrc, phaseImageAlt } from '../../utils/phaseImages';

/**
 * Project card. Tech-panel frame via .cyber-card.
 * Active projects link to a live workspace; planned phases show summary only.
 *
 * @param {object} project
 * @param {'active'|'planned'} [project.status] - active = open workspace; planned = future phase
 * @param {boolean} [featured] - heavier recognition treatment (gold under Forge)
 * @param {function} [onView] - called with project when card is activated (active / planned with href)
 * @param {string} [className]
 */
const ProjectCard = ({ project, onView, featured = false, className = '' }) => {
  const status =
    project.status ||
    (project.phase === 'Early' ? 'active' : 'planned');
  const isActive = status === 'active';
  const isPlanned = !isActive;

  const hasLiveStats =
    isActive &&
    (typeof project.tasksCompleted === 'number' ||
      typeof project.activeVolunteers === 'number');

  const ctaLabel = isActive
    ? project.ctaLabel || 'View Project'
    : project.ctaLabel || 'View Plans';

  const canActivate = Boolean(onView && project?.id != null);

  const open = () => {
    if (canActivate) onView(project);
  };

  const imageSrc =
    project.image || project.imageUrl || phaseImageSrc(project.phase);
  const imageAlt = phaseImageAlt(project.phase, project.title);

  return (
    <div
      role={canActivate ? 'link' : 'article'}
      tabIndex={canActivate ? 0 : undefined}
      onClick={canActivate ? open : undefined}
      onKeyDown={
        canActivate
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
              }
            }
          : undefined
      }
      className={`cyber-card group overflow-hidden flex flex-col h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg ${
        canActivate ? 'interactive cursor-pointer' : ''
      } ${featured ? 'cyber-card-panel home-project-featured' : ''} ${className}`}
    >
      <div className="h-40 sm:h-44 shrink-0 bg-gradient-to-br from-cyber-surface to-cyber-card flex items-center justify-center border-b border-cyber-border overflow-hidden relative">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={imageAlt}
            className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${
              canActivate ? 'group-hover:scale-[1.03]' : ''
            }`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="text-6xl opacity-20">⚒️</div>
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-cyber-card/80 via-transparent to-transparent pointer-events-none"
          aria-hidden="true"
        />
        <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2">
          {featured && isActive && <Badge variant="gold">Featured</Badge>}
          {isPlanned && <Badge variant="default">Coming Soon</Badge>}
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1 min-h-0">
        <div className="flex justify-between items-start mb-3 gap-2">
          <h3
            className={`text-lg font-semibold transition-colors ${
              featured && isActive
                ? 'text-text-primary group-hover:text-neon-purple'
                : canActivate
                  ? 'text-text-primary group-hover:text-neon-cyan'
                  : 'text-text-primary'
            }`}
          >
            {project.title}
          </h3>
          <Badge variant={featured && isActive ? 'gold' : 'neon'}>
            {project.phase}
          </Badge>
        </div>

        <p className="text-text-secondary text-sm line-clamp-3 mb-4 flex-1">
          {project.description}
        </p>

        {hasLiveStats ? (
          <div className="flex items-center justify-between text-xs text-text-muted mb-4">
            <span>
              <span className="text-semantic-success font-mono">
                {project.tasksCompleted ?? 0}
              </span>{' '}
              completed
            </span>
            <span className="text-neon-cyan font-mono">
              {project.activeVolunteers ?? 0} active
            </span>
          </div>
        ) : isPlanned ? (
          <div className="mb-4 text-xs font-mono tracking-wide text-text-muted">
            <span className="text-neon-purple/90">Planned phase</span>
            <span className="text-text-muted">
              {' '}
              ·{' '}
              {project.statusNote ||
                (project.phase === 'Late'
                  ? 'after Mid is completed'
                  : project.phase === 'Mid'
                    ? 'after Early is completed'
                    : 'upcoming')}
            </span>
          </div>
        ) : (
          <div className="mb-4" aria-hidden="true" />
        )}

        <Button
          className="w-full pointer-events-none mt-auto"
          tabIndex={-1}
          variant={featured && isActive ? 'gold' : isPlanned ? 'secondary' : 'primary'}
        >
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
};

export default ProjectCard;
