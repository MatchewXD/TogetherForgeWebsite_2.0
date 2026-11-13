import { describe, it, expect, beforeEach } from 'vitest';
import {
  claimHousekeepingRun,
  resetHousekeepingForTests,
} from '../utils/housekeeping';

describe('claimHousekeepingRun', () => {
  beforeEach(() => resetHousekeepingForTests());

  it('allows the first run and blocks repeats inside the interval', () => {
    expect(claimHousekeepingRun('job', 60_000, 1_000_000)).toBe(true);
    expect(claimHousekeepingRun('job', 60_000, 1_030_000)).toBe(false);
    expect(claimHousekeepingRun('job', 60_000, 1_059_999)).toBe(false);
  });

  it('allows a run again once the interval has passed', () => {
    expect(claimHousekeepingRun('job', 60_000, 1_000_000)).toBe(true);
    expect(claimHousekeepingRun('job', 60_000, 1_060_000)).toBe(true);
    expect(claimHousekeepingRun('job', 60_000, 1_060_001)).toBe(false);
  });

  it('tracks keys independently', () => {
    expect(claimHousekeepingRun('a', 60_000, 1_000_000)).toBe(true);
    expect(claimHousekeepingRun('b', 60_000, 1_000_000)).toBe(true);
  });

  it('persists across reloads through localStorage', () => {
    expect(claimHousekeepingRun('job', 60_000, 1_000_000)).toBe(true);
    expect(Number(localStorage.getItem('tf_hk_job'))).toBe(1_000_000);
  });

  it('is not blocked forever by a timestamp from the future', () => {
    localStorage.setItem('tf_hk_job', String(9_000_000));
    expect(claimHousekeepingRun('job', 60_000, 1_000_000)).toBe(true);
  });
});
