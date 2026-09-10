import { describe, it, expect } from 'vitest';
import { TASK_CATEGORIES } from '../constants/taskCategories';
import {
  TETHER_V014_TASKS,
  buildTetherV014Description,
  tetherV014Depth,
  tetherV014StaffOnly,
  tetherV014Title,
} from '../data/tetherTaskTreeV014.js';

function byCode() {
  return Object.fromEntries(TETHER_V014_TASKS.map((t) => [t.code, t]));
}

describe('Tether Task Breakdown v0.14 tree (Tether-6)', () => {
  it('keeps IDs unique and titles board-sized', () => {
    const codes = TETHER_V014_TASKS.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const task of TETHER_V014_TASKS) {
      const title = tetherV014Title(task);
      expect(title.startsWith(`${task.code} `)).toBe(true);
      expect(title.length).toBeLessThanOrEqual(120);
      expect(buildTetherV014Description(task).length).toBeLessThanOrEqual(2000);
      expect(TASK_CATEGORIES).toContain(task.skill);
      expect(task.state).not.toBe('Parked');
    }
  });

  it('nests Epic → Medium → Small and does not nest Tether-6 under Tether-5', () => {
    const map = byCode();
    expect(map['Tether-6'].parentCode).toBeNull();
    expect(map['Tether-6.1'].parentCode).toBe('Tether-6');
    expect(map['Tether-6.1.2'].parentCode).toBe('Tether-6.1');
    expect(map['Tether-6.2.1'].parentCode).toBe('Tether-6.2');
    expect(tetherV014Depth(map['Tether-6'])).toBe(0);
    expect(tetherV014Depth(map['Tether-6.1'])).toBe(1);
    expect(tetherV014Depth(map['Tether-6.1.2'])).toBe(2);
    expect(Math.max(...TETHER_V014_TASKS.map(tetherV014Depth))).toBe(2);
    expect(TETHER_V014_TASKS.some((t) => t.parentCode === 'Tether-5')).toBe(false);
  });

  it('puts kit first as 6.1 and does not nest kit pieces under section maps', () => {
    const map = byCode();
    expect(map['Tether-6.1'].shortTitle).toBe('Modular kit');
    expect(map['Tether-6.1'].sortOrder).toBeLessThan(map['Tether-6.2'].sortOrder);
    expect(map['Tether-6.2.1'].shortTitle).toBe('Map 1 spine');
    expect(map['Tether-6.2.1'].parentCode).toBe('Tether-6.2');
    expect(map['Tether-6.1.2'].parentCode).toBe('Tether-6.1');
    expect(map['Tether-6.1.2'].parentCode).not.toBe('Tether-6.2');
  });

  it('blocks section maps on the kit family they use, not later families', () => {
    const map = byCode();
    expect(map['Tether-6.2'].blockedByCodes).toEqual(['Tether-6.1.2']);
    expect(map['Tether-6.3'].blockedByCodes).toEqual(['Tether-6.1.3']);
    expect(map['Tether-6.4'].blockedByCodes).toEqual(['Tether-6.1.4']);
    expect(map['Tether-6.5'].blockedByCodes).toEqual(['Tether-6.1.4', 'Tether-6.1.5']);
    expect(map['Tether-6'].blockedByCodes || []).toEqual([]);
  });

  it('maps leftover public campaign titles onto the v0.14 IDs', () => {
    const map = byCode();
    expect(map['Tether-6'].shortTitle).toBe('Maps');
    expect(map['Tether-6.1'].shortTitle).toBe('Modular kit');
    expect(map['Tether-6.1.1'].shortTitle).toBe('Folder naming and piece list');
    expect(map['Tether-6.1.2'].shortTitle).toBe('Ground kit family');
    expect(map['Tether-6.2'].shortTitle).toBe('Section 1 beginner ground');
    expect(map['Tether-6.2.1'].shortTitle).toBe('Map 1 spine');
    expect(map['Tether-6.6'].shortTitle).toBe('Unofficial maps');
    expect(map['Tether-6.2.1'].parentCode).toBe('Tether-6.2');
    expect(map['Tether-6.6'].parentCode).toBe('Tether-6');
  });

  it('does not add Tether-5.6 and keeps 11.4 / 11.5 out from under Tether-6', () => {
    const map = byCode();
    expect(map['Tether-5.6']).toBeUndefined();
    expect(map['Tether-11.4'].parentCode).toBe('Tether-11');
    expect(map['Tether-11.5'].parentCode).toBe('Tether-11');
    expect(map['Tether-CD.3'].parentCode).toBe('Tether-CD');
    expect(tetherV014StaffOnly(map['Tether-6'])).toBe(true);
    expect(tetherV014StaffOnly(map['Tether-6.1.2'])).toBe(false);
    expect(tetherV014StaffOnly(map['Tether-6.2.1'])).toBe(true);
  });
});
