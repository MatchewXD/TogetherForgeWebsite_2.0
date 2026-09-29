/**
 * Circle-i control. Hover or focus shows the explanation; click pins it
 * for touch. Portaled so modal overflow and cyber-card clip-path cannot
 * crop the tooltip.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

export default function InfoHoverTip({
  label = 'More information',
  children,
  className = '',
}) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [coords, setCoords] = useState(null);
  const tipId = useId();
  const rootRef = useRef(null);
  const open = pinned || hovered;

  useEffect(() => {
    if (!open || !rootRef.current) {
      setCoords(null);
      return undefined;
    }

    const place = () => {
      if (!rootRef.current) return;
      const r = rootRef.current.getBoundingClientRect();
      const gap = 8;
      const preferAbove = r.top > 120;
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

  useEffect(() => {
    if (!pinned) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setPinned(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pinned]);

  return (
    <span ref={rootRef} className={`inline-flex ${className}`.trim()}>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-full p-0.5 text-text-muted hover:text-neon-cyan focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/60"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPinned((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && (pinned || hovered)) {
            e.preventDefault();
            e.stopPropagation();
            setPinned(false);
            setHovered(false);
          }
        }}
      >
        <Info className="w-4 h-4" aria-hidden />
      </button>
      {open &&
        coords &&
        createPortal(
          <span
            id={tipId}
            role="tooltip"
            className="fixed z-[300] w-max max-w-[min(22rem,calc(100vw-1.5rem))] px-3 py-2 rounded-lg border border-white/15 bg-cyber-bg text-left shadow-lg pointer-events-none"
            style={{
              left: coords.left,
              top: coords.top,
              transform: coords.placeAbove
                ? 'translate(-50%, -100%)'
                : 'translate(-50%, 0)',
            }}
          >
            <span className="block text-xs text-text-secondary leading-relaxed">
              {children}
            </span>
          </span>,
          document.body
        )}
    </span>
  );
}
