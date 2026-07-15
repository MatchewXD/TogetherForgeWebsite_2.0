import { useEffect, useId } from 'react';

/**
 * Centered dialog. Sits above scanline/navbar (z-50) so actions remain clickable.
 */
const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;

    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="presentation"
      onMouseDown={(e) => {
        // Close only when pressing the backdrop itself (not dialog content)
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`cyber-card w-full ${sizeClasses[size] || sizeClasses.md} rounded-2xl border border-neon-cyan/30 shadow-2xl bg-cyber-card pointer-events-auto`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-cyber-border px-6 py-4">
          <h2
            id={titleId}
            className="text-xl font-semibold text-text-primary pr-4"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose?.();
            }}
            className="text-text-muted hover:text-text-primary transition-colors p-1 shrink-0"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
