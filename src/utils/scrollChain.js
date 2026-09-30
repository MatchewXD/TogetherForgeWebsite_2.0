/**
 * Nested overflow cards should hand leftover wheel motion to the page
 * once they hit the top or bottom.
 *
 * Chromium latches a wheel gesture to the first scroller it hits. Changing
 * overflow mid-flick does not unlatch, and a short unlock timeout lets the
 * card become a scroller again between mouse notches — the scrollbar
 * flashes and the page does not move.
 *
 * When a card reaches its edge, keep it from being a scroll container until
 * the user scrolls back into it or the gesture has been idle. The next
 * wheel then latches to the page at native speed.
 *
 * Overlays with Tailwind `overscroll-contain` / `overscroll-none`
 * (modals, side panels) stay trapped.
 */

const Y_OVERFLOW = new Set(['auto', 'scroll', 'overlay']);
const LOCK_ATTR = 'data-tf-scroll-chain';
const OVERFLOW_ATTR = 'data-tf-scroll-chain-overflow';
/** Longer than a slow mouse-wheel gap so the card stays out of the way. */
export const SCROLL_CHAIN_RESTORE_MS = 1200;

const locked = new Set();
const restoreTimers = new Map();

export function normalizeWheelDeltaY(event) {
  let dy = Number(event?.deltaY) || 0;
  const mode = Number(event?.deltaMode) || 0;
  if (mode === 1) dy *= 16;
  else if (mode === 2) {
    dy *= typeof window !== 'undefined' ? window.innerHeight || 800 : 800;
  }
  return dy;
}

function isElement(node) {
  return Boolean(node) && node.nodeType === 1;
}

export function isNestedYScrollable(el, getStyle = getComputedStyle) {
  if (!isElement(el)) return false;
  if (el === document.documentElement || el === document.body) return false;
  const overflowY = getStyle(el).overflowY;
  if (!Y_OVERFLOW.has(overflowY)) return false;
  return el.scrollHeight > el.clientHeight + 1;
}

export function trapsOverscroll(el, getStyle = getComputedStyle) {
  if (!isElement(el)) return false;
  const style = getStyle(el);
  const value = `${style.overscrollBehaviorY || ''} ${
    style.overscrollBehavior || ''
  }`.toLowerCase();
  return value.includes('contain') || value.includes('none');
}

function startNodeFromEvent(event) {
  const t = event?.target;
  if (!t) return null;
  if (isElement(t)) return t;
  return t.parentElement || null;
}

export function isScrollChainLocked(el) {
  return isElement(el) && el.getAttribute(LOCK_ATTR) === '1';
}

function isChainScroller(el, getStyle = getComputedStyle) {
  return isScrollChainLocked(el) || isNestedYScrollable(el, getStyle);
}

export function findInnermostYScroller(start, getStyle = getComputedStyle) {
  let el = isElement(start) ? start : start?.parentElement || null;
  while (el && el !== document.documentElement && el !== document.body) {
    if (isChainScroller(el, getStyle)) return el;
    el = el.parentElement;
  }
  return null;
}

function canScrollY(el, dy) {
  const top = el.scrollTop;
  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  if (dy < 0) return top > 0.5;
  if (dy > 0) return top < max - 0.5;
  return false;
}

function isPointerOver(el, event) {
  if (!isElement(el) || event?.clientX == null || event?.clientY == null) {
    return false;
  }
  const r = el.getBoundingClientRect();
  return (
    event.clientX >= r.left &&
    event.clientX <= r.right &&
    event.clientY >= r.top &&
    event.clientY <= r.bottom
  );
}

function lockScroller(el) {
  if (!isElement(el) || isScrollChainLocked(el)) return false;
  el.setAttribute(LOCK_ATTR, '1');
  el.setAttribute(OVERFLOW_ATTR, el.style.overflowY || '');
  el.style.overflowY = 'hidden';
  locked.add(el);
  return true;
}

function unlockScroller(el) {
  if (!isElement(el) || !isScrollChainLocked(el)) return;
  const prev = restoreTimers.get(el);
  if (prev) {
    clearTimeout(prev);
    restoreTimers.delete(el);
  }
  el.style.overflowY = el.getAttribute(OVERFLOW_ATTR) || '';
  el.removeAttribute(LOCK_ATTR);
  el.removeAttribute(OVERFLOW_ATTR);
  locked.delete(el);
}

function scheduleUnlock(el) {
  const prev = restoreTimers.get(el);
  if (prev) clearTimeout(prev);
  restoreTimers.set(
    el,
    setTimeout(() => {
      restoreTimers.delete(el);
      unlockScroller(el);
    }, SCROLL_CHAIN_RESTORE_MS)
  );
}

function lockEdgeAncestors(start, dy, getStyle) {
  let el = isElement(start) ? start : start?.parentElement || null;
  let lockedAny = false;
  while (el && el !== document.body && el !== document.documentElement) {
    if (isChainScroller(el, getStyle)) {
      if (trapsOverscroll(el, getStyle)) return lockedAny;
      if (canScrollY(el, dy)) {
        unlockScroller(el);
        return lockedAny;
      }
      lockScroller(el);
      scheduleUnlock(el);
      lockedAny = true;
    }
    el = el.parentElement;
  }
  return lockedAny;
}

function refreshLocksUnderPointer(event, dy) {
  let held = false;
  for (const el of [...locked]) {
    const over =
      isPointerOver(el, event) || el.contains(startNodeFromEvent(event));
    if (!over) continue;
    if (canScrollY(el, dy)) {
      unlockScroller(el);
      continue;
    }
    scheduleUnlock(el);
    held = true;
  }
  return held;
}

function scheduleLockIfAtEdge(scroller, dy, getStyle) {
  if (typeof requestAnimationFrame !== 'function') return;
  requestAnimationFrame(() => {
    if (!scroller.isConnected) return;
    if (trapsOverscroll(scroller, getStyle)) return;
    if (canScrollY(scroller, dy)) return;
    lockScroller(scroller);
    scheduleUnlock(scroller);
  });
}

/**
 * At a nested card's scroll edge, keep it from capturing the next wheel
 * so the page can scroll at native speed.
 * @returns {boolean} true when a card is locked out of the way
 */
export function handleNestedWheel(event, getStyle = getComputedStyle) {
  if (!event || event.ctrlKey) return false;
  if (Math.abs(event.deltaX || 0) > Math.abs(event.deltaY || 0)) return false;

  const dy = normalizeWheelDeltaY(event);
  if (dy === 0) return false;

  const start = startNodeFromEvent(event);
  const held = refreshLocksUnderPointer(event, dy);

  const scroller = findInnermostYScroller(start, getStyle);
  if (scroller && trapsOverscroll(scroller, getStyle)) return false;

  if (scroller && canScrollY(scroller, dy)) {
    scheduleLockIfAtEdge(scroller, dy, getStyle);
    return false;
  }

  if (scroller) {
    return lockEdgeAncestors(start, dy, getStyle) || held;
  }
  return held;
}

export function resetScrollChain() {
  for (const el of [...locked]) {
    unlockScroller(el);
  }
  locked.clear();
  for (const t of restoreTimers.values()) clearTimeout(t);
  restoreTimers.clear();
}

export function installScrollChain(root = document) {
  if (!root?.addEventListener) return () => {};
  const onWheel = (event) => {
    handleNestedWheel(event);
  };
  root.addEventListener('wheel', onWheel, { passive: true, capture: true });
  return () => {
    root.removeEventListener('wheel', onWheel, { capture: true });
    resetScrollChain();
  };
}
