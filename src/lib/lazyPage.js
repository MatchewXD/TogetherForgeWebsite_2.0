import { lazy } from 'react';

const RELOAD_FLAG = 'tf-chunk-reload';

/**
 * React.lazy for route pages, with one automatic reload when a chunk fails
 * to load. After a new deploy, tabs still open on the old build ask for
 * chunk files that no longer exist; a single reload picks up the new build.
 * The session flag prevents a reload loop when the failure is something else
 * (offline, blocked request), in which case the error boundary takes over.
 *
 * @param {() => Promise<{ default: import('react').ComponentType<any> }>} load
 */
export function lazyPage(load) {
  return lazy(async () => {
    try {
      const mod = await load();
      try {
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        /* storage unavailable */
      }
      return mod;
    } catch (err) {
      let alreadyReloaded = true;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
        if (!alreadyReloaded) sessionStorage.setItem(RELOAD_FLAG, '1');
      } catch {
        /* storage unavailable: do not risk a reload loop */
      }
      if (!alreadyReloaded && typeof window !== 'undefined') {
        window.location.reload();
        // Keep Suspense pending while the page reloads
        return new Promise(() => {});
      }
      throw err;
    }
  });
}
