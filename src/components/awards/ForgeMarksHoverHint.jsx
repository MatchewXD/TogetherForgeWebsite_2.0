/**
 * Hover / focus explanation for Forge Marks.
 * Portaled so cyber-card clip-path cannot crop it.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FORGE_MARKS_HOVER_HINT } from '../../utils/forgeMarks';

export default function ForgeMarksHoverHint({
  children,
  className = '',
  hint = FORGE_MARKS_HOVER_HINT,
  align = 'center',
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const tipId = useId();
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open || !rootRef.current) {
      setCoords(null);
      return undefined;
    }

    const place = () => {
      const r = rootRef.current.getBoundingClientRect();
      const gap = 8;
      const preferAbove = r.top > 88;
      setCoords({
        left: r.left + r.width / 2,
        top: preferAbove ? r.top - gap : r.bottom + gap,
        placeAbove: preferAbove,
      });
    };

    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={`inline-flex ${className}`}>
      <button
        type="button"
        className={`w-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-forge-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cyber-bg ${
          align === 'start' ? 'text-left' : 'text-center'
        }`}
        aria-label={hint}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </button>
      {open &&
        coords &&
        createPortal(
          <span
            id={tipId}
            role="tooltip"
            className="fixed z-[300] w-max max-w-[18rem] px-2.5 py-1.5 rounded-lg border border-white/15 bg-cyber-bg text-left shadow-lg pointer-events-none"
            style={{
              left: coords.left,
              top: coords.top,
              transform: coords.placeAbove
                ? 'translate(-50%, -100%)'
                : 'translate(-50%, 0)',
            }}
          >
            <span className="block text-xs font-semibold text-white leading-tight">
              Forge Marks
            </span>
            <span className="block text-xs text-text-muted mt-0.5 leading-snug">
              {hint}
            </span>
          </span>,
          document.body
        )}
    </span>
  );
}
