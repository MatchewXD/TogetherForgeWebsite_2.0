const Badge = ({ children, variant = 'default', className = '' }) => {
    const variants = {
        default: "bg-cyber-surface text-text-secondary border border-cyber-border",
        neon: "bg-neon-cyan text-cyber-bg border-neon-cyan shadow-neon-cyan",
        purple: "bg-neon-purple text-white border-neon-purple",
    };

    return (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-mono uppercase tracking-widest border ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
};

export default Badge;