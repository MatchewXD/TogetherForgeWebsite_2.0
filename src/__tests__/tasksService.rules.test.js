/**
 * High-risk Task Board rules: claims, checklist gate, parent ready-for-review.
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_ACTIVE_CLAIMS,
  NEW_USER_CLAIM_LIMIT,
  ESTABLISHED_CLAIM_LIMIT,
  CLAIM_LIMIT_UNLOCK_COMPLETIONS,
  TRUSTED_CLAIM_UNLOCK_COMPLETIONS,
  OPEN_CLAIM_STATUSES,
  claimLimitForAcceptedCount,
  getTaskClaimBlockedReason,
  isVolunteerClaimable,
  isChecklistComplete,
  progressFromChecklist,
  attachTaskHierarchy,
  attachTaskDependencies,
  wouldCreateDependencyCycle,
  isTaskVisibleWithLockedToggle,
  isTaskDependencyLocked,
  normalizeChecklist,
} from '../services/tasksService';

function task(partial) {
  return {
    id: partial.id || 't1',
    title: partial.title || 'Task',
    parentTaskId: partial.parentTaskId ?? null,
    depth: partial.depth ?? 0,
    status: partial.status || 'todo',
    dbStatus: partial.dbStatus || 'ToDo',
    hasChildren: partial.hasChildren ?? false,
    childCount: partial.childCount ?? 0,
    claim: partial.claim ?? null,
    subtasks: partial.subtasks ?? [],
    progressPercent: partial.progressPercent ?? 0,
    ...partial,
  };
}

describe('claim limits (constants)', () => {
  it('defines progressive trust limits used site-wide', () => {
    expect(NEW_USER_CLAIM_LIMIT).toBe(2);
    expect(ESTABLISHED_CLAIM_LIMIT).toBe(3);
    expect(MAX_ACTIVE_CLAIMS).toBe(5);
    expect(CLAIM_LIMIT_UNLOCK_COMPLETIONS).toBe(2);
    expect(TRUSTED_CLAIM_UNLOCK_COMPLETIONS).toBe(5);
    expect(claimLimitForAcceptedCount(0)).toBe(2);
    expect(claimLimitForAcceptedCount(2)).toBe(3);
    expect(claimLimitForAcceptedCount(5)).toBe(5);
    expect(OPEN_CLAIM_STATUSES).toEqual(
      expect.arrayContaining(['Active', 'PendingReview'])
    );
  });
});

describe('getTaskClaimBlockedReason / isVolunteerClaimable', () => {
  it('blocks Epics (depth 0)', () => {
    const reason = getTaskClaimBlockedReason(
      task({ depth: 0, dbStatus: 'ToDo' })
    );
    expect(reason).toMatch(/Epic/i);
    expect(isVolunteerClaimable(task({ depth: 0 }))).toBe(false);
  });

  it('blocks parents that have children', () => {
    const reason = getTaskClaimBlockedReason(
      task({ depth: 1, hasChildren: true, childCount: 2 })
    );
    expect(reason).toMatch(/sub-task/i);
  });

  it('blocks completed tasks', () => {
    expect(
      getTaskClaimBlockedReason(
        task({ depth: 2, dbStatus: 'Completed', status: 'completed' })
      )
    ).toMatch(/completed/i);
  });

  it('allows Medium/Small leaves', () => {
    expect(
      getTaskClaimBlockedReason(
        task({ depth: 1, hasChildren: false, childCount: 0, dbStatus: 'ToDo' })
      )
    ).toBeNull();
    expect(
      isVolunteerClaimable(
        task({ depth: 2, hasChildren: false, childCount: 0 })
      )
    ).toBe(true);
  });

  it('blocks locked tasks with waiting-on message', () => {
    const reason = getTaskClaimBlockedReason(
      task({
        depth: 2,
        hasChildren: false,
        isLocked: true,
        lockedWaitingOn: ['Choose art style'],
      })
    );
    expect(reason).toMatch(/Locked/i);
    expect(reason).toMatch(/Choose art style/);
    expect(
      isVolunteerClaimable(
        task({ depth: 2, isLocked: true, lockedWaitingOn: ['X'] })
      )
    ).toBe(false);
  });
});

describe('attachTaskDependencies (Blocked by / Locked)', () => {
  /** Epic → Medium → leaves so attachTaskHierarchy yields claimable depth > 0 */
  const projectTasks = (leaves) =>
    attachTaskHierarchy([
      task({
        id: 'epic1',
        title: 'Epic',
        parentTaskId: null,
        dbStatus: 'ToDo',
        status: 'todo',
      }),
      task({
        id: 'mid1',
        title: 'Medium',
        parentTaskId: 'epic1',
        dbStatus: 'ToDo',
        status: 'todo',
      }),
      ...leaves.map((L) =>
        task({
          id: L.id,
          title: L.title,
          parentTaskId: 'mid1',
          dbStatus: L.dbStatus || 'ToDo',
          status: L.status || 'todo',
          dependencyOverride: L.dependencyOverride || false,
        })
      ),
    ]);

  it('locks when any blocker is not Completed', () => {
    const hierarchy = projectTasks([
      { id: 'blocker', title: 'Choose art style' },
      { id: 'art1', title: 'Draw hero' },
    ]);
    const withDeps = attachTaskDependencies(hierarchy, [
      { task_id: 'art1', blocks_on_task_id: 'blocker' },
    ]);
    const art = withDeps.find((t) => t.id === 'art1');
    expect(art.isLocked).toBe(true);
    expect(art.volunteerClaimable).toBe(false);
    expect(art.lockedWaitingOn).toEqual(['Choose art style']);
    expect(art.claimBlockedReason).toMatch(/Choose art style/);
  });

  it('unlocks when all blockers are Completed (accepted)', () => {
    const hierarchy = projectTasks([
      {
        id: 'blocker',
        title: 'Choose art style',
        dbStatus: 'Completed',
        status: 'completed',
      },
      { id: 'art1', title: 'Draw hero' },
      { id: 'art2', title: 'Draw villain' },
    ]);
    const withDeps = attachTaskDependencies(hierarchy, [
      { task_id: 'art1', blocks_on_task_id: 'blocker' },
      { task_id: 'art2', blocks_on_task_id: 'blocker' },
    ]);
    expect(withDeps.find((t) => t.id === 'art1').isLocked).toBe(false);
    expect(withDeps.find((t) => t.id === 'art1').volunteerClaimable).toBe(true);
    expect(withDeps.find((t) => t.id === 'art2').isLocked).toBe(false);
  });

  it('stays locked until every multi-blocker is complete', () => {
    const hierarchy = projectTasks([
      { id: 'a', title: 'Style', dbStatus: 'Completed', status: 'completed' },
      { id: 'b', title: 'Palette', dbStatus: 'ToDo', status: 'todo' },
      { id: 'art1', title: 'Draw hero' },
    ]);
    const withDeps = attachTaskDependencies(hierarchy, [
      { task_id: 'art1', blocks_on_task_id: 'a' },
      { task_id: 'art1', blocks_on_task_id: 'b' },
    ]);
    const art = withDeps.find((t) => t.id === 'art1');
    expect(art.isLocked).toBe(true);
    expect(art.lockedWaitingOn).toEqual(['Palette']);
  });

  it('respects dependency_override (staff unlock)', () => {
    const hierarchy = projectTasks([
      { id: 'blocker', title: 'Choose art style' },
      { id: 'art1', title: 'Draw hero', dependencyOverride: true },
    ]);
    const withDeps = attachTaskDependencies(hierarchy, [
      { task_id: 'art1', blocks_on_task_id: 'blocker' },
    ]);
    const art = withDeps.find((t) => t.id === 'art1');
    expect(art.isLocked).toBe(false);
    expect(art.dependencyOverride).toBe(true);
    expect(art.blockedBy).toHaveLength(1);
    expect(art.volunteerClaimable).toBe(true);
  });

  it('detects dependency cycles', () => {
    const list = [
      { id: 'a', blockedByIds: ['b'] },
      { id: 'b', blockedByIds: [] },
    ];
    // b depends on a would cycle if a already depends on b
    expect(wouldCreateDependencyCycle('b', 'a', list)).toBe(true);
    expect(wouldCreateDependencyCycle('a', 'c', list)).toBe(false);
  });
});

