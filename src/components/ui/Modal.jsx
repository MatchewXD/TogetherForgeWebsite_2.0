import { useEffect } from 'react';

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl'
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className={`cyber-card w-full ${sizeClasses[size]} mx-4 rounded-2xl border border-neon-cyan/30 shadow-2xl`}>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-cyber-border px-6 py-4">
                    <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
                    <button
                        onClick={onClose}
                        className="text-text-muted hover:text-text-primary transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;