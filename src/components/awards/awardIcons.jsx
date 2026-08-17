import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Hammer, Crown, Hexagon } from 'lucide-react';

const AWARD_ICON_SRC = {
  spark: '/images/spot_illustrations/Awards/Spark.png',
  hammer: '/images/spot_illustrations/Awards/Hammer.png',
  anvil: '/images/spot_illustrations/Awards/Anvil.png',
  masterwork: '/images/spot_illustrations/Awards/Masterwork.png',
};

export function awardIconSrc(tierId) {
  return AWARD_ICON_SRC[String(tierId || '').toLowerCase()] || null;
}

export function AwardTierIcon({
  tierId,
  className = 'w-5 h-5',
  alt = '',
}) {
  const id = String(tierId || '').toLowerCase();
  const src = awardIconSrc(id);
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`object-contain ${className}`}
        draggable={false}
      />
    );
  }
  if (id === 'hammer') return <Hammer className={className} aria-hidden />;
  if (id === 'anvil') return <Hexagon className={className} aria-hidden />;
  if (id === 'masterwork') return <Crown className={className} aria-hidden />;
  return <Sparkles className={className} aria-hidden />;
}

/**
 * Icon-only award with hover/focus name. Portaled so card clip-path cannot crop it.
 */
export function AwardTierIconTip({
  tierId,
  name,
  count = 1,
  className = 'w-6 h-6',
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const tipId = useId();
  const rootRef = useRef(null);
  const label = count > 1 ? `${name} ×${count}` : name;

  useEffect(() => {
    if (!open || !rootRef.current) {
      setCoords(null);
      return undefined;
    }
    const place = () => {
      const r = rootRef.current.getBoundingClientRect();
      setCoords({
        left: r.left + r.width / 2,
        top: r.top - 8,
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
    <span ref={rootRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        className="relative inline-flex items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-forge-gold/50"
        aria-label={label}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <AwardTierIcon tierId={tierId} className={className} alt="" />
        {count > 1 && (
          <span className="absolute -right-1 -bottom-0.5 min-w-[0.9rem] rounded-full bg-cyber-bg/90 px-0.5 text-[9px] font-mono tabular-nums text-forge-gold leading-none">
            {count}
          </span>
        )}
      </button>
      {open &&
        coords &&
        createPortal(
          <span
            id={tipId}
            role="tooltip"
            className="fixed z-[200] px-2 py-1 rounded-md border border-white/15 bg-cyber-bg text-[12px] font-semibold text-white shadow-lg pointer-events-none whitespace-nowrap"
            style={{
              left: coords.left,
              top: coords.top,
              transform: 'translate(-50%, -100%)',
            }}
          >
            {label}
          </span>,
          document.body
        )}
    </span>
  );
}
