import { Link } from 'react-router-dom';

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
 * @param {string} [to] - in-app path; renders as Link so middle-click opens a tab
 * @param {string} [href] - external URL; renders as <a>
 */
const Card = ({
  children,
  className = '',
  glow = false,
  interactive = false,
  variant = 'default',
  to,
  href,
  target,
  rel,
  ...props
}) => {
  const hoverClass = interactive || to || href ? 'interactive cursor-pointer' : '';

  const variantClass =
    variant === 'panel'
      ? 'cyber-card-panel'
      : variant === 'subtle'
        ? 'cyber-card-subtle'
        : '';

  const classes = `cyber-card p-6 ${
    glow ? 'shadow-neon-cyan' : ''
  } ${hoverClass} ${variantClass} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a
        href={href}
        className={classes}
        target={target}
        rel={
          rel || (target === '_blank' ? 'noopener noreferrer' : undefined)
        }
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};

export default Card;
