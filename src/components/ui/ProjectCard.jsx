import Button from './Buttons';
import Badge from './Badge';

const ProjectCard = ({ project, onView }) => {
    return (
        <div className="cyber-card group overflow-hidden border border-cyber-border hover:border-neon-cyan transition-all duration-300">
            <div className="h-48 bg-gradient-to-br from-cyber-surface to-cyber-card flex items-center justify-center border-b border-cyber-border">
                {/* Placeholder for project image / screenshot */}
                <div className="text-6xl opacity-20">⚒️</div>
            </div>

            <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-text-primary">{project.title}</h3>
                    <Badge variant="neon">{project.phase}</Badge>
                </div>

                <p className="text-text-secondary text-sm line-clamp-3 mb-4">
                    {project.description}
                </p>

                <div className="flex items-center justify-between text-xs text-text-muted">
                    <span>{project.tasksCompleted || 0} tasks completed</span>
                    <span className="text-neon-cyan">{project.activeVolunteers || 0} active</span>
                </div>

                <Button
                    className="w-full mt-5"
                    onClick={() => onView(project.id)}
                >
                    View Project
                </Button>
            </div>
        </div>
    );
};

export default ProjectCard;