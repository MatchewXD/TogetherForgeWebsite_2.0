import { describe, it, expect } from 'vitest';
import { TASK_CATEGORIES } from '../constants/taskCategories';
import {
  TETHER_V015_TASKS,
  buildTetherV015Description,
  tetherV015Depth,
  tetherV015StaffOnly,
  tetherV015Title,
} from '../data/tetherTaskTreeV015.js';

function byCode() {
  return Object.fromEntries(TETHER_V015_TASKS.map((t) => [t.code, t]));
}

describe('Tether Task Breakdown v0.15 tree (Tether-7)', () => {
  it('keeps IDs unique and titles board-sized', () => {
    const codes = TETHER_V015_TASKS.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const task of TETHER_V015_TASKS) {
      const title = tetherV015Title(task);
      expect(title.startsWith(`${task.code} `)).toBe(true);
      expect(title.length).toBeLessThanOrEqual(120);
      expect(buildTetherV015Description(task).length).toBeLessThanOrEqual(2000);
      expect(TASK_CATEGORIES).toContain(task.skill);
      expect(task.state).not.toBe('Parked');
    }
  });

  it('nests Epic → Medium → Small and does not nest Tether-7 under 5 or 6', () => {
    const map = byCode();
    expect(map['Tether-7'].parentCode).toBeNull();
    expect(map['Tether-7.2'].parentCode).toBe('Tether-7');
    expect(map['Tether-7.2.1'].parentCode).toBe('Tether-7.2');
    expect(tetherV015Depth(map['Tether-7'])).toBe(0);
    expect(tetherV015Depth(map['Tether-7.2'])).toBe(1);
    expect(tetherV015Depth(map['Tether-7.2.1'])).toBe(2);
    expect(Math.max(...TETHER_V015_TASKS.map(tetherV015Depth))).toBe(2);
    expect(TETHER_V015_TASKS.some((t) => t.parentCode === 'Tether-5')).toBe(false);
    expect(TETHER_V015_TASKS.some((t) => t.parentCode === 'Tether-6')).toBe(false);
    expect(TETHER_V015_TASKS.some((t) => String(t.code).startsWith('Tether-7.2.1.'))).toBe(
      false
    );
    expect(TETHER_V015_TASKS.some((t) => String(t.code).startsWith('Tether-7.3.6.'))).toBe(
      false
    );
  });

  it('puts Hand Spark, Grapple, and Boost under Tether-7, not Tether-11', () => {
    const map = byCode();
    expect(map['Tether-7.2.1'].shortTitle).toBe('Hand Spark');
    expect(map['Tether-7.2.1'].parentCode).toBe('Tether-7.2');
    expect(map['Tether-7.3.3'].shortTitle).toBe('Grapple hook');
    expect(map['Tether-7.3.3'].parentCode).toBe('Tether-7.3');
    expect(map['Tether-7.3.4'].shortTitle).toBe('Boost pack');
    expect(map['Tether-7.3.4'].parentCode).toBe('Tether-7.3');
    expect(map['Tether-7.3.5'].shortTitle).toBe('Crew shields field');
    expect(map['Tether-11'].shortTitle).toBe('UI');
    expect(map['Tether-11'].parentCode).toBeNull();
    expect(map['Tether-11.1']).toBeUndefined();
    expect(map['Tether-11.4']).toBeUndefined();
    expect(map['Tether-11.5']).toBeUndefined();
    expect(TETHER_V015_TASKS.some((t) => t.parentCode === 'Tether-11')).toBe(false);
  });

  it('blocks Canon and Snare on the first playtest of Spark, Knife, and Enforcer', () => {
    const map = byCode();
    expect(map['Tether-7.2.4'].shortTitle).toBe('Energy Canon');
    expect(map['Tether-7.2.5'].shortTitle).toBe('Snare');
    expect(map['Tether-7.2.4'].blockedByCodes).toEqual([
      'Tether-7.2.1',
      'Tether-7.2.2',
      'Tether-7.2.3',
    ]);
    expect(map['Tether-7.2.5'].blockedByCodes).toEqual([
      'Tether-7.2.1',
      'Tether-7.2.2',
      'Tether-7.2.3',
    ]);
  });

  it('says Nano-Knife nanites attack from the inside and keeps Docs/Tools.md claimable', () => {
    const map = byCode();
    expect(map['Tether-7.2.2'].purpose).toMatch(/nanites that attack the creature from the inside/i);
    expect(tetherV015StaffOnly(map['Tether-7'])).toBe(true);
    expect(tetherV015StaffOnly(map['Tether-7.4.1'])).toBe(false);
    expect(
      TETHER_V015_TASKS.filter((t) => String(t.code).startsWith('Tether-7')).every((t) =>
        t.code === 'Tether-7.4.1' ? tetherV015StaffOnly(t) === false : tetherV015StaffOnly(t)
      )
    ).toBe(true);
  });
});
