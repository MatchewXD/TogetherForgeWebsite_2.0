import { forwardRef } from 'react';

const Button = forwardRef(({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}, ref) => {
  const base = "font-medium transition-all duration-200 inline-flex items-center justify-center rounded-lg border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-cyber-bg";

  const variants = {
    primary: "bg-neon-cyan text-cyber-bg hover:bg-cyan-400 border-neon-cyan shadow-neon-cyan",
    secondary: "bg-cyber-surface text-text-primary border-cyber-border hover:border-neon-cyan",
    outline: "border-neon-purple text-neon-purple hover:bg-neon-purple hover:text-cyber-bg",
    ghost: "border-transparent hover:bg-cyber-surface text-text-secondary hover:text-text-primary"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-base",
    lg: "px-6 py-3 text-lg"
  };

  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

export default Button;