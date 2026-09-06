import { Children } from 'react';

/**
 * Gold-framed staff-only action strip.
 * Keeps volunteer UI (claim / view) uncluttered; staff tools sit apart and labeled.
 */
const StaffToolsBar = ({ children, className = '', compact = false }) => {
  const items = Children.toArray(children).filter(Boolean);
  if (!items.length) return null;

  return (
    <div
      className={`rounded-lg border border-semantic-achievement/40 bg-semantic-achievement/[0.08] ${
        compact ? 'px-2 py-1.5' : 'px-3 py-2'
      } ${className}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="text-[10px] font-mono tracking-[0.16em] uppercase text-semantic-achievement shrink-0">
          Staff
        </span>
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {items}
        </div>
      </div>
    </div>
  );
};

export default StaffToolsBar;
