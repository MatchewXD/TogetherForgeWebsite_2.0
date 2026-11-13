/**
 * ProjectWorkspace - single-project hub at /projects/:id
 * Dedicated Task Board at /projects/:id/board (boardOnly mode).
 *
 * Hub sections:
 *  1. Project Header
 *  2. Project Pulse
 *  3. Task Board entry (full board lives on /board)
 *  4. Recent Activity + Shoutouts
 *  5. Open Questions, Ideas, Updates
 *
 * Board page: focused kanban + task modals (claim, review, create/edit).
 */

import { claimHousekeepingRun } from '../utils/housekeeping';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Link,
  useParams,
  useNavigate,
  useLocation,
  useMatch,
} from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import SuggestTaskModal from '../components/tasks/SuggestTaskModal';
import OpenQuestionsSection from '../components/projects/OpenQuestionsSection';
import ProjectUpdatesSection from '../components/projects/ProjectUpdatesSection';
import { updateProject } from '../services/projectsService';
import { useIsModerator } from '../hooks/useIsModerator';
import { areClaimsEnabled, CLAIMS_PAUSED_CODE } from '../constants/claimsEnabled';
import {
  tasksService,
  getChildTasks,
  getTaskBreadcrumb,
  getUserTaskClaimBlockedReason,
  STAFF_ONLY_TASK_MESSAGE,
  STAGING_TASK_CLAIM_MESSAGE,
  BOARD_SCOPE_STAGING,
  BOARD_SCOPE_PUBLIC,
  canPublishStagingTask,
  canMovePublicTaskToStaging,
  isStagingTask,
  TASK_CANNOT_WAIT_ON_SELF,
  normalizeChecklist,
  progressFromChecklist,
  isChecklistComplete,
  isTaskVisibleWithLockedToggle,
  getTaskWaitingOnBlockers,
  isCommunityDecisionsEpic,
  sortTasksAsForest,
  selectBoardTasks,
  CLAIM_IDLE_RELEASE_DAYS,
  formatAutoReleaseReason,
} from '../services/tasksService';
import { taskSuggestionsService } from '../services/taskSuggestionsService';
import { ideasService } from '../services/ideasService';
import {
  optimisticPublicCount,
  reconcilePublicCount,
} from '../utils/publicCounts';
import { supabase } from '../lib/supabase';
import { displayProjectTitle, canonicalProjectSlug } from '../utils/ideaStatus';
import {
  filterUnseenAutoReleases,
  pingUserNotices,
  rememberAutoReleaseSeen,
} from '../utils/userNotices';
import { normalizeTaskCategoryKey } from '../constants/taskCategories';
import { normalizeTaskEffort } from '../constants/taskEffort';
import { composeReviewEvidence, validateReviewEvidencePackage, normalizeEvidenceUrl } from '../constants/taskReviewEvidence';
import { DISCORD_URL } from '../constants/communityLinks';
import BoardHeader from './workspace/BoardHeader';
import HubHeader from './workspace/HubHeader';
import TaskBoardSection from './workspace/TaskBoardSection';
import ActivityShoutoutsSection from './workspace/ActivityShoutoutsSection';
import ProjectIdeasSection from './workspace/ProjectIdeasSection';
import TaskDetailModal from './workspace/TaskDetailModal';
import SubmitReviewModal from './workspace/SubmitReviewModal';
import ProjectGithubModal from './workspace/ProjectGithubModal';
import TaskFormModal from './workspace/TaskFormModal';
import PublishTaskConfirmModal from './workspace/PublishTaskConfirmModal';
import UnpublishTaskConfirmModal from './workspace/UnpublishTaskConfirmModal';
import DeleteTaskConfirmModal from './workspace/DeleteTaskConfirmModal';
import {
  FALLBACK_PROJECTS,
  DEFAULT_PROJECT,
  mapWorkspaceIdea,
  MAX_CHECKLIST_STEPS,
  EMPTY_TASK_FORM,
  parseSubtaskLines,
  friendlyError,
} from './workspace/shared';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ProjectWorkspace = () => {
  const { id: projectSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const boardMatch = useMatch({ path: '/projects/:id/board', end: true });
  const stagingMatch = useMatch({
    path: '/projects/:id/board/staging',
    end: true,
  });
  /** Dedicated Task Board page (full focus) vs project hub */
  const isStagingBoard = Boolean(stagingMatch);
  const boardOnly = Boolean(boardMatch) || isStagingBoard;
  const { isModerator, loading: roleLoading } = useIsModerator();

  const [project, setProject] = useState(null);
  const [projectUuid, setProjectUuid] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [activity, setActivity] = useState([]);
  const [shoutouts, setShoutouts] = useState([]);
  const [pulse, setPulse] = useState({
    contributors: 0,
    tasksCompleted: 0,
    openTasks: 0,
    activeWorkers: [],
  });

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [boardError, setBoardError] = useState(null);
  const [toast, setToast] = useState(null);
  const [claimingId, setClaimingId] = useState(null);
  const [joiningId, setJoiningId] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  /** Staff review button label: 'accept' | 'reject' | 'fake' | null */
  const [reviewActionBusy, setReviewActionBusy] = useState(null);
  const [claimQuota, setClaimQuota] = useState(null);
  /** Soft tip on submit (e.g. code task without GitHub link) — does not block */
  const [evidenceLinkWarning, setEvidenceLinkWarning] = useState(null);
  /** Staff: edit project GitHub URL */
  const [githubEditOpen, setGithubEditOpen] = useState(false);
  const [githubEditDraft, setGithubEditDraft] = useState('');
  const [githubEditBusy, setGithubEditBusy] = useState(false);
  /** Staff trust signal for the selected task's claimant */
  const [claimantTrust, setClaimantTrust] = useState(null);
  const [joinRequests, setJoinRequests] = useState([]);
  /** Task ids where the current user already has a pending join request */
  const [myPendingJoinTaskIds, setMyPendingJoinTaskIds] = useState(
    () => new Set()
  );

  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [progressDraft, setProgressDraft] = useState(0);
  const [evidenceDraft, setEvidenceDraft] = useState('');
  /** Proof links on submit-for-review (composed into evidence text) */
  const [evidenceLinks, setEvidenceLinks] = useState(['']);
  /** Optional hand-off / dependency note at submit time */
  const [evidenceDependsOn, setEvidenceDependsOn] = useState('');
  /**
   * Field-scoped validation on submit-for-review modal.
   * Keep note vs links separate so errors highlight the right control.
   */
  const [evidenceNoteError, setEvidenceNoteError] = useState(null);
  const [evidenceLinkError, setEvidenceLinkError] = useState(null);
  /** Separate focused hand-off UI (not the working modal) */
  const [submitReviewOpen, setSubmitReviewOpen] = useState(false);
  const [reviewFeedbackDraft, setReviewFeedbackDraft] = useState('');
  /** Claimant: “bigger than expected” note draft */
  const [scopeHelpDraft, setScopeHelpDraft] = useState('');
  const [scopeHelpOpen, setScopeHelpOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [subtasksDraft, setSubtasksDraft] = useState([]);
  /** Collapsible full-width sections under the main columns */
  const [reviewOpen, setReviewOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);

  // Create / edit task form (Project Lead + Admin via useIsModerator)
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskFormMode, setTaskFormMode] = useState('create'); // 'create' | 'edit'
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [taskFormError, setTaskFormError] = useState(null);
  const [taskFormBusy, setTaskFormBusy] = useState(false);
  /** Kanban: top-level only (default) or full tree flattened */
  const [boardScope, setBoardScope] = useState('top'); // 'top' | 'all'
  /** Multi-select category chips (empty = all). Uses TASK_CATEGORIES labels. */
  const [boardCategoryFilter, setBoardCategoryFilter] = useState([]);
  /** Only show claimable tasks with no active claim */
  const [boardUnclaimedOnly, setBoardUnclaimedOnly] = useState(false);
  /** When true, blocked tasks are hidden on the board and in parent detail. Default off. */
  const [hideBlockedTasks, setHideBlockedTasks] = useState(false);
  /** Staff: force dual-rule auto-release check */
  const [autoReleaseBusy, setAutoReleaseBusy] = useState(false);
  const [stagingBusyId, setStagingBusyId] = useState(null);
  const [publishingId, setPublishingId] = useState(null);
  const [publishConfirmTask, setPublishConfirmTask] = useState(null);
  const [unpublishConfirmTask, setUnpublishConfirmTask] = useState(null);
  const [unpublishingId, setUnpublishingId] = useState(null);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState(null);
  /** Notices for claims auto-released under this user */
  const [autoReleaseNotices, setAutoReleaseNotices] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestAccount, setSuggestAccount] = useState({
    signedIn: false,
    locked: false,
    strikeCount: 0,
  });
  const [pendingSuggestionCount, setPendingSuggestionCount] = useState(0);

  const [projectIdeas, setProjectIdeas] = useState([]);
  const [ideasLoading, setIdeasLoading] = useState(true);
  const [ideasError, setIdeasError] = useState(null);
  // Same pattern as GameIdeas: Set of idea ids the user has voted on
  const [userIdeaVotes, setUserIdeaVotes] = useState(() => new Set());
  const [ideaSortMode, setIdeaSortMode] = useState('newest'); // newest | votes | title
  const [ideaSearch, setIdeaSearch] = useState('');
  const [ideaCategoryFilter, setIdeaCategoryFilter] = useState([]);
  const [ideaFilterOpen, setIdeaFilterOpen] = useState(false);

  const showToast = useCallback((message, kind = 'info') => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 8000);
  }, []);

  const refreshBoard = useCallback(
    async (uuid) => {
      if (!uuid) return;
      const [taskRows, activityRows, pulseData, shoutoutRows] = await Promise.all([
        tasksService.getTasksForProject(uuid, {
          boardScope: isStagingBoard ? BOARD_SCOPE_STAGING : BOARD_SCOPE_PUBLIC,
        }),
        tasksService.getActivityForProject(uuid, { limit: 25 }),
        tasksService.getProjectPulse(uuid),
        tasksService.getShoutouts(uuid, { limit: 8 }),
      ]);
      setTasks(taskRows);
      setActivity(activityRows);
      setPulse(pulseData);
      setShoutouts(shoutoutRows);
    },
    [isStagingBoard]
  );

  // Auth session
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) setUser(session?.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // Project-scoped ideas only (project_id matches slug and/or uuid)
  const loadProjectIdeas = useCallback(async () => {
    if (!projectSlug && !projectUuid) {
      setProjectIdeas([]);
      setIdeasLoading(false);
      return;
    }
    setIdeasLoading(true);
    setIdeasError(null);
    try {
      const keys = { slug: projectSlug, id: projectUuid };
      console.debug('[ProjectWorkspace] loading ideas for', keys);
      const rows = await ideasService.getIdeasForProject(keys);
      console.debug('[ProjectWorkspace] ideas loaded', rows?.length ?? 0, rows);
      const mapped = (rows || []).map(mapWorkspaceIdea);
      setProjectIdeas(mapped);

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (authUser && mapped.length > 0) {
        const ids = mapped.map((i) => i.id);
        const { data: voteRows } = await supabase
          .from('votes')
          .select('idea_id')
          .eq('user_id', authUser.id)
          .in('idea_id', ids);
        // Normalize to Number keys (same as GameIdeas voteKey)
        const voted = new Set();
        for (const row of voteRows || []) {
          const n = Number(row.idea_id);
          voted.add(Number.isFinite(n) ? n : row.idea_id);
        }
        setUserIdeaVotes(voted);
      } else {
        setUserIdeaVotes(new Set());
      }
    } catch (err) {
      console.error('[ProjectWorkspace] loadProjectIdeas failed', err);
      setProjectIdeas([]);
      const msg = err?.message || String(err);
      if (/project_id|column .* does not exist/i.test(msg)) {
        setIdeasError(
          'Ideas are missing project_id. Run supabase/sql/supabase_ideas_project_id.sql in the Supabase SQL Editor, then refresh.'
        );
      } else {
        setIdeasError(friendlyError(err));
      }
    } finally {
      setIdeasLoading(false);
    }
  }, [projectSlug, projectUuid]);

  useEffect(() => {
    loadProjectIdeas();
  }, [loadProjectIdeas]);

  // Scroll to Project Ideas after submit redirect - do NOT re-fetch here
  // (re-fetching overwrites optimistic vote counts and causes flicker).
  useEffect(() => {
    if (location.hash !== '#project-ideas') return undefined;
    const t = window.setTimeout(() => {
      document
        .getElementById('project-ideas')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => window.clearTimeout(t);
  }, [location.hash]);

  // One-shot refresh when arriving with a newly submitted idea id
  useEffect(() => {
    if (!location.state?.newIdeaId) return;
    loadProjectIdeas();
    // Clear navigation state so this doesn't re-run on remounts
    navigate(location.pathname + (location.hash || ''), { replace: true, state: {} });
  }, [location.state?.newIdeaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load project + board
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setBoardError(null);

      const fallback =
        FALLBACK_PROJECTS[projectSlug] ||
        FALLBACK_PROJECTS[canonicalProjectSlug(projectSlug)] ||
        (projectSlug
          ? {
              ...DEFAULT_PROJECT,
              slug: canonicalProjectSlug(projectSlug) || projectSlug,
              title: displayProjectTitle({ slug: projectSlug }) ||
                projectSlug
                  .split('-')
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' '),
            }
          : DEFAULT_PROJECT);

      try {
        const dbProject = await tasksService.getProjectBySlug(projectSlug);
        if (cancelled) return;

        if (dbProject) {
          // Prefer FALLBACK_PROJECTS copy for known catalog slugs so site text
          // stays under version control (DB description is often seed/stale).
          const catalog =
            FALLBACK_PROJECTS[projectSlug] ||
            FALLBACK_PROJECTS[canonicalProjectSlug(projectSlug)];
          const publicSlug =
            canonicalProjectSlug(dbProject.slug) || dbProject.slug;
          setProject({
            id: publicSlug,
            slug: publicSlug,
            uuid: dbProject.id,
            title: displayProjectTitle({
              slug: publicSlug,
              title: catalog?.title || dbProject.title,
            }),
            description:
              catalog?.description ||
              dbProject.description ||
              fallback.description,
            phase: catalog?.phase || dbProject.phase || fallback.phase,
            status: catalog?.status || dbProject.status || fallback.status,
            githubUrl: dbProject.github_url || dbProject.githubUrl || null,
            contributionMeta:
              dbProject.contribution_meta || dbProject.contributionMeta || {},
          });
          setProjectUuid(dbProject.id);
          await refreshBoard(dbProject.id);
        } else {
          setProject({
            id: fallback.slug,
            ...fallback,
          });
          setProjectUuid(null);
          setTasks([]);
          setActivity([]);
          setShoutouts([]);
          setPulse({
            activePeople: 0,
            activeWorkers: [],
            tasksThisWeek: 0,
            tasksThisMonth: 0,
            recentWins: 0,
          });
          setBoardError(
            'No project row found for this slug. Run supabase/sql/supabase_tasks_schema.sql (seed section) in Supabase.'
          );
        }
      } catch (err) {
        if (cancelled) return;
        setProject({ id: fallback.slug, ...fallback });
        setProjectUuid(null);
        setTasks([]);
        setBoardError(friendlyError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [projectSlug, refreshBoard]);

  useEffect(() => {
    if (!isStagingBoard || roleLoading) return;
    if (!isModerator) {
      navigate(`/projects/${projectSlug}/board`, { replace: true });
    }
  }, [isStagingBoard, roleLoading, isModerator, projectSlug, navigate]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );
  const selectedTaskWaitBlockers = useMemo(
    () => getTaskWaitingOnBlockers(selectedTask),
    [selectedTask]
  );
  const selectedTaskShowsBlocked = Boolean(
    selectedTask &&
      !selectedTask.dependencyOverride &&
      selectedTaskWaitBlockers.length > 0 &&
      (selectedTask.isLocked || selectedTask.isVisuallyBlocked)
  );
  const claimsEnabled = areClaimsEnabled();
  const selectedTaskCanClaim = Boolean(
    selectedTask &&
      selectedTask.status === 'todo' &&
      !selectedTask.claimedBy &&
      !getUserTaskClaimBlockedReason(selectedTask, { isStaff: isModerator }) &&
      (!selectedTask.staffOnly || isModerator) &&
      (claimsEnabled || isModerator)
  );
  const selectedTaskClaimsPaused = Boolean(
    selectedTask &&
      !claimsEnabled &&
      !isModerator &&
      selectedTask.status === 'todo' &&
      !selectedTask.claimedBy &&
      !selectedTask.staffOnly &&
      !getUserTaskClaimBlockedReason(selectedTask, { isStaff: false })
  );

  /**
   * Sync modal drafts only when the user opens a *different* task.
   * Board refreshes (e.g. auto-save before Submit for Review) replace
   * selectedTask with a new object for the same id — do not reset drafts
   * or force-close the submit modal in that case (that caused a double-click).
   */
  const lastSyncedTaskIdRef = useRef(null);
  useEffect(() => {
    if (!selectedTask) {
      lastSyncedTaskIdRef.current = null;
      return;
    }
    if (lastSyncedTaskIdRef.current === selectedTask.id) {
      return;
    }
    lastSyncedTaskIdRef.current = selectedTask.id;

    setNotesDraft(selectedTask.claim?.notes || '');
    setEvidenceDraft(selectedTask.claim?.submissionEvidence || '');
    setEvidenceLinks(['']);
    setEvidenceDependsOn('');
    setEvidenceNoteError(null);
    setEvidenceLinkError(null);
    setSubmitReviewOpen(false);
    setReviewFeedbackDraft('');
    setScopeHelpDraft('');
    setScopeHelpOpen(false);
    const checklist = normalizeChecklist(selectedTask.subtasks);
    setSubtasksDraft(checklist);
    // Progress follows checklist when present; otherwise claim/task progress
    const fromList = progressFromChecklist(checklist);
    if (fromList != null) {
      setProgressDraft(Math.min(99, fromList));
    } else {
      setProgressDraft(Math.min(99, selectedTask.progressPercent ?? 0));
    }
  }, [selectedTask]);

  /** Helper usernames on the active claim (filled when join requests are approved). */
  const claimHelperNames = useMemo(() => {
    const helpers = selectedTask?.claim?.helpers;
    if (!Array.isArray(helpers)) return [];
    return helpers
      .map((h) =>
        typeof h === 'string' ? h : h?.username || h?.name || ''
      )
      .map((s) => String(s || '').trim())
      .filter(Boolean);
  }, [selectedTask]);

  /**
   * Board visibility:
   * - "all": every matching task, nested under its Epic → Medium parent
   * - "top": epics / true roots only (plus claimed or in-review leaves).
   *   Nested blocked Mediums/Smalls stay off this list; open the Epic to
   *   see them, or switch to All tasks.
   * - "Hide Blocked Tasks" (off by default) hides locked work everywhere,
   *   including parent detail lists.
   */
  const boardTasks = useMemo(() => {
    const isUnclaimedClaimable = (t) => {
      if (t.dbStatus === 'Completed' || t.status === 'completed') return false;
      if (!isTaskVisibleWithLockedToggle(t, false)) return false;
      if (t.claim?.status === 'Active' || t.claim?.status === 'PendingReview') {
        return false;
      }
      if (t.claimedBy) return false;
      if (t.volunteerClaimable === true) return true;
      if (t.volunteerClaimable === false) return false;
      if (t.hasChildren || t.isEpic || (t.depth || 0) === 0) return false;
      return true;
    };

    return selectBoardTasks(tasks, {
      boardScope,
      hideBlocked: hideBlockedTasks,
      categoryFilter: boardCategoryFilter,
      unclaimedOnly: boardUnclaimedOnly,
      isUnclaimedClaimable,
    });
  }, [
    tasks,
    boardScope,
    boardCategoryFilter,
    boardUnclaimedOnly,
    hideBlockedTasks,
  ]);

  const lockedTaskCount = useMemo(
    () =>
      tasks.filter((t) => !isTaskVisibleWithLockedToggle(t, false)).length,
    [tasks]
  );

  const boardFiltersActive =
    boardCategoryFilter.length > 0 || boardUnclaimedOnly || hideBlockedTasks;

  const toggleBoardCategory = useCallback((cat) => {
    setBoardCategoryFilter((prev) => {
      const key = normalizeTaskCategoryKey(cat);
      const has = prev.some((c) => normalizeTaskCategoryKey(c) === key);
      if (has) return prev.filter((c) => normalizeTaskCategoryKey(c) !== key);
      return [...prev, cat];
    });
  }, []);

  const clearBoardFilters = useCallback(() => {
    setBoardCategoryFilter([]);
    setBoardUnclaimedOnly(false);
    setHideBlockedTasks(false);
  }, []);

  /**
   * Column placement is claim-driven for active work:
   * - In Progress = only tasks with an Active claim (not parent rollup status)
   * - Ready for Review = PendingReview claim, InReview task status, or parent
   *   with all children Completed (awaiting staff close)
   * - Completed only when status is Completed (staff action for parents)
   */
  const tasksByStatus = useMemo(() => {
    const groups = {
      todo: [],
      in_progress: [],
      in_review: [],
      completed: [],
    };
    for (const task of boardTasks) {
      let key = 'todo';
      if (task.dbStatus === 'Completed' || task.status === 'completed') {
        key = 'completed';
      } else if (
        task.claim?.status === 'PendingReview' ||
        task.dbStatus === 'InReview' ||
        task.status === 'in_review' ||
        task.readyForParentReview
      ) {
        key = 'in_review';
      } else if (
        task.claim?.status === 'Active' ||
        isCommunityDecisionsEpic(task)
      ) {
        key = 'in_progress';
      } else {
        key = 'todo';
      }
      groups[key].push(task);
    }
    const forestOpts = { allTasks: tasks };
    return {
      todo: sortTasksAsForest(groups.todo, forestOpts),
      in_progress: sortTasksAsForest(groups.in_progress, forestOpts),
      in_review: sortTasksAsForest(groups.in_review, forestOpts),
      completed: sortTasksAsForest(groups.completed, forestOpts),
    };
  }, [boardTasks, tasks]);

  /**
   * Direct children in the task detail hierarchy list.
   * Hide Blocked Tasks also hides locked children here.
   */
  const selectedChildren = useMemo(() => {
    if (!selectedTaskId) return [];
    return getChildTasks(tasks, selectedTaskId).filter((t) =>
      isTaskVisibleWithLockedToggle(t, !hideBlockedTasks)
    );
  }, [tasks, selectedTaskId, hideBlockedTasks]);

  /** Root → … → current for compact orientation path only */
  const selectedBreadcrumb = useMemo(() => {
    if (!selectedTaskId) return [];
    return getTaskBreadcrumb(tasks, selectedTaskId);
  }, [tasks, selectedTaskId]);

  const sortedIdeas = useMemo(() => {
    const q = ideaSearch.trim().toLowerCase();
    return [...projectIdeas]
      .filter((idea) => {
        const hay = `${idea.title || ''} ${idea.summary || ''}`.toLowerCase();
        const matchesSearch = !q || hay.includes(q);
        const matchesCategory =
          ideaCategoryFilter.length === 0 ||
          ideaCategoryFilter.includes(idea.category);
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (ideaSortMode === 'votes') {
          return (b.votes || 0) - (a.votes || 0);
        }
        if (ideaSortMode === 'title') {
          return (a.title || '').localeCompare(b.title || '');
        }
        return (
          new Date(b.createdAt || b.created_at || 0).getTime() -
          new Date(a.createdAt || a.created_at || 0).getTime()
        );
      });
  }, [projectIdeas, ideaSortMode, ideaSearch, ideaCategoryFilter]);

  /** Active claim holder (not staff override) - required for progress/checklist */
  const isClaimHolder = useMemo(() => {
    if (!selectedTask || !user?.id) return false;
    const claimStatus = selectedTask.claim?.status;
    if (claimStatus !== 'Active' && claimStatus !== 'PendingReview') {
      return false;
    }
    const ownerId =
      selectedTask.claim?.userId ?? selectedTask.claim?.user_id ?? null;
    if (!ownerId) return false;
    return String(ownerId) === String(user.id);
  }, [selectedTask, user]);

  const isPendingReview = selectedTask?.claim?.status === 'PendingReview'
    || selectedTask?.status === 'in_review'
    || selectedTask?.dbStatus === 'InReview';

  /**
   * Progress + checklist for claim holder on leaf tasks only
   * while claim is Active (not while waiting for review).
   */
  const canEditProgress = useMemo(() => {
    if (!isClaimHolder || !selectedTask) return false;
    if (selectedTask.hasChildren || selectedTask.progressFromChildren) {
      return false;
    }
    if (selectedTask.claim?.status !== 'Active') return false;
    return selectedTask.status !== 'completed';
  }, [isClaimHolder, selectedTask]);

  /** Leaf = no hierarchical children (checklists live on leaves, including Small). */
  const selectedIsLeaf = Boolean(
    selectedTask && !selectedTask.hasChildren && !selectedTask.progressFromChildren
  );

  /** Claimant can submit Active leaf work for review (not self-complete). */
  const canSubmitForReview = useMemo(() => {
    if (!isClaimHolder || !selectedTask) return false;
    if (selectedTask.hasChildren) return false;
    if (selectedTask.claim?.status !== 'Active') return false;
    return selectedTask.status !== 'completed';
  }, [isClaimHolder, selectedTask]);

  /** Staff: accept / reject pending submissions (leaf claim reviews) */
  const canReviewSubmission = useMemo(() => {
    if (!isModerator || !selectedTask) return false;
    if (selectedTask.hasChildren) return false;
    return isPendingReview;
  }, [isModerator, selectedTask, isPendingReview]);

  // Staff: load trust signal + board load for the claimant on open claims
  useEffect(() => {
    if (!isModerator || !selectedTask?.claim?.userId) {
      setClaimantTrust(null);
      return;
    }
    let cancelled = false;
    const uid = selectedTask.claim.userId || selectedTask.claim.user_id;
    tasksService
      .getContributorTrust(uid)
      .then((t) => {
        if (!cancelled) setClaimantTrust(t);
      })
      .catch(() => {
        if (!cancelled) setClaimantTrust(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    isModerator,
    selectedTask?.id,
    selectedTask?.claim?.userId,
    selectedTask?.claim?.user_id,
    selectedTask?.claim?.status,
  ]);

  /**
   * Staff: close Epic/Medium after all children are Completed
   * (parent sits in Ready for Review until this).
   */
  const canStaffCompleteParent = useMemo(() => {
    if (!isModerator || !selectedTask) return false;
    if (selectedTask.dbStatus === 'Completed' || selectedTask.status === 'completed') {
      return false;
    }
    if (!selectedTask.hasChildren) return false;
    return Boolean(
      selectedTask.readyForParentReview ||
        selectedTask.allChildrenCompleted ||
        selectedTask.dbStatus === 'InReview' ||
        selectedTask.status === 'in_review'
    );
  }, [isModerator, selectedTask]);

  /**
   * Return claim: only the active claim holder on a leaf task.
   * Never shown for unclaimed tasks (staff included).
   */
  const canReturnClaim = useMemo(() => {
    if (!selectedTask || selectedTask.status === 'completed') return false;
    if (selectedTask.hasChildren) return false;
    return isClaimHolder && selectedTask.claim?.status === 'Active';
  }, [selectedTask, isClaimHolder]);

  /**
   * Join-request Approve/Decline: only claim owner or staff.
   * Requesters must never see these controls (even if they can view the task).
   */
  const canManageJoinRequests = useMemo(() => {
    if (!selectedTask || !user?.id) return false;
    if (selectedTask.claim?.status !== 'Active') return false;
    if (isModerator) return true;
    return isClaimHolder;
  }, [selectedTask, user, isModerator, isClaimHolder]);

  /** Current user's pending join request on this task (for read-only status). */
  const myPendingJoinRequest = useMemo(() => {
    if (!user?.id || !joinRequests?.length) return null;
    return (
      joinRequests.find(
        (jr) =>
          jr.status === 'pending' &&
          String(jr.requesterId) === String(user.id)
      ) || null
    );
  }, [joinRequests, user]);

  const openCreateTaskForm = (parentTaskId = null) => {
    setTaskFormMode('create');
    setEditingTaskId(null);
    setTaskForm({
      ...EMPTY_TASK_FORM,
      subtaskLines: [''],
      parentTaskId: parentTaskId || null,
      blockedByTaskIds: [],
      dependencyOverride: false,
      staffOnly: false,
      holdClaim: false,
    });
    setTaskFormError(null);
    setTaskFormOpen(true);
  };

  const openCreateSubTask = (parentTask) => {
    if (!parentTask) return;
    if (parentTask.canAddChild === false) {
      showToast(
        'Maximum nesting is 3 levels (Epic → Medium → Small). This task cannot have children.',
        'warn'
      );
      return;
    }
    setSelectedTaskId(null);
    openCreateTaskForm(parentTask.id);
  };

  const openEditTaskForm = (task) => {
    if (!task) return;
    setTaskFormMode('edit');
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title || '',
      description: task.description || '',
      category: task.category || 'Code',
      difficulty: task.difficulty || 'Medium',
      estimatedEffort: normalizeTaskEffort(task.estimatedEffort || ''),
      subtaskLines:
        Array.isArray(task.subtasks) && task.subtasks.length > 0
          ? task.subtasks.map((s) => s.label || s.title || '')
          : [''],
      parentTaskId: task.parentTaskId || null,
      blockedByTaskIds: (
        Array.isArray(task.blockedByIds)
          ? [...task.blockedByIds]
          : Array.isArray(task.blockedBy)
            ? task.blockedBy.map((b) => b.id).filter(Boolean)
            : []
      ).filter((id) => id && String(id) !== String(task.id)),
      dependencyOverride: Boolean(task.dependencyOverride),
      staffOnly: Boolean(task.staffOnly),
      holdClaim: Boolean(task.holdClaim),
    });
    setTaskFormError(null);
    setSelectedTaskId(null);
    setTaskFormOpen(true);
  };

  /**
   * Staff: open create form pre-filled from an existing task.
   * Does not copy claim, progress, status, or review data — new task starts To Do.
   */
  const openDuplicateTaskForm = (task) => {
    if (!task || !isModerator) return;
    const rawTitle = String(task.title || '').trim();
    const title = rawTitle
      ? rawTitle.startsWith('Copy of ')
        ? rawTitle
        : `Copy of ${rawTitle}`
      : 'Copy of task';
    const checklistLines =
      Array.isArray(task.subtasks) && task.subtasks.length > 0
        ? task.subtasks.map((s) => s.label || s.title || '').filter(Boolean)
        : [''];
    setTaskFormMode('create');
    setEditingTaskId(null);
    setTaskForm({
      title: title.slice(0, 120),
      description: task.description || '',
      category: task.category || 'Code',
      difficulty: task.difficulty || 'Medium',
      estimatedEffort: normalizeTaskEffort(task.estimatedEffort || ''),
      subtaskLines: checklistLines.length ? checklistLines : [''],
      // Keep same parent so hierarchy stays sensible (lead can change later if we add parent field)
      parentTaskId: task.parentTaskId || null,
      blockedByTaskIds: (
        Array.isArray(task.blockedByIds)
          ? [...task.blockedByIds]
          : Array.isArray(task.blockedBy)
            ? task.blockedBy.map((b) => b.id).filter(Boolean)
            : []
      ).filter((id) => id && String(id) !== String(task.id)),
      // Fresh copy should respect blockers unless lead re-enables override
      dependencyOverride: false,
      staffOnly: Boolean(task.staffOnly),
      holdClaim: Boolean(task.holdClaim),
    });
    setTaskFormError(null);
    setSelectedTaskId(null);
    setTaskFormOpen(true);
  };

  const handleDuplicateTask = (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      showToast('Could not find that task to duplicate.', 'warn');
      return;
    }
    openDuplicateTaskForm(task);
  };

  const handleStagingDelete = (task) => {
    if (!isModerator || !task?.id) return;
    setDeleteConfirmTask(task);
  };

  const requestDeleteFromTaskForm = () => {
    if (!isModerator || taskFormMode !== 'edit' || !editingTaskId) return;
    const task = tasks.find((t) => t.id === editingTaskId);
    if (!task) {
      showToast('Could not find that task to delete.', 'warn');
      return;
    }
    setTaskFormOpen(false);
    setTaskFormError(null);
    setEditingTaskId(null);
    setDeleteConfirmTask(task);
  };

  const confirmStagingDelete = async () => {
    const task = deleteConfirmTask;
    if (!task?.id) return;
    setStagingBusyId(task.id);
    try {
      await tasksService.deleteTask(task.id);
      setDeleteConfirmTask(null);
      if (selectedTaskId === task.id) setSelectedTaskId(null);
      await refreshBoard(projectUuid);
      showToast(
        isStagingTask(task) ? 'Removed from Staging.' : 'Removed from the board.',
        'success'
      );
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setStagingBusyId(null);
    }
  };

  const handleStagingMove = async (task, direction) => {
    if (!isModerator || !task?.id || !isStagingBoard) return;
    setStagingBusyId(task.id);
    try {
      await tasksService.reorderTaskAmongSiblings(task.id, direction, tasks);
      await refreshBoard(projectUuid);
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setStagingBusyId(null);
    }
  };

  const handlePublishStaging = (task) => {
    if (!isModerator || !task?.id || !isStagingBoard) return;
    if (!canPublishStagingTask(task)) {
      showToast('Publish a Medium or Epic. Small tasks go with their parent.', 'warn');
      return;
    }
    setPublishConfirmTask(task);
  };

  const confirmPublishStaging = async () => {
    const task = publishConfirmTask;
    if (!task?.id) return;
    setPublishingId(task.id);
    try {
      const result = await tasksService.publishStagingTask(task.id);
      setPublishConfirmTask(null);
      await refreshBoard(projectUuid);
      const created = Number(result?.created_count) || 0;
      const archived = Number(result?.archived_count) || 0;
      showToast(
        created > 0
          ? `Moved ${created} task${created === 1 ? '' : 's'} to the public board.`
          : archived > 0
            ? 'Removed from Staging. Public copies were already live.'
            : 'Nothing new to publish.',
        'success'
      );
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setPublishingId(null);
    }
  };

  const handleMovePublicToStaging = (task) => {
    if (!isModerator || !task?.id || isStagingBoard) return;
    if (!canMovePublicTaskToStaging(task)) {
      showToast('Move a Medium or Epic. Small tasks go with their parent.', 'warn');
      return;
    }
    setUnpublishConfirmTask(task);
  };

  const confirmMovePublicToStaging = async () => {
    const task = unpublishConfirmTask;
    if (!task?.id) return;
    setUnpublishingId(task.id);
    try {
      const result = await tasksService.movePublicTaskToStaging(task.id);
      setUnpublishConfirmTask(null);
      if (selectedTaskId === task.id) setSelectedTaskId(null);
      await refreshBoard(projectUuid);
      const n =
        (Number(result?.flipped_count) || 0) +
        (Number(result?.restored_count) || 0) +
        (Number(result?.created_count) || 0);
      showToast(
        n > 0
          ? `Moved ${n} task${n === 1 ? '' : 's'} back to Staging.`
          : 'Moved to Staging.',
        'success'
      );
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setUnpublishingId(null);
    }
  };

  const toggleBlockedByTask = (blockerId) => {
    if (!blockerId) return;
    if (
      taskFormMode === 'edit' &&
      editingTaskId &&
      String(blockerId) === String(editingTaskId)
    ) {
      setTaskFormError(TASK_CANNOT_WAIT_ON_SELF);
      return;
    }
    setTaskForm((prev) => {
      const cur = prev.blockedByTaskIds || [];
      const has = cur.includes(blockerId);
      return {
        ...prev,
        blockedByTaskIds: has
          ? cur.filter((id) => id !== blockerId)
          : [...cur, blockerId],
      };
    });
  };

  const closeTaskForm = () => {
    if (taskFormBusy) return;
    setTaskFormOpen(false);
    setTaskFormError(null);
    setEditingTaskId(null);
  };

  const updateTaskFormField = (field, value) => {
    setTaskForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateSubtaskLine = (index, value) => {
    setTaskForm((prev) => {
      const next = [...prev.subtaskLines];
      next[index] = value;
      return { ...prev, subtaskLines: next };
    });
  };

  const addSubtaskLine = () => {
    setTaskForm((prev) => {
      if (prev.subtaskLines.length >= MAX_CHECKLIST_STEPS) return prev;
      return { ...prev, subtaskLines: [...prev.subtaskLines, ''] };
    });
  };

  const removeSubtaskLine = (index) => {
    setTaskForm((prev) => {
      const next = prev.subtaskLines.filter((_, i) => i !== index);
      return { ...prev, subtaskLines: next.length ? next : [''] };
    });
  };

  const handleTaskFormSubmit = async (e) => {
    e.preventDefault();
    if (!isModerator) {
      setTaskFormError('Only project leads and admins can create or edit tasks.');
      return;
    }
    if (!projectUuid) {
      setTaskFormError(
        'Project is not wired to the database yet. Run supabase/sql/supabase_tasks_schema.sql first.'
      );
      return;
    }
    if (!user) {
      setTaskFormError('Sign in to create or edit tasks.');
      return;
    }

    const title = (taskForm.title || '').trim();
    if (!title) {
      setTaskFormError('Title is required.');
      return;
    }

    const blockerIds = [...(taskForm.blockedByTaskIds || [])].filter(Boolean);
    if (
      taskFormMode === 'edit' &&
      editingTaskId &&
      blockerIds.some((id) => String(id) === String(editingTaskId))
    ) {
      setTaskFormError(TASK_CANNOT_WAIT_ON_SELF);
      return;
    }

    const payload = {
      title,
      description: (taskForm.description || '').trim(),
      category: taskForm.category || null,
      difficulty: taskForm.difficulty || null,
      estimatedEffort:
        normalizeTaskEffort(taskForm.estimatedEffort || '') || null,
      subtasks: parseSubtaskLines(taskForm.subtaskLines),
      parentTaskId: taskForm.parentTaskId || null,
      blockedByTaskIds: blockerIds.filter(
        (id) =>
          !(
            taskFormMode === 'edit' &&
            editingTaskId &&
            String(id) === String(editingTaskId)
          )
      ),
      dependencyOverride: Boolean(taskForm.dependencyOverride),
      staffOnly: Boolean(taskForm.staffOnly),
      holdClaim: Boolean(taskForm.holdClaim),
      boardScope: isStagingBoard ? BOARD_SCOPE_STAGING : BOARD_SCOPE_PUBLIC,
    };

    setTaskFormBusy(true);
    setTaskFormError(null);
    try {
      if (taskFormMode === 'edit' && editingTaskId) {
        // Preserve done flags when editing existing checklist by label match
        const existing = tasks.find((t) => t.id === editingTaskId);
        const prevByLabel = new Map(
          (existing?.subtasks || []).map((s) => [
            (s.label || s.title || '').trim().toLowerCase(),
            s,
          ])
        );
        payload.subtasks = payload.subtasks.map((s, i) => {
          const prev = prevByLabel.get(s.label.toLowerCase());
          return {
            id: prev?.id || s.id || `s${i + 1}`,
            label: s.label,
            done: Boolean(prev?.done),
          };
        });

        await tasksService.updateTaskMeta(editingTaskId, payload);
        await refreshBoard(projectUuid);
        showToast('Task updated. The board reflects your changes.', 'success');
      } else {
        const parentBefore = payload.parentTaskId
          ? tasks.find((t) => t.id === payload.parentTaskId)
          : null;
        const parentWasClaimed = Boolean(
          parentBefore?.claim?.status === 'Active' ||
            parentBefore?.claim?.status === 'PendingReview'
        );
        await tasksService.createTask(projectUuid, payload, user.id);
        await refreshBoard(projectUuid);
        pingUserNotices();
        if (!isStagingBoard && payload.parentTaskId && parentWasClaimed) {
          showToast(
            'The parent claim was returned. Nested Smalls are in To Do.',
            'info'
          );
        } else {
          showToast(
            isStagingBoard
              ? payload.parentTaskId
                ? 'Staging sub-task saved. Publish its Medium or Epic when the structure is ready.'
                : 'Staging task saved. Volunteers cannot see it until you publish.'
              : payload.parentTaskId
                ? 'Sub-task created under its parent. Nested Smalls are claimed from To Do.'
                : 'Task created - it is live in To Do and ready to claim!',
            'success'
          );
        }
      }
      const reopenParent = payload.parentTaskId;
      setTaskFormOpen(false);
      setEditingTaskId(null);
      setTaskForm({
        ...EMPTY_TASK_FORM,
        subtaskLines: [''],
        parentTaskId: null,
        blockedByTaskIds: [],
        dependencyOverride: false,
        staffOnly: false,
        holdClaim: false,
      });
      if (reopenParent) setSelectedTaskId(reopenParent);
    } catch (err) {
      setTaskFormError(friendlyError(err));
    } finally {
      setTaskFormBusy(false);
    }
  };

  const refreshClaimQuota = useCallback(async () => {
    try {
      const q = await tasksService.getMyClaimQuota();
      setClaimQuota(q);
    } catch {
      setClaimQuota(null);
    }
  }, []);

  useEffect(() => {
    if (user?.id) refreshClaimQuota();
    else setClaimQuota(null);
    // Re-check after email verify / SSO link (same user id, new identities)
  }, [
    user?.id,
    user?.email_confirmed_at,
    user?.confirmed_at,
    // identities array identity — stringify providers for stable dep
    Array.isArray(user?.identities)
      ? user.identities.map((i) => i?.provider).join(',')
      : '',
    refreshClaimQuota,
  ]);

  const refreshMyPendingJoins = useCallback(async () => {
    if (!user?.id) {
      setMyPendingJoinTaskIds(new Set());
      return;
    }
    try {
      const ids = await tasksService.listMyPendingJoinTaskIds();
      setMyPendingJoinTaskIds(ids);
    } catch {
      setMyPendingJoinTaskIds(new Set());
    }
  }, [user?.id]);

  useEffect(() => {
    refreshMyPendingJoins();
  }, [refreshMyPendingJoins, projectUuid]);

  const refreshSuggestionMeta = useCallback(async () => {
    try {
      const acct = await taskSuggestionsService.getMyAccount();
      setSuggestAccount(acct);
    } catch {
      setSuggestAccount({ signedIn: Boolean(user), locked: false, strikeCount: 0 });
    }
    if (isModerator && projectUuid) {
      try {
        const n = await taskSuggestionsService.countPending(projectUuid);
        setPendingSuggestionCount(n);
      } catch {
        setPendingSuggestionCount(0);
      }
    } else {
      setPendingSuggestionCount(0);
    }
  }, [isModerator, projectUuid, user]);

  useEffect(() => {
    void refreshSuggestionMeta();
  }, [refreshSuggestionMeta]);

  // Dual-rule auto-release when opening a board (server is source of truth)
  useEffect(() => {
    if (!projectUuid) return;
    let cancelled = false;
    (async () => {
      try {
        // Housekeeping sweep: members only, throttled per browser. Anonymous
        // visitors must not turn every board view into a database write.
        const result =
          user?.id && claimHousekeepingRun('claim-auto-release', 5 * 60 * 1000)
            ? await tasksService.runClaimAutoRelease()
            : { releasedCount: 0, released: [] };
        if (cancelled) return;
        if (result.releasedCount > 0) {
          await refreshBoard(projectUuid);
        }
        // Inform previous claimant when their claim was just released
        if (user?.id && result.released?.length) {
          const mine = result.released.filter(
            (r) => String(r.user_id || r.userId) === String(user.id)
          );
          if (mine.length) {
            const msg = mine
              .map((r) => {
                const title = r.task_title || r.taskTitle || 'a task';
                return formatAutoReleaseReason(r.reason, r).replace(
                  /Your claim was auto-released/,
                  `Your claim on “${title}” was auto-released`
                );
              })
              .join(' ');
            showToast(msg, 'warn');
          }
        }
      } catch {
        /* ignore if RPC not migrated yet */
      }
      // Also surface recent notices (e.g. released while offline)
      if (user?.id) {
        try {
          const notices = await tasksService.listMyRecentAutoReleases({
            days: 14,
            limit: 5,
          });
          if (!cancelled && notices?.length) {
            const unseen = filterUnseenAutoReleases(notices);
            if (unseen.length) setAutoReleaseNotices(unseen);
          }
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- board open housekeeping
  }, [projectUuid, user?.id]);

  const dismissAutoReleaseNotices = useCallback(() => {
    setAutoReleaseNotices((prev) => {
      rememberAutoReleaseSeen(prev.map((n) => n.id));
      return [];
    });
  }, []);

  /**
   * Staff test: evaluate Active claims as if the 14-day idle window already
   * elapsed (releases current Active claims without waiting real time).
   */
  const handleToggleHoldClaim = async (task) => {
    if (!isModerator || !task?.id) return;
    const next = !task.holdClaim;
    setActionBusy(true);
    try {
      await tasksService.updateTaskMeta(task.id, { holdClaim: next });
      await refreshBoard(projectUuid);
      showToast(
        next
          ? 'Auto-release is off for this card. The claim stays until it is returned or completed.'
          : 'Auto-release is on again for this card.',
        'success'
      );
    } catch (err) {
      showToast(
        friendlyError(err) || 'Could not update the Hold claim setting.',
        'error'
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleRunAutoReleaseCheck = async () => {
    if (!isModerator) return;
    const ok = window.confirm(
      `Test auto-release (14-day idle simulation)\n\n` +
        `This treats every Active claim as if it has had no meaningful progress for ${CLAIM_IDLE_RELEASE_DAYS} days, and will release those claims now so you can verify the flow.\n\n` +
        `Pending-review claims and held cards are not touched. Continue?`
    );
    if (!ok) return;

    setAutoReleaseBusy(true);
    try {
      const result = await tasksService.runClaimAutoReleaseTest();
      await refreshBoard(projectUuid);
      const n = result.releasedCount || 0;
      if (n === 0) {
        showToast(
          'Test complete: no Active claims to release (none matched, or none on the board).',
          'success'
        );
      } else {
        const titles = (result.released || [])
          .map((r) => r.task_title || r.taskTitle || 'task')
          .slice(0, 5);
        showToast(
          `Test idle release: freed ${n} claim${n === 1 ? '' : 's'} (as if ${CLAIM_IDLE_RELEASE_DAYS}d idle)${
            titles.length ? `: ${titles.join('; ')}` : ''
          }${n > 5 ? '…' : ''}. Tasks are claimable again.`,
          'success'
        );
      }
    } catch (err) {
      showToast(
        err?.message ||
          'Auto-release test failed. Re-run supabase/sql/supabase_claim_auto_release.sql in Supabase (includes run_claim_auto_release_test).',
        'error'
      );
    } finally {
      setAutoReleaseBusy(false);
    }
  };

  const handleClaim = async (taskId) => {
    if (!user) {
      showToast('Sign in to claim a task. It will show on your profile.', 'warn');
      navigate('/account');
      return;
    }
    if (!projectUuid) {
      showToast('Project is not wired to the database yet.', 'error');
      return;
    }

    if (isStagingBoard) {
      showToast(STAGING_TASK_CLAIM_MESSAGE, 'warn');
      return;
    }
    const task = tasks.find((t) => t.id === taskId);
    const blocked = getUserTaskClaimBlockedReason(task, {
      isStaff: isModerator,
    });
    if (blocked) {
      showToast(blocked, 'warn');
      return;
    }

    setClaimingId(taskId);
    try {
      await tasksService.claimTask(taskId, { task, isStaff: isModerator });
      await refreshBoard(projectUuid);
      await refreshClaimQuota();
      showToast(
        'Task claimed! Update progress as you go, then submit for review when ready.',
        'success'
      );
      setSelectedTaskId(taskId);
    } catch (err) {
      const msg = friendlyError(err);
      const soft =
        err?.code === 'CLAIM_LIMIT' ||
        err?.code === 'CLAIM_COOLDOWN' ||
        err?.code === 'CLAIM_HIERARCHY' ||
        err?.code === 'IDENTITY_GATE' ||
        err?.code === 'CLAIM_RESTRICTED' ||
        err?.code === 'STAFF_ONLY' ||
        err?.code === CLAIMS_PAUSED_CODE;
      showToast(msg, soft ? 'warn' : 'error');
      refreshClaimQuota();
    } finally {
      setClaimingId(null);
    }
  };

  const handleRequestJoin = async (taskId) => {
    if (!user) {
      showToast('Sign in to request joining a claim.', 'warn');
      navigate('/account');
      return;
    }
    const joinTask = tasks.find((t) => t.id === taskId);
    if (joinTask?.staffOnly && !isModerator) {
      showToast(STAFF_ONLY_TASK_MESSAGE, 'warn');
      return;
    }
    if (myPendingJoinTaskIds.has(taskId)) {
      showToast('You already have a pending join request on this task.', 'warn');
      return;
    }
    setJoiningId(taskId);
    try {
      await tasksService.requestJoinClaim(taskId);
      setMyPendingJoinTaskIds((prev) => {
        const next = new Set(prev);
        next.add(taskId);
        return next;
      });
      showToast(
        'Join request sent. The claim owner can approve you as a helper.',
        'success'
      );
      if (selectedTaskId === taskId) {
        const list = await tasksService.listJoinRequestsForTask(taskId);
        setJoinRequests(list);
      }
    } catch (err) {
      if (err?.code === 'JOIN_ALREADY') {
        setMyPendingJoinTaskIds((prev) => {
          const next = new Set(prev);
          next.add(taskId);
          return next;
        });
        showToast(friendlyError(err), 'warn');
      } else {
        showToast(
          friendlyError(err),
          err?.code === 'STAFF_ONLY' ? 'warn' : 'error'
        );
      }
    } finally {
      setJoiningId(null);
    }
  };

  const handleResolveJoin = async (requestId, approve) => {
    // Hard gate: only claim owner or staff (never the requester)
    if (!canManageJoinRequests) {
      showToast('Only the person who claimed this task can approve join requests.', 'warn');
      return;
    }
    setActionBusy(true);
    try {
      await tasksService.resolveJoinRequest(requestId, approve);
      showToast(
        approve ? 'Helper approved and added to the claim.' : 'Join request declined.',
        'success'
      );
      if (selectedTaskId) {
        const list = await tasksService.listJoinRequestsForTask(selectedTaskId);
        setJoinRequests(list);
      }
      if (projectUuid) await refreshBoard(projectUuid);
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleViewTask = (taskId) => {
    void openTaskDetail(taskId);
  };

  /** Staff: open edit form for a completed (or any) task */
  const handleUpdateTask = (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (!isModerator) {
      showToast('Only Project Leads and moderators can update tasks.', 'warn');
      return;
    }
    openEditTaskForm(task);
  };

  useEffect(() => {
    if (!selectedTaskId) {
      setJoinRequests([]);
      return;
    }
    let cancelled = false;
    tasksService.listJoinRequestsForTask(selectedTaskId).then((list) => {
      if (!cancelled) setJoinRequests(list);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedTaskId]);

  /**
   * Latest claim-edit drafts for flush-on-close (avoids stale closures).
   */
  const progressFlushRef = useRef({
    selectedTask: null,
    projectUuid: null,
    canEditProgress: false,
    progressDraft: 0,
    notesDraft: '',
    subtasksDraft: [],
  });
  progressFlushRef.current = {
    selectedTask,
    projectUuid,
    canEditProgress,
    progressDraft,
    notesDraft,
    subtasksDraft,
  };
  const autoSavingRef = useRef(false);

  const isProgressDraftDirty = useCallback((snap) => {
    const task = snap?.selectedTask;
    if (!task || !snap.canEditProgress) return false;
    if (task.claim?.status !== 'Active') return false;

    const pct = Math.min(99, Number(snap.progressDraft) || 0);
    const origPct = Math.min(99, Number(task.progressPercent) || 0);
    if (pct !== origPct) return true;

    const notes = String(snap.notesDraft || '');
    const origNotes = String(task.claim?.notes || '');
    if (notes !== origNotes) return true;

    const draftList = normalizeChecklist(snap.subtasksDraft);
    const origList = normalizeChecklist(task.subtasks);
    if (draftList.length !== origList.length) return true;
    for (let i = 0; i < draftList.length; i += 1) {
      const a = draftList[i];
      const b = origList[i];
      if (
        Boolean(a.done) !== Boolean(b.done) ||
        String(a.label || '') !== String(b.label || '') ||
        String(a.id || '') !== String(b.id || '')
      ) {
        return true;
      }
    }
    return false;
  }, []);

  /**
   * Persist claim progress/checklist/notes when leaving the task modal.
   * Silent on success; keeps modal open on failure so edits are not lost.
   * @returns {Promise<boolean>} true if safe to leave
   */
  const flushProgressSave = useCallback(async () => {
    if (autoSavingRef.current) return false;
    const snap = progressFlushRef.current;
    const task = snap.selectedTask;
    if (!task || !snap.projectUuid || !snap.canEditProgress) return true;
    if (!isProgressDraftDirty(snap)) return true;

    autoSavingRef.current = true;
    try {
      const pct = Math.min(99, Number(snap.progressDraft) || 0);
      await tasksService.updateProgress(task.id, {
        progressPercent: pct,
        subtasks: snap.subtasksDraft,
        notes: snap.notesDraft,
      });
      await refreshBoard(snap.projectUuid);
      return true;
    } catch (err) {
      showToast(
        friendlyError(err) ||
          'Could not save progress. Stay on this task and try again.',
        'error'
      );
      return false;
    } finally {
      autoSavingRef.current = false;
    }
  }, [isProgressDraftDirty, refreshBoard, showToast]);

  const closeTaskPanel = async () => {
    if (actionBusy || autoSavingRef.current) return;
    if (submitReviewOpen) {
      setSubmitReviewOpen(false);
      setEvidenceNoteError(null);
      setEvidenceLinkError(null);
      return;
    }
    const ok = await flushProgressSave();
    if (!ok) return;
    setSelectedTaskId(null);
  };

  /** Switch task (or close) after auto-saving claim progress when needed. */
  const openTaskDetail = useCallback(
    async (taskId) => {
      if (taskId === selectedTaskId) return;
      if (actionBusy || autoSavingRef.current) return;
      setSubmitReviewOpen(false);
      const ok = await flushProgressSave();
      if (!ok) return;
      setSelectedTaskId(taskId ?? null);
    },
    [selectedTaskId, actionBusy, flushProgressSave]
  );

  /**
   * Open dedicated Submit for Review step (evidence only).
   * Checklist must already be complete; progress is saved first.
   */
  const openSubmitReviewFlow = async () => {
    if (!selectedTask || !projectUuid) return;
    if (!user) {
      showToast('Sign in to submit work for review.', 'warn');
      navigate('/account');
      return;
    }
    if (!isChecklistComplete(subtasksDraft)) {
      showToast(
        'Complete every checklist item before submitting for review.',
        'warn'
      );
      window.setTimeout(() => {
        document.getElementById('task-checklist-section')?.scrollIntoView?.({
          behavior: 'smooth',
          block: 'nearest',
        });
      }, 0);
      return;
    }
    const ok = await flushProgressSave();
    if (!ok) return;
    setEvidenceNoteError(null);
    setEvidenceLinkError(null);
    setEvidenceLinkWarning(null);
    setEvidenceDraft('');
    setEvidenceLinks(['']);
    setEvidenceDependsOn('');
    setSubmitReviewOpen(true);
  };

  const closeSubmitReviewFlow = () => {
    if (actionBusy) return;
    setSubmitReviewOpen(false);
    setEvidenceNoteError(null);
    setEvidenceLinkError(null);
  };

  const updateEvidenceLink = (index, value) => {
    setEvidenceLinks((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addEvidenceLinkRow = () => {
    setEvidenceLinks((prev) =>
      prev.length >= 8 ? prev : [...prev, '']
    );
  };

  const removeEvidenceLinkRow = (index) => {
    setEvidenceLinks((prev) => {
      if (prev.length <= 1) return [''];
      return prev.filter((_, i) => i !== index);
    });
  };

  /** Claimant: hand off from the dedicated submit-for-review modal. */
  const handleSubmitForReview = async () => {
    if (!selectedTask || !projectUuid) return;
    if (!user) {
      showToast('Sign in to submit work for review.', 'warn');
      navigate('/account');
      return;
    }
    if (!isChecklistComplete(subtasksDraft)) {
      showToast(
        'Complete every checklist item before submitting for review.',
        'warn'
      );
      setSubmitReviewOpen(false);
      return;
    }
    const note = String(evidenceDraft || '').trim();
    const normalizedLinks = (evidenceLinks || [])
      .map((l) => normalizeEvidenceUrl(l))
      .filter(Boolean);
    const evidenceCheck = validateReviewEvidencePackage({
      note,
      links: normalizedLinks,
      category: selectedTask.category,
    });
    if (!evidenceCheck.ok) {
      const isNoteErr = evidenceCheck.code === 'EVIDENCE_REQUIRED';
      const isLinkErr =
        evidenceCheck.code === 'EVIDENCE_LINK_REQUIRED' ||
        evidenceCheck.code === 'EVIDENCE_LINK_INVALID';
      setEvidenceNoteError(isNoteErr ? evidenceCheck.message : null);
      setEvidenceLinkError(isLinkErr ? evidenceCheck.message : null);
      setEvidenceLinkWarning(null);
      showToast(evidenceCheck.message, 'warn');
      window.setTimeout(() => {
        const focusId = isNoteErr
          ? 'task-evidence-draft'
          : 'task-evidence-link-0';
        document.getElementById(focusId)?.focus?.();
        if (!isNoteErr) {
          document
            .getElementById('task-evidence-links-section')
            ?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
        }
      }, 0);
      return;
    }
    setEvidenceLinkWarning(evidenceCheck.warning || null);
    const evidence = composeReviewEvidence({
      note,
      links: normalizedLinks,
      dependsOn: evidenceDependsOn,
    });
    setEvidenceNoteError(null);
    setEvidenceLinkError(null);
    setActionBusy(true);
    try {
      try {
        await tasksService.updateProgress(selectedTask.id, {
          progressPercent: Math.min(99, Number(progressDraft) || 90),
          subtasks: subtasksDraft,
          notes: notesDraft,
        });
      } catch {
        /* still attempt submit */
      }
      await tasksService.submitForReview(selectedTask.id, evidence, {
        subtasks: subtasksDraft,
        note,
        links: normalizedLinks,
      });
      await refreshBoard(projectUuid);
      await refreshClaimQuota();
      setReviewOpen(true);
      setSubmitReviewOpen(false);
      setSelectedTaskId(null);
      showToast(
        'Submitted for review. A Project Lead or moderator will accept or reject your work.',
        'success'
      );
    } catch (err) {
      const soft =
        err?.code === 'SUBMIT_LIMIT' ||
        err?.code === 'SUBMIT_COOLDOWN' ||
        err?.code === 'IDENTITY_GATE' ||
        err?.code === 'CLAIM_RESTRICTED' ||
        err?.code === 'EVIDENCE_REQUIRED' ||
        err?.code === 'EVIDENCE_LINK_REQUIRED' ||
        err?.code === 'EVIDENCE_LINK_INVALID';
      const msg = friendlyError(err);
      if (err?.code === 'EVIDENCE_REQUIRED') {
        setEvidenceNoteError(msg);
        setEvidenceLinkError(null);
      } else if (
        err?.code === 'EVIDENCE_LINK_REQUIRED' ||
        err?.code === 'EVIDENCE_LINK_INVALID'
      ) {
        setEvidenceLinkError(msg);
        setEvidenceNoteError(null);
      }
      showToast(msg, soft ? 'warn' : 'error');
      refreshClaimQuota();
    } finally {
      setActionBusy(false);
    }
  };

  /** Staff: mark Epic/Medium Completed after children are done */
  const handleStaffCompleteParent = async () => {
    if (!selectedTask || !projectUuid || !canStaffCompleteParent) return;
    setActionBusy(true);
    try {
      await tasksService.completeTask(selectedTask.id);
      await refreshBoard(projectUuid);
      setCompletedOpen(true);
      showToast(
        'Parent task marked complete. Child work remains credited under its owners.',
        'success'
      );
      setSelectedTaskId(null);
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setActionBusy(false);
    }
  };

  /** Staff: accept pending submission → Completed + credit */
  const handleAcceptReview = async () => {
    if (!selectedTask || !projectUuid || actionBusy) return;
    setActionBusy(true);
    setReviewActionBusy('accept');
    try {
      await tasksService.reviewSubmission(selectedTask.id, {
        accept: true,
        feedback: reviewFeedbackDraft.trim() || null,
      });
      await refreshBoard(projectUuid);
      // Nested completed work is on the board; open the section so it is obvious
      setCompletedOpen(true);
      showToast(
        'Work accepted. Task completed and credit recorded. See the Completed section below.',
        'success'
      );
      setSelectedTaskId(null);
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setActionBusy(false);
      setReviewActionBusy(null);
    }
  };

  /** Staff: reject → claim back to Active with feedback */
  const handleRejectReview = async () => {
    if (!selectedTask || !projectUuid || actionBusy) return;
    setActionBusy(true);
    setReviewActionBusy('reject');
    try {
      await tasksService.reviewSubmission(selectedTask.id, {
        accept: false,
        feedback:
          reviewFeedbackDraft.trim() ||
          'Please revise and resubmit with clearer evidence.',
      });
      await refreshBoard(projectUuid);
      showToast('Submission rejected. Claimant can revise and resubmit.', 'warn');
      setSelectedTaskId(null);
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setActionBusy(false);
      setReviewActionBusy(null);
    }
  };

  /**
   * Staff: reject as fake/no-real-work, release claim, restrict claiming.
   * Two-step: confirm via window.confirm for safety.
   */
  const handleRejectAsFakeWork = async () => {
    if (!selectedTask || !projectUuid || !canReviewSubmission || actionBusy)
      return;
    const ok = window.confirm(
      'Reject as fake / no real work?\n\nThis will:\n• Release the claim so others can take the task\n• Count as a fake-work rejection\n• Restrict the user’s claiming privileges if the pattern continues (or after multiple flags)\n\nThis is logged for audit.'
    );
    if (!ok) return;
    setActionBusy(true);
    setReviewActionBusy('fake');
    try {
      const result = await tasksService.rejectAsFakeWork(
        selectedTask.id,
        reviewFeedbackDraft.trim() ||
          'Flagged as fake / no real work. Claim released; privileges may be restricted.'
      );
      await refreshBoard(projectUuid);
      const r = result?.restriction;
      const restricted = r?.is_restricted;
      showToast(
        restricted
          ? 'Flagged as fake work. Claim released and contributor claim privileges restricted.'
          : 'Flagged as fake work. Claim released. Contributor warned (further flags will restrict claims).',
        'warn'
      );
      setSelectedTaskId(null);
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setActionBusy(false);
      setReviewActionBusy(null);
    }
  };

  const handleReturn = async () => {
    if (!selectedTask || !projectUuid) return;
    if (!user) {
      showToast('Sign in to return a claim.', 'warn');
      return;
    }
    setActionBusy(true);
    try {
      await tasksService.returnClaim(selectedTask.id);
      await refreshBoard(projectUuid);
      showToast('Claim returned. Task is open again for the community.', 'success');
      setSelectedTaskId(null);
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setActionBusy(false);
    }
  };

  /**
   * Claimant: non-punitive flag that the work is larger than expected.
   * Staff see it on the board and can break down / re-scope.
   */
  const handleRequestScopeHelp = async () => {
    if (!selectedTask || !projectUuid) return;
    if (!user) {
      showToast('Sign in to request scope help.', 'warn');
      navigate('/account');
      return;
    }
    setActionBusy(true);
    try {
      await tasksService.requestScopeHelp(selectedTask.id, scopeHelpDraft);
      await refreshBoard(projectUuid);
      setScopeHelpOpen(false);
      setScopeHelpDraft('');
      showToast(
        'Thanks for flagging this. A Project Lead will help break it down or re-scope. This is expected when work is bigger than planned.',
        'success'
      );
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancelScopeRequest = async () => {
    if (!selectedTask?.scopeRequest?.id || !projectUuid) return;
    setActionBusy(true);
    try {
      await tasksService.cancelScopeRequest(selectedTask.scopeRequest.id);
      await refreshBoard(projectUuid);
      showToast('Scope request cancelled.', 'info');
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setActionBusy(false);
    }
  };

  /** Toggle checklist item and derive progress % from completed items. */
  const toggleSubtask = (subId) => {
    setSubtasksDraft((prev) => {
      const next = prev.map((s) =>
        s.id === subId ? { ...s, done: !s.done } : s
      );
      if (next.length > 0) {
        const done = next.filter((s) => s.done).length;
        setProgressDraft(
          Math.min(99, Math.round((100 * done) / next.length))
        );
      }
      return next;
    });
  };

  // Per-idea lock - prevents unlike→like race flicker
  const voteInflight = useRef(new Map());

  const voteKey = (id) => {
    if (id == null) return null;
    const n = Number(id);
    return Number.isFinite(n) ? n : String(id);
  };

  /**
   * Vote toggle - matches GameIdeas:
   * userIdeaVotes Set = this user only; optimistic UI; ideasService.toggleVote.
   * Own ideas allowed. Idempotent server ops.
   */
  const handleVoteIdea = async (e, ideaId) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    const key = voteKey(ideaId);
    if (key == null) return;

    if (voteInflight.current.has(key)) {
      await voteInflight.current.get(key);
    }

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      showToast('Sign in to vote on ideas.', 'warn');
      navigate('/account');
      return;
    }

    const hasVoted =
      userIdeaVotes.has(key) ||
      userIdeaVotes.has(ideaId) ||
      userIdeaVotes.has(Number(ideaId));

    let resolveLock;
    const lockPromise = new Promise((r) => {
      resolveLock = r;
    });
    voteInflight.current.set(key, lockPromise);

    const prevCount = Math.max(
      0,
      Number(
        (projectIdeas.find((i) => voteKey(i.id) === key) || {}).votes
      ) || 0
    );

    // Optimistic: always flip Voted; only bump the number while still live (<10)
    if (hasVoted) {
      setProjectIdeas((prev) =>
        prev.map((i) =>
          voteKey(i.id) === key
            ? { ...i, votes: optimisticPublicCount(prevCount, false) }
            : i
        )
      );
      setUserIdeaVotes((prev) => {
        const next = new Set(prev);
        next.delete(key);
        next.delete(ideaId);
        next.delete(Number(ideaId));
        return next;
      });
    } else {
      setProjectIdeas((prev) =>
        prev.map((i) =>
          voteKey(i.id) === key
            ? { ...i, votes: optimisticPublicCount(prevCount, true) }
            : i
        )
      );
      setUserIdeaVotes((prev) => new Set(prev).add(key));
    }

    try {
      const { votes } = await ideasService.toggleVote(ideaId, authUser.id);
      setProjectIdeas((prev) =>
        prev.map((i) =>
          voteKey(i.id) === key
            ? { ...i, votes: reconcilePublicCount(prevCount, votes) }
            : i
        )
      );
    } catch (err) {
      const soft =
        /already voted|duplicate|unique/i.test(err?.message || '') ||
        err?.code === '23505';
      if (!soft) {
        setProjectIdeas((prev) =>
          prev.map((i) =>
            voteKey(i.id) === key ? { ...i, votes: prevCount } : i
          )
        );
        if (hasVoted) {
          setUserIdeaVotes((prev) => new Set(prev).add(key));
        } else {
          setUserIdeaVotes((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
        showToast(friendlyError(err), 'error');
      }
    } finally {
      voteInflight.current.delete(key);
      resolveLock?.();
    }
  };

  const openIdeaDetail = (ideaId) => {
    if (ideaId == null) return;
    navigate(`/ideas/${ideaId}`);
  };

  const toggleIdeaCategory = (cat) => {
    setIdeaCategoryFilter((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  if (!project && loading) {
    return (
      <div className="pt-20 min-h-screen flex items-center justify-center text-text-secondary gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-neon-cyan" />
        Loading workspace…
      </div>
    );
  }

  if (isStagingBoard && (roleLoading || !isModerator)) {
    return (
      <div className="pt-20 min-h-screen flex items-center justify-center text-text-secondary gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-neon-cyan" />
        Loading staging…
      </div>
    );
  }

  const displayProject = project || DEFAULT_PROJECT;
  const projectKey = displayProject.slug || displayProject.id || projectSlug;
  const projectPath = `/projects/${projectKey}`;
  const boardPath = `${projectPath}/board`;
  const stagingPath = `${boardPath}/staging`;
  const suggestedPath = `${boardPath}/suggested`;
  const projectSubmitPath = `/ideas/submit?project=${projectKey || ''}`;
  const projectGithubUrl =
    displayProject.githubUrl || displayProject.github_url || null;

  const openGithubEdit = () => {
    setGithubEditDraft(projectGithubUrl || '');
    setGithubEditOpen(true);
  };

  const saveProjectGithub = async () => {
    if (!projectUuid || !isModerator) return;
    setGithubEditBusy(true);
    try {
      const updated = await updateProject(projectUuid, {
        github_url: githubEditDraft.trim() || null,
      });
      setProject((prev) =>
        prev
          ? {
              ...prev,
              githubUrl: updated?.github_url || updated?.githubUrl || null,
            }
          : prev
      );
      setGithubEditOpen(false);
      showToast(
        updated?.github_url || updated?.githubUrl
          ? 'Project repository link saved.'
          : 'GitHub link cleared.',
        'success'
      );
    } catch (err) {
      showToast(
        friendlyError(err) ||
          'Could not save GitHub URL. Run supabase/sql/supabase_project_github.sql if the column is missing.',
        'error'
      );
    } finally {
      setGithubEditBusy(false);
    }
  };

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">

      <div
        className={`container-custom relative z-10 ${
          boardOnly
            ? 'py-6 md:py-8 space-y-6 md:space-y-8'
            : 'py-10 md:py-14 space-y-12 md:space-y-16'
        }`}
      >
        {boardOnly ? (
          /* -------- Dedicated Task Board: title + full-width control bar -------- */
          <BoardHeader
            autoReleaseBusy={autoReleaseBusy}
            autoReleaseNotices={autoReleaseNotices}
            boardCategoryFilter={boardCategoryFilter}
            boardFiltersActive={boardFiltersActive}
            boardPath={boardPath}
            boardScope={boardScope}
            boardTasks={boardTasks}
            boardUnclaimedOnly={boardUnclaimedOnly}
            claimQuota={claimQuota}
            claimsEnabled={claimsEnabled}
            clearBoardFilters={clearBoardFilters}
            dismissAutoReleaseNotices={dismissAutoReleaseNotices}
            displayProject={displayProject}
            handleRunAutoReleaseCheck={handleRunAutoReleaseCheck}
            hideBlockedTasks={hideBlockedTasks}
            isModerator={isModerator}
            isStagingBoard={isStagingBoard}
            loading={loading}
            lockedTaskCount={lockedTaskCount}
            openCreateTaskForm={openCreateTaskForm}
            openGithubEdit={openGithubEdit}
            pendingSuggestionCount={pendingSuggestionCount}
            projectGithubUrl={projectGithubUrl}
            projectPath={projectPath}
            projectUuid={projectUuid}
            setBoardCategoryFilter={setBoardCategoryFilter}
            setBoardScope={setBoardScope}
            setBoardUnclaimedOnly={setBoardUnclaimedOnly}
            setHideBlockedTasks={setHideBlockedTasks}
            stagingPath={stagingPath}
            suggestedPath={suggestedPath}
            tasks={tasks}
            toggleBoardCategory={toggleBoardCategory}
            user={user}
          />
        ) : (
          <HubHeader
            boardPath={boardPath}
            displayProject={displayProject}
            projectGithubUrl={projectGithubUrl}
            projectPath={projectPath}
            projectSubmitPath={projectSubmitPath}
            pulse={pulse}
          />
        )}

        {boardOnly && boardError && (
          <div
            role="alert"
            className="rounded-xl border border-semantic-warning/40 bg-semantic-warning/10 px-4 py-3 text-sm text-semantic-warning"
          >
            {boardError}
          </div>
        )}

        {boardOnly && !isStagingBoard && claimQuota?.signedIn && claimQuota.isRestricted && (
          <div
            role="alert"
            className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 space-y-1"
          >
            <p className="font-semibold text-red-100">
              Claim privileges limited
            </p>
            <p className="text-red-100/90 leading-relaxed">
              {claimQuota.restrictionPermanent
                ? 'Your ability to claim and submit tasks is restricted due to prior review issues.'
                : `Your ability to claim and submit tasks is temporarily limited${
                    claimQuota.restrictedUntil
                      ? ` until ${new Date(claimQuota.restrictedUntil).toLocaleDateString()}`
                      : ''
                  }.`}{' '}
              To appeal or regain privileges, message a Project Lead on{' '}
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-neon-cyan hover:text-white"
              >
                Discord
              </a>
              .
            </p>
            {claimQuota.restrictionReason && (
              <p className="text-xs text-red-200/70 font-mono">
                Note: {claimQuota.restrictionReason}
              </p>
            )}
          </div>
        )}

        {boardOnly &&
          !isStagingBoard &&
          claimQuota?.signedIn &&
          !claimQuota.isRestricted &&
          claimQuota.meetsIdentityGate === false && (
            <div
              role="status"
              className="rounded-xl border border-semantic-warning/40 bg-semantic-warning/10 px-4 py-3 text-sm text-semantic-warning"
            >
              <p className="font-semibold">Finish account setup to contribute</p>
              <p className="mt-1 leading-relaxed text-semantic-warning/90">
                {claimQuota.identityReason ||
                  'Verify your email and link Discord, Google, or GitHub before claiming tasks or submitting for review.'}
              </p>
              <Link
                to="/account/linked?setup=identity"
                className="mt-2 inline-flex items-center rounded-lg border border-semantic-warning/50 bg-semantic-warning/15 px-3 py-1.5 text-xs font-semibold text-semantic-warning hover:bg-semantic-warning/25 hover:text-white"
              >
                Link accounts on Profile
              </Link>
            </div>
          )}

        {/* 3. TASK BOARD (full page) or hub entry card */}
        {<TaskBoardSection
          boardOnly={boardOnly}
          boardPath={boardPath}
          boardScope={boardScope}
          boardTasks={boardTasks}
          claimingId={claimingId}
          completedOpen={completedOpen}
          handleClaim={handleClaim}
          handleDuplicateTask={handleDuplicateTask}
          handleMovePublicToStaging={handleMovePublicToStaging}
          handlePublishStaging={handlePublishStaging}
          handleRequestJoin={handleRequestJoin}
          handleStagingDelete={handleStagingDelete}
          handleStagingMove={handleStagingMove}
          handleUpdateTask={handleUpdateTask}
          handleViewTask={handleViewTask}
          isModerator={isModerator}
          isStagingBoard={isStagingBoard}
          joiningId={joiningId}
          loading={loading}
          myPendingJoinTaskIds={myPendingJoinTaskIds}
          navigate={navigate}
          openCreateSubTask={openCreateSubTask}
          openCreateTaskForm={openCreateTaskForm}
          openEditTaskForm={openEditTaskForm}
          projectUuid={projectUuid}
          publishingId={publishingId}
          pulse={pulse}
          reviewOpen={reviewOpen}
          setCompletedOpen={setCompletedOpen}
          setReviewOpen={setReviewOpen}
          setSuggestOpen={setSuggestOpen}
          stagingBusyId={stagingBusyId}
          stagingPath={stagingPath}
          tasks={tasks}
          tasksByStatus={tasksByStatus}
          unpublishingId={unpublishingId}
          user={user}
        />}

        {!boardOnly && (
        <>
        {/* 4 + 5. ACTIVITY + SHOUTOUTS - fixed height, scroll when overflowing */}
        <ActivityShoutoutsSection
          activity={activity}
          shoutouts={shoutouts}
        />

        {/* 6. OPEN QUESTIONS — staff-initiated project decisions */}
        <OpenQuestionsSection
          projectId={projectUuid}
          projectSlug={projectKey}
          projectTitle={displayProject.title}
          isStaff={isModerator}
          user={user}
        />

        {/* 7. PROJECT IDEAS - scoped to this project only */}
        <ProjectIdeasSection
          displayProject={displayProject}
          handleVoteIdea={handleVoteIdea}
          ideaCategoryFilter={ideaCategoryFilter}
          ideaFilterOpen={ideaFilterOpen}
          ideaSearch={ideaSearch}
          ideasError={ideasError}
          ideasLoading={ideasLoading}
          ideaSortMode={ideaSortMode}
          openIdeaDetail={openIdeaDetail}
          projectIdeas={projectIdeas}
          projectSlug={projectSlug}
          projectSubmitPath={projectSubmitPath}
          setIdeaCategoryFilter={setIdeaCategoryFilter}
          setIdeaFilterOpen={setIdeaFilterOpen}
          setIdeaSearch={setIdeaSearch}
          setIdeaSortMode={setIdeaSortMode}
          sortedIdeas={sortedIdeas}
          toggleIdeaCategory={toggleIdeaCategory}
          userIdeaVotes={userIdeaVotes}
          voteKey={voteKey}
        />

        {/* 8. UPDATES — staff Devlogs & announcements */}
        <ProjectUpdatesSection
          projectId={projectUuid}
          isStaff={isModerator}
          user={user}
        />
        </>
        )}
      </div>

      {/* Task detail (working view) — evidence / submit live in a separate modal */}
      <TaskDetailModal
        actionBusy={actionBusy}
        canEditProgress={canEditProgress}
        canManageJoinRequests={canManageJoinRequests}
        canReturnClaim={canReturnClaim}
        canReviewSubmission={canReviewSubmission}
        canStaffCompleteParent={canStaffCompleteParent}
        canSubmitForReview={canSubmitForReview}
        claimantTrust={claimantTrust}
        claimHelperNames={claimHelperNames}
        claimingId={claimingId}
        closeTaskPanel={closeTaskPanel}
        handleAcceptReview={handleAcceptReview}
        handleCancelScopeRequest={handleCancelScopeRequest}
        handleClaim={handleClaim}
        handleMovePublicToStaging={handleMovePublicToStaging}
        handleRejectAsFakeWork={handleRejectAsFakeWork}
        handleRejectReview={handleRejectReview}
        handleRequestScopeHelp={handleRequestScopeHelp}
        handleResolveJoin={handleResolveJoin}
        handleReturn={handleReturn}
        handleStaffCompleteParent={handleStaffCompleteParent}
        handleToggleHoldClaim={handleToggleHoldClaim}
        handleViewTask={handleViewTask}
        isClaimHolder={isClaimHolder}
        isModerator={isModerator}
        isPendingReview={isPendingReview}
        isStagingBoard={isStagingBoard}
        joinRequests={joinRequests}
        myPendingJoinRequest={myPendingJoinRequest}
        notesDraft={notesDraft}
        openCreateSubTask={openCreateSubTask}
        openDuplicateTaskForm={openDuplicateTaskForm}
        openEditTaskForm={openEditTaskForm}
        openSubmitReviewFlow={openSubmitReviewFlow}
        openTaskDetail={openTaskDetail}
        progressDraft={progressDraft}
        projectSlug={projectSlug}
        projectUuid={projectUuid}
        reviewActionBusy={reviewActionBusy}
        reviewFeedbackDraft={reviewFeedbackDraft}
        scopeHelpDraft={scopeHelpDraft}
        scopeHelpOpen={scopeHelpOpen}
        selectedBreadcrumb={selectedBreadcrumb}
        selectedChildren={selectedChildren}
        selectedIsLeaf={selectedIsLeaf}
        selectedTask={selectedTask}
        selectedTaskCanClaim={selectedTaskCanClaim}
        selectedTaskClaimsPaused={selectedTaskClaimsPaused}
        selectedTaskShowsBlocked={selectedTaskShowsBlocked}
        selectedTaskWaitBlockers={selectedTaskWaitBlockers}
        setNotesDraft={setNotesDraft}
        setProgressDraft={setProgressDraft}
        setReviewFeedbackDraft={setReviewFeedbackDraft}
        setScopeHelpDraft={setScopeHelpDraft}
        setScopeHelpOpen={setScopeHelpOpen}
        submitReviewOpen={submitReviewOpen}
        subtasksDraft={subtasksDraft}
        toggleSubtask={toggleSubtask}
        unpublishingId={unpublishingId}
        user={user}
      />

      {/* Dedicated Submit for Review — focused hand-off */}
      <SubmitReviewModal
        actionBusy={actionBusy}
        addEvidenceLinkRow={addEvidenceLinkRow}
        claimQuota={claimQuota}
        closeSubmitReviewFlow={closeSubmitReviewFlow}
        evidenceDependsOn={evidenceDependsOn}
        evidenceDraft={evidenceDraft}
        evidenceLinkError={evidenceLinkError}
        evidenceLinks={evidenceLinks}
        evidenceLinkWarning={evidenceLinkWarning}
        evidenceNoteError={evidenceNoteError}
        handleSubmitForReview={handleSubmitForReview}
        projectGithubUrl={projectGithubUrl}
        removeEvidenceLinkRow={removeEvidenceLinkRow}
        selectedTask={selectedTask}
        setEvidenceDependsOn={setEvidenceDependsOn}
        setEvidenceDraft={setEvidenceDraft}
        setEvidenceLinkError={setEvidenceLinkError}
        setEvidenceLinkWarning={setEvidenceLinkWarning}
        setEvidenceNoteError={setEvidenceNoteError}
        submitReviewOpen={submitReviewOpen}
        subtasksDraft={subtasksDraft}
        updateEvidenceLink={updateEvidenceLink}
      />

      {/* Staff: project GitHub repository URL */}
      <ProjectGithubModal
        githubEditBusy={githubEditBusy}
        githubEditDraft={githubEditDraft}
        githubEditOpen={githubEditOpen}
        projectUuid={projectUuid}
        saveProjectGithub={saveProjectGithub}
        setGithubEditDraft={setGithubEditDraft}
        setGithubEditOpen={setGithubEditOpen}
      />

      {/* Create / Edit task form (Project Lead + Admin only) */}
      <TaskFormModal
        addSubtaskLine={addSubtaskLine}
        closeTaskForm={closeTaskForm}
        editingTaskId={editingTaskId}
        handleTaskFormSubmit={handleTaskFormSubmit}
        isModerator={isModerator}
        isStagingBoard={isStagingBoard}
        removeSubtaskLine={removeSubtaskLine}
        requestDeleteFromTaskForm={requestDeleteFromTaskForm}
        taskForm={taskForm}
        taskFormBusy={taskFormBusy}
        taskFormError={taskFormError}
        taskFormMode={taskFormMode}
        taskFormOpen={taskFormOpen}
        tasks={tasks}
        toggleBlockedByTask={toggleBlockedByTask}
        updateSubtaskLine={updateSubtaskLine}
        updateTaskFormField={updateTaskFormField}
      />

      <PublishTaskConfirmModal
        confirmPublishStaging={confirmPublishStaging}
        publishConfirmTask={publishConfirmTask}
        publishingId={publishingId}
        setPublishConfirmTask={setPublishConfirmTask}
      />

      <UnpublishTaskConfirmModal
        confirmMovePublicToStaging={confirmMovePublicToStaging}
        setUnpublishConfirmTask={setUnpublishConfirmTask}
        unpublishConfirmTask={unpublishConfirmTask}
        unpublishingId={unpublishingId}
      />

      <DeleteTaskConfirmModal
        confirmStagingDelete={confirmStagingDelete}
        deleteConfirmTask={deleteConfirmTask}
        setDeleteConfirmTask={setDeleteConfirmTask}
        stagingBusyId={stagingBusyId}
      />

      <SuggestTaskModal
        isOpen={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        projectUuid={projectUuid}
        user={user}
        tasks={tasks}
        locked={Boolean(suggestAccount.locked)}
        strikeCount={Number(suggestAccount.strikeCount) || 0}
        onSubmitted={() => {
          showToast(
            'Suggestion sent. Staff will review it on the Suggested Tasks board.',
            'success'
          );
          void refreshSuggestionMeta();
        }}
      />

      {/* Above task modals (z-200) so validation/errors stay readable while a modal is open */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 z-[300] max-w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border px-4 py-3 text-sm font-mono tracking-wide shadow-xl pointer-events-none ${
            toast.kind === 'error'
              ? 'border-semantic-danger/50 bg-cyber-card text-semantic-danger'
              : toast.kind === 'success'
                ? 'border-semantic-success/50 bg-cyber-card text-semantic-success'
                : toast.kind === 'warn'
                  ? 'border-semantic-warning/50 bg-cyber-card text-semantic-warning'
                  : 'border-neon-cyan/50 bg-cyber-card text-neon-cyan'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default ProjectWorkspace;
