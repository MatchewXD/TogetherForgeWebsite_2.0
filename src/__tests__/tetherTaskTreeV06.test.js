import { describe, it, expect } from 'vitest';
import { TASK_CATEGORIES } from '../constants/taskCategories';
import {
  TETHER_V06_TASKS,
  buildTetherV06Description,
  isTetherV06Title,
  listTetherV06SmallsUnder,
  tetherV06Depth,
  tetherV06StaffOnly,
  tetherV06Title,
} from '../data/tetherTaskTreeV06.js';

describe('Tether Task Breakdown v0.6 tree', () => {
  it('keeps doc IDs unique and titles short', () => {
    const codes = TETHER_V06_TASKS.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const task of TETHER_V06_TASKS) {
      expect(tetherV06Title(task).length).toBeLessThanOrEqual(120);
      expect(buildTetherV06Description(task).length).toBeLessThanOrEqual(2000);
      expect(TASK_CATEGORIES).toContain(task.skill);
    }
  });

  it('imports Staff Only / Blocked / Parked without extra Smalls on parked epics', () => {
    expect(listTetherV06SmallsUnder('Tether-7')).toEqual([]);
    expect(listTetherV06SmallsUnder('Tether-8')).toEqual([]);
    expect(listTetherV06SmallsUnder('Tether-11')).toEqual([]);
    expect(listTetherV06SmallsUnder('Tether-12')).toEqual([]);
    expect(listTetherV06SmallsUnder('Tether-13')).toEqual([]);
    expect(TETHER_V06_TASKS.filter((t) => t.code.startsWith('Tether-11')).map((t) => t.code)).toEqual([
      'Tether-11',
    ]);
  });

  it('marks Epic 1, Epic 2, Tether-P, 9.1, and Epic 10 Staff Only', () => {
    const staffCodes = TETHER_V06_TASKS.filter((t) => tetherV06StaffOnly(t.state)).map(
      (t) => t.code
    );
    expect(staffCodes).toContain('Tether-1');
    expect(staffCodes).toContain('Tether-1.1.1');
    expect(staffCodes).toContain('Tether-2.3.2');
    expect(staffCodes).toContain('Tether-P');
    expect(staffCodes).toContain('Tether-P.2.1');
    expect(staffCodes).toContain('Tether-P.3.2');
    expect(staffCodes).toContain('Tether-9.1');
    expect(staffCodes).toContain('Tether-10');
    expect(staffCodes).not.toContain('Tether-3');
    expect(staffCodes).not.toContain('Tether-9.2');
  });

  it('blocks later epics on the named previous epic, and 9.2 on style lock', () => {
    const byCode = Object.fromEntries(TETHER_V06_TASKS.map((t) => [t.code, t]));
    expect(byCode['Tether-3'].blockedByCode).toBe('Tether-2');
    expect(byCode['Tether-3'].blocker).toMatch(/playtest/i);
    expect(byCode['Tether-4'].blockedByCode).toBe('Tether-3');
    expect(byCode['Tether-5'].blockedByCode).toBe('Tether-4');
    expect(byCode['Tether-6'].blockedByCode).toBe('Tether-5');
    expect(byCode['Tether-9.2'].blockedByCode).toBe('Tether-9.1');
    expect(byCode['Tether-9.2'].state).toBe('Blocked');
    expect(byCode['Tether-2.2'].blockedByCode).toBe('Tether-2.1.0');
    expect(byCode['Tether-2.3'].blockedByCode).toBe('Tether-2.1.0');
  });

  it('puts the prototype graybox first under Tether-2.1', () => {
    const smalls = TETHER_V06_TASKS.filter((t) => t.parentCode === 'Tether-2.1').sort(
      (a, b) => a.sortOrder - b.sortOrder
    );
    expect(smalls.map((t) => t.code)).toEqual([
      'Tether-2.1.0',
      'Tether-2.1.1',
      'Tether-2.1.2',
      'Tether-2.1.3',
    ]);
    expect(smalls[0].shortTitle).toMatch(/graybox/i);
    expect(smalls[1].shortTitle).toMatch(/stand-in/i);
    expect(smalls[2].shortTitle).toMatch(/constraint|visual|tether/i);
  });

  it('keeps Tether-P as staging-only leftover game work and does not recreate removed P cards', () => {
    const byCode = Object.fromEntries(TETHER_V06_TASKS.map((t) => [t.code, t]));
    expect(byCode['Tether-P'].parentCode).toBeNull();
    expect(byCode['Tether-P'].state).toBe('Staff Only');
    expect(byCode['Tether-P.1']).toBeUndefined();
    expect(byCode['Tether-P.1.1']).toBeUndefined();
    expect(byCode['Tether-P.1.2']).toBeUndefined();
    expect(byCode['Tether-P.2'].parentCode).toBe('Tether-P');
    expect(byCode['Tether-P.2.1'].parentCode).toBe('Tether-P.2');
    expect(byCode['Tether-P.2.2'].parentCode).toBe('Tether-P.2');
    expect(byCode['Tether-P.2.3']).toBeUndefined();
    expect(byCode['Tether-P.3']).toBeUndefined();
    expect(byCode['Tether-P.3.1']).toBeUndefined();
    expect(byCode['Tether-P.3.2'].parentCode).toBe('Tether-P');
    expect(byCode['Tether-P.4']).toBeUndefined();
    expect(byCode['Tether-P.4.1']).toBeUndefined();
    const pCodes = TETHER_V06_TASKS.filter((t) => t.code.startsWith('Tether-P')).map(
      (t) => t.code
    );
    expect(pCodes).toEqual([
      'Tether-P',
      'Tether-P.2',
      'Tether-P.2.1',
      'Tether-P.2.2',
      'Tether-P.3.2',
    ]);
    for (const task of TETHER_V06_TASKS.filter((t) => t.code.startsWith('Tether-P'))) {
      const desc = buildTetherV06Description(task);
      expect(desc).not.toMatch(/Promote to public Ready/i);
      expect(desc).not.toMatch(/WhatThisIsNot/i);
      expect(task.staffNote).toBeUndefined();
    }
  });

  it('locks the product at 1-4 players and keeps two pawns only on Epic 2 feel-test cards', () => {
    const byCode = Object.fromEntries(TETHER_V06_TASKS.map((t) => [t.code, t]));
    expect(byCode['Tether-6.2'].shortTitle).toMatch(/1-4 player/);
    expect(byCode['Tether-6.2'].purpose).toMatch(/1-4 player/);
    expect(byCode['Tether-6.2'].purpose).not.toMatch(/two-player/);
    expect(byCode['Tether-6.2'].dod.join(' ')).not.toMatch(/two-player/);
    expect(byCode['Tether-2'].purpose).toMatch(/two pawns/);
    expect(byCode['Tether-2'].purpose).toMatch(/Solo behavior and 3-4 tether topology stay Open/);
    expect(byCode['Tether-2.1'].purpose).toMatch(/two pawns/);
    expect(byCode['Tether-2.1.1'].output).toMatch(/two stand-ins/);
    expect(byCode['Tether-5.1'].purpose).not.toMatch(/\bpair\b/i);
    expect(byCode['Tether-2.2'].purpose).not.toMatch(/\bpair\b/i);
  });

  it('does not paste the engine/repo warehouse block onto every Epic 1 card', () => {
    const warehouse = /Engine lock: Unreal Engine 5\.8\.x, current 5\.8 patch from the Epic Games Launcher/;
    for (const task of TETHER_V06_TASKS) {
      expect(buildTetherV06Description(task)).not.toMatch(warehouse);
    }
    const byCode = Object.fromEntries(TETHER_V06_TASKS.map((t) => [t.code, t]));
    expect(byCode['Tether-1.1.1'].output).toMatch(/EngineDecision\.md/);
    expect(byCode['Tether-1.1.2'].output).toMatch(/Content\/Tether/);
    expect(byCode['Tether-1.2.1'].output).toMatch(/LFS/);
    expect(byCode['Tether-1.2.2'].dod.join(' ')).toMatch(/Access rule/);
    expect(byCode['Tether-1'].extra).toBeUndefined();
    expect(byCode['Tether-1.1'].extra).toBeUndefined();
  });

  it('treats leftover demo/empty titles as not part of the v0.6 tree', () => {
    for (const task of TETHER_V06_TASKS) {
      expect(isTetherV06Title(tetherV06Title(task))).toBe(true);
    }
    expect(isTetherV06Title('Tether-10 Networking foundation')).toBe(true);
    expect(isTetherV06Title('Tether-P.4.1 Credit current off-site helpers')).toBe(
      true
    );
    expect(isTetherV06Title('Design core loop doc')).toBe(false);
    expect(isTetherV06Title('Demo map layout')).toBe(false);
    expect(isTetherV06Title('Placeholder art set A')).toBe(false);
    expect(isTetherV06Title('Tether-14 Extra')).toBe(false);
    expect(isTetherV06Title('Tether prototype')).toBe(false);
  });

  it('nests Epic → Medium → Small and does not exceed three levels', () => {
    expect(tetherV06Depth(TETHER_V06_TASKS.find((t) => t.code === 'Tether-1'))).toBe(0);
    expect(tetherV06Depth(TETHER_V06_TASKS.find((t) => t.code === 'Tether-1.1'))).toBe(1);
    expect(tetherV06Depth(TETHER_V06_TASKS.find((t) => t.code === 'Tether-1.1.1'))).toBe(2);
    expect(Math.max(...TETHER_V06_TASKS.map(tetherV06Depth))).toBe(2);
  });
});
