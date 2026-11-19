import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ supabase: {} }));

import { buildTaskTree, mapFilterHighlight } from '../utils/taskMapLayout';
import { boardMapFilter, isTaskUnclaimedClaimable } from '../utils/taskActions';

const t = (id, parentTaskId, extra = {}) => ({
  id,
  parentTaskId,
  title: `Task ${id}`,
  status: 'todo',
  dbStatus: 'Todo',
  sortOrder: 0,
  createdAt: `2026-01-01T00:00:${String(id.length).padStart(2, '0')}Z`,
  boardScope: 'public',
  depth: parentTaskId ? (parentTaskId.startsWith('e') ? 1 : 2) : 0,
  ...extra,
});
const claimed = { claimedBy: 'ada', claim: { status: 'Active', userId: 'u1' } };
const locked = { isLocked: true, lockedWaitingOn: ['Other task'] };

/*
 * eA (Design)
 *   mA (Design)
 *     sCodeOpen    Code, unclaimed       <- the only unclaimed Code task
 *     sCodeTaken   Code, claimed
 *     sArtOpen     Art, unclaimed
 * eB (Design)
 *   mB (Design)
 *     sCodeTaken2  Code, claimed
 *     sArtOpen2    Art, unclaimed
 * eC (Design)
 *   mC (Code, blocked)
 *     sCodeBlocked Code, unclaimed but blocked
 */
const TASKS = [
  t('eA', null, { category: 'Design', hasChildren: true }),
  t('mA', 'eA', { category: 'Design', hasChildren: true }),
  t('sCodeOpen', 'mA', { category: 'Code' }),
  t('sCodeTaken', 'mA', { category: 'Code', sortOrder: 1, ...claimed }),
  t('sArtOpen', 'mA', { category: 'Art', sortOrder: 2 }),
  t('eB', null, { category: 'Design', sortOrder: 1, hasChildren: true }),
  t('mB', 'eB', { category: 'Design', hasChildren: true }),
  t('sCodeTaken2', 'mB', { category: 'Code', ...claimed }),
  t('sArtOpen2', 'mB', { category: 'Art', sortOrder: 1 }),
  t('eC', null, { category: 'Design', sortOrder: 2, hasChildren: true }),
  t('mC', 'eC', { category: 'Code', hasChildren: true, ...locked }),
  t('sCodeBlocked', 'mC', { category: 'Code', ...locked }),
];

function lit(filters) {
  const { roots } = buildTaskTree(TASKS);
  const h = mapFilterHighlight(roots, boardMapFilter(filters));
  if (!h) return null;
  return [...h.entries()].filter(([, v]) => v.lit).map(([id]) => id).sort();
}

describe('Task Map: board filters as a highlight', () => {
  it('no filter: nothing to highlight', () => {
    expect(lit({})).toBeNull();
  });

  it('Unclaimed only: open, claimable tasks plus the path to them', () => {
    expect(lit({ unclaimedOnly: true })).toEqual(
      ['eA', 'eB', 'mA', 'mB', 'sArtOpen', 'sArtOpen2', 'sCodeOpen'].sort()
    );
  });

  it('Code + Unclaimed only combine: a card is lit only if it, or something under it, is an unclaimed Code task', () => {
    expect(lit({ categoryFilter: ['Code'], unclaimedOnly: true })).toEqual(
      ['eA', 'mA', 'sCodeOpen'].sort()
    );
  });

  it('Code alone still lights claimed Code work', () => {
    expect(lit({ categoryFilter: ['Code'] })).toEqual(
      ['eA', 'eB', 'eC', 'mA', 'mB', 'mC', 'sCodeBlocked', 'sCodeOpen', 'sCodeTaken', 'sCodeTaken2'].sort()
    );
  });

  it('Hide Blocked Tasks greys blocked tasks instead of hiding them', () => {
    const { roots, byId } = buildTaskTree(TASKS);
    const h = mapFilterHighlight(roots, boardMapFilter({ hideBlocked: true }));
    expect(byId.has('mC')).toBe(true); // still on the map
    expect(h.get('mC').lit).toBe(false);
    expect(h.get('sCodeBlocked').lit).toBe(false);
    expect(h.get('eC').lit).toBe(true);
    expect(h.get('sCodeOpen').lit).toBe(true);
  });

  it('Code + Hide Blocked: blocked Code work goes grey, and so does a path with nothing else lit', () => {
    expect(lit({ categoryFilter: ['Code'], hideBlocked: true })).toEqual(
      ['eA', 'eB', 'mA', 'mB', 'sCodeOpen', 'sCodeTaken', 'sCodeTaken2'].sort()
    );
  });

  it('all three combine', () => {
    expect(
      lit({ categoryFilter: ['Code'], unclaimedOnly: true, hideBlocked: true })
    ).toEqual(['eA', 'mA', 'sCodeOpen'].sort());
  });

  it('uses the same unclaimed rule as the board', () => {
    expect(isTaskUnclaimedClaimable(TASKS[2])).toBe(true);
    expect(isTaskUnclaimedClaimable(TASKS[3])).toBe(false); // claimed
    expect(isTaskUnclaimedClaimable(TASKS[0])).toBe(false); // Epic
    expect(isTaskUnclaimedClaimable(TASKS[11])).toBe(false); // blocked
  });
});
