import { describe, it, expect } from 'vitest';
import { TASK_CATEGORIES } from '../constants/taskCategories';
import {
  TETHER_V021_TASKS,
  buildTetherV021Description,
  tetherV021Depth,
  tetherV021StaffOnly,
  tetherV021Title,
} from '../data/tetherTaskTreeV021.js';

function byCode() {
  return Object.fromEntries(TETHER_V021_TASKS.map((t) => [t.code, t]));
}

describe('Tether Task Breakdown v0.21 tree (Tether-8 UI, Tether-11 animation)', () => {
  it('keeps IDs unique and titles board-sized', () => {
    const codes = TETHER_V021_TASKS.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const task of TETHER_V021_TASKS) {
      const title = tetherV021Title(task);
      expect(title.startsWith(`${task.code} `)).toBe(true);
      expect(title.length).toBeLessThanOrEqual(120);
      expect(buildTetherV021Description(task).length).toBeLessThanOrEqual(2000);
      expect(TASK_CATEGORIES).toContain(task.skill);
      expect(task.state).not.toBe('Parked');
    }
  });

  it('nests Epic → Medium → Small and does not rewrite 4-7', () => {
    const map = byCode();
    expect(map['Tether-8'].parentCode).toBeNull();
    expect(map['Tether-8.1'].parentCode).toBe('Tether-8');
    expect(map['Tether-8.1.1'].parentCode).toBe('Tether-8.1');
    expect(map['Tether-11'].parentCode).toBeNull();
    expect(map['Tether-11.1'].parentCode).toBe('Tether-11');
    expect(map['Tether-11.1.1'].parentCode).toBe('Tether-11.1');
    expect(tetherV021Title(map['Tether-8.1.1'])).toBe('Tether-8.1.1 Player health bar');
    expect(Math.max(...TETHER_V021_TASKS.map(tetherV021Depth))).toBe(2);
    expect(TETHER_V021_TASKS.some((t) => /^Tether-[4-7]([.]|$)/.test(t.code))).toBe(
      false
    );
  });

  it('keeps Tether-8 off Tether-10 and Tether-11 as animation not UI', () => {
    const map = byCode();
    expect(map['Tether-8'].shortTitle).toBe('UI');
    expect(map['Tether-11'].shortTitle).toBe('Model rigging and animation');
    expect(map['Tether-11'].purpose).not.toMatch(/\bUI\b/);
    expect(
      TETHER_V021_TASKS.some((t) =>
        (t.blockedByCodes || (t.blockedByCode ? [t.blockedByCode] : [])).some((c) =>
          String(c).startsWith('Tether-10')
        )
      )
    ).toBe(false);
    expect(TETHER_V021_TASKS.some((t) => t.parentCode === 'Tether-11' && /weapon/i.test(t.shortTitle) && t.code.startsWith('Tether-7'))).toBe(false);
    expect(map['Tether-11.1'].parentCode).toBe('Tether-11');
  });

  it('puts snap-dump and beam-shared shield damage on 8.1.2', () => {
    const map = byCode();
    const text = `${map['Tether-8.1.2'].purpose}\n${map['Tether-8.1.2'].extra}`;
    expect(text).toMatch(/tether snaps/i);
    expect(text).toMatch(/shield empties immediately/i);
    expect(text).toMatch(/Shield damage also (hits the tether|damages the beam)/i);
    expect(tetherV021StaffOnly(map['Tether-8.1.2'])).toBe(true);
  });

  it('says basic and quick on 11.0.1 and keeps graybox clips claimable', () => {
    const map = byCode();
    expect(map['Tether-11.0.1'].purpose).toMatch(/Basic and quick/i);
    expect(tetherV021StaffOnly(map['Tether-11.0.1'])).toBe(false);
    expect(tetherV021StaffOnly(map['Tether-11.1.1'])).toBe(false);
    expect(tetherV021StaffOnly(map['Tether-8.1.1'])).toBe(false);
    expect(tetherV021StaffOnly(map['Tether-8.3.2'])).toBe(true);
    expect(tetherV021StaffOnly(map['Tether-8.5.4'])).toBe(true);
    expect(tetherV021StaffOnly(map['Tether-11.2.6'])).toBe(true);
  });
});
