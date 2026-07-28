/**
 * Branded forge loading state - pure CSS only (no images).
 * Angular tech progress bar + on-brand text.
 *
 * @param {'fullscreen'|'section'|'inline'} [variant]
 * @param {string} [message] - short on-brand label
 * @param {string} [className]
 */

const LoadingScreen = ({
  variant = 'section',
  message = 'Forging…',
  className = '',
}) => {
  const isFullscreen = variant === 'fullscreen';
  const isInline = variant === 'inline';

  const shell = isFullscreen
    ? 'fixed inset-0 z-[100] flex items-center justify-center bg-cyber-bg'
    : isInline
      ? 'relative flex flex-col items-center justify-center py-10 px-4'
      : 'relative flex flex-col items-center justify-center min-h-[16rem] sm:min-h-[20rem] py-16 px-4 bg-cyber-bg/40';

  return (
    <div
      className={`${shell} ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {!isInline && (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(var(--tf-neon-cyan)/0.07)_0%,transparent_55%)]" />
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center text-center max-w-xs w-full">
        {message && (
          <p
            className={`mb-5 font-sans font-semibold uppercase tracking-[0.22em] text-neon-cyan ${
              isInline ? 'text-[10px]' : 'text-xs sm:text-sm'
            }`}
          >
            {message}
          </p>
        )}

        {/* Angular tech progress rail - CSS only */}
        <div
          className={`tf-loader-track w-full max-w-[14rem] ${
            isInline ? 'h-1.5' : 'h-2'
          }`}
          aria-hidden="true"
        >
          <div className="tf-loader-fill" />
          <div className="tf-loader-sheen" />
        </div>

        <span className="sr-only">Loading</span>
      </div>
    </div>
  );
};

export default LoadingScreen;
