/**
 * Tech panel card - 45° chamfered frame via .cyber-card CSS.
 *
 * Interior stays a clean dark surface (cyber-card / bg utilities).
 * Cyberpunk treatment is outer shape + thin HUD border only.
 *
 * @param {boolean} [interactive] - hover lift + brighter frame (clickable only)
 * @param {boolean} [glow] - stronger cyan drop-shadow
 * @param {'default'|'panel'|'subtle'} [variant]
 *   default - feature-style cut (14px) + corner ticks
 *   panel   - larger cut / stronger frame (featured, Home, stats)
 *   subtle  - smaller cut, no ticks (dense utility)
 */
const Card = ({
  children,
  className = '',
  glow = false,
  interactive = false,
  variant = 'default',
  ...props
}) => {
  const hoverClass = interactive ? 'interactive cursor-pointer' : '';

  const variantClass =
    variant === 'panel'
      ? 'cyber-card-panel'
      : variant === 'subtle'
        ? 'cyber-card-subtle'
        : '';

  return (
    <div
      className={`cyber-card p-6 ${
        glow ? 'shadow-neon-cyan' : ''
      } ${hoverClass} ${variantClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
