import { describe, it, expect } from 'vitest';
import { TASK_CATEGORIES } from '../constants/taskCategories';
import {
  TETHER_V011_TASKS,
  buildTetherV011Description,
  isTetherV011StaffOnlyCode,
  isTetherV011Title,
  listTetherV011SmallsUnder,
  tetherV011Depth,
  tetherV011StaffOnly,
  tetherV011Title,
} from '../data/tetherTaskTreeV011.js';

function byCode() {
  return Object.fromEntries(TETHER_V011_TASKS.map((t) => [t.code, t]));
}

describe('Tether Task Breakdown v0.11 tree (Tether-4 and Tether-5)', () => {
  it('keeps IDs unique, titles short, and descriptions board-sized', () => {
    const codes = TETHER_V011_TASKS.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const task of TETHER_V011_TASKS) {
      const title = tetherV011Title(task);
      expect(title.startsWith(`${task.code} `)).toBe(true);
      expect(title.length).toBeLessThanOrEqual(120);
      expect(buildTetherV011Description(task).length).toBeLessThanOrEqual(2000);
      expect(TASK_CATEGORIES).toContain(task.skill);
      expect(['Staff Only', 'Blocked', 'Ready', 'In Review', 'Done']).toContain(task.state);
      expect(task.state).not.toBe('Parked');
    }
  });

  it('only encodes Tether-4 and Tether-5 and does not add Epic 11', () => {
    for (const task of TETHER_V011_TASKS) {
      expect(isTetherV011Title(tetherV011Title(task))).toBe(true);
      expect(task.code.startsWith('Tether-11')).toBe(false);
    }
    expect(TETHER_V011_TASKS.some((t) => t.code === 'Tether-11')).toBe(false);
    expect(TETHER_V011_TASKS.map((t) => t.code).filter((c) => c.startsWith('Tether-4'))).toEqual([
      'Tether-4',
      'Tether-4.1',
      'Tether-4.1.1',
      'Tether-4.1.2',
      'Tether-4.1.3',
      'Tether-4.2',
      'Tether-4.2.1',
      'Tether-4.2.2',
      'Tether-4.2.3',
    ]);
  });

  it('nests Epic → Medium → Small and does not nest Tether-5 under Tether-4', () => {
    const map = byCode();
    expect(tetherV011Depth(map['Tether-4'])).toBe(0);
    expect(tetherV011Depth(map['Tether-4.1'])).toBe(1);
    expect(tetherV011Depth(map['Tether-4.1.1'])).toBe(2);
    expect(tetherV011Depth(map['Tether-5'])).toBe(0);
    expect(tetherV011Depth(map['Tether-5.1'])).toBe(1);
    expect(tetherV011Depth(map['Tether-5.1.1'])).toBe(2);
    expect(Math.max(...TETHER_V011_TASKS.map(tetherV011Depth))).toBe(2);

    expect(map['Tether-5'].parentCode).toBeNull();
    expect(map['Tether-5.1'].parentCode).toBe('Tether-5');
    expect(map['Tether-5.2'].parentCode).toBe('Tether-5');
    expect(map['Tether-4.1.1'].parentCode).toBe('Tether-4.1');
    expect(map['Tether-4.2.1'].parentCode).toBe('Tether-4.2');
    expect(listTetherV011SmallsUnder('Tether-4').every((t) => t.code.startsWith('Tether-4.'))).toBe(
      true
    );
    expect(listTetherV011SmallsUnder('Tether-5').some((t) => t.code.startsWith('Tether-4'))).toBe(
      false
    );
  });

  it('makes Snatch the only first-enemy card and keeps Latch as 5.2', () => {
    const map = byCode();
    expect(map['Tether-5.1'].shortTitle).toBe('Snatch');
    expect(map['Tether-5.2'].shortTitle).toBe('Latch');
    expect(map['Tether-5.1'].purpose).toMatch(/First enemy/i);
    expect(map['Tether-5.1'].purpose).toMatch(/Latch is 5\.2/);
    expect(map['Tether-5.2'].purpose).toMatch(/Not the first enemy/i);
    expect(map['Tether-5.1'].purpose).not.toMatch(/Energy Pulse/i);
    expect(map['Tether-5'].purpose).not.toMatch(/Latch is one example creature/i);
    expect(map['Tether-5'].blockedByCode).toBeUndefined();
    expect(map['Tether-5.1'].blockedByCode).toBeUndefined();
    const firstEnemy = TETHER_V011_TASKS.filter((t) =>
      /(^|\n)First enemy\b/i.test(t.purpose)
    );
    expect(firstEnemy.map((t) => t.code)).toEqual(['Tether-5.1']);
  });

  it('sets staff_only false only on graybox art, concept, audio, dressing, Docs, and QA smalls', () => {
    const falseCodes = TETHER_V011_TASKS.filter((t) => !tetherV011StaffOnly(t)).map((t) => t.code);
    expect(falseCodes).toEqual([
      'Tether-5.0.5',
      'Tether-5.0.6',
      'Tether-5.1.1',
      'Tether-5.1.10',
      'Tether-5.1.11',
      'Tether-5.1.12',
      'Tether-5.2.1',
      'Tether-5.2.7',
      'Tether-5.2.8',
      'Tether-5.3.1',
      'Tether-5.3.10',
      'Tether-5.3.11',
      'Tether-5.3.12',
      'Tether-5.4.1',
      'Tether-5.4.10',
      'Tether-5.4.11',
      'Tether-5.4.12',
      'Tether-5.5.1',
      'Tether-5.5.8',
      'Tether-5.5.9',
      'Tether-5.5.10',
    ]);
    for (const task of TETHER_V011_TASKS) {
      expect(tetherV011StaffOnly(task)).toBe(isTetherV011StaffOnlyCode(task.code));
    }
    expect(tetherV011StaffOnly(byCode()['Tether-4'])).toBe(true);
    expect(tetherV011StaffOnly(byCode()['Tether-5'])).toBe(true);
    expect(tetherV011StaffOnly(byCode()['Tether-5.1.14'])).toBe(true);
    expect(tetherV011StaffOnly(byCode()['Tether-4.1.3'])).toBe(true);
  });

  it('does not block Tether-5 on Tether-4 or Tether-6', () => {
    for (const task of TETHER_V011_TASKS) {
      expect(task.blockedByCode).toBeUndefined();
      expect(task.state).not.toBe('Blocked');
      expect(task.state).not.toBe('Parked');
    }
  });
});
