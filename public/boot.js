/*
 * Pre-paint boot script, loaded synchronously from index.html <head>.
 * Kept as a file (not inline) so the Content-Security-Policy can forbid
 * inline scripts.
 */
(function () {
  /* Forge is the only theme - clear any legacy classic preference */
  try {
    document.documentElement.setAttribute('data-theme', 'forge');
    localStorage.removeItem('tf-color-theme');
  } catch (e) {}

  /*
   * Detect software GL / reduced motion before CSS paint.
   * Adds html.tf-lite-fx only - no user-facing hardware-acceleration copy.
   */
  try {
    if (sessionStorage.getItem('tf-lite-fx')) {
      document.documentElement.classList.add('tf-lite-fx');
      return;
    }
  } catch (e) {}
  try {
    if (
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      document.documentElement.classList.add('tf-lite-fx');
      return;
    }
    var c = document.createElement('canvas');
    var o = { failIfMajorPerformanceCaveat: true };
    if (!(c.getContext('webgl', o) || c.getContext('experimental-webgl', o))) {
      document.documentElement.classList.add('tf-lite-fx');
    }
  } catch (e) {
    document.documentElement.classList.add('tf-lite-fx');
  }
})();