describe('isTaskVisibleWithLockedToggle (board visibility)', () => {
  it('hides locked tasks when toggle is off (default)', () => {
    const locked = task({ isLocked: true, lockedWaitingOn: ['Style'] });
    const open = task({ isLocked: false });
    expect(isTaskVisibleWithLockedToggle(locked, false)).toBe(false);
    expect(isTaskVisibleWithLockedToggle(open, false)).toBe(true);
    expect(isTaskDependencyLocked(locked)).toBe(true);
  });

  it('shows locked tasks when toggle is on', () => {
    const locked = task({ isLocked: true, lockedWaitingOn: ['Style'] });
    expect(isTaskVisibleWithLockedToggle(locked, true)).toBe(true);
  });

  it('treats incomplete blocker list as locked even if isLocked flag missing', () => {
    const partial = task({
      isLocked: undefined,
      dependencyOverride: false,
      blockedByIncomplete: [{ id: 'x', title: 'Style' }],
      dbStatus: 'ToDo',
      status: 'todo',
    });
    expect(isTaskDependencyLocked(partial)).toBe(true);
    expect(isTaskVisibleWithLockedToggle(partial, false)).toBe(false);
    expect(isTaskVisibleWithLockedToggle(partial, true)).toBe(true);
  });
});

describe('isChecklistComplete (submit-for-review gate)', () => {
  it('treats empty checklist as complete (no gate)', () => {
    expect(isChecklistComplete([])).toBe(true);
    expect(isChecklistComplete(null)).toBe(true);
  });

  it('requires every item done', () => {
    const items = normalizeChecklist([
      { id: 'a', label: 'One', done: true },
      { id: 'b', label: 'Two', done: false },
    ]);
    expect(isChecklistComplete(items)).toBe(false);
    items[1].done = true;
    expect(isChecklistComplete(items)).toBe(true);
  });

  it('progressFromChecklist matches completion ratio', () => {
    expect(
      progressFromChecklist([
        { label: 'a', done: true },
        { label: 'b', done: false },
      ])
    ).toBe(50);
  });
});

