/**
 * Quiet visual-performance path for weak GPUs / software rasterization.
 * Adds `tf-lite-fx` on <html>. No user-facing messaging.
 */

export const LITE_FX_CLASS = 'tf-lite-fx';
export const LITE_FX_STORAGE_KEY = 'tf-lite-fx';

export function prefersReducedMotion() {
  try {
    return Boolean(
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    );
  } catch {
    return false;
  }
}

/** True when WebGL is missing or the browser flags a major GPU caveat (e.g. SwiftShader). */
export function hasMajorGpuCaveat() {
  try {
    const canvas = document.createElement('canvas');
    const opts = { failIfMajorPerformanceCaveat: true };
    const gl =
      canvas.getContext('webgl', opts) ||
      canvas.getContext('experimental-webgl', opts);
    return !gl;
  } catch {
    return true;
  }
}

export function isLiteFxActive() {
  try {
    return document.documentElement.classList.contains(LITE_FX_CLASS);
  } catch {
    return false;
  }
}

export function applyLiteFx(reason = '1') {
  try {
    const root = document.documentElement;
    if (!root.classList.contains(LITE_FX_CLASS)) {
      root.classList.add(LITE_FX_CLASS);
    }
    try {
      sessionStorage.setItem(LITE_FX_STORAGE_KEY, String(reason));
    } catch {
      /* private mode */
    }
  } catch {
    /* ignore */
  }
}

function readCachedLiteFx() {
  try {
    return Boolean(sessionStorage.getItem(LITE_FX_STORAGE_KEY));
  } catch {
    return false;
  }
}

/**
 * Watch a short burst of frames after first paint. Software rasterizers
 * often pass WebGL but still miss vsync; degrade if several frames are slow.
 */
export function watchFrameBudget({
  sampleFrames = 24,
  slowMs = 36,
  slowCount = 4,
  maxMs = 2500,
} = {}) {
  if (typeof window === 'undefined' || isLiteFxActive()) return () => {};

  let samples = 0;
  let slow = 0;
  let last = 0;
  let raf = 0;
  const started = performance.now();

  const tick = (now) => {
    raf = 0;
    if (isLiteFxActive()) return;
    if (samples === 0) {
      last = now;
      samples = 1;
      raf = window.requestAnimationFrame(tick);
      return;
    }
    const dt = now - last;
    last = now;
    samples += 1;
    if (dt > slowMs) slow += 1;
    if (slow >= slowCount) {
      applyLiteFx('frames');
      return;
    }
    if (samples < sampleFrames && now - started < maxMs) {
      raf = window.requestAnimationFrame(tick);
    }
  };

  raf = window.requestAnimationFrame(tick);
  return () => {
    if (raf) window.cancelAnimationFrame(raf);
  };
}

/** Call once at boot (main.jsx). Safe to call more than once. */
export function initVisualPerformance() {
  if (typeof document === 'undefined') return () => {};

  if (readCachedLiteFx() || prefersReducedMotion() || hasMajorGpuCaveat()) {
    applyLiteFx(
      readCachedLiteFx()
        ? 'cached'
        : prefersReducedMotion()
          ? 'motion'
          : 'gpu'
    );
    return () => {};
  }

  return watchFrameBudget();
}

export default initVisualPerformance;
