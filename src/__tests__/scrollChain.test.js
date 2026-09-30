import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findInnermostYScroller,
  handleNestedWheel,
  installScrollChain,
  isNestedYScrollable,
  isScrollChainLocked,
  normalizeWheelDeltaY,
  resetScrollChain,
  trapsOverscroll,
} from '../utils/scrollChain';

function mockBox(el, { height, scroll, top = 0, contain = false }) {
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    get: () => height,
  });
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get: () => scroll,
  });
  el.scrollTop = top;
  el.style.overflowY = 'auto';
  el.style.overscrollBehaviorY = contain ? 'contain' : 'auto';
  return el;
}

function wheelOn(target, deltaY) {
  const event = new WheelEvent('wheel', {
    deltaY,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, 'target', { value: target });
  return handleNestedWheel(event);
}

describe('scrollChain', () => {
  let inner;
  let outer;
  let uninstall;

  beforeEach(() => {
    outer = mockBox(document.createElement('div'), {
      height: 200,
      scroll: 800,
      top: 0,
    });
    inner = mockBox(document.createElement('div'), {
      height: 100,
      scroll: 400,
      top: 0,
    });
    outer.appendChild(inner);
    document.body.appendChild(outer);
    uninstall = installScrollChain();
  });

  afterEach(() => {
    uninstall?.();
    resetScrollChain();
    inner?.remove();
    outer?.remove();
    vi.restoreAllMocks();
  });

  it('normalizes line-mode wheel deltas to pixels', () => {
    expect(normalizeWheelDeltaY({ deltaY: 3, deltaMode: 1 })).toBe(48);
  });

  it('detects nested overflow boxes and overscroll traps', () => {
    expect(isNestedYScrollable(inner)).toBe(true);
    expect(trapsOverscroll(inner)).toBe(false);
    inner.style.overscrollBehaviorY = 'contain';
    expect(trapsOverscroll(inner)).toBe(true);
  });

  it('finds the innermost scroller from a child target', () => {
    const child = document.createElement('p');
    inner.appendChild(child);
    expect(findInnermostYScroller(child)).toBe(inner);
  });

  it('locks a card at the bottom so leftover wheel can reach the page', () => {
    inner.remove();
    document.body.appendChild(inner);
    inner.scrollTop = 300;
    expect(wheelOn(inner, 80)).toBe(true);
    expect(isScrollChainLocked(inner)).toBe(true);
    expect(inner.style.overflowY).toBe('hidden');
  });

  it('locks a card at the top when scrolling up', () => {
    inner.remove();
    document.body.appendChild(inner);
    inner.scrollTop = 0;
    expect(wheelOn(inner, -40)).toBe(true);
    expect(isScrollChainLocked(inner)).toBe(true);
  });

  it('leaves mid-card scrolling on the card', () => {
    inner.scrollTop = 50;
    expect(wheelOn(inner, 40)).toBe(false);
    expect(isScrollChainLocked(inner)).toBe(false);
    expect(inner.style.overflowY).toBe('auto');
  });

  it('does not lock overlay scrollers that use overscroll-contain', () => {
    inner.style.overscrollBehaviorY = 'contain';
    inner.scrollTop = 300;
    expect(wheelOn(inner, 80)).toBe(false);
    expect(isScrollChainLocked(inner)).toBe(false);
    expect(inner.style.overflowY).toBe('auto');
  });

  it('locks only the inner list when the parent card can still scroll', () => {
    inner.scrollTop = 300;
    outer.scrollTop = 10;
    expect(wheelOn(inner, 50)).toBe(true);
    expect(isScrollChainLocked(inner)).toBe(true);
    expect(isScrollChainLocked(outer)).toBe(false);
    expect(outer.style.overflowY).toBe('auto');
  });

  it('unlocks the card when the user scrolls back into it', () => {
    inner.remove();
    document.body.appendChild(inner);
    inner.scrollTop = 300;
    wheelOn(inner, 80);
    expect(isScrollChainLocked(inner)).toBe(true);
    wheelOn(inner, -40);
    expect(isScrollChainLocked(inner)).toBe(false);
    expect(inner.style.overflowY).toBe('auto');
  });

  it('keeps the card locked across leftover wheel ticks so the scrollbar does not flash', () => {
    inner.remove();
    document.body.appendChild(inner);
    inner.scrollTop = 300;
    wheelOn(inner, 80);
    expect(inner.style.overflowY).toBe('hidden');
    wheelOn(inner, 80);
    wheelOn(inner, 120);
    expect(isScrollChainLocked(inner)).toBe(true);
    expect(inner.style.overflowY).toBe('hidden');
  });

  it('locks after a card-scroll tick lands on the bottom', async () => {
    inner.remove();
    document.body.appendChild(inner);
    inner.scrollTop = 250;
    expect(wheelOn(inner, 80)).toBe(false);
    expect(isScrollChainLocked(inner)).toBe(false);
    inner.scrollTop = 300;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(isScrollChainLocked(inner)).toBe(true);
  });
});

