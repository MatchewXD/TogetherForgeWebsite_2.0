/**
 * Status / label chips.
 * Semantic variants remap by theme (classic stays cyan/magenta; forge uses green/amber/red/gold).
 */
const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default:
      'bg-cyber-surface text-text-secondary border border-cyber-border',
    neon: 'bg-neon-cyan text-cyber-bg border-neon-cyan shadow-neon-cyan',
    purple: 'bg-neon-purple text-white border-neon-purple',
    // Semantic roles
    success:
      'bg-semantic-success/15 text-semantic-success border border-semantic-success/50',
    warning:
      'bg-semantic-warning/15 text-semantic-warning border border-semantic-warning/50',
    danger:
      'bg-semantic-danger/15 text-semantic-danger border border-semantic-danger/50',
    gold: 'bg-semantic-achievement/15 text-semantic-achievement border border-semantic-achievement/50',
    achievement:
      'bg-semantic-achievement/15 text-semantic-achievement border border-semantic-achievement/50',
  };

  const resolved = variants[variant] || variants.default;

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-sans font-semibold uppercase tracking-widest border ${resolved} ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;
