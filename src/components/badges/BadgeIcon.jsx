/**
 * Badge icon: custom PNG from public/images/Badges when available,
 * Lucide geometric fallback otherwise. Tooltip on hover / tap.
 */
import { useState, useRef, useEffect } from 'react';
import {
  Heart,
  Sparkles,
  Coins,
  Gem,
  Crown,
  CheckCircle2,
  Flag,
  Rocket,
  Star,
  Ship,
  Lightbulb,
  MessageCircle,
  MessagesSquare,
  Megaphone,
  Trophy,
  Gift,
  Flame,
  Handshake,
  Users,
  Image,
} from 'lucide-react';
import { getBadgeDef, getBadgeImageSrc } from '../../constants/badges';

const ICONS = {
  heart: Heart,
  spark: Sparkles,
  coin: Coins,
  gem: Gem,
  crown: Crown,
  check: CheckCircle2,
  flag: Flag,
  rocket: Rocket,
  star: Star,
  ship: Ship,
  lightbulb: Lightbulb,
  message: MessageCircle,
  messages: MessagesSquare,
  megaphone: Megaphone,
  trophy: Trophy,
  gift: Gift,
  flame: Flame,
  handshake: Handshake,
  users: Users,
  image: Image,
};

const CATEGORY_TONE = {
  status: 'text-neon-cyan',
  donation: 'text-forge-gold',
  tasks: 'text-neon-magenta',
  starter: 'text-neon-green',
  impact: 'text-neon-purple',
  giving: 'text-forge-gold',
  collaboration: 'text-neon-cyan',
};

/**
 * box  = outer hit target
 * icon = lucide size when no art
 * img  = classes for <img> (fill frame; slight scale so padded PNGs read larger)
 */
const SIZES = {
  sm: {
    box: 'w-10 h-10',
    icon: 'w-5 h-5',
    img: 'w-full h-full object-contain scale-[1.15]',
  },
  md: {
    box: 'w-16 h-16',
    icon: 'w-8 h-8',
    img: 'w-full h-full object-contain scale-[1.12]',
  },
  lg: {
    box: 'w-24 h-24',
    icon: 'w-12 h-12',
    img: 'w-full h-full object-contain scale-[1.1]',
  },
  xl: {
    box: 'w-28 h-28 sm:w-32 sm:h-32',
    icon: 'w-14 h-14',
    img: 'w-full h-full object-contain scale-[1.08]',
  },
};

/**
 * @param {{
 *   badgeKey?: string|null,
 *   def?: object|null,
 *   size?: 'sm'|'md'|'lg'|'xl',
 *   className?: string,
 *   showTooltip?: boolean,
 *   fill?: boolean,
 * }} props
 */
export default function BadgeIcon({
  badgeKey = null,
  def: defProp = null,
  size = 'sm',
  className = '',
  showTooltip = true,
  fill = false,
}) {
  const def = defProp || getBadgeDef(badgeKey);
  const [open, setOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const rootRef = useRef(null);

  const imageSrc = def
    ? getBadgeImageSrc(def.key || badgeKey) || def.image || null
    : null;

  useEffect(() => {
    setImgFailed(false);
  }, [imageSrc, def?.key, badgeKey]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);

  if (!def) return null;

  const Icon = ICONS[def.icon] || Star;
  const tone = CATEGORY_TONE[def.category] || CATEGORY_TONE.status;
  const dim = SIZES[size] || SIZES.sm;
  const label = `${def.name}. ${def.description}`;
  const useImage = Boolean(imageSrc) && !imgFailed;

  // Use <button> only when this control is interactive (tooltips on tap).
  // When showTooltip is false the parent often wraps us in its own button
  // (e.g. pin/unpin on Public Profile) — nested <button> is invalid HTML.
  const shellClass = `${
    fill ? 'w-full h-full' : dim.box
  } inline-flex items-center justify-center border-0 bg-transparent overflow-visible outline-none focus-visible:ring-1 focus-visible:ring-neon-cyan/50 ${
    useImage ? '' : tone
  }`;

  const iconContent = useImage ? (
    <img
      src={imageSrc}
      alt=""
      className={
        fill ? 'w-full h-full object-contain scale-110 p-1' : dim.img
      }
      loading="lazy"
      decoding="async"
      onError={() => setImgFailed(true)}
    />
  ) : (
    <Icon
      className={fill ? 'w-12 h-12' : dim.icon}
      strokeWidth={2}
      aria-hidden
    />
  );

  return (
    <span
      ref={rootRef}
      className={`relative inline-flex shrink-0 ${
        fill ? 'w-full h-full' : ''
      } ${className}`}
      onMouseEnter={() => showTooltip && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {showTooltip ? (
        <button
          type="button"
          className={shellClass}
          title={label}
          aria-label={label}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
        >
          {iconContent}
        </button>
      ) : (
        <span className={shellClass} title={label} aria-label={label}>
          {iconContent}
        </span>
      )}
      {showTooltip && open && (
        <span
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[14rem] px-2.5 py-1.5 rounded-lg border border-white/15 bg-cyber-surface/95 text-left shadow-lg pointer-events-none"
        >
          <span className="block text-[11px] font-semibold text-white leading-tight">
            {def.name}
          </span>
          <span className="block text-[10px] text-text-muted mt-0.5 leading-snug">
            {def.description}
          </span>
        </span>
      )}
    </span>
  );
}
