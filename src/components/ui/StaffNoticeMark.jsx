/**
 * Moderator queue marker. Amber square + shield so it is not mistaken
 * for a member inbox NoticeDot (red circle).
 */
import { Shield } from 'lucide-react';

export default function StaffNoticeMark({
  overlap = false,
  className = '',
  label = 'Moderator queue needs attention',
}) {
  const pos = overlap
    ? 'absolute top-0 right-0 z-20 translate-x-[35%] -translate-y-[35%]'
    : 'relative shrink-0';

  return (
    <span
      role="status"
      aria-label={label}
      className={`${pos} inline-flex items-center justify-center w-4 h-4 rounded-[4px] bg-semantic-warning text-cyber-bg ring-2 ring-cyber-bg pointer-events-none ${className}`}
    >
      <Shield className="w-2.5 h-2.5" strokeWidth={2.75} aria-hidden />
    </span>
  );
}
