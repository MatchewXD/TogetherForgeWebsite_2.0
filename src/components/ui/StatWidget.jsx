const StatWidget = ({ label, value, suffix = '', icon }) => {
    return (
        <div className="cyber-card p-5 text-center border border-cyber-border hover:border-neon-cyan transition-colors">
            {icon && <div className="text-3xl mb-3 opacity-75">{icon}</div>}
            <div className="text-4xl font-mono font-bold text-neon-cyan mb-1">
                {value}{suffix}
            </div>
            <div className="text-sm uppercase tracking-widest text-text-muted font-mono">
                {label}
            </div>
        </div>
    );
};

export default StatWidget;