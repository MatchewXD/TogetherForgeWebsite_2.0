/**
 * Colored category chip for task cards, filters, and detail views.
 * Always shows the text label; color is a secondary cue.
 */

import { getTaskCategoryStyle } from '../../constants/taskCategories';

const TaskCategoryBadge = ({
  category,
  className = '',
  /** Show a small color swatch before the label */
  showSwatch = true,
  size = 'md',
}) => {
  if (!category) return null;
  const style = getTaskCategoryStyle(category);
  const sizeClass =
    size === 'sm'
      ? 'px-2 py-0.5 text-[10px] gap-1'
      : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center max-w-full rounded-full border font-sans font-semibold !normal-case tracking-wide ${sizeClass} ${style.badge} ${className}`}
      title={String(category)}
    >
      {showSwatch && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.swatch}`}
          aria-hidden
        />
      )}
      <span className="truncate">{category}</span>
    </span>
  );
};

export default TaskCategoryBadge;
