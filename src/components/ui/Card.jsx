const Card = ({ children, className = '', glow = false, ...props }) => {
    return (
        <div
            className={`cyber-card border border-cyber-border rounded-xl p-6 transition-all duration-300 
        ${glow ? 'shadow-neon-cyan' : 'hover:border-neon-cyan/50'} ${className}`}
            {...props}
        >
            {children}
        </div>
    );
};

export default Card;