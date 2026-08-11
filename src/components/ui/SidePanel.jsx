import { useEffect, useId, useRef } from 'react';
import { ArrowLeft, X } from 'lucide-react';

/**
 * Right-side workstream panel. Board stays visible on lg+.
 * Primary close control is “Back to Board”; Escape also closes.
 */
const SidePanel = ({
  isOpen,
  onClose,
  title,
  children,
  widthClass = 'max-w-md sm:max-w-lg lg:max-w-xl',
  /** Small label above title */
  eyebrow = 'Workstream',
  /** Label for the primary return action */
  backLabel = 'Back to Board',
  headerExtra = null,
}) => {
  const titleId = useId();
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const wasOpenRef = useRef(false);
  const returnFocusRef = useRef(null);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current && returnFocusRef.current) {
        const el = returnFocusRef.current;
        returnFocusRef.current = null;
        window.setTimeout(() => {
          if (el && typeof el.focus === 'function') {
            try {
              el.focus({ preventScroll: true });
            } catch {
              el.focus?.();
            }
          }
        }, 0);
      }
      wasOpenRef.current = false;
      return undefined;
    }

    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (justOpened) {
      returnFocusRef.current = document.activeElement;
      const t = window.setTimeout(() => {
        closeRef.current?.focus?.();
      }, 0);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[180] bg-black/50 lg:bg-transparent lg:pointer-events-none"
        aria-label={backLabel}
        onClick={() => onClose?.()}
        tabIndex={-1}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`fixed top-20 right-0 bottom-0 z-[190] w-full ${widthClass} flex flex-col border-l border-neon-cyan/35 bg-cyber-card/98 shadow-[-12px_0_40px_rgba(0,0,0,0.45)] backdrop-blur-md`}
        style={{ maxWidth: '100vw' }}
      >
        <div className="shrink-0 border-b border-cyber-border bg-cyber-surface/90">
          <div className="flex items-center gap-2 px-3 sm:px-4 pt-3 pb-2">
            <button
              ref={closeRef}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose?.();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyber-border bg-cyber-card px-3 py-1.5 text-sm font-medium text-neon-cyan hover:bg-neon-cyan/10 hover:border-neon-cyan/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
            >
              <ArrowLeft className="w-4 h-4" />
              {backLabel}
            </button>
            <button
              type="button"
              onClick={() => onClose?.()}
              className="ml-auto shrink-0 rounded-lg p-2 text-text-muted hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
              aria-label={backLabel}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-4 sm:px-5 pb-3.5 min-w-0">
            {eyebrow ? (
              <p className="text-[10px] font-mono tracking-widest text-text-muted uppercase mb-0.5">
                {eyebrow}
              </p>
            ) : null}
            <h2
              id={titleId}
              className="text-lg sm:text-xl font-semibold text-white leading-snug line-clamp-2"
            >
              {title}
            </h2>
            {headerExtra}
          </div>
        </div>

        <div className="task-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 sm:py-5">
          {children}
        </div>
      </aside>
    </>
  );
};

export default SidePanel;
