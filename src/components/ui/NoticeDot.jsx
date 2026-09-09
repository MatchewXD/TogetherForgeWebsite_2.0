/**
 * Small red unread marker. Use overlap on avatars/cards; inline next to labels.
 */
export default function NoticeDot({
  overlap = false,
  className = '',
  label = 'New notice',
}) {
  const pos = overlap
    ? 'absolute top-0 right-0 z-20 translate-x-[35%] -translate-y-[35%]'
    : 'relative shrink-0';

  return (
    <span
      role="status"
      aria-label={label}
      className={`${pos} w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-cyber-bg pointer-events-none ${className}`}
    />
  );
}
