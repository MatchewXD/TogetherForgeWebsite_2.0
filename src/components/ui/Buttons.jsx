import { forwardRef } from 'react';

/**
 * Button variants.
 * success / danger use semantic tokens (classic ≈ cyan/magenta; forge = green/red).
 */
const Button = forwardRef(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      className = '',
      type = 'button',
      ...props
    },
    ref
  ) => {
    const base =
      'font-sans font-semibold tracking-wide transition-all duration-200 inline-flex items-center justify-center rounded-lg border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-cyber-bg disabled:opacity-50 disabled:pointer-events-none';

    const variants = {
      primary:
        'bg-neon-cyan text-cyber-bg hover:brightness-110 border-neon-cyan shadow-neon-cyan focus:ring-neon-cyan/50',
      secondary:
        'bg-cyber-surface text-text-primary border-cyber-border hover:border-neon-cyan focus:ring-neon-cyan/40',
      outline:
        'border-neon-purple text-neon-purple hover:bg-neon-purple hover:text-cyber-bg focus:ring-neon-purple/40',
      ghost:
        'border-transparent hover:bg-cyber-surface text-text-secondary hover:text-text-primary focus:ring-cyber-border',
      success:
        'bg-semantic-success/15 text-semantic-success border-semantic-success/60 hover:bg-semantic-success/25 focus:ring-semantic-success/40',
      danger:
        'bg-semantic-danger/15 text-semantic-danger border-semantic-danger/60 hover:bg-semantic-danger/25 focus:ring-semantic-danger/40',
      warning:
        'bg-semantic-warning/15 text-semantic-warning border-semantic-warning/60 hover:bg-semantic-warning/25 focus:ring-semantic-warning/40',
      gold:
        'bg-semantic-achievement/15 text-semantic-achievement border-semantic-achievement/60 hover:bg-semantic-achievement/25 focus:ring-semantic-achievement/40',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-5 py-2.5 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    return (
      <button
        ref={ref}
        type={type}
        className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
