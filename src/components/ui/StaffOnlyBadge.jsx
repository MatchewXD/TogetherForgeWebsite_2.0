import { useEffect, useId, useRef, useState } from 'react';
import Badge from './Badge';
import { DISCORD_URL } from '../../constants/communityLinks';
import {
  STAFF_CONTACT_EMAIL,
  STAFF_ONLY_TASK_SNIPPET,
} from '../../services/tasksService';

/**
 * Gold Staff Only chip. Hover shows a short preview; click opens the
 * full volunteer note (claim rules + how to reach staff).
 */
const StaffOnlyBadge = ({ compact = false, align = 'end', className = '' }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const tooltipId = useId();
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const badgeClass = compact
    ? '!normal-case tracking-wide !text-[10px] !py-0.5 !px-2 cursor-pointer'
    : '!normal-case tracking-wide cursor-pointer';

  const panelAlign = align === 'start' ? 'left-0' : 'right-0';

  return (
    <span
      ref={wrapRef}
      className={`group relative inline-flex ${className}`.trim()}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-describedby={!open ? tooltipId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
        }}
        className="rounded-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-semantic-achievement/70"
      >
        <Badge variant="gold" className={badgeClass}>
          Staff Only
        </Badge>
      </button>
      {!open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className={`pointer-events-none absolute top-full z-20 mt-1.5 hidden w-56 rounded-md border border-semantic-achievement/35 bg-cyber-surface px-2.5 py-1.5 text-left text-[11px] font-sans font-normal normal-case tracking-normal leading-snug text-text-secondary shadow-lg [@media(hover:hover)]:group-hover:block [@media(hover:hover)]:group-focus-within:block ${panelAlign}`}
        >
          {STAFF_ONLY_TASK_SNIPPET}…
        </span>
      ) : null}
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label="Staff Only details"
          className={`absolute top-full z-30 mt-1.5 w-[min(20.5rem,calc(100vw-3.5rem))] rounded-lg border border-semantic-achievement/30 bg-cyber-surface px-3 py-2.5 text-left shadow-lg ${panelAlign}`}
        >
          <p className="text-sm font-sans font-normal normal-case tracking-normal text-text-secondary leading-relaxed">
            Only staff can claim and complete this task. If your work is waiting
            on it, please be patient. If you need it sooner, email{' '}
            <a
              href={`mailto:${STAFF_CONTACT_EMAIL}`}
              className="text-neon-cyan hover:underline"
            >
              {STAFF_CONTACT_EMAIL}
            </a>{' '}
            or reach us on{' '}
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon-cyan hover:underline"
            >
              Discord
            </a>
            .
          </p>
        </div>
      ) : null}
    </span>
  );
};

export default StaffOnlyBadge;
