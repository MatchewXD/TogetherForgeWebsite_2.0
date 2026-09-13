import { describe, it, expect } from 'vitest';
import { TASK_CATEGORIES } from '../constants/taskCategories';
import {
  TETHER_V025_SHEET_CODES,
  TETHER_V025_TASKS,
  buildTetherV025Description,
  isTetherV025LookCard,
  tetherV025Blockers,
  tetherV025Depth,
  tetherV025StaffOnly,
  tetherV025Title,
} from '../data/tetherTaskTreeV025.js';

function byCode() {
  return Object.fromEntries(TETHER_V025_TASKS.map((t) => [t.code, t]));
}

describe('Tether Task Breakdown v0.25 tree (Tether-9 Production look)', () => {
  it('keeps IDs unique and titles board-sized', () => {
    const codes = TETHER_V025_TASKS.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const task of TETHER_V025_TASKS) {
      const title = tetherV025Title(task);
      expect(title.startsWith(`${task.code} `)).toBe(true);
      expect(title.length).toBeLessThanOrEqual(120);
      expect(buildTetherV025Description(task).length).toBeLessThanOrEqual(2000);
      expect(TASK_CATEGORIES).toContain(task.skill);
      expect(task.state).not.toBe('Parked');
      expect(title).not.toMatch(/founder/i);
    }
  });

  it('nests Epic → Medium → Small and does not rewrite 4-8, 11, or 12', () => {
    const map = byCode();
    expect(map['Tether-9'].parentCode).toBeNull();
    expect(map['Tether-9.0'].parentCode).toBe('Tether-9');
    expect(map['Tether-9.0.A'].parentCode).toBe('Tether-9.0');
    expect(map['Tether-9.1'].parentCode).toBe('Tether-9');
    expect(map['Tether-9.1.1'].parentCode).toBe('Tether-9.1');
    expect(tetherV025Title(map['Tether-9.0.A'])).toBe('Tether-9.0.A Scale sheet');
    expect(map['Tether-9'].shortTitle).toBe('Production look');
    expect(Math.max(...TETHER_V025_TASKS.map(tetherV025Depth))).toBe(2);
    expect(
      TETHER_V025_TASKS.some((t) => /^Tether-(4|5|6|7|8|11|12)([.]|$)/.test(t.code))
    ).toBe(false);
  });

  it('keeps sheet cards staff_only and look cards claimable after sheets', () => {
    const map = byCode();
    expect(tetherV025StaffOnly(map['Tether-9.0'])).toBe(true);
    expect(tetherV025StaffOnly(map['Tether-9.0.0'])).toBe(true);
    expect(tetherV025StaffOnly(map['Tether-9.0.A'])).toBe(true);
    expect(tetherV025StaffOnly(map['Tether-9.0.B'])).toBe(true);
    expect(tetherV025StaffOnly(map['Tether-9.0.C'])).toBe(true);
    expect(tetherV025StaffOnly(map['Tether-9.0.1'])).toBe(true);
    expect(tetherV025StaffOnly(map['Tether-9.0.2'])).toBe(false);
    expect(tetherV025StaffOnly(map['Tether-9.1'])).toBe(false);
    expect(tetherV025StaffOnly(map['Tether-9.1.1'])).toBe(false);
    expect(tetherV025StaffOnly(map['Tether-9.5.6'])).toBe(true);
    expect(tetherV025Blockers(map['Tether-9.0.2'])).toEqual(['Tether-9.0.C']);
  });

  it('blocks every 9.1-9.8 card on 9.0.A, 9.0.B, and 9.0.C, not 9.0.0', () => {
    for (const task of TETHER_V025_TASKS) {
      const blockers = tetherV025Blockers(task);
      expect(blockers).not.toContain('Tether-9.0.0');
      if (isTetherV025LookCard(task)) {
        expect(blockers).toEqual(TETHER_V025_SHEET_CODES);
      }
    }
    const map = byCode();
    expect(tetherV025Blockers(map['Tether-9.0.0'])).toEqual([]);
    expect(tetherV025Blockers(map['Tether-9.0.A'])).toEqual([]);
    expect(map['Tether-9.0.0'].purpose).toMatch(/Not a blocker for 9\.1-9\.8/i);
  });

  it('keeps graybox and clips on 6 and 11 and never says Founder', () => {
    const map = byCode();
    expect(map['Tether-9'].purpose).toMatch(/Tether-6\.1 owns graybox shapes/);
    expect(map['Tether-9'].purpose).toMatch(/Tether-11 owns clips/);
    expect(map['Tether-9.4'].purpose).toMatch(/Paint Tether-6\.1 families/);
    expect(map['Tether-9.5'].purpose).toMatch(/Clips are Tether-11\.2/);
    expect(
      TETHER_V025_TASKS.some((t) => /founder/i.test(`${t.shortTitle} ${t.purpose} ${t.extra || ''}`))
    ).toBe(false);
  });
});
