import { useEffect, useId, useRef } from 'react';

/**
 * Centered dialog. Sits above scanline/navbar so actions remain clickable.
 * Escape closes; initial focus moves to the close control only when opening
 * (not on every parent re-render / onClose identity change).
 */
const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const titleId = useId();
  const closeRef = useRef(null);
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const wasOpenRef = useRef(false);
  onCloseRef.current = onClose;

  // Body scroll lock + focus close only on open transition
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      document.body.style.overflow = 'unset';
      return undefined;
    }

    document.body.style.overflow = 'hidden';

    // Only steal focus when the modal first opens, never while typing in fields
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    let t;
    if (justOpened) {
      t = window.setTimeout(() => {
        // Prefer first text field if present; else close button
        const firstField = panelRef.current?.querySelector(
          'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
        );
        if (firstField && typeof firstField.focus === 'function') {
          firstField.focus();
        } else {
          closeRef.current?.focus?.();
        }
      }, 0);
    }

    return () => {
      if (t) window.clearTimeout(t);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Key handlers: keep latest onClose via ref so identity changes do not rebind focus
  useEffect(() => {
    if (!isOpen) return undefined;

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      // Simple focus trap within the dialog panel
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      const list = [...focusable].filter(
        (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
      );
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

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
        ref={panelRef}
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
            ref={closeRef}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose?.();
            }}
            className="text-text-muted hover:text-text-primary transition-colors p-1 shrink-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
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
