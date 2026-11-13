/**
 * Moderator Dashboard: attention mark + count shown on tab buttons.
 */

import StaffNoticeMark from '../../components/ui/StaffNoticeMark';

export default function QueueMark({ count, className, label }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-1.5 ml-1">
      <StaffNoticeMark label={label || `${count} need attention`} />
      <span
        className={`text-xs font-mono tabular-nums px-1.5 py-0.5 rounded ${className}`}
      >
        {count}
      </span>
    </span>
  );
}
