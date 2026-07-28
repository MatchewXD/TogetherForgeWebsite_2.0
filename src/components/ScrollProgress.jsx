/**
 * Thin top scroll-progress rail for long pages (esp. Home).
 * Pure CSS width driven by scroll position - minimal, on-brand.
 */

import { useEffect, useState } from 'react';

const ScrollProgress = ({ className = '' }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;

    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const next = Math.min(1, Math.max(0, scrollTop / max));
      setProgress(next);
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      className={`tf-scroll-progress ${className}`}
      role="progressbar"
      aria-label="Page scroll progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      <div
        className="tf-scroll-progress-fill"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
};

/**
 * Quiet cue at the end of a major section - page continues below.
 * Decorative only; hide near page bottom via parent placement.
 */
export const SectionContinueCue = ({ className = '' }) => (
  <div
    className={`tf-section-continue ${className}`}
    aria-hidden="true"
  >
    <div className="tf-section-continue-line" />
    <div className="tf-section-continue-mark" />
  </div>
);

export default ScrollProgress;
