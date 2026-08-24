/**
 * Thin top scroll-progress rail for long pages (esp. Home).
 * Pure CSS width driven by scroll position - minimal, on-brand.
 */

import { useEffect, useRef, useState } from 'react';

const ScrollProgress = ({ className = '' }) => {
  const fillRef = useRef(null);
  const valueRef = useRef(null);

  useEffect(() => {
    let raf = 0;

    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const next = Math.min(1, Math.max(0, scrollTop / max));
      if (fillRef.current) {
        fillRef.current.style.transform = `scaleX(${next})`;
      }
      if (valueRef.current) {
        valueRef.current.setAttribute(
          'aria-valuenow',
          String(Math.round(next * 100))
        );
      }
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
      ref={valueRef}
      className={`tf-scroll-progress ${className}`}
      role="progressbar"
      aria-label="Page scroll progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
    >
      <div
        ref={fillRef}
        className="tf-scroll-progress-fill"
        style={{ transform: 'scaleX(0)' }}
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

/**
 * First-screen “keep going” cue. Pinned to the viewport so a tall hero
 * cannot clip it. A bottom fade plus motion chevrons say the page continues;
 * it hides after the reader starts scrolling.
 */
export function HeroContinueCue({
  targetId = 'mission',
  className = '',
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const threshold = Math.max(48, window.innerHeight * 0.18);
      setVisible(window.scrollY < threshold);
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

  const go = (e) => {
    e.preventDefault();
    document
      .getElementById(targetId)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      className={`tf-hero-continue ${visible ? 'is-visible' : ''} ${className}`}
      aria-hidden={visible ? undefined : true}
    >
      <div className="tf-hero-continue-fade" aria-hidden="true" />
      <a
        href={`#${targetId}`}
        onClick={go}
        className="tf-hero-continue-btn"
        tabIndex={visible ? 0 : -1}
        aria-label="More below. Continue down the page."
      >
        <span className="tf-hero-continue-chevrons" aria-hidden="true">
          <span className="tf-hero-continue-chevron" />
          <span className="tf-hero-continue-chevron" />
        </span>
      </a>
    </div>
  );
}

export default ScrollProgress;
