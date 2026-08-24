import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LITE_FX_CLASS,
  LITE_FX_STORAGE_KEY,
  applyLiteFx,
  hasMajorGpuCaveat,
  prefersReducedMotion,
} from '../lib/visualPerformance';
import { compactBannerSrc } from '../components/ui/BannerImage';

describe('visualPerformance', () => {
  afterEach(() => {
    document.documentElement.classList.remove(LITE_FX_CLASS);
    try {
      sessionStorage.removeItem(LITE_FX_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    vi.restoreAllMocks();
  });

  it('treats missing WebGL as a GPU caveat', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(hasMajorGpuCaveat()).toBe(true);
  });

  it('treats a successful WebGL context as capable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
    expect(hasMajorGpuCaveat()).toBe(false);
  });

  it('reads prefers-reduced-motion', () => {
    window.matchMedia = vi.fn((query) => ({
      matches: String(query).includes('prefers-reduced-motion'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    expect(prefersReducedMotion()).toBe(true);
  });

  it('applies tf-lite-fx without user-facing copy', () => {
    applyLiteFx('gpu');
    expect(document.documentElement.classList.contains(LITE_FX_CLASS)).toBe(
      true
    );
    expect(sessionStorage.getItem(LITE_FX_STORAGE_KEY)).toBe('gpu');
    expect(document.body.textContent || '').not.toMatch(/hardware acceleration/i);
  });
});

describe('compactBannerSrc', () => {
  it('derives a 960w companion for webp banners', () => {
    expect(compactBannerSrc('/images/Hero_Background.webp')).toBe(
      '/images/Hero_Background-960.webp'
    );
  });

  it('leaves non-webp paths alone', () => {
    expect(compactBannerSrc('/images/TF_Logo_Ideas_V2.png')).toBeNull();
  });
});
