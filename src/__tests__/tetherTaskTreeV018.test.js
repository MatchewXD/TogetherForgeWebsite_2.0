import { describe, it, expect } from 'vitest';
import { TASK_CATEGORIES } from '../constants/taskCategories';
import {
  TETHER_V018_KEEP_CODES,
  TETHER_V018_TASKS,
  buildTetherV018Description,
  isTetherV018KeepTitle,
  tetherV018Depth,
  tetherV018StaffOnly,
  tetherV018Title,
} from '../data/tetherTaskTreeV018.js';

function byCode() {
  return Object.fromEntries(TETHER_V018_TASKS.map((t) => [t.code, t]));
}

describe('Tether Task Breakdown v0.18 tree (Tether-4)', () => {
  it('keeps IDs unique and titles board-sized', () => {
    const codes = TETHER_V018_TASKS.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const task of TETHER_V018_TASKS) {
      const title = tetherV018Title(task);
      expect(title.startsWith(`${task.code} `)).toBe(true);
      expect(title.length).toBeLessThanOrEqual(120);
      expect(buildTetherV018Description(task).length).toBeLessThanOrEqual(2000);
      expect(TASK_CATEGORIES).toContain(task.skill);
      expect(task.state).not.toBe('Parked');
    }
  });

  it('does not rewrite the six keep-list Smalls and stays Epic → Medium → Small', () => {
    const map = byCode();
    for (const code of TETHER_V018_KEEP_CODES) {
      expect(map[code]).toBeUndefined();
    }
    expect(isTetherV018KeepTitle('Tether-4.1.1 ResourceNode prefab and interact')).toBe(
      true
    );
    expect(isTetherV018KeepTitle('Tether-4.2.3 Visible running total')).toBe(true);
    expect(isTetherV018KeepTitle('Tether-4.3.3 Ore vein')).toBe(false);
    expect(map['Tether-4'].parentCode).toBeNull();
    expect(map['Tether-4.3'].parentCode).toBe('Tether-4');
    expect(map['Tether-4.3.0'].parentCode).toBe('Tether-4.3');
    expect(map['Tether-4.3.3'].parentCode).toBe('Tether-4.3');
    expect(Math.max(...TETHER_V018_TASKS.map(tetherV018Depth))).toBe(2);
    expect(TETHER_V018_TASKS.some((t) => t.parentCode === 'Tether-5')).toBe(false);
    expect(TETHER_V018_TASKS.some((t) => t.parentCode === 'Tether-7')).toBe(false);
    expect(TETHER_V018_TASKS.some((t) => String(t.code).startsWith('Tether-4.3.0.'))).toBe(
      false
    );
  });

  it('puts Extractor at 4.3.0 as melt plus vacuum, not a pickaxe', () => {
    const map = byCode();
    expect(map['Tether-4.3.0'].shortTitle).toBe('Extractor');
    expect(map['Tether-4.3.3'].shortTitle).toBe('Ore vein');
    expect(map['Tether-4.3.0'].purpose).toMatch(/No pickaxe/i);
    expect(map['Tether-4.3.0'].purpose).toMatch(/melts only the metal/i);
    expect(map['Tether-4.3.0'].purpose).toMatch(/anti-gravity stream vacuums/i);
    expect(tetherV018Title(map['Tether-4.3.3'])).toBe('Tether-4.3.3 Ore vein');
  });

  it('keeps raw as progress and power cells / scrap as colony survival', () => {
    const map = byCode();
    expect(map['Tether-4.3'].purpose).toMatch(/Raw is progress only/i);
    expect(map['Tether-4.4'].purpose).toMatch(/Power cells and scrap keep the colony alive/i);
    expect(map['Tether-4.4.2'].shortTitle).toBe('Power cell');
    expect(
      TETHER_V018_TASKS.some((t) =>
        /nanite canister/i.test(`${t.shortTitle} ${t.purpose || ''}`)
      )
    ).toBe(false);
  });

  it('sets staff_only false on graybox nodes and Docs, true on clock quota converter Guard', () => {
    const map = byCode();
    expect(tetherV018StaffOnly(map['Tether-4.3.1'])).toBe(false);
    expect(tetherV018StaffOnly(map['Tether-4.3.3'])).toBe(false);
    expect(tetherV018StaffOnly(map['Tether-4.3.4'])).toBe(false);
    expect(tetherV018StaffOnly(map['Tether-4.3.5'])).toBe(false);
    expect(tetherV018StaffOnly(map['Tether-4.3.0'])).toBe(true);
    expect(tetherV018StaffOnly(map['Tether-4.3.9'])).toBe(true);
    expect(tetherV018StaffOnly(map['Tether-4.6'])).toBe(true);
    expect(tetherV018StaffOnly(map['Tether-4.6.1'])).toBe(true);
    expect(tetherV018StaffOnly(map['Tether-4.6.2'])).toBe(true);
    expect(tetherV018StaffOnly(map['Tether-4.6.4'])).toBe(true);
  });
});