describe('attachTaskHierarchy parent Ready for Review', () => {
  it('does not mark parent Completed when all children are Completed', () => {
    const rows = [
      task({
        id: 'epic',
        title: 'Epic',
        depth: 0,
        dbStatus: 'ToDo',
        status: 'todo',
      }),
      task({
        id: 'med',
        title: 'Medium',
        parentTaskId: 'epic',
        depth: 1,
        dbStatus: 'Completed',
        status: 'completed',
      }),
      task({
        id: 'small',
        title: 'Small',
        parentTaskId: 'med',
        depth: 2,
        dbStatus: 'Completed',
        status: 'completed',
      }),
    ];

    // Only small+med completed: medium ready, epic not until medium staff-closed
    const midReady = attachTaskHierarchy([
      task({
        id: 'med',
        parentTaskId: null,
        depth: 0,
        dbStatus: 'ToDo',
        status: 'todo',
      }),
      task({
        id: 's1',
        parentTaskId: 'med',
        depth: 1,
        dbStatus: 'Completed',
        status: 'completed',
      }),
      task({
        id: 's2',
        parentTaskId: 'med',
        depth: 1,
        dbStatus: 'Completed',
        status: 'completed',
      }),
    ]);

    const parent = midReady.find((t) => t.id === 'med');
    expect(parent.hasChildren).toBe(true);
    expect(parent.allChildrenCompleted).toBe(true);
    expect(parent.readyForParentReview).toBe(true);
    expect(parent.isFullyDone).toBe(false);
    expect(parent.dbStatus).not.toBe('Completed');
    expect(parent.progressPercent).toBe(100);
  });

  it('Epic becomes ready only when Medium children are status Completed', () => {
    const tree = attachTaskHierarchy([
      task({
        id: 'epic',
        parentTaskId: null,
        depth: 0,
        dbStatus: 'ToDo',
        status: 'todo',
      }),
      task({
        id: 'med',
        parentTaskId: 'epic',
        depth: 1,
        dbStatus: 'ToDo',
        status: 'todo',
      }),
      task({
        id: 's1',
        parentTaskId: 'med',
        depth: 2,
        dbStatus: 'Completed',
        status: 'completed',
      }),
    ]);

    const epic = tree.find((t) => t.id === 'epic');
    const med = tree.find((t) => t.id === 'med');
    // Medium has all smalls done → ready, but not Completed
    expect(med.readyForParentReview).toBe(true);
    expect(med.isFullyDone).toBe(false);
    // Epic still waiting on Medium status Completed
    expect(epic.allChildrenCompleted).toBe(false);
    expect(epic.readyForParentReview).toBe(false);

    const afterStaffClosesMedium = attachTaskHierarchy([
      task({
        id: 'epic',
        parentTaskId: null,
        depth: 0,
        dbStatus: 'ToDo',
        status: 'todo',
      }),
      task({
        id: 'med',
        parentTaskId: 'epic',
        depth: 1,
        dbStatus: 'Completed',
        status: 'completed',
      }),
      task({
        id: 's1',
        parentTaskId: 'med',
        depth: 2,
        dbStatus: 'Completed',
        status: 'completed',
      }),
    ]);
    const epic2 = afterStaffClosesMedium.find((t) => t.id === 'epic');
    expect(epic2.readyForParentReview).toBe(true);
    expect(epic2.isFullyDone).toBe(false);
  });

  it('staff-completed parent is fully done, not ready-for-review', () => {
    const tree = attachTaskHierarchy([
      task({
        id: 'med',
        parentTaskId: null,
        depth: 0,
        dbStatus: 'Completed',
        status: 'completed',
      }),
      task({
        id: 's1',
        parentTaskId: 'med',
        depth: 1,
        dbStatus: 'Completed',
        status: 'completed',
      }),
    ]);
    const parent = tree.find((t) => t.id === 'med');
    expect(parent.isFullyDone).toBe(true);
    expect(parent.readyForParentReview).toBe(false);
  });
});
