import Button from './Buttons';
import Badge from './Badge';

/**
 * Compact task card for kanban boards and task lists.
 * Expected task shape: { id, title, description, difficulty, category?, status? }
 */
const TaskCard = ({ task, onClaim, onView }) => {
  const isClaimable = !task.claimedBy && task.status !== 'completed';

  return (
    <div className="task-card cyber-card p-4 border border-cyber-border hover:border-neon-cyan/50 transition-all group">
      <div className="flex justify-between items-start gap-2 mb-2">
        <h4 className="font-medium text-text-primary text-sm leading-snug">
          {task.title}
        </h4>
        {task.difficulty && (
          <Badge variant="default" className="shrink-0">
            {task.difficulty}
          </Badge>
        )}
      </div>

      {task.category && (
        <div className="mb-2">
          <Badge variant="purple" className="!normal-case tracking-wide">
            {task.category}
          </Badge>
        </div>
      )}

      <p className="text-text-secondary text-sm line-clamp-2 mb-4">
        {task.description}
      </p>

      {task.claimedBy && (
        <p className="text-xs font-mono text-neon-cyan/80 mb-3">
          Claimed by {task.claimedBy}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {isClaimable && onClaim && (
          <Button size="sm" onClick={() => onClaim(task.id)}>
            Claim Task
          </Button>
        )}
        {onView && (
          <Button size="sm" variant="secondary" onClick={() => onView(task.id)}>
            View Details
          </Button>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
