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
  getTaskStaffOnlyBlockedReason,
  getUserTaskClaimBlockedReason,
  isTaskStaffOnly,
  isStagingTask,
  canPublishStagingTask,
  canMovePublicTaskToStaging,
  isVolunteerClaimable,
  STAFF_ONLY_TASK_MESSAGE,
  STAGING_TASK_CLAIM_MESSAGE,
  isChecklistComplete,
  progressFromChecklist,
  attachTaskHierarchy,
  inferTaskBoardDepthFromTitle,
  attachTaskDependencies,
  wouldCreateDependencyCycle,
  isTaskVisibleWithLockedToggle,
  isTaskDependencyLocked,
  isTaskVisuallyBlocked,
  getTaskWaitingOnBlockers,
  waitingBlockersExcludingSelf,
  isCommunityDecisionsEpic,
  normalizeChecklist,
  isVisibleProjectHubActivity,
  groupCompletedTaskForest,
  groupTaskForest,
  sortTasksAsForest,
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

  it('lets staff hold the Community Decisions epic', () => {
    const cd = task({
      depth: 0,
      parentTaskId: null,
      title: 'Tether-CD Community Decisions',
      staffOnly: true,
      dbStatus: 'ToDo',
    });
    expect(isCommunityDecisionsEpic(cd)).toBe(true);
    expect(getTaskClaimBlockedReason(cd)).toMatch(/Epic/i);
    expect(getTaskClaimBlockedReason(cd, { isStaff: true })).toBeNull();
    expect(
      isCommunityDecisionsEpic(
        task({
          depth: 1,
          parentTaskId: 'cd',
          title: 'Tether-CD.1 Suit and world palette',
        })
      )
    ).toBe(false);
  });

  it('blocks parents that have children', () => {
    const reason = getTaskClaimBlockedReason(
      task({ depth: 1, hasChildren: true, childCount: 2 })
    );
    expect(reason).toMatch(/sub-task/i);
  });

  it('lets staff claim a Medium that has children', () => {
    const parent = task({
      depth: 1,
      hasChildren: true,
      childCount: 1,
      dbStatus: 'ToDo',
    });
    expect(getTaskClaimBlockedReason(parent)).toMatch(/sub-task/i);
    expect(
      getTaskClaimBlockedReason(parent, { isStaff: true })
    ).toBeNull();
  });

  it('lets staff claim when dependency override is on', () => {
    const locked = task({
      depth: 2,
      hasChildren: false,
      isLocked: true,
      dependencyOverride: true,
      lockedWaitingOn: ['Other task'],
    });
    expect(getTaskClaimBlockedReason(locked)).toBeNull();
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

describe('Staff Only claim gate', () => {
  it('maps staffOnly from the row flag and leaves volunteerClaimable structural', () => {
    const leaf = task({
      depth: 2,
      hasChildren: false,
      childCount: 0,
      staffOnly: true,
    });
    expect(isTaskStaffOnly(leaf)).toBe(true);
    expect(isVolunteerClaimable(leaf)).toBe(true);
    expect(getTaskClaimBlockedReason(leaf)).toBeNull();
  });

  it('blocks volunteers and allows staff/founders', () => {
    const leaf = task({
      depth: 2,
      hasChildren: false,
      childCount: 0,
      staffOnly: true,
    });
    expect(getTaskStaffOnlyBlockedReason(leaf, false)).toBe(
      STAFF_ONLY_TASK_MESSAGE
    );
    expect(getTaskStaffOnlyBlockedReason(leaf, true)).toBeNull();
    expect(
      getUserTaskClaimBlockedReason(leaf, { isStaff: false })
    ).toBe(STAFF_ONLY_TASK_MESSAGE);
    expect(getUserTaskClaimBlockedReason(leaf, { isStaff: true })).toBeNull();
  });

  it('still prefers hierarchy/lock reasons over Staff Only', () => {
    const locked = task({
      depth: 2,
      staffOnly: true,
      isLocked: true,
      lockedWaitingOn: ['Choose art style'],
    });
    expect(getUserTaskClaimBlockedReason(locked, { isStaff: false })).toMatch(
      /Locked/i
    );
    expect(getUserTaskClaimBlockedReason(locked, { isStaff: true })).toMatch(
      /Locked/i
    );
  });
});

describe('Staging vs Public board scope', () => {
  it('blocks claiming staging tasks for everyone', () => {
    const leaf = task({
      depth: 2,
      hasChildren: false,
      childCount: 0,
      boardScope: 'staging',
    });
    expect(isStagingTask(leaf)).toBe(true);
    expect(isVolunteerClaimable(leaf)).toBe(false);
    expect(getTaskClaimBlockedReason(leaf)).toBe(STAGING_TASK_CLAIM_MESSAGE);
    expect(getUserTaskClaimBlockedReason(leaf, { isStaff: true })).toBe(
      STAGING_TASK_CLAIM_MESSAGE
    );
  });

  it('lets staff publish Epics and Mediums, not Smalls', () => {
    expect(
      canPublishStagingTask(task({ depth: 0, boardScope: 'staging' }))
    ).toBe(true);
    expect(
      canPublishStagingTask(task({ depth: 1, boardScope: 'staging' }))
    ).toBe(true);
    expect(
      canPublishStagingTask(task({ depth: 2, boardScope: 'staging' }))
    ).toBe(false);
    expect(
      canPublishStagingTask(task({ depth: 0, boardScope: 'public' }))
    ).toBe(false);
  });

  it('lets staff move public Epics and Mediums back to Staging, not Smalls', () => {
    expect(
      canMovePublicTaskToStaging(task({ id: 'e', depth: 0, boardScope: 'public' }))
    ).toBe(true);
    expect(
      canMovePublicTaskToStaging(task({ id: 'm', depth: 1, boardScope: 'public' }))
    ).toBe(true);
    expect(
      canMovePublicTaskToStaging(task({ id: 's', depth: 2, boardScope: 'public' }))
    ).toBe(false);
    expect(
      canMovePublicTaskToStaging(task({ id: 'st', depth: 0, boardScope: 'staging' }))
    ).toBe(false);
  });

  it('does not change public leaf claimability', () => {
    const leaf = task({
      depth: 2,
      hasChildren: false,
      childCount: 0,
      boardScope: 'public',
    });
    expect(isStagingTask(leaf)).toBe(false);
    expect(getTaskClaimBlockedReason(leaf)).toBeNull();
    expect(isVolunteerClaimable(leaf)).toBe(true);
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
    expect(art.lockedWaitingOnBlockers).toEqual([
      expect.objectContaining({
        id: 'blocker',
        title: 'Choose art style',
      }),
    ]);
    expect(getTaskWaitingOnBlockers(art)).toEqual([
      expect.objectContaining({
        id: 'blocker',
        title: 'Choose art style',
      }),
    ]);
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

  it('marks a Medium blocked when every incomplete child is locked', () => {
    const hierarchy = attachTaskHierarchy([
      task({ id: 'epic1', title: 'Epic', parentTaskId: null }),
      task({ id: 'gate', title: 'Locomotion', parentTaskId: 'epic1' }),
      task({ id: 'mid1', title: 'Medium', parentTaskId: 'epic1' }),
      task({ id: 'a', title: 'Small A', parentTaskId: 'mid1' }),
      task({ id: 'b', title: 'Small B', parentTaskId: 'mid1' }),
    ]);
    const withDeps = attachTaskDependencies(hierarchy, [
      { task_id: 'a', blocks_on_task_id: 'gate' },
      { task_id: 'b', blocks_on_task_id: 'gate' },
    ]);
    const mid = withDeps.find((t) => t.id === 'mid1');
    const epic = withDeps.find((t) => t.id === 'epic1');
    expect(withDeps.find((t) => t.id === 'a').isLocked).toBe(true);
    expect(mid.isLocked).toBe(false);
    expect(mid.isBlockedGroup).toBe(true);
    expect(mid.isVisuallyBlocked).toBe(true);
    expect(isTaskVisuallyBlocked(mid)).toBe(true);
    expect(mid.lockedWaitingOnBlockers).toEqual([
      expect.objectContaining({ id: 'gate', title: 'Locomotion' }),
    ]);
    expect(getTaskWaitingOnBlockers(mid).map((b) => b.id)).toEqual(['gate']);
    expect(epic.isBlockedGroup).toBe(false);
    expect(epic.isVisuallyBlocked).toBe(false);
    expect(isTaskVisibleWithLockedToggle(mid, false)).toBe(true);
  });

  it('does not grey a parent when any incomplete child is unblocked', () => {
    const hierarchy = attachTaskHierarchy([
      task({ id: 'epic1', title: 'Epic', parentTaskId: null }),
      task({ id: 'gate', title: 'Locomotion', parentTaskId: 'epic1' }),
      task({ id: 'mid1', title: 'Medium', parentTaskId: 'epic1' }),
      task({ id: 'a', title: 'Small A', parentTaskId: 'mid1' }),
      task({ id: 'b', title: 'Small B', parentTaskId: 'mid1' }),
    ]);
    const withDeps = attachTaskDependencies(hierarchy, [
      { task_id: 'a', blocks_on_task_id: 'gate' },
    ]);
    const mid = withDeps.find((t) => t.id === 'mid1');
    expect(mid.isBlockedGroup).toBe(false);
    expect(mid.isVisuallyBlocked).toBe(false);
    expect(isTaskVisuallyBlocked(mid)).toBe(false);
  });

  it('ignores completed children when rolling blocked state up', () => {
    const hierarchy = attachTaskHierarchy([
      task({ id: 'epic1', title: 'Epic', parentTaskId: null }),
      task({ id: 'gate', title: 'Locomotion', parentTaskId: 'epic1' }),
      task({ id: 'mid1', title: 'Medium', parentTaskId: 'epic1' }),
      task({
        id: 'done',
        title: 'Done small',
        parentTaskId: 'mid1',
        dbStatus: 'Completed',
        status: 'completed',
      }),
      task({ id: 'a', title: 'Small A', parentTaskId: 'mid1' }),
    ]);
    const withDeps = attachTaskDependencies(hierarchy, [
      { task_id: 'a', blocks_on_task_id: 'gate' },
    ]);
    const mid = withDeps.find((t) => t.id === 'mid1');
    expect(mid.isBlockedGroup).toBe(true);
    expect(mid.isVisuallyBlocked).toBe(true);
  });

  it('does not mark a parent Blocked when children only wait on that parent', () => {
    const hierarchy = attachTaskHierarchy([
      task({ id: 'epic1', title: 'Epic', parentTaskId: null }),
      task({
        id: 'mid32',
        title: 'Tether-3.2 Pull/resist and failure-mode tests',
        parentTaskId: 'epic1',
      }),
      task({
        id: 'small',
        title: 'Tether-3.2.1 Failure-mode playtest',
        parentTaskId: 'mid32',
      }),
    ]);
    const withDeps = attachTaskDependencies(hierarchy, [
      { task_id: 'small', blocks_on_task_id: 'mid32' },
      { task_id: 'mid32', blocks_on_task_id: 'mid32' },
    ]);
    const parent = withDeps.find((t) => t.id === 'mid32');
    const child = withDeps.find((t) => t.id === 'small');
    expect(child.isLocked).toBe(true);
    expect(child.lockedWaitingOn).toEqual([
      'Tether-3.2 Pull/resist and failure-mode tests',
    ]);
    expect(parent.isLocked).toBe(false);
    expect(parent.isBlockedGroup).toBe(false);
    expect(parent.isVisuallyBlocked).toBe(false);
    expect(parent.lockedWaitingOn || []).not.toContain(
      'Tether-3.2 Pull/resist and failure-mode tests'
    );
  });

  it('greys an Epic when every Medium under it is blocked', () => {
    const hierarchy = attachTaskHierarchy([
      task({ id: 'epic1', title: 'Epic', parentTaskId: null }),
      task({ id: 'gate', title: 'Locomotion', parentTaskId: null }),
      task({ id: 'mid1', title: 'Medium A', parentTaskId: 'epic1' }),
      task({ id: 'mid2', title: 'Medium B', parentTaskId: 'epic1' }),
      task({ id: 'a', title: 'Small A', parentTaskId: 'mid1' }),
      task({ id: 'b', title: 'Small B', parentTaskId: 'mid2' }),
    ]);
    const withDeps = attachTaskDependencies(hierarchy, [
      { task_id: 'a', blocks_on_task_id: 'gate' },
      { task_id: 'b', blocks_on_task_id: 'gate' },
    ]);
    expect(withDeps.find((t) => t.id === 'mid1').isBlockedGroup).toBe(true);
    expect(withDeps.find((t) => t.id === 'mid2').isBlockedGroup).toBe(true);
    const epic = withDeps.find((t) => t.id === 'epic1');
    expect(epic.isLocked).toBe(false);
    expect(epic.isBlockedGroup).toBe(true);
    expect(epic.isVisuallyBlocked).toBe(true);
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

describe('waitingBlockersExcludingSelf / getTaskWaitingOnBlockers', () => {
  it('drops self by id and by title', () => {
    const t = task({
      id: 'mid32',
      title: 'Tether-3.2 Pull/resist and failure-mode tests',
    });
    expect(
      waitingBlockersExcludingSelf(t, [
        { id: 'mid32', title: 'Tether-3.2 Pull/resist and failure-mode tests' },
        { id: 't31', title: 'Tether-3.1 Core locomotion and camera' },
      ])
    ).toEqual([
      expect.objectContaining({
        id: 't31',
        title: 'Tether-3.1 Core locomotion and camera',
      }),
    ]);
  });

  it('falls back to title-only lockedWaitingOn when ids are missing', () => {
    const t = task({
      id: 's1',
      lockedWaitingOn: ['Tether-3.1 Core locomotion and camera'],
    });
    expect(getTaskWaitingOnBlockers(t)).toEqual([
      expect.objectContaining({
        id: null,
        title: 'Tether-3.1 Core locomotion and camera',
      }),
    ]);
  });

  it('keeps blocker ids on rolled-up Epic waiting-on lists', () => {
    const hierarchy = attachTaskHierarchy([
      task({ id: 'epic1', title: 'Epic', parentTaskId: null }),
      task({ id: 'gate', title: 'Locomotion', parentTaskId: null }),
      task({ id: 'mid1', title: 'Medium A', parentTaskId: 'epic1' }),
      task({ id: 'mid2', title: 'Medium B', parentTaskId: 'epic1' }),
      task({ id: 'a', title: 'Small A', parentTaskId: 'mid1' }),
      task({ id: 'b', title: 'Small B', parentTaskId: 'mid2' }),
    ]);
    const withDeps = attachTaskDependencies(hierarchy, [
      { task_id: 'a', blocks_on_task_id: 'gate' },
      { task_id: 'b', blocks_on_task_id: 'gate' },
    ]);
    const epic = withDeps.find((t) => t.id === 'epic1');
    expect(getTaskWaitingOnBlockers(epic)).toEqual([
      expect.objectContaining({ id: 'gate', title: 'Locomotion' }),
    ]);
  });
});

describe('orphaned nested tasks (archived parent)', () => {
  it('infers Epic / Medium / Small from Tether IDs', () => {
    expect(inferTaskBoardDepthFromTitle('Tether-CD Community Decisions')).toBe(0);
    expect(
      inferTaskBoardDepthFromTitle('Tether-CD.1 Suit and world palette')
    ).toBe(1);
    expect(inferTaskBoardDepthFromTitle('Tether-P First Spark')).toBe(0);
    expect(inferTaskBoardDepthFromTitle('Tether-P.3 QA templates')).toBe(1);
    expect(
      inferTaskBoardDepthFromTitle('Tether-P.3.2 Playtest note template')
    ).toBe(2);
    expect(inferTaskBoardDepthFromTitle('Tether-10.1 Core netcode')).toBe(1);
    expect(inferTaskBoardDepthFromTitle('Design core loop')).toBeNull();
  });

  it('does not label a nested Tether Small as Epic when its parent is missing', () => {
    const rows = attachTaskHierarchy([
      task({
        id: 'orphan',
        title: 'Tether-P.3.2 Playtest note template',
        parentTaskId: 'missing-parent',
        dbStatus: 'ToDo',
        status: 'todo',
      }),
    ]);
    const orphan = rows[0];
    expect(orphan.depth).toBe(2);
    expect(orphan.levelShort).toBe('Small');
    expect(orphan.isEpic).toBe(false);
    expect(canMovePublicTaskToStaging(orphan)).toBe(false);
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

describe('project hub recent activity', () => {
  it('hides checklist progress ticks from the hub feed', () => {
    expect(isVisibleProjectHubActivity('updated progress on')).toBe(false);
    expect(isVisibleProjectHubActivity('progress')).toBe(false);
    expect(isVisibleProjectHubActivity('claimed')).toBe(true);
    expect(isVisibleProjectHubActivity('completed')).toBe(true);
    expect(isVisibleProjectHubActivity('submitted_for_review')).toBe(true);
    expect(isVisibleProjectHubActivity('suggested_task')).toBe(true);
    expect(isVisibleProjectHubActivity('claim_split_to_smalls')).toBe(false);
  });
});

describe('groupCompletedTaskForest', () => {
  it('nests completed mediums and smalls under a completed epic', () => {
    const epic = task({ id: 'e', title: 'Epic', parentTaskId: null, depth: 0 });
    const med = task({ id: 'm', title: 'Medium', parentTaskId: 'e', depth: 1 });
    const small = task({
      id: 's',
      title: 'Small',
      parentTaskId: 'm',
      depth: 2,
    });
    const orphan = task({
      id: 'o',
      title: 'Orphan small',
      parentTaskId: 'other',
      depth: 2,
    });
    const { roots, childrenOf } = groupCompletedTaskForest([
      small,
      epic,
      orphan,
      med,
    ]);
    expect(roots.map((t) => t.id)).toEqual(['e', 'o']);
    expect(childrenOf.get('e').map((t) => t.id)).toEqual(['m']);
    expect(childrenOf.get('m').map((t) => t.id)).toEqual(['s']);
    expect(childrenOf.get('o')).toBeUndefined();
  });

  it('sits a small under its epic when the medium is missing from the slice', () => {
    const epic = task({ id: 'e', title: 'Epic', parentTaskId: null, depth: 0 });
    const med = task({ id: 'm', title: 'Medium', parentTaskId: 'e', depth: 1 });
    const small = task({
      id: 's',
      title: 'Small',
      parentTaskId: 'm',
      depth: 2,
    });
    const { roots, childrenOf } = groupTaskForest([epic, small], {
      allTasks: [epic, med, small],
    });
    expect(roots.map((t) => t.id)).toEqual(['e']);
    expect(childrenOf.get('e').map((t) => t.id)).toEqual(['s']);
  });

  it('nests blocked section maps under the epic when kit parents are off the top-level slice', () => {
    const epic = task({ id: 'e', title: 'Tether-6 Maps', depth: 0 });
    const kit = task({
      id: 'kit',
      title: 'Tether-6.1 Modular kit',
      parentTaskId: 'e',
      depth: 1,
    });
    const ground = task({
      id: 'g',
      title: 'Tether-6.1.2 Ground kit family',
      parentTaskId: 'kit',
      depth: 2,
    });
    const section2 = task({
      id: 's2',
      title: 'Tether-6.3 Section 2 floating rocks and islands',
      parentTaskId: 'e',
      depth: 1,
    });
    const { roots, childrenOf } = groupTaskForest([epic, ground, section2], {
      allTasks: [epic, kit, ground, section2],
    });
    expect(roots.map((t) => t.id)).toEqual(['e']);
    expect(childrenOf.get('e').map((t) => t.id).sort()).toEqual(['g', 's2']);
  });
});

describe('sortTasksAsForest', () => {
  it('lists nested work under the parent instead of shuffled siblings', () => {
    const epicB = task({
      id: 'b',
      title: 'Tether-5 Enemies',
      parentTaskId: null,
      depth: 0,
      sortOrder: 50,
    });
    const epicA = task({
      id: 'a',
      title: 'Tether-4 Resources',
      parentTaskId: null,
      depth: 0,
      sortOrder: 40,
    });
    const small = task({
      id: 's',
      title: 'Tether-4.1.1 Prefab',
      parentTaskId: 'm',
      depth: 2,
      sortOrder: 10,
    });
    const med = task({
      id: 'm',
      title: 'Tether-4.1 Nodes',
      parentTaskId: 'a',
      depth: 1,
      sortOrder: 10,
    });
    const ordered = sortTasksAsForest([small, epicB, med, epicA]);
    expect(ordered.map((t) => t.id)).toEqual(['a', 'm', 's', 'b']);
  });
});
