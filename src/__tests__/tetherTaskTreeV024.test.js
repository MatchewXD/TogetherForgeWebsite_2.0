import { describe, it, expect } from 'vitest';
import { TASK_CATEGORIES } from '../constants/taskCategories';
import {
  TETHER_V024_TASKS,
  buildTetherV024Description,
  tetherV024Depth,
  tetherV024StaffOnly,
  tetherV024Title,
} from '../data/tetherTaskTreeV024.js';

function byCode() {
  return Object.fromEntries(TETHER_V024_TASKS.map((t) => [t.code, t]));
}

function blockersOf(task) {
  return task.blockedByCodes || (task.blockedByCode ? [task.blockedByCode] : []);
}

describe('Tether Task Breakdown v0.24 tree (Tether-8 UI, Tether-11 animation, Tether-12 audio)', () => {
  it('keeps IDs unique and titles board-sized', () => {
    const codes = TETHER_V024_TASKS.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const task of TETHER_V024_TASKS) {
      const title = tetherV024Title(task);
      expect(title.startsWith(`${task.code} `)).toBe(true);
      expect(title.length).toBeLessThanOrEqual(120);
      expect(buildTetherV024Description(task).length).toBeLessThanOrEqual(2000);
      expect(TASK_CATEGORIES).toContain(task.skill);
      expect(task.state).not.toBe('Parked');
    }
  });

  it('nests Epic → Medium → Small and does not rewrite 4-7 or 9', () => {
    const map = byCode();
    expect(map['Tether-8'].parentCode).toBeNull();
    expect(map['Tether-8.1'].parentCode).toBe('Tether-8');
    expect(map['Tether-8.1.1'].parentCode).toBe('Tether-8.1');
    expect(map['Tether-11'].parentCode).toBeNull();
    expect(map['Tether-11.1'].parentCode).toBe('Tether-11');
    expect(map['Tether-11.1.1'].parentCode).toBe('Tether-11.1');
    expect(map['Tether-12'].parentCode).toBeNull();
    expect(map['Tether-12.1'].parentCode).toBe('Tether-12');
    expect(map['Tether-12.1.1'].parentCode).toBe('Tether-12.1');
    expect(tetherV024Title(map['Tether-8.1.1'])).toBe('Tether-8.1.1 Player health bar');
    expect(Math.max(...TETHER_V024_TASKS.map(tetherV024Depth))).toBe(2);
    expect(TETHER_V024_TASKS.some((t) => /^Tether-[4-7]([.]|$)/.test(t.code))).toBe(
      false
    );
    expect(TETHER_V024_TASKS.some((t) => /^Tether-9([.]|$)/.test(t.code))).toBe(false);
  });

  it('keeps Tether-8 off Tether-10 and Tether-11 as animation not UI', () => {
    const map = byCode();
    expect(map['Tether-8'].shortTitle).toBe('UI');
    expect(map['Tether-11'].shortTitle).toBe('Model rigging and animation');
    expect(map['Tether-11'].purpose).not.toMatch(/\bUI\b/);
    expect(map['Tether-12'].shortTitle).toBe('Audio');
    expect(
      TETHER_V024_TASKS.some((t) =>
        blockersOf(t).some((c) => String(c).startsWith('Tether-10'))
      )
    ).toBe(false);
    expect(
      TETHER_V024_TASKS.filter((t) => t.parentCode === 'Tether-11')
        .map((t) => t.code)
        .sort()
    ).toEqual(['Tether-11.0', 'Tether-11.1', 'Tether-11.2', 'Tether-11.3']);
    expect(map['Tether-11.3'].shortTitle).toBe('Weapon and tool poses');
    expect(map['Tether-11.3'].parentCode).toBe('Tether-11');
  });

  it('puts snap-dump and beam-shared shield damage on 8.1.2', () => {
    const map = byCode();
    const text = `${map['Tether-8.1.2'].purpose}\n${map['Tether-8.1.2'].extra}`;
    expect(text).toMatch(/tether snaps/i);
    expect(text).toMatch(/shield empties immediately/i);
    expect(text).toMatch(/Shield damage also (hits the tether|damages the beam)/i);
    expect(tetherV024StaffOnly(map['Tether-8.1.2'])).toBe(true);
  });

  it('says basic and quick on 11.0.1 and keeps graybox / one-shot cues claimable', () => {
    const map = byCode();
    expect(map['Tether-11.0.1'].purpose).toMatch(/Basic and quick/i);
    expect(tetherV024StaffOnly(map['Tether-11.0.1'])).toBe(false);
    expect(tetherV024StaffOnly(map['Tether-11.1.1'])).toBe(false);
    expect(tetherV024StaffOnly(map['Tether-8.1.1'])).toBe(false);
    expect(tetherV024StaffOnly(map['Tether-8.2.1'])).toBe(false);
    expect(tetherV024StaffOnly(map['Tether-8.5.4'])).toBe(true);
    expect(tetherV024StaffOnly(map['Tether-11.2.6'])).toBe(true);
    expect(tetherV024StaffOnly(map['Tether-12.0.1'])).toBe(false);
    expect(tetherV024StaffOnly(map['Tether-12.0.2'])).toBe(true);
    expect(tetherV024StaffOnly(map['Tether-12.0.3'])).toBe(true);
    expect(tetherV024StaffOnly(map['Tether-12.1.1'])).toBe(false);
    expect(tetherV024StaffOnly(map['Tether-12.3.8'])).toBe(true);
    expect(tetherV024StaffOnly(map['Tether-12.4.6'])).toBe(true);
  });
});
