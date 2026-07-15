/**
 * Static surface by default. Pass interactive (or glow) for hover affordance.
 * Also add class "interactive" when using raw .cyber-card for clickable tiles.
 */
const Card = ({
  children,
  className = '',
  glow = false,
  interactive = false,
  ...props
}) => {
  const hoverClass = interactive
    ? 'interactive hover:border-neon-cyan/50 cursor-pointer'
    : '';

  return (
    <div
      className={`cyber-card border border-cyber-border rounded-xl p-6 transition-all duration-300 ${
        glow ? 'shadow-neon-cyan' : ''
      } ${hoverClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
