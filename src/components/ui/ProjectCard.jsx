import Button from './Buttons';
import Badge from './Badge';
import { phaseImageSrc, phaseImageAlt } from '../../utils/phaseImages';

/**
 * Featured project card. Entire card is the hit target (hover + click),
 * with a visual CTA button that does not capture separate clicks.
 */
const ProjectCard = ({ project, onView }) => {
  const open = () => {
    if (onView && project?.id != null) onView(project.id);
  };

  const imageSrc =
    project.image || project.imageUrl || phaseImageSrc(project.phase);
  const imageAlt = phaseImageAlt(project.phase, project.title);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      className="cyber-card group overflow-hidden border border-cyber-border hover:border-neon-cyan transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg"
    >
      <div className="h-48 bg-gradient-to-br from-cyber-surface to-cyber-card flex items-center justify-center border-b border-cyber-border overflow-hidden relative">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={imageAlt}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
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
      </div>

      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-semibold text-text-primary group-hover:text-neon-cyan transition-colors">
            {project.title}
          </h3>
          <Badge variant="neon">{project.phase}</Badge>
        </div>

        <p className="text-text-secondary text-sm line-clamp-3 mb-4">
          {project.description}
        </p>

        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>{project.tasksCompleted || 0} tasks completed</span>
          <span className="text-neon-cyan">
            {project.activeVolunteers || 0} active
          </span>
        </div>

        {/* Visual affordance only — card handles navigation */}
        <Button className="w-full mt-5 pointer-events-none" tabIndex={-1}>
          View Project
        </Button>
      </div>
    </div>
  );
};

export default ProjectCard;
