const Input = ({ label, className = '', ...props }) => {
    return (
        <div className="space-y-1.5">
            {label && <label className="block text-sm text-text-secondary font-mono">{label}</label>}
            <input
                className={`w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors ${className}`}
                {...props}
            />
        </div>
    );
};

export default Input;