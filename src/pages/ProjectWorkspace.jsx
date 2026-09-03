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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Link,
  useParams,
  useNavigate,
  useLocation,
  useMatch,
} from 'react-router-dom';
import {
  Users,
  CheckCircle2,
  Sparkles,
  Megaphone,
  Hammer,
  Lightbulb,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Copy,
  ChevronDown,
  LayoutGrid,
  ExternalLink,
  Github,
  Upload,
} from 'lucide-react';

import Button from '../components/ui/Buttons';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import TaskCard from '../components/ui/TaskCard';
import SubTaskList from '../components/ui/SubTaskList';
import TaskDependencyPicker from '../components/ui/TaskDependencyPicker';
import TaskStagingTree from '../components/ui/TaskStagingTree';
import OpenQuestionsSection from '../components/projects/OpenQuestionsSection';
import BannerImage from '../components/ui/BannerImage';
import ActivityItem from '../components/ui/ActivityItem';
import StatWidget from '../components/ui/StatWidget';
import Modal from '../components/ui/Modal';
import TaskCategoryBadge from '../components/ui/TaskCategoryBadge';
import DiscordLink from '../components/ui/DiscordLink';
import UserAvatar from '../components/ui/UserAvatar';
import { updateProject } from '../services/projectsService';
import UserNameWithBadge from '../components/badges/UserNameWithBadge';
import LoadingScreen from '../components/ui/LoadingScreen';
import IdeaCard from '../components/ui/IdeaCard';
import { useIsModerator } from '../hooks/useIsModerator';
import OpenConductCaseButton from '../components/conduct/OpenConductCaseButton';
import {
  tasksService,
  getChildTasks,
  getTaskBreadcrumb,
  taskLevelLabel,
  getUserTaskClaimBlockedReason,
  STAFF_ONLY_TASK_MESSAGE,
  STAGING_TASK_CLAIM_MESSAGE,
  BOARD_SCOPE_STAGING,
  BOARD_SCOPE_PUBLIC,
  canPublishStagingTask,
  normalizeChecklist,
  progressFromChecklist,
  isChecklistComplete,
  isTaskVisibleWithLockedToggle,
  CLAIM_IDLE_RELEASE_DAYS,
  CLAIM_MAX_DURATION_DAYS,
  CLAIM_AUTO_RELEASE_POLICY_COPY,
  getClaimAutoReleaseInfo,
  formatAutoReleaseReason,
} from '../services/tasksService';
import { ideasService } from '../services/ideasService';
import {
  optimisticPublicCount,
  reconcilePublicCount,
} from '../utils/publicCounts';
import { supabase } from '../lib/supabase';
import { phaseImageSrc, phaseImageAlt } from '../utils/phaseImages';
import {
  displayProjectTitle,
  canonicalProjectSlug,
  TETHER_SLUG,
} from '../utils/ideaStatus';
import {
  TASK_CATEGORIES,
  getTaskCategoryTextClass,
  getTaskCategoryStyle,
  taskMatchesCategoryFilter,
  normalizeTaskCategoryKey,
} from '../constants/taskCategories';
import {
  TASK_EFFORT_OPTIONS,
  isStructuredTaskEffort,
  normalizeTaskEffort,
} from '../constants/taskEffort';
import {
  getReviewEvidenceHint,
  getReviewNoteHint,
  getReviewLinkPlaceholder,
  isCodeLikeCategory,
  composeReviewEvidence,
  validateReviewEvidencePackage,
  normalizeEvidenceUrl,
  REVIEW_EVIDENCE_MIN_CHARS,
} from '../constants/taskReviewEvidence';
import { DISCORD_URL } from '../constants/communityLinks';
import { progressTone } from '../utils/progressTone';

// ---------------------------------------------------------------------------
// Fallback copy when projects table has no matching slug yet
// ---------------------------------------------------------------------------

const FALLBACK_PROJECTS = {
  tether: {
    slug: 'tether',
    title: 'Tether',
    phase: 'Early',
    status: 'In Development',
    description:
      'A tethered crew crosses dangerous semi-procedural levels to reach a destroyed orbital station. Linked by a shared energy tether, players must coordinate movement, manage tension and momentum, collect critical resources for their stranded colony, and ultimately recover an antimatter generator that will let the colony survive on its own. Teamwork tools grow stronger when used together, while simple enemies try to break the tether. The tone is serious and the stakes are real: the people waiting below are counting on the crew.',
  },
  'core-features': {
    slug: 'core-features',
    title: 'Mid Game Ambitions',
    phase: 'Mid',
    status: 'Planning',
    description:
      'Next up after Early is completed: cooperative games at the scale of Halo, Horizon Zero Dawn, and Skyrim, with deeper systems, dynamic worlds, and stronger teamwork. Not open for claims yet.',
  },
  'polish-playtests': {
    slug: 'polish-playtests',
    title: 'Stability & Polish',
    phase: 'Late',
    status: 'Vision',
    description:
      'Polish passes, optimization, and wider playtests. Help stress-test builds and report what breaks - or what delights.',
  },
};

const DEFAULT_PROJECT = {
  slug: 'unknown',
  title: 'Community Project',
  phase: 'Early',
  status: 'In Development',
  description:
    'A collaborative Together Forge project. Claim tasks, ship wins, and help shape the build with the community.',
};

FALLBACK_PROJECTS['prototype-systems'] = FALLBACK_PROJECTS[TETHER_SLUG];

const IDEA_CATEGORIES = [
  'Full Game Idea',
  'Game Mechanic',
  'Setting / Story / Lore',
  'Art / Visual Design',
  'Audio / Sound / Music',
  'Multiplayer / Cooperative Systems',
  'Twitch / Streamer Integration',
  'Progression / Economy / Crafting',
  'Enemy / AI / Combat',
  'World Building / Environment',
  'Other',
];

const mapWorkspaceIdea = (idea) => ({
  id: idea.id,
  title: idea.title,
  summary: idea.summary || idea.description || '',
  description: idea.description || '',
  votes: idea.votes || 0,
  category: idea.category || 'Idea',
  tags: idea.tags || null,
  created_at: idea.created_at || null,
  createdAt: idea.created_at || null,
  lastVoteTime: idea.last_vote_time || idea.lastVoteTime || null,
  project_id: idea.project_id || null,
  projectId: idea.project_id || null,
  user_id: idea.user_id || null,
  commentCount: idea.commentCount || 0,
  submitter: idea.creator?.username || 'Member',
  creator: idea.creator || {
    username: 'Member',
    avatar_url: null,
    avatarUrl: null,
  },
});

const UPDATES = [
  {
    id: 'u1',
    title: 'Weekly pulse - networking & map',
    date: 'Jul 8, 2026',
    body: 'Interpolation fixes landed on player movement. Demo map is ready for internal playtests. Next: claim UI polish and HUD mockups review.',
    tag: 'Devlog',
  },
  {
    id: 'u2',
    title: 'Volunteer onboarding notes',
    date: 'Jul 3, 2026',
    body: 'New claim flow is live on the board. Leave progress notes when you hand off a task so the next person can pick up cleanly.',
    tag: 'Process',
  },
  {
    id: 'u3',
    title: 'Art drop - placeholder set A',
    date: 'Jun 28, 2026',
    body: 'First placeholder sprites are in. Enough visual language to run co-op loops without blocking on final art.',
    tag: 'Art',
  },
];

/** Main kanban columns (side-by-side). Review + Completed are collapsible rows below. */
const KANBAN_COLUMNS = [
  {
    key: 'todo',
    label: 'To Do',
    accent: 'border-neon-cyan/40',
    header: 'text-neon-cyan',
    dot: 'bg-neon-cyan',
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    accent: 'border-neon-magenta/40',
    header: 'text-neon-magenta',
    dot: 'bg-neon-magenta',
  },
];

const REVIEW_COLUMN = {
  key: 'in_review',
  label: 'Ready for Review',
  accent: 'border-semantic-warning/40',
  header: 'text-semantic-warning',
  dot: 'bg-semantic-warning',
};

const COMPLETED_COLUMN = {
  key: 'completed',
  label: 'Completed',
  accent: 'border-semantic-success/40',
  header: 'text-semantic-success',
  dot: 'bg-semantic-success',
};

const TASK_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

/** Max optional checklist steps per task (staff create/edit form). */
const MAX_CHECKLIST_STEPS = 20;

const EMPTY_TASK_FORM = {
  title: '',
  description: '',
  category: 'Code',
  difficulty: 'Medium',
  estimatedEffort: '',
  subtaskLines: [''],
  parentTaskId: null,
  /** Task ids this task is blocked by (all must be Completed to unlock) */
  blockedByTaskIds: [],
  /** Staff: allow claim while blockers incomplete */
  dependencyOverride: false,
  /** Staff: volunteers can view but cannot claim */
  staffOnly: false,
};

const fieldLabelClass =
  'block text-sm font-mono tracking-widest text-neon-cyan mb-2';
const fieldControlClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors';

function parseSubtaskLines(lines) {
  return (lines || [])
    .map((line, i) => String(line || '').trim())
    .filter(Boolean)
    .map((label, i) => ({
      id: `s${i + 1}`,
      label,
      done: false,
    }));
}

function friendlyError(err) {
  const msg = err?.message || String(err || 'Something went wrong');
  if (err?.code === 'IDENTITY_GATE' || /IDENTITY_GATE/i.test(msg)) {
    return msg.replace(/^IDENTITY_GATE:\s*/i, '');
  }
  if (err?.code === 'CLAIM_RESTRICTED' || /CLAIM_RESTRICTED/i.test(msg)) {
    return msg.replace(/^CLAIM_RESTRICTED:\s*/i, '');
  }
  if (err?.code === 'TASK_LOCKED' || /TASK_LOCKED|Locked – waiting on/i.test(msg)) {
    return msg.replace(/^TASK_LOCKED:\s*/i, '');
  }
  if (err?.code === 'STAFF_ONLY' || /STAFF_ONLY/i.test(msg)) {
    return msg.replace(/^STAFF_ONLY:\s*/i, '') || STAFF_ONLY_TASK_MESSAGE;
  }
  if (err?.code === 'STAGING_TASK' || /STAGING_TASK/i.test(msg)) {
    return msg.replace(/^STAGING_TASK:\s*/i, '') || STAGING_TASK_CLAIM_MESSAGE;
  }
  if (
    err?.code === 'SUBMIT_LIMIT' ||
    err?.code === 'SUBMIT_COOLDOWN' ||
    /SUBMIT_LIMIT|SUBMIT_COOLDOWN/i.test(msg)
  ) {
    return msg.replace(/^(SUBMIT_LIMIT|SUBMIT_COOLDOWN):\s*/i, '');
  }
  if (
    err?.code === 'EVIDENCE_LINK_REQUIRED' ||
    err?.code === 'EVIDENCE_LINK_INVALID' ||
    err?.code === 'EVIDENCE_REQUIRED'
  ) {
    return msg;
  }
  if (/JWT|not authenticated|sign in/i.test(msg)) {
    return 'Sign in to claim tasks and track progress.';
  }
  if (/already claimed/i.test(msg)) {
    return 'Someone already claimed that task. Pick another!';
  }
  if (/already completed/i.test(msg)) return 'That task is already complete.';
  if (/No active claim/i.test(msg)) return 'No active claim on this task.';
  if (/active tasks|CLAIM_LIMIT|claim limit|before claiming/i.test(msg)) {
    return msg;
  }
  if (/Only the claimant/i.test(msg)) {
    return 'Only the claimant or a project lead can do that.';
  }
  if (/relation .* does not exist|Could not find the table/i.test(msg)) {
    return 'Task tables are not set up yet. Run supabase/sql/supabase_tasks_schema.sql in the Supabase SQL Editor.';
  }
  if (/Maximum nesting|hierarchy|parent_task|Epic|sub-task|cannot be claimed|calculated from completed/i.test(msg)) {
    return msg;
  }
  if (/do not hold an active claim|Claim it before/i.test(msg)) {
    return 'Claim this task first before saving progress or checklist items.';
  }
  if (/already have a pending|already helping|already requested/i.test(msg)) {
    return msg;
  }
  return msg;
}

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
  /** When false (default), locked (Blocked by incomplete) tasks are hidden */
  const [boardShowLocked, setBoardShowLocked] = useState(false);
  /** Staff: force dual-rule auto-release check */
  const [autoReleaseBusy, setAutoReleaseBusy] = useState(false);
  const [stagingBusyId, setStagingBusyId] = useState(null);
  const [publishingId, setPublishingId] = useState(null);
  /** Notices for claims auto-released under this user */
  const [autoReleaseNotices, setAutoReleaseNotices] = useState([]);

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
   * - "all": every task (flat / indented hierarchy)
   * - "top": top-level epics/tasks for overview, PLUS nested leaves that are
   *   claimed, in review, or completed so work never disappears from the kanban
   * - Category / Unclaimed filters stack on top (AND with scope).
   * - When filters are active in "top" mode, matching nested tasks are also
   *   included so an artist can find claimable Art work without switching scope.
   * - "Show locked tasks" applies in BOTH scopes (and nested detail lists).
   */
  const boardTasks = useMemo(() => {
    const filtersActive =
      boardCategoryFilter.length > 0 || boardUnclaimedOnly;

    const inTopScope = (t) => {
      if (!t.parentTaskId) return true;
      if (t.dbStatus === 'Completed' || t.status === 'completed') return true;
      const claimStatus = t.claim?.status;
      if (claimStatus === 'Active' || claimStatus === 'PendingReview') {
        return true;
      }
      if (t.dbStatus === 'InReview' || t.status === 'in_review') return true;
      if (claimStatus === 'Completed') return true;
      return false;
    };

    const isUnclaimedClaimable = (t) => {
      if (t.dbStatus === 'Completed' || t.status === 'completed') return false;
      // Locked tasks are never "claimable now"
      if (!isTaskVisibleWithLockedToggle(t, false)) return false;
      if (t.claim?.status === 'Active' || t.claim?.status === 'PendingReview') {
        return false;
      }
      if (t.claimedBy) return false;
      // Prefer service flag (epics / parents with children are not claimable)
      if (t.volunteerClaimable === true) return true;
      if (t.volunteerClaimable === false) return false;
      if (t.hasChildren || t.isEpic || (t.depth || 0) === 0) return false;
      return true;
    };

    const matchesFilters = (t) => {
      // Locked gate is applied again as a final pass so no scope branch skips it
      if (!isTaskVisibleWithLockedToggle(t, boardShowLocked)) return false;
      if (!taskMatchesCategoryFilter(t, boardCategoryFilter)) return false;
      if (boardUnclaimedOnly && !isUnclaimedClaimable(t)) return false;
      return true;
    };

    let list;
    if (boardScope === 'all') {
      list = tasks.filter(matchesFilters);
    } else if (!filtersActive) {
      // Top-level / tiered overview
      list = tasks.filter((t) => matchesFilters(t) && inTopScope(t));
    } else {
      // Top-level mode + filters: keep top-scope tasks that match, plus any
      // nested match so skill filters surface claimable work under epics.
      list = tasks.filter((t) => {
        if (!matchesFilters(t)) return false;
        if (inTopScope(t)) return true;
        // Nested match (e.g. unclaimed Art leaf under a Design epic)
        return Boolean(t.parentTaskId);
      });
    }

    // Final pass: never surface locked tasks unless the toggle is on
    // (covers every board scope / filter combination)
    return list.filter((t) =>
      isTaskVisibleWithLockedToggle(t, boardShowLocked)
    );
  }, [
    tasks,
    boardScope,
    boardCategoryFilter,
    boardUnclaimedOnly,
    boardShowLocked,
  ]);

  const lockedTaskCount = useMemo(
    () =>
      tasks.filter((t) => !isTaskVisibleWithLockedToggle(t, false)).length,
    [tasks]
  );

  const boardFiltersActive =
    boardCategoryFilter.length > 0 || boardUnclaimedOnly || boardShowLocked;

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
    setBoardShowLocked(false);
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
      } else if (task.claim?.status === 'Active') {
        key = 'in_progress';
      } else {
        key = 'todo';
      }
      groups[key].push(task);
    }
    return groups;
  }, [boardTasks]);

  /**
   * Direct children in the task detail hierarchy list.
   * Respects "Show locked tasks" so tiered navigation matches the board toggle.
   */
  const selectedChildren = useMemo(() => {
    if (!selectedTaskId) return [];
    return getChildTasks(tasks, selectedTaskId).filter((t) =>
      isTaskVisibleWithLockedToggle(t, boardShowLocked)
    );
  }, [tasks, selectedTaskId, boardShowLocked]);

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
      blockedByTaskIds: Array.isArray(task.blockedByIds)
        ? [...task.blockedByIds]
        : Array.isArray(task.blockedBy)
          ? task.blockedBy.map((b) => b.id).filter(Boolean)
          : [],
      dependencyOverride: Boolean(task.dependencyOverride),
      staffOnly: Boolean(task.staffOnly),
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
      blockedByTaskIds: Array.isArray(task.blockedByIds)
        ? [...task.blockedByIds]
        : Array.isArray(task.blockedBy)
          ? task.blockedBy.map((b) => b.id).filter(Boolean)
          : [],
      // Fresh copy should respect blockers unless lead re-enables override
      dependencyOverride: false,
      staffOnly: Boolean(task.staffOnly),
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

  const handleStagingDelete = async (task) => {
    if (!isModerator || !task?.id || !isStagingBoard) return;
    const nested = task.childCount || 0;
    const ok = window.confirm(
      nested > 0
        ? `Delete “${task.title}” and ${nested} nested staging task${nested === 1 ? '' : 's'}?\n\nPublic copies already published stay on the live board.`
        : `Delete “${task.title}” from Staging?\n\nPublic copies already published stay on the live board.`
    );
    if (!ok) return;
    setStagingBusyId(task.id);
    try {
      await tasksService.deleteTask(task.id);
      if (selectedTaskId === task.id) setSelectedTaskId(null);
      await refreshBoard(projectUuid);
      showToast('Removed from Staging.', 'success');
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

  const handlePublishStaging = async (task) => {
    if (!isModerator || !task?.id || !isStagingBoard) return;
    if (!canPublishStagingTask(task)) {
      showToast('Publish a Medium or Epic. Small tasks go with their parent.', 'warn');
      return;
    }
    const kind = (Number(task.depth) || 0) === 0 ? 'Epic' : 'Medium';
    const extra =
      task.publishedTaskId
        ? '\n\nSome of this was published before. New nested work will be copied; existing public tasks stay in place.'
        : '';
    const ok = window.confirm(
      `Publish “${task.title}” (${kind}) to the public task board?\n\nThis copies it and nested staging tasks to the live board. Staff Only flags are kept. The Staging copy stays here for further prep.${extra}`
    );
    if (!ok) return;
    setPublishingId(task.id);
    try {
      const result = await tasksService.publishStagingTask(task.id);
      await refreshBoard(projectUuid);
      const created = Number(result?.created_count) || 0;
      showToast(
        created > 0
          ? `Published ${created} task${created === 1 ? '' : 's'} to the public board.`
          : 'Already on the public board. New nested work will appear the next time you publish.',
        'success'
      );
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setPublishingId(null);
    }
  };

  const toggleBlockedByTask = (blockerId) => {
    if (!blockerId) return;
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

    const payload = {
      title,
      description: (taskForm.description || '').trim(),
      category: taskForm.category || null,
      difficulty: taskForm.difficulty || null,
      estimatedEffort:
        normalizeTaskEffort(taskForm.estimatedEffort || '') || null,
      subtasks: parseSubtaskLines(taskForm.subtaskLines),
      parentTaskId: taskForm.parentTaskId || null,
      blockedByTaskIds: [...(taskForm.blockedByTaskIds || [])],
      dependencyOverride: Boolean(taskForm.dependencyOverride),
      staffOnly: Boolean(taskForm.staffOnly),
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
        await tasksService.createTask(projectUuid, payload, user.id);
        await refreshBoard(projectUuid);
        showToast(
          isStagingBoard
            ? payload.parentTaskId
              ? 'Staging sub-task saved. Publish its Medium or Epic when the structure is ready.'
              : 'Staging task saved. Volunteers cannot see it until you publish.'
            : payload.parentTaskId
              ? 'Sub-task created under its parent. Open the parent to claim nested work.'
              : 'Task created - it is live in To Do and ready to claim!',
          'success'
        );
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

  // Dual-rule auto-release when opening a board (server is source of truth)
  useEffect(() => {
    if (!projectUuid) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await tasksService.runClaimAutoRelease();
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
            const seenKey = 'tf_auto_release_seen';
            let seen = [];
            try {
              seen = JSON.parse(localStorage.getItem(seenKey) || '[]');
            } catch {
              seen = [];
            }
            const unseen = notices.filter((n) => !seen.includes(n.id));
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
      const seenKey = 'tf_auto_release_seen';
      try {
        const seen = JSON.parse(localStorage.getItem(seenKey) || '[]');
        const next = [...new Set([...seen, ...prev.map((n) => n.id)])].slice(
          -50
        );
        localStorage.setItem(seenKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return [];
    });
  }, []);

  /**
   * Staff test: evaluate Active claims as if the 14-day idle window already
   * elapsed (releases current Active claims without waiting real time).
   */
  const handleRunAutoReleaseCheck = async () => {
    if (!isModerator) return;
    const ok = window.confirm(
      `Test auto-release (14-day idle simulation)\n\n` +
        `This treats every Active claim as if it has had no meaningful progress for ${CLAIM_IDLE_RELEASE_DAYS} days, and will release those claims now so you can verify the flow.\n\n` +
        `Pending-review claims are not touched. Continue?`
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
        err?.code === 'STAFF_ONLY';
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
          <header className="space-y-5">
            <div className="min-w-0">
              <div className="section-header">
                {isStagingBoard ? 'Staff only' : 'Task Board'}
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-neon-cyan drop-shadow-[0_0_24px_rgba(0,249,255,0.25)]">
                {isStagingBoard ? 'Staging' : displayProject.title}
              </h1>
              {isStagingBoard && (
                <p className="mt-2 text-sm text-text-secondary max-w-2xl leading-relaxed">
                  Preparation board for {displayProject.title}. Volunteers never
                  see these tasks. Publish an Epic or Medium to copy it onto the
                  public board.
                </p>
              )}
            </div>

            {/* Contribution loop: TF board vs GitHub — below title, above controls */}
            <div className="rounded-lg border border-cyber-border/80 bg-cyber-bg/40 px-3 py-2.5 text-xs text-text-secondary leading-relaxed">
              <p className="font-mono tracking-widest text-[10px] text-text-muted uppercase mb-1">
                {isStagingBoard ? 'How staging works' : 'How contributing works'}
              </p>
              <p>
                {isStagingBoard ? (
                  <>
                    Build Epics, Mediums, and Smalls here. Reorder and delete
                    freely. When a Medium or Epic is ready,{' '}
                    <span className="text-white font-medium">Publish</span> it
                    to the public board. Staff Only flags copy with the live
                    tasks. Volunteers never see Staging.
                  </>
                ) : (
                  <>
                <span className="text-white font-medium">Together Forge</span>{' '}
                = claim, track, review, and credit ·{' '}
                <span className="text-white font-medium">GitHub</span> = where
                technical work lives
                {projectGithubUrl ? (
                  <>
                    {' '}
                    (
                    <a
                      href={projectGithubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-neon-cyan hover:underline"
                    >
                      project repo
                    </a>
                    )
                  </>
                ) : (
                  ''
                )}
                . Claim here → do the work
                {projectGithubUrl ? ' on GitHub' : ' (GitHub for code tasks)'}{' '}
                → submit with clear evidence (PR preferred for Code) → get
                credit when accepted.
                  </>
                )}
              </p>
              {!isStagingBoard && (
              <p className="mt-2 text-[11px] text-text-muted leading-relaxed border-t border-cyber-border/50 pt-2">
                {CLAIM_AUTO_RELEASE_POLICY_COPY}
              </p>
              )}
            </div>

            {!isStagingBoard && autoReleaseNotices.length > 0 && (
              <div className="rounded-lg border border-semantic-warning/40 bg-semantic-warning/10 px-3 py-2.5 flex flex-col sm:flex-row sm:items-start gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xs font-mono tracking-widest text-semantic-warning uppercase">
                    Claim auto-released
                  </p>
                  {autoReleaseNotices.map((n) => (
                    <p
                      key={n.id}
                      className="text-sm text-text-secondary leading-snug"
                    >
                      {n.message}
                      {n.taskTitle ? (
                        <span className="text-text-muted">
                          {' '}
                          ({n.taskTitle})
                        </span>
                      ) : null}
                    </p>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={dismissAutoReleaseNotices}
                >
                  Dismiss
                </Button>
              </div>
            )}

            <div className="w-full rounded-xl border border-cyber-border bg-cyber-surface/70 px-3 py-3 sm:px-4 sm:py-3.5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                {/* Meta: claims + counts */}
                <div className="flex flex-wrap items-center gap-2 min-w-0 lg:flex-1">
                  <Badge variant="neon" className="justify-center shrink-0">
                    {loading
                      ? 'Loading…'
                      : isStagingBoard
                        ? `${tasks.length} staging`
                        : `${boardTasks.length} shown · ${tasks.length} total`}
                  </Badge>
                  {!user && !isStagingBoard && (
                    <span className="text-xs font-mono text-text-muted">
                      Sign in to claim
                    </span>
                  )}
                  {claimQuota?.signedIn && !isStagingBoard && (
                    <span className="text-xs font-mono text-text-muted">
                      Your claims: {claimQuota.activeClaims ?? 0}/
                      {claimQuota.claimLimit ?? 2} active
                      {claimQuota.completedClaims != null
                        ? ` · ${claimQuota.completedClaims} accepted`
                        : ''}
                      {typeof claimQuota.submitsLast24h === 'number' &&
                      typeof claimQuota.submitLimit24h === 'number'
                        ? ` · submits ${claimQuota.submitsLast24h}/${claimQuota.submitLimit24h} (24h)`
                        : ''}
                      {claimQuota.cooldownEndsAt &&
                      new Date(claimQuota.cooldownEndsAt) > new Date()
                        ? ' · claim cooldown'
                        : ''}
                      {claimQuota.submitCooldownEndsAt &&
                      new Date(claimQuota.submitCooldownEndsAt) > new Date()
                        ? ' · submit cooldown'
                        : ''}
                      {claimQuota.isRestricted ? ' · restricted' : ''}
                    </span>
                  )}
                </div>

                {/* Scope toggle — centered on wide screens */}
                <div className="flex justify-start lg:justify-center lg:shrink-0">
                  <div className="inline-flex rounded-lg border border-cyber-border overflow-hidden text-xs font-mono w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setBoardScope('top')}
                      className={`flex-1 sm:flex-none px-4 py-2.5 transition-colors ${
                        boardScope === 'top'
                          ? 'bg-neon-cyan/15 text-neon-cyan'
                          : 'text-text-muted hover:text-white'
                      }`}
                      title="Overview: top-level tasks, plus any nested claims"
                    >
                      Top-level
                    </button>
                    <button
                      type="button"
                      onClick={() => setBoardScope('all')}
                      className={`flex-1 sm:flex-none px-4 py-2.5 border-l border-cyber-border transition-colors ${
                        boardScope === 'all'
                          ? 'bg-neon-cyan/15 text-neon-cyan'
                          : 'text-text-muted hover:text-white'
                      }`}
                      title="Show every task including nested sub-tasks"
                    >
                      All tasks
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 lg:flex-1 lg:justify-end">
                  {projectGithubUrl ? (
                    <a
                      href={projectGithubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-2 text-xs font-semibold text-neon-cyan hover:bg-neon-cyan/20 hover:text-white transition-colors"
                      title="Open this project’s GitHub repository or board"
                    >
                      <Github className="w-4 h-4" />
                      View on GitHub
                    </a>
                  ) : isModerator ? (
                    <Button
                      variant="outline"
                      className="gap-2"
                      size="sm"
                      onClick={openGithubEdit}
                      disabled={!projectUuid}
                      title="Set the GitHub repo so contributors know where technical work lives"
                    >
                      <Github className="w-4 h-4" />
                      Set GitHub repo
                    </Button>
                  ) : null}
                  {isModerator && projectGithubUrl && (
                    <button
                      type="button"
                      onClick={openGithubEdit}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-text-muted hover:text-neon-cyan"
                      title="Edit project GitHub URL"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit repo
                    </button>
                  )}
                  {isModerator && !isStagingBoard && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      to={stagingPath}
                      disabled={!projectUuid || loading}
                      title="Staff-only preparation board. Volunteers cannot see it."
                    >
                      <Upload className="w-4 h-4" />
                      Staging
                    </Button>
                  )}
                  {isStagingBoard && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      to={boardPath}
                    >
                      <LayoutGrid className="w-4 h-4" />
                      Public board
                    </Button>
                  )}
                  {isModerator && !isStagingBoard && (
                    <Button
                      className="gap-2"
                      onClick={() => openCreateTaskForm(null)}
                      disabled={!projectUuid || loading}
                      title={
                        !projectUuid
                          ? 'Project must be loaded from Supabase first'
                          : 'Create a new top-level task on this board'
                      }
                    >
                      <Plus className="w-4 h-4" />
                      Add New Task
                    </Button>
                  )}
                  {isModerator && !isStagingBoard && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => void handleRunAutoReleaseCheck()}
                      disabled={autoReleaseBusy || !projectUuid}
                      title={`TEST: Release Active claims as if they have been idle for ${CLAIM_IDLE_RELEASE_DAYS} days (no real wait). Staff only.`}
                    >
                      {autoReleaseBusy
                        ? 'Testing…'
                        : 'Run auto-release check now'}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="gap-2"
                    to={`${projectPath}/contributors`}
                  >
                    <Users className="w-4 h-4" />
                    Contributors
                  </Button>
                  <Button
                    variant="secondary"
                    className="gap-2"
                    to={projectPath}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Project hub
                  </Button>
                </div>
              </div>

              {/* Category + unclaimed filters — skill-first for new contributors */}
              {!isStagingBoard && (
              <div className="mt-3 pt-3 border-t border-cyber-border/80 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-mono tracking-widest text-text-muted uppercase">
                    Filter by skill
                  </p>
                  {boardFiltersActive && (
                    <button
                      type="button"
                      onClick={clearBoardFilters}
                      className="text-[11px] font-mono text-neon-cyan hover:text-white transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
                <div
                  className="flex flex-wrap items-center gap-2"
                  role="group"
                  aria-label="Task board filters"
                >
                  <button
                    type="button"
                    onClick={() => setBoardCategoryFilter([])}
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
                      boardCategoryFilter.length === 0
                        ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/50'
                        : 'bg-transparent text-text-muted border-cyber-border hover:border-cyber-border hover:text-text-secondary'
                    }`}
                    aria-pressed={boardCategoryFilter.length === 0}
                  >
                    All categories
                  </button>
                  {TASK_CATEGORIES.map((cat) => {
                    const active = boardCategoryFilter.some(
                      (c) =>
                        normalizeTaskCategoryKey(c) ===
                        normalizeTaskCategoryKey(cat)
                    );
                    const style = getTaskCategoryStyle(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleBoardCategory(cat)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
                          active
                            ? `${style.badge} ring-1 ${style.ring}`
                            : 'bg-cyber-surface/40 text-text-muted border-cyber-border/80 hover:text-text-secondary hover:border-cyber-border'
                        }`}
                        aria-pressed={active}
                        title={
                          active
                            ? `Remove ${cat} filter`
                            : `Show ${cat} tasks`
                        }
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            active ? style.swatch : 'bg-text-muted/50'
                          }`}
                          aria-hidden
                        />
                        {cat}
                      </button>
                    );
                  })}
                  <span
                    className="hidden sm:inline w-px h-5 bg-cyber-border mx-0.5"
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => setBoardUnclaimedOnly((v) => !v)}
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
                      boardUnclaimedOnly
                        ? 'bg-semantic-achievement/15 text-semantic-achievement border-semantic-achievement/50 ring-1 ring-semantic-achievement/30'
                        : 'bg-transparent text-text-muted border-cyber-border hover:text-text-secondary'
                    }`}
                    aria-pressed={boardUnclaimedOnly}
                    title="Only tasks you can claim right now"
                  >
                    Unclaimed only
                  </button>
                  <button
                    type="button"
                    onClick={() => setBoardShowLocked((v) => !v)}
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
                      boardShowLocked
                        ? 'bg-white/10 text-text-secondary border-white/30 ring-1 ring-white/15'
                        : 'bg-transparent text-text-muted border-cyber-border hover:text-text-secondary'
                    }`}
                    aria-pressed={boardShowLocked}
                    title={
                      boardShowLocked
                        ? 'Hide locked tasks (blocked by incomplete work)'
                        : 'Show locked tasks that are waiting on other tasks'
                    }
                  >
                    Show locked tasks
                    {lockedTaskCount > 0 ? (
                      <span className="ml-1.5 tabular-nums opacity-80">
                        ({lockedTaskCount})
                      </span>
                    ) : null}
                  </button>
                </div>
                {boardFiltersActive && !loading && (
                  <p className="text-[11px] font-mono text-text-muted">
                    Showing {boardTasks.length} match
                    {boardTasks.length === 1 ? '' : 'es'}
                    {boardCategoryFilter.length > 0
                      ? ` · ${boardCategoryFilter.join(', ')}`
                      : ''}
                    {boardUnclaimedOnly ? ' · unclaimed only' : ''}
                    {boardShowLocked ? ' · including locked' : ''}
                    {boardScope === 'top'
                      ? ' · includes matching nested tasks'
                      : ''}
                  </p>
                )}
              </div>
              )}
            </div>
          </header>
        ) : (
          <>
            {/* 1. PROJECT HEADER (hub) */}
            <header className="space-y-4">
              {phaseImageSrc(displayProject.phase) && (
                <div className="relative w-full h-40 sm:h-52 md:h-56 rounded-xl overflow-hidden border border-cyber-border bg-cyber-surface">
                  <BannerImage
                    src={phaseImageSrc(displayProject.phase)}
                    alt={phaseImageAlt(
                      displayProject.phase,
                      displayProject.title
                    )}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="eager"
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-cyber-bg via-cyber-bg/40 to-transparent pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              )}

              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                <div className="max-w-3xl">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
                    {displayProject.title}
                  </h1>
                  <p className="mt-4 text-text-secondary text-base sm:text-lg leading-relaxed">
                    {displayProject.description}
                  </p>
                  <p className="mt-2 text-xs font-mono text-text-muted tracking-widest">
                    ID // {displayProject.slug || displayProject.id}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                  <Button
                    className="gap-2"
                    to={boardPath}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    Task Board
                  </Button>
                  {projectGithubUrl ? (
                    <a
                      href={projectGithubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-5 py-2.5 text-base font-semibold text-neon-cyan hover:bg-neon-cyan/20 transition-colors"
                    >
                      <Github className="w-4 h-4" />
                      View on GitHub
                    </a>
                  ) : null}
                  <Button
                    variant="secondary"
                    className="gap-2"
                    to={projectSubmitPath}
                  >
                    <Sparkles className="w-4 h-4" />
                    Submit Idea
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    to={`${projectPath}/contributors`}
                  >
                    <Users className="w-4 h-4" />
                    Contributors
                  </Button>
                </div>
              </div>
              <div className="max-w-xl">
                <DiscordLink
                  variant="note"
                  labelKey="chat"
                  note="Coordinate claims, ask questions, or discuss scope with the community."
                />
              </div>
            </header>

            {/* 2. PROJECT PULSE */}
            <section aria-label="Project activity stats">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatWidget
                  label="Contributors"
                  value={pulse.contributors ?? pulse.activePeople ?? 0}
                  icon={<Users className="w-7 h-7 text-neon-cyan mx-auto" />}
                />
                <StatWidget
                  label="Tasks Completed"
                  value={pulse.tasksCompleted ?? 0}
                  icon={
                    <CheckCircle2 className="w-7 h-7 text-neon-cyan mx-auto" />
                  }
                />
                <StatWidget
                  label="Open Tasks"
                  value={pulse.openTasks ?? 0}
                  icon={
                    <Hammer className="w-7 h-7 text-semantic-achievement mx-auto" />
                  }
                />
              </div>

              {pulse.activeWorkers?.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="text-xs font-mono tracking-widest text-text-muted uppercase">
                    On the forge now
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {pulse.activeWorkers.map((w) => (
                      <div
                        key={w.userId}
                        className="inline-flex items-center gap-2 rounded-full border border-neon-cyan/30 bg-cyber-surface/80 pl-1 pr-3 py-1"
                        title={w.username}
                      >
                        <UserAvatar
                          src={w.avatarUrl || w.avatar_url}
                          name={w.username}
                          username={w.username}
                          initials={w.initials}
                          size="sm"
                        />
                        <UserNameWithBadge
                          username={w.username}
                          displayName={w.username}
                          pinnedBadgeKey={
                            w.pinnedBadgeKey || w.pinned_badge_key || null
                          }
                          linkClassName="text-sm text-text-primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </>
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
        {boardOnly && isStagingBoard ? (
        <section aria-labelledby="staging-board-heading" className="space-y-4">
          <h2 id="staging-board-heading" className="sr-only">
            Staging task board
          </h2>
          {loading ? (
            <LoadingScreen variant="section" message="Loading staging…" />
          ) : (
            <TaskStagingTree
              tasks={tasks}
              busyId={stagingBusyId}
              publishingId={publishingId}
              onAddEpic={() => openCreateTaskForm(null)}
              onAddChild={(parent) => openCreateSubTask(parent)}
              onEdit={(task) => openEditTaskForm(task)}
              onDelete={handleStagingDelete}
              onPublish={handlePublishStaging}
              onMove={handleStagingMove}
            />
          )}
        </section>
        ) : boardOnly ? (
        <section aria-labelledby="board-heading" className="space-y-4">
          <h2 id="board-heading" className="sr-only">
            Task board columns
          </h2>

          {loading ? (
            <LoadingScreen variant="section" message="Loading board…" />
          ) : (
            <div className="space-y-4">
              {/* Main columns: To Do / In Progress */}
              <div className="flex lg:grid lg:grid-cols-2 gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
                {KANBAN_COLUMNS.map((col) => {
                  const colTasks = tasksByStatus[col.key] || [];
                  return (
                    <div
                      key={col.key}
                      className={`snap-start shrink-0 w-[min(100%,20rem)] sm:w-[22rem] lg:w-auto flex flex-col rounded-xl border bg-cyber-surface/80 ${col.accent} min-h-[20rem]`}
                    >
                      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-cyber-border">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                          <h3
                            className={`font-mono text-xs tracking-widest uppercase ${col.header}`}
                          >
                            {col.label}
                          </h3>
                        </div>
                        <span className="text-xs font-mono text-text-muted">
                          {colTasks.length}
                        </span>
                      </div>

                      <div className="task-scroll flex-1 p-3 space-y-3 max-h-[28rem] overflow-y-auto">
                        {colTasks.length === 0 ? (
                          <p className="text-sm text-text-muted text-center py-8 px-2">
                            No tasks in this column.
                          </p>
                        ) : (
                          colTasks.map((task) => (
                            <div key={task.id} id={`task-${task.id}`}>
                              <TaskCard
                                task={task}
                                currentUserId={user?.id}
                                claiming={claimingId === task.id}
                                joining={joiningId === task.id}
                                joinRequestPending={myPendingJoinTaskIds.has(
                                  task.id
                                )}
                                onClaim={
                                  col.key === 'todo' ? handleClaim : undefined
                                }
                                onRequestJoin={
                                  col.key === 'in_progress'
                                    ? handleRequestJoin
                                    : undefined
                                }
                                onView={handleViewTask}
                                canStaffUpdate={isModerator}
                                isStaff={isModerator}
                                onDuplicate={
                                  isModerator ? handleDuplicateTask : undefined
                                }
                              />
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ready for Review: full-width collapsible (same pattern as Completed) */}
              {(() => {
                const reviewTasks = tasksByStatus[REVIEW_COLUMN.key] || [];
                return (
                  <div
                    className={`w-full rounded-xl border bg-cyber-surface/80 ${REVIEW_COLUMN.accent} overflow-hidden`}
                  >
                    <button
                      type="button"
                      onClick={() => setReviewOpen((o) => !o)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-cyber-border hover:bg-cyber-card/40 transition-colors text-left"
                      aria-expanded={reviewOpen}
                      aria-controls="review-tasks-panel"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${REVIEW_COLUMN.dot}`}
                        />
                        <h3
                          className={`font-mono text-xs tracking-widest uppercase ${REVIEW_COLUMN.header}`}
                        >
                          {REVIEW_COLUMN.label}
                        </h3>
                        <span className="text-xs font-mono text-text-muted tabular-nums">
                          {reviewTasks.length}
                        </span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-text-muted shrink-0 transition-transform duration-200 ${
                          reviewOpen ? 'rotate-180' : ''
                        }`}
                        aria-hidden
                      />
                    </button>

                    {reviewOpen && (
                      <div
                        id="review-tasks-panel"
                        className="task-scroll p-3 sm:p-4 max-h-[28rem] overflow-y-auto"
                      >
                        {reviewTasks.length === 0 ? (
                          <p className="text-sm text-text-muted text-center py-8 px-2">
                            No tasks waiting for review.
                          </p>
                        ) : (
                          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            {reviewTasks.map((task) => (
                              <div key={task.id} id={`task-${task.id}`}>
                                <TaskCard
                                  task={task}
                                  currentUserId={user?.id}
                                  onView={handleViewTask}
                                  canStaffUpdate={isModerator}
                                  isStaff={isModerator}
                                  onDuplicate={
                                    isModerator
                                      ? handleDuplicateTask
                                      : undefined
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Completed: full-width collapsible under the active columns */}
              {(() => {
                const completedTasks =
                  tasksByStatus[COMPLETED_COLUMN.key] || [];
                return (
                  <div
                    className={`w-full rounded-xl border bg-cyber-surface/80 ${COMPLETED_COLUMN.accent} overflow-hidden`}
                  >
                    <button
                      type="button"
                      onClick={() => setCompletedOpen((o) => !o)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-cyber-border hover:bg-cyber-card/40 transition-colors text-left"
                      aria-expanded={completedOpen}
                      aria-controls="completed-tasks-panel"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${COMPLETED_COLUMN.dot}`}
                        />
                        <h3
                          className={`font-mono text-xs tracking-widest uppercase ${COMPLETED_COLUMN.header}`}
                        >
                          {COMPLETED_COLUMN.label}
                        </h3>
                        <span className="text-xs font-mono text-text-muted tabular-nums">
                          {completedTasks.length}
                        </span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-text-muted shrink-0 transition-transform duration-200 ${
                          completedOpen ? 'rotate-180' : ''
                        }`}
                        aria-hidden
                      />
                    </button>

                    {completedOpen && (
                      <div
                        id="completed-tasks-panel"
                        className="task-scroll p-3 sm:p-4 max-h-[28rem] overflow-y-auto"
                      >
                        {completedTasks.length === 0 ? (
                          <p className="text-sm text-text-muted text-center py-8 px-2">
                            No completed tasks yet. Accepted work appears here.
                          </p>
                        ) : (
                          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            {completedTasks.map((task) => (
                              <div key={task.id} id={`task-${task.id}`}>
                                <TaskCard
                                  task={task}
                                  currentUserId={user?.id}
                                  onView={handleViewTask}
                                  canStaffUpdate={isModerator}
                                  isStaff={isModerator}
                                  onUpdate={handleUpdateTask}
                                  onDuplicate={
                                    isModerator
                                      ? handleDuplicateTask
                                      : undefined
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          <div className="max-w-xl pt-2">
            <DiscordLink
              variant="note"
              labelKey="join"
              note="Need to talk about a task, scope, or claim? Chat with the community in real time."
            />
          </div>
        </section>
        ) : (
        /* Hub: Task Board entry (full board is on /board) */
        <section aria-labelledby="board-entry-heading">
          <Card className="bg-cyber-card/80 border-neon-cyan/25 overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6 p-1">
              <div className="flex-1 min-w-0 space-y-3">
                <div className="section-header">Contribute</div>
                <h2
                  id="board-entry-heading"
                  className="text-2xl font-bold text-white flex items-center gap-2"
                >
                  <LayoutGrid className="w-6 h-6 text-neon-cyan shrink-0" />
                  Task Board
                </h2>
                <p className="text-text-secondary text-sm sm:text-base leading-relaxed max-w-2xl">
                  Claim work, track progress, submit for review, and ship wins.
                  The full board has room for columns, hierarchy, and every
                  task on this project.
                </p>
                <div className="flex flex-wrap gap-3 text-xs font-mono text-text-muted">
                  <span>
                    {pulse.openTasks ?? 0} open
                  </span>
                  <span className="text-white/20" aria-hidden>
                    ·
                  </span>
                  <span>
                    {pulse.tasksCompleted ?? 0} completed
                  </span>
                  {tasks.length > 0 && (
                    <>
                      <span className="text-white/20" aria-hidden>
                        ·
                      </span>
                      <span>{tasks.length} total</span>
                    </>
                  )}
                </div>
              </div>
              <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-2">
                <Button
                  className="gap-2"
                  to={boardPath}
                  disabled={loading}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Open Task Board
                </Button>
                {isModerator && (
                  <Button
                    variant="outline"
                    className="gap-2"
                    to={stagingPath}
                    disabled={loading}
                    title="Staff-only preparation board"
                  >
                    <Upload className="w-4 h-4" />
                    Open Staging
                  </Button>
                )}
                <DiscordLink
                  variant="button"
                  labelKey="join"
                  className="w-full sm:w-auto lg:w-full"
                />
                <Button
                  variant="ghost"
                  className="gap-2"
                  to="/get-involved"
                >
                  <Hammer className="w-4 h-4" />
                  How to contribute
                </Button>
              </div>
            </div>
          </Card>
        </section>
        )}

        {!boardOnly && (
        <>
        {/* 4 + 5. ACTIVITY + SHOUTOUTS - fixed height, scroll when overflowing */}
        <div className="grid lg:grid-cols-5 gap-6 lg:items-stretch">
          <section
            aria-labelledby="activity-heading"
            className="lg:col-span-3 flex flex-col min-h-0"
          >
            <h2 id="activity-heading" className="section-header mb-4 shrink-0">
              Recent Activity
            </h2>
            <Card className="bg-cyber-card/80 !p-0 flex-1 min-h-0 max-h-[min(28rem,50vh)] flex flex-col overflow-hidden">
              <div className="task-scroll overflow-y-auto flex-1 min-h-0 px-5 py-2">
                {activity.length === 0 ? (
                  <p className="text-sm text-text-muted py-6 text-center">
                    No activity yet - claim a task to light up the feed.
                  </p>
                ) : (
                  activity.map((item) => (
                    <ActivityItem key={item.id} activity={item} />
                  ))
                )}
              </div>
            </Card>
          </section>

          <section
            aria-labelledby="shoutouts-heading"
            className="lg:col-span-2 flex flex-col min-h-0"
          >
            <h2 id="shoutouts-heading" className="section-header mb-4 shrink-0">
              Shoutouts
            </h2>
            <div className="task-scroll overflow-y-auto flex-1 min-h-0 max-h-[min(28rem,50vh)] space-y-3 pr-0.5">
              {shoutouts.length === 0 ? (
                <Card className="bg-cyber-card/80 border-semantic-achievement/25">
                  <p className="text-sm text-text-secondary">
                    Complete a task or support this project to earn a shoutout
                    here. The forge celebrates shippers and supporters.
                  </p>
                </Card>
              ) : (
                shoutouts.map((person) => (
                  <Card
                    key={person.id}
                    className={
                      person.kind === 'donation'
                        ? 'bg-cyber-card/80 border-neon-magenta/30'
                        : 'bg-cyber-card/80 border-semantic-achievement/30'
                    }
                  >
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        src={person.avatarUrl || person.avatar_url}
                        name={person.name}
                        username={person.username}
                        initials={person.initials}
                        size="lg"
                        className="shrink-0 mt-0.5"
                        borderClass={
                          person.kind === 'donation'
                            ? 'border border-neon-magenta/50'
                            : 'border border-semantic-achievement/50'
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {person.username ? (
                            <UserNameWithBadge
                              username={person.username}
                              displayName={person.name}
                              pinnedBadgeKey={
                                person.pinnedBadgeKey ||
                                person.pinned_badge_key ||
                                null
                              }
                              linkClassName={
                                person.kind === 'donation'
                                  ? 'font-medium text-neon-magenta'
                                  : 'font-medium text-semantic-achievement'
                              }
                            />
                          ) : (
                            <span
                              className={
                                person.kind === 'donation'
                                  ? 'font-medium text-neon-magenta'
                                  : 'font-medium text-semantic-achievement'
                              }
                            >
                              {person.name}
                            </span>
                          )}
                          {person.role ? (
                            <Badge
                              variant={
                                person.kind === 'donation' ? 'purple' : 'gold'
                              }
                            >
                              {person.role}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-text-secondary leading-relaxed">
                          {person.note}
                        </p>
                        {person.time && (
                          <p className="text-xs font-mono text-text-muted mt-1">
                            {person.time}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </section>
        </div>

        {/* 6. OPEN QUESTIONS — staff-initiated project decisions */}
        <OpenQuestionsSection
          projectId={projectUuid}
          projectTitle={displayProject.title}
          isStaff={isModerator}
          user={user}
        />

        {/* 7. PROJECT IDEAS - scoped to this project only */}
        <section id="project-ideas" aria-labelledby="project-ideas-heading">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
            <div className="max-w-2xl">
              <div className="section-header">Project Ideas</div>
              <h2
                id="project-ideas-heading"
                className="text-2xl font-bold text-white"
              >
                Ideas for {displayProject.title}
              </h2>
              <p className="text-text-secondary text-sm mt-2 leading-relaxed">
                Only ideas linked to this project. Vote, discuss, and help shape
                what we build next.
              </p>
            </div>

            <Button
              className="gap-2 self-start lg:self-auto shrink-0"
              to={projectSubmitPath}
            >
              <Lightbulb className="w-4 h-4" />
              Submit Idea for this Project
            </Button>
          </div>

          {/* Sort / filter bar (aligned with main Ideas page) */}
          <div className="mb-5 flex flex-col sm:flex-row gap-3 max-w-4xl">
            <input
              type="search"
              placeholder="Search project ideas..."
              value={ideaSearch}
              onChange={(e) => setIdeaSearch(e.target.value)}
              className="bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 w-full sm:max-w-xs text-text-primary placeholder:text-text-muted focus:border-neon-cyan outline-none text-sm"
            />
            <select
              value={ideaSortMode}
              onChange={(e) => setIdeaSortMode(e.target.value)}
              className="bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary focus:border-neon-cyan outline-none text-sm"
            >
              <option value="newest">Newest</option>
              <option value="votes">Most Voted</option>
              <option value="title">Title A–Z</option>
            </select>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIdeaFilterOpen((o) => !o)}
                className="w-full sm:w-auto bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary text-sm flex items-center gap-2 hover:border-neon-cyan transition-colors"
              >
                Filter by Category
                {ideaCategoryFilter.length > 0 && (
                  <span className="text-xs bg-neon-cyan text-cyber-bg px-2 py-0.5 rounded-full font-mono">
                    {ideaCategoryFilter.length}
                  </span>
                )}
              </button>
              {ideaFilterOpen && (
                <div className="absolute mt-2 w-72 max-w-[calc(100vw-2rem)] bg-cyber-surface border border-cyber-border rounded-lg p-4 z-50 shadow-lg">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-text-muted">Categories</span>
                    <button
                      type="button"
                      onClick={() => setIdeaCategoryFilter([])}
                      className="text-xs text-neon-cyan hover:underline"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="task-scroll max-h-60 overflow-auto space-y-1">
                    {IDEA_CATEGORIES.map((cat) => (
                      <label
                        key={cat}
                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={ideaCategoryFilter.includes(cat)}
                          onChange={() => toggleIdeaCategory(cat)}
                          className="accent-cyan-400"
                        />
                        <span className="text-text-secondary">{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {ideasError && (
            <div
              role="alert"
              className="mb-4 max-w-4xl rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-100/90"
            >
              {ideasError}
            </div>
          )}

          <div className="space-y-3 max-w-4xl">
            {ideasLoading ? (
              <div className="flex items-center gap-2 py-10 text-text-secondary text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-neon-cyan" />
                Loading project ideas…
              </div>
            ) : sortedIdeas.length === 0 ? (
              <Card className="bg-cyber-card/80 border-neon-cyan/20">
                <p className="text-sm text-text-secondary leading-relaxed">
                  {projectIdeas.length === 0
                    ? 'No ideas linked to this project yet. Be the first - submit an idea and it will land here for the team.'
                    : 'No ideas match your search or filters. Clear filters to see everything for this project.'}
                </p>
                <Button
                  className="gap-2 mt-4"
                  size="sm"
                  to={projectSubmitPath}
                >
                  <Lightbulb className="w-4 h-4" />
                  Submit Idea for this Project
                </Button>
              </Card>
            ) : (
              sortedIdeas.map((idea) => {
                const key = voteKey(idea.id);
                const voted =
                  userIdeaVotes.has(key) ||
                  userIdeaVotes.has(idea.id) ||
                  userIdeaVotes.has(Number(idea.id));
                // Ideas on this workspace are linked to this project
                const projectLabel =
                  displayProject.title ||
                  displayProject.slug ||
                  projectSlug ||
                  'This project';
                const projectKey =
                  displayProject.slug || projectSlug || idea.project_id;

                return (
                  <IdeaCard
                    key={idea.id}
                    idea={{
                      ...idea,
                      // Ensure Linked status + project key for chip
                      project_id: idea.project_id || projectKey,
                    }}
                    voted={voted}
                    isOwn={false}
                    onVote={(e, ideaRow) => handleVoteIdea(e, ideaRow.id)}
                    onOpen={openIdeaDetail}
                    projectName={projectLabel}
                    projectHref={
                      projectKey
                        ? `/projects/${canonicalProjectSlug(projectKey) || projectKey}`
                        : null
                    }
                    commentCount={idea.commentCount || 0}
                    showTags
                  />
                );
              })
            )}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <Button
              variant="outline"
              className="gap-2"
              to={projectSubmitPath}
            >
              <Sparkles className="w-4 h-4" />
              Submit Idea for this Project
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              to={`/ideas?project=${displayProject.slug || displayProject.id}`}
            >
              View all ideas
            </Button>
            {!ideasLoading && projectIdeas.length > 0 && (
              <span className="text-xs font-mono text-text-muted">
                {sortedIdeas.length} of {projectIdeas.length} shown
              </span>
            )}
          </div>
        </section>

        {/* 8. UPDATES */}
        <section aria-labelledby="updates-heading" className="pb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
            <div>
              <div className="section-header">Updates</div>
              <h2 id="updates-heading" className="text-2xl font-bold text-white">
                Devlogs & announcements
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 self-start sm:self-auto"
              to="/transparency"
            >
              <Megaphone className="w-4 h-4" />
              Transparency Hub
            </Button>
          </div>

          <div className="space-y-4 max-w-4xl">
            {UPDATES.map((update) => (
              <Card
                key={update.id}
                className="bg-cyber-card/80 border-l-2 border-l-neon-cyan"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge variant="neon">{update.tag}</Badge>
                  <span className="text-xs font-mono text-text-muted">
                    {update.date}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {update.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {update.body}
                </p>
              </Card>
            ))}
          </div>
        </section>
        </>
        )}
      </div>

      {/* Task detail (working view) — evidence / submit live in a separate modal */}
      <Modal
        isOpen={Boolean(selectedTask) && !submitReviewOpen}
        onClose={closeTaskPanel}
        title={selectedTask?.title || 'Task'}
        size="lg"
      >
        {selectedTask && (
          <div className="task-scroll space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Header: path then meta (stacked on mobile so they never collide) */}
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-3 sm:gap-y-1.5">
                {selectedBreadcrumb.length > 1 ? (
                  <nav
                    aria-label="Parent path"
                    className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs min-w-0 w-full sm:flex-1 sm:w-auto"
                  >
                    {selectedBreadcrumb.map((crumb, i) => {
                      const isLast = i === selectedBreadcrumb.length - 1;
                      return (
                        <span
                          key={crumb.id}
                          className="inline-flex items-center gap-1 min-w-0 max-w-full"
                        >
                          {i > 0 && (
                            <span className="text-white/25 shrink-0" aria-hidden>
                              →
                            </span>
                          )}
                          {isLast ? (
                            <span
                              className="truncate max-w-[min(12rem,70vw)] text-text-secondary"
                              title={crumb.title}
                            >
                              {crumb.title}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void openTaskDetail(crumb.id)}
                              className="inline-flex max-w-[min(11rem,70vw)] items-center rounded-md border border-neon-cyan/25 bg-transparent px-2 py-0.5 text-left text-xs font-medium text-neon-cyan/80 shadow-none hover:border-neon-cyan/45 hover:bg-neon-cyan/10 hover:text-neon-cyan active:bg-neon-cyan/15 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/50"
                              title={`Open ${crumb.title}`}
                            >
                              <span className="truncate">{crumb.title}</span>
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </nav>
                ) : null}

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono tracking-wide text-text-muted w-full sm:w-auto sm:max-w-[min(100%,22rem)] sm:justify-end sm:text-right sm:shrink-0">
                  {selectedTask.levelShort && (
                    <span className="shrink-0">{selectedTask.levelShort}</span>
                  )}
                  {selectedTask.category && (
                    <>
                      {selectedTask.levelShort && (
                        <span className="text-white/20 shrink-0" aria-hidden>
                          ·
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 font-medium shrink-0 ${getTaskCategoryTextClass(
                          selectedTask.category
                        )}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            getTaskCategoryStyle(selectedTask.category).swatch
                          }`}
                          aria-hidden
                        />
                        {selectedTask.category}
                      </span>
                    </>
                  )}
                  <>
                    {(selectedTask.levelShort || selectedTask.category) && (
                      <span className="text-white/20 shrink-0" aria-hidden>
                        ·
                      </span>
                    )}
                    <span className="shrink-0">
                      {selectedTask.status === 'todo'
                        ? 'To Do'
                        : selectedTask.status === 'in_progress'
                          ? 'In Progress'
                          : selectedTask.status === 'in_review'
                            ? 'Ready for Review'
                            : selectedTask.status === 'completed'
                              ? 'Completed'
                              : String(selectedTask.status || 'Open')}
                    </span>
                  </>
                  {selectedTask.staffOnly && (
                    <>
                      <span className="text-white/20 shrink-0" aria-hidden>
                        ·
                      </span>
                      <Badge
                        variant="gold"
                        className="!normal-case tracking-wide !text-[10px] !py-0.5 !px-2"
                      >
                        Staff Only
                      </Badge>
                    </>
                  )}
                  {!selectedTask.isEpic &&
                    !selectedTask.hasChildren &&
                    (selectedTask.difficulty ||
                      selectedTask.estimatedEffort) && (
                      <>
                        <span className="text-white/20 shrink-0" aria-hidden>
                          ·
                        </span>
                        <span className="shrink-0">
                          {[
                            selectedTask.difficulty
                              ? `Difficulty: ${selectedTask.difficulty}`
                              : null,
                            selectedTask.estimatedEffort || null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </>
                    )}
                  {selectedTask.hasChildren && (
                    <>
                      <span className="text-white/20 shrink-0" aria-hidden>
                        ·
                      </span>
                      <span className="shrink-0">
                        {selectedTask.completedChildCount}/
                        {selectedTask.childCount} sub-tasks
                      </span>
                    </>
                  )}
                  {isModerator && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 shrink-0 !py-1 !px-2 text-xs sm:ml-1"
                        onClick={() => openDuplicateTaskForm(selectedTask)}
                        title="Create a new To Do task with the same details"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Duplicate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 shrink-0 !py-1 !px-2 text-xs"
                        onClick={() => openEditTaskForm(selectedTask)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit Task
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {selectedTask.staffOnly && (
                <div className="rounded-lg border border-semantic-achievement/30 bg-semantic-achievement/10 px-3 py-2.5">
                  <p className="font-mono tracking-widest text-[10px] text-semantic-achievement uppercase mb-1.5">
                    Staff Only
                  </p>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {isModerator
                      ? 'Staff and founders can claim, work, and complete this task. Volunteers can see it on the board but cannot claim it.'
                      : 'This work is reserved for staff. It stays on the board so progress stays visible, but volunteers cannot claim it.'}
                  </p>
                </div>
              )}

              {selectedTask.description ? (
                <div className="rounded-lg border border-cyber-border/80 bg-cyber-bg/40 px-3 py-2.5">
                  <p className="font-mono tracking-widest text-[10px] text-text-muted uppercase mb-1.5">
                    Description
                  </p>
                  <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                    {selectedTask.description}
                  </p>
                </div>
              ) : null}

              {/* Locked / Blocked by */}
              {(selectedTask.isLocked ||
                (selectedTask.blockedBy &&
                  selectedTask.blockedBy.length > 0)) && (
                <div
                  className={`rounded-lg border px-3 py-2.5 ${
                    selectedTask.isLocked
                      ? 'border-white/15 bg-white/[0.03]'
                      : 'border-cyber-border/80 bg-cyber-bg/40'
                  }`}
                >
                  <p className="font-mono tracking-widest text-[10px] text-text-muted uppercase mb-1.5">
                    {selectedTask.isLocked
                      ? 'Locked'
                      : selectedTask.dependencyOverride
                        ? 'Dependencies (override on)'
                        : 'Blocked by'}
                  </p>
                  {selectedTask.isLocked ? (
                    <p className="text-sm text-text-secondary leading-relaxed">
                      Locked – waiting on:{' '}
                      <span className="text-text-primary font-medium">
                        {(selectedTask.lockedWaitingOn || []).join(', ') ||
                          'blocking tasks'}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-text-secondary leading-relaxed">
                      Depends on:{' '}
                      {(selectedTask.blockedBy || [])
                        .map((b) =>
                          b.isComplete
                            ? `${b.title} (done)`
                            : b.title
                        )
                        .join(', ')}
                      {selectedTask.dependencyOverride
                        ? ' · staff override allows claiming'
                        : ''}
                    </p>
                  )}
                  {isModerator && selectedTask.isLocked && (
                    <p className="text-[11px] text-text-muted mt-1.5">
                      Edit task to clear blockers or enable dependency override.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Hierarchy: volunteers only see this when children exist; staff can add */}
            {(selectedChildren.length > 0 ||
              (isModerator && selectedTask.canAddChild !== false)) && (
              <SubTaskList
                items={selectedChildren}
                parentDepth={selectedTask.depth || 0}
                onOpen={handleViewTask}
                onClaim={handleClaim}
                claimingId={claimingId}
                canClaim={Boolean(user)}
                isStaff={isModerator}
                canAdd={Boolean(
                  isModerator && selectedTask.canAddChild !== false
                )}
                onAdd={
                  isModerator
                    ? () => openCreateSubTask(selectedTask)
                    : undefined
                }
                hideEmptyMessage={!isModerator}
              />
            )}

            {/* Progress for parents / non-editors (always labeled Progress) */}
            {!canEditProgress &&
              (selectedTask.hasChildren ||
                selectedTask.hasChecklist ||
                (selectedTask.subtasks && selectedTask.subtasks.length > 0) ||
                selectedTask.claim?.status === 'Active' ||
                selectedTask.progressPercent > 0 ||
                selectedTask.status === 'completed') && (
                <div>
                  {(() => {
                    const pct =
                      selectedTask.status === 'completed'
                        ? 100
                        : Math.min(
                            100,
                            Math.max(0, selectedTask.progressPercent ?? 0)
                          );
                    const tone = progressTone(pct, {
                      isCompleted: selectedTask.status === 'completed',
                    });
                    return (
                      <>
                        <div className="flex items-center justify-between text-[10px] font-mono tracking-widest text-text-muted mb-1">
                          <span>PROGRESS</span>
                          <span className={tone.text}>{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-cyber-surface border border-cyber-border overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${tone.bar}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

            {/* Read-only checklist on leaf tasks for non-claimants */}
            {!canEditProgress &&
              selectedIsLeaf &&
              selectedTask.subtasks?.length > 0 && (
                <div>
                  <div className="text-xs font-mono tracking-widest text-text-muted mb-2">
                    CHECKLIST
                  </div>
                  <ul className="space-y-1.5 text-sm text-text-secondary">
                    {selectedTask.subtasks.map((s, i) => (
                      <li key={s.id || i} className="flex gap-2">
                        <span className="text-neon-cyan font-mono">
                          {s.done ? '✓' : '○'}
                        </span>
                        <span
                          className={s.done ? 'line-through opacity-70' : ''}
                        >
                          {s.label || s.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Claimed leaf: assignee */}
            {selectedTask.claimedBy && !selectedTask.hasChildren && (
              <div className="flex items-center gap-2">
                <UserAvatar
                  src={
                    selectedTask.claimedByAvatarUrl ||
                    selectedTask.claim?.avatarUrl ||
                    selectedTask.claim?.avatar_url
                  }
                  name={selectedTask.claimedBy}
                  username={
                    selectedTask.claim?.username || selectedTask.claimedBy
                  }
                  size="sm"
                />
                <div className="text-xs font-mono text-neon-cyan">
                  <p>
                    {selectedTask.status === 'completed'
                      ? 'Shipped by'
                      : 'Claimed by'}{' '}
                    {selectedTask.claimedBy}
                  </p>
                  {selectedTask.status !== 'completed' &&
                    selectedTask.claim?.claimedAt && (
                      <p className="text-text-muted">
                        {selectedTask.claim.heldLabel ||
                          `since ${new Date(
                            selectedTask.claim.claimedAt
                          ).toLocaleString()}`}
                      </p>
                    )}
                  {isModerator && claimantTrust && (
                    <p className="text-text-muted mt-0.5">
                      <span
                        className={
                          claimantTrust.trustTier === 'trusted'
                            ? 'text-emerald-300'
                            : claimantTrust.trustTier === 'new'
                              ? 'text-semantic-warning'
                              : 'text-neon-cyan'
                        }
                      >
                        {claimantTrust.trustLabel}
                      </span>
                      {' · '}
                      {claimantTrust.acceptedTasks} accepted · load{' '}
                      {claimantTrust.activeClaims}+
                      {claimantTrust.pendingReview} in review ·{' '}
                      {claimantTrust.accountAgeDays}d
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Claim owner / staff: moderate join requests */}
            {joinRequests.length > 0 && canManageJoinRequests && (
              <div className="rounded-lg border border-cyber-border bg-cyber-surface/60 p-3 space-y-2">
                <div className="text-xs font-mono tracking-widest text-text-muted uppercase">
                  Join requests
                </div>
                {joinRequests.map((jr) => (
                  <div
                    key={jr.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-white">{jr.username}</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={actionBusy}
                        onClick={() => handleResolveJoin(jr.id, true)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={actionBusy}
                        onClick={() => handleResolveJoin(jr.id, false)}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Requester (not claim owner): read-only status only - no Approve/Decline */}
            {!canManageJoinRequests && myPendingJoinRequest && (
              <div className="rounded-lg border border-cyber-border bg-cyber-surface/60 px-3 py-2 text-sm text-text-secondary">
                Your join request is pending. Waiting on{' '}
                <span className="text-white">
                  {selectedTask.claimedBy || 'the claim holder'}
                </span>
                .
              </div>
            )}

            {/* Claim holder only: progress + checklist on leaf tasks */}
            {canEditProgress && (
              <>
                {(() => {
                  const info = getClaimAutoReleaseInfo(selectedTask.claim);
                  return (
                    <div
                      className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                        info.urgent
                          ? 'border-semantic-warning/50 bg-semantic-warning/10 text-semantic-warning'
                          : info.warn
                            ? 'border-semantic-warning/30 bg-semantic-warning/5 text-text-secondary'
                            : 'border-cyber-border/80 bg-cyber-bg/40 text-text-muted'
                      }`}
                    >
                      <p className="font-mono tracking-widest text-[10px] uppercase mb-1 opacity-90">
                        Claim timer
                      </p>
                      <p>
                        {info.detailLabel || CLAIM_AUTO_RELEASE_POLICY_COPY}
                      </p>
                      {!info.detailLabel && (
                        <p className="mt-1 opacity-90">
                          Idle: {CLAIM_IDLE_RELEASE_DAYS}d without progress notes
                          / checklist / status · Hard max:{' '}
                          {CLAIM_MAX_DURATION_DAYS}d from claim.
                        </p>
                      )}
                    </div>
                  );
                })()}
                <div>
                  {(() => {
                    const pct = Math.min(99, Number(progressDraft) || 0);
                    const tone = progressTone(pct);
                    const checklistDriven = subtasksDraft.length > 0;
                    return (
                      <>
                        <div className="flex items-center justify-between text-[10px] font-mono tracking-widest text-text-muted mb-1">
                          <span>PROGRESS</span>
                          <span className={tone.text}>{pct}%</span>
                        </div>
                        {/* Single colored bar; range is invisible overlay when not checklist-driven */}
                        <div className="relative h-2 rounded-full bg-cyber-surface border border-cyber-border overflow-hidden">
                          <div
                            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${tone.bar}`}
                            style={{ width: `${pct}%` }}
                          />
                          {!checklistDriven && (
                            <input
                              type="range"
                              min={0}
                              max={99}
                              step={5}
                              value={pct}
                              onChange={(e) =>
                                setProgressDraft(
                                  Math.min(99, Number(e.target.value))
                                )
                              }
                              aria-label="Task progress"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          )}
                        </div>
                        <p className="text-[11px] text-text-muted mt-1">
                          {checklistDriven
                            ? 'Progress follows the checklist below.'
                            : 'Drag the bar to set progress. '}
                          100% requires a Project Lead to accept your review.
                        </p>
                      </>
                    );
                  })()}
                </div>

                {subtasksDraft.length > 0 && (
                  <div id="task-checklist-section">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="text-sm text-text-secondary font-mono">
                        Checklist
                      </div>
                      <span className="text-[11px] font-mono text-text-muted">
                        {subtasksDraft.filter((s) => s.done).length}/
                        {subtasksDraft.length} done
                        {!isChecklistComplete(subtasksDraft)
                          ? ' · required before review'
                          : ''}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {subtasksDraft.map((s) => (
                        <li key={s.id}>
                          <label className="flex items-start gap-2 text-sm text-text-primary cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(s.done)}
                              onChange={() => toggleSubtask(s.id)}
                              className="mt-0.5 accent-cyan-400"
                            />
                            <span
                              className={
                                s.done ? 'line-through text-text-muted' : ''
                              }
                            >
                              {s.label}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <label className="block text-sm text-text-secondary font-mono mb-1.5">
                    Working notes
                  </label>
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={2}
                    placeholder="What did you ship? What is blocked?"
                    className="w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors text-sm"
                  />
                </div>

                {claimHelperNames.length > 0 && (
                  <div>
                    <div className="text-sm text-text-secondary font-mono mb-2">
                      Helpers
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {claimHelperNames.map((name) => (
                        <Badge
                          key={name}
                          variant="default"
                          className="!normal-case tracking-wide"
                        >
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedTask.claim?.reviewFeedback && (
                  <div className="rounded-lg border border-semantic-warning/40 bg-semantic-warning/10 px-3 py-2 text-sm text-text-secondary">
                    <span className="font-semibold text-semantic-warning">
                      Review feedback:{' '}
                    </span>
                    {selectedTask.claim.reviewFeedback}
                  </div>
                )}

                {/* Light secondary: scope help (does not compete with primary actions) */}
                {isClaimHolder &&
                  selectedTask.claim?.status === 'Active' &&
                  !selectedTask.scopeRequest && (
                    <div className="pt-0.5">
                      {!scopeHelpOpen ? (
                        <button
                          type="button"
                          onClick={() => setScopeHelpOpen(true)}
                          disabled={actionBusy}
                          className="text-xs text-text-muted hover:text-text-secondary underline decoration-white/15 underline-offset-2 transition-colors disabled:opacity-50"
                        >
                          This is bigger than expected
                        </button>
                      ) : (
                        <div className="space-y-2 rounded-md border border-cyber-border/70 bg-cyber-surface/40 px-2.5 py-2">
                          <textarea
                            value={scopeHelpDraft}
                            onChange={(e) => setScopeHelpDraft(e.target.value)}
                            rows={2}
                            maxLength={2000}
                            placeholder="What is larger than expected?"
                            className="w-full bg-cyber-surface border border-cyber-border rounded-md px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none"
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={handleRequestScopeHelp}
                              disabled={
                                actionBusy || scopeHelpDraft.trim().length < 10
                              }
                              className="text-xs font-medium text-neon-cyan hover:text-white disabled:opacity-50"
                            >
                              {actionBusy ? 'Sending…' : 'Request breakdown'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setScopeHelpOpen(false);
                                setScopeHelpDraft('');
                              }}
                              disabled={actionBusy}
                              className="text-xs text-text-muted hover:text-text-secondary"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                {isClaimHolder &&
                  selectedTask.scopeRequest?.status === 'pending' && (
                    <p className="text-xs text-text-muted">
                      <span className="text-semantic-warning">
                        Scope help requested.
                      </span>{' '}
                      A Project Lead will follow up.{' '}
                      <button
                        type="button"
                        onClick={handleCancelScopeRequest}
                        disabled={actionBusy}
                        className="underline decoration-white/20 hover:text-text-secondary"
                      >
                        Cancel request
                      </button>
                    </p>
                  )}

                {/* Primary actions at bottom of working modal */}
                <div className="flex flex-wrap gap-2 pt-3 mt-1 border-t border-cyber-border">
                  {canSubmitForReview && (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => void openSubmitReviewFlow()}
                      disabled={
                        actionBusy || !isChecklistComplete(subtasksDraft)
                      }
                      title={
                        !isChecklistComplete(subtasksDraft)
                          ? 'Complete every checklist item first'
                          : 'Continue to submit for review'
                      }
                    >
                      Submit for Review
                    </Button>
                  )}
                  {canReturnClaim && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={handleReturn}
                      disabled={actionBusy}
                    >
                      Return Claim
                    </Button>
                  )}
                </div>
              </>
            )}

            {/* Staff: scope help is handled on the Moderator Dashboard */}
            {isModerator &&
              selectedTask.scopeRequest?.status === 'pending' && (
                <div className="rounded-lg border border-semantic-warning/40 bg-semantic-warning/10 px-3 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-sm text-text-secondary">
                    <span className="font-medium text-semantic-warning">
                      Scope help pending
                    </span>
                    {selectedTask.scopeRequest.username
                      ? ` from ${selectedTask.scopeRequest.username}`
                      : ''}
                    . Review and resolve on the Moderator Dashboard.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 shrink-0"
                    to="/moderator?tab=scope"
                  >
                    Open Scope help queue
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}

            {/* Staff: close Epic/Medium when all children are Completed */}
            {canStaffCompleteParent && selectedTask && (
              <div className="rounded-lg border border-semantic-warning/40 bg-semantic-warning/10 p-4 space-y-3">
                <div className="text-sm font-semibold text-semantic-warning">
                  Ready for Review
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  All sub-tasks have been completed. Confirm integration and
                  polish, then mark this task complete.
                </p>
                <p className="text-xs font-mono text-text-muted">
                  {selectedTask.completedChildCount}/{selectedTask.childCount}{' '}
                  children completed
                </p>
                <Button
                  size="sm"
                  variant="success"
                  onClick={handleStaffCompleteParent}
                  disabled={actionBusy}
                >
                  {actionBusy ? 'Saving…' : 'Mark task complete'}
                </Button>
              </div>
            )}

            {/* Pending review: claimant read-only + staff accept/reject */}
            {isPendingReview && selectedTask && !selectedTask.hasChildren && (
              <div className="space-y-3 rounded-lg border border-semantic-warning/40 bg-semantic-warning/10 p-4">
                <div className="text-sm font-semibold text-semantic-warning">
                  Ready for Review
                </div>
                {isModerator && claimantTrust && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold tracking-wide ${
                        claimantTrust.trustTier === 'trusted'
                          ? 'border-emerald-400/40 text-emerald-300 bg-emerald-500/10'
                          : claimantTrust.trustTier === 'established'
                            ? 'border-neon-cyan/40 text-neon-cyan bg-neon-cyan/10'
                            : claimantTrust.isRestricted
                              ? 'border-red-400/40 text-red-300 bg-red-500/10'
                              : 'border-semantic-warning/40 text-semantic-warning bg-semantic-warning/10'
                      }`}
                      title="Trust from accepted reviews + account age"
                    >
                      {claimantTrust.trustLabel}
                    </span>
                    <span className="font-mono text-text-muted">
                      {claimantTrust.acceptedTasks} accepted ·{' '}
                      {claimantTrust.accountAgeDays}d old · load{' '}
                      {claimantTrust.activeClaims} claimed +{' '}
                      {claimantTrust.pendingReview} in review
                      {claimantTrust.fakeRejectionCount > 0
                        ? ` · ${claimantTrust.fakeRejectionCount} fake flags`
                        : ''}
                    </span>
                  </div>
                )}
                {selectedTask.claim?.primaryGithubUrl && (
                  <a
                    href={selectedTask.claim.primaryGithubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-neon-cyan hover:underline"
                  >
                    <Github className="w-4 h-4" />
                    Open GitHub evidence
                  </a>
                )}
                {selectedTask.claim?.submissionEvidence && (
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">
                    <span className="text-text-muted">Evidence: </span>
                    {selectedTask.claim.submissionEvidence}
                  </p>
                )}
                {isClaimHolder && !isModerator && (
                  <p className="text-xs text-text-muted">
                    Waiting for a Project Lead or moderator to accept or reject
                    this submission. Your claim slot stays occupied until then.
                  </p>
                )}
                {canReviewSubmission && (
                  <>
                    <div>
                      <label className="block text-sm text-text-secondary font-mono mb-1.5">
                        Feedback (optional on accept, recommended on reject)
                      </label>
                      <textarea
                        value={reviewFeedbackDraft}
                        onChange={(e) => setReviewFeedbackDraft(e.target.value)}
                        rows={2}
                        placeholder="Notes for the contributor…"
                        className="w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors text-sm"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => void handleAcceptReview()}
                        disabled={actionBusy}
                      >
                        {reviewActionBusy === 'accept'
                          ? 'Accepting…'
                          : 'Accept work'}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => void handleRejectReview()}
                        disabled={actionBusy}
                      >
                        {reviewActionBusy === 'reject'
                          ? 'Rejecting…'
                          : 'Reject'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-400/50 text-red-300 hover:bg-red-500/10"
                        onClick={() => void handleRejectAsFakeWork()}
                        disabled={actionBusy}
                        title="Release claim and escalate claim restrictions for fake / no real work"
                      >
                        {reviewActionBusy === 'fake'
                          ? 'Rejecting…'
                          : 'Reject as fake work'}
                      </Button>
                      {selectedTask.claim?.userId ? (
                        <OpenConductCaseButton
                          targetUserId={selectedTask.claim.userId}
                          contentType="task"
                          contentId={String(
                            selectedTask.claim.id || selectedTask.id || ''
                          )}
                          projectId={projectUuid || null}
                          contentPath={`/projects/${projectSlug}/board`}
                        />
                      ) : null}
                    </div>
                    <p className="text-[11px] text-text-muted leading-relaxed">
                      “Reject as fake work” releases the claim (frees the board)
                      and records a restriction event. Multiple flags
                      automatically limit claiming privileges.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Helpers for viewers when claim has helpers */}
            {!canEditProgress &&
              !selectedTask.hasChildren &&
              claimHelperNames.length > 0 && (
                <div>
                  <div className="text-xs font-mono tracking-widest text-text-muted mb-2">
                    HELPERS
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {claimHelperNames.map((name) => (
                      <Badge
                        key={name}
                        variant="default"
                        className="!normal-case tracking-wide"
                      >
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

            {/* Notes for non-holders on leaf claims only */}
            {!canEditProgress &&
              !selectedTask.hasChildren &&
              selectedTask.claim?.notes && (
                <p className="text-sm text-text-secondary border-l-2 border-neon-cyan/40 pl-3">
                  {selectedTask.claim.notes}
                </p>
              )}

            {selectedTask.isLocked &&
              selectedTask.status === 'todo' &&
              !selectedTask.claimedBy && (
                <div className="space-y-2 pt-2 border-t border-cyber-border">
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Locked – waiting on:{' '}
                    <span className="text-text-primary font-medium">
                      {(selectedTask.lockedWaitingOn || []).join(', ') ||
                        'blocking tasks'}
                    </span>
                  </p>
                  <p className="text-[11px] text-text-muted">
                    This task unlocks automatically when every blocker is
                    completed and accepted.
                  </p>
                </div>
              )}

            {selectedTask.volunteerClaimable &&
              !selectedTask.isLocked &&
              selectedTask.status === 'todo' &&
              !selectedTask.claimedBy &&
              selectedTask.staffOnly &&
              !isModerator && (
                <div className="space-y-2 pt-2 border-t border-cyber-border">
                  <Badge variant="gold" className="!normal-case tracking-wide">
                    Staff Only
                  </Badge>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {STAFF_ONLY_TASK_MESSAGE}
                  </p>
                </div>
              )}

            {selectedTask.volunteerClaimable &&
              !selectedTask.isLocked &&
              selectedTask.status === 'todo' &&
              !selectedTask.claimedBy &&
              (!selectedTask.staffOnly || isModerator) && (
                <div className="space-y-2 pt-2 border-t border-cyber-border">
                  {selectedTask.staffOnly && (
                    <Badge variant="gold" className="!normal-case tracking-wide">
                      Staff Only
                    </Badge>
                  )}
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    Claiming reserves this task for you on Together Forge.
                    {isCodeLikeCategory(selectedTask.category)
                      ? ' Do the technical work on GitHub, then submit for review with a PR or branch link.'
                      : ' Do the work, then submit for review with a clear proof link.'}
                  </p>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    {CLAIM_AUTO_RELEASE_POLICY_COPY}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => handleClaim(selectedTask.id)}
                    disabled={claimingId === selectedTask.id || !user}
                  >
                    {claimingId === selectedTask.id
                      ? 'Claiming…'
                      : !user
                        ? 'Sign in to claim'
                        : 'Claim Task'}
                  </Button>
                </div>
              )}
          </div>
        )}
      </Modal>

      {/* Dedicated Submit for Review — focused hand-off */}
      <Modal
        isOpen={Boolean(selectedTask) && submitReviewOpen}
        onClose={closeSubmitReviewFlow}
        title="Submit for Review"
        size="lg"
      >
        {selectedTask && (
          <div className="task-scroll space-y-5 max-h-[75vh] overflow-y-auto pr-1">
            <div>
              <p className="text-xs font-mono tracking-widest text-text-muted uppercase mb-1">
                Task
              </p>
              <h3 className="text-lg font-semibold text-white leading-snug">
                {selectedTask.title}
              </h3>
              {selectedTask.category && (
                <p className="mt-1.5">
                  <TaskCategoryBadge
                    category={selectedTask.category}
                    size="sm"
                  />
                </p>
              )}
              <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                Reviewers need a short summary plus a link they can open. After
                you submit, this task moves to Ready for Review on the board.
              </p>
              {isCodeLikeCategory(selectedTask.category) && (
                <p className="text-xs text-neon-cyan/90 mt-2 leading-relaxed">
                  Code task: prefer a GitHub PR, branch, or commit as the main
                  evidence link
                  {projectGithubUrl ? (
                    <>
                      {' '}
                      (
                      <a
                        href={projectGithubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-white"
                      >
                        project repo
                      </a>
                      )
                    </>
                  ) : null}
                  .
                </p>
              )}
            </div>

            {subtasksDraft.length > 0 && (
              <div className="rounded-lg border border-cyber-border bg-cyber-surface/50 px-3 py-2 text-sm text-text-secondary">
                Checklist{' '}
                <span className="font-mono text-text-muted">
                  {subtasksDraft.filter((s) => s.done).length}/
                  {subtasksDraft.length} done
                </span>
                {!isChecklistComplete(subtasksDraft) && (
                  <span className="text-semantic-warning">
                    {' '}
                    · complete all items before submitting
                  </span>
                )}
              </div>
            )}

            {/* Evidence: 1) description note  2) links — separate validation */}
            <div className="space-y-4">
              {/* 1. Description */}
              <section
                className="space-y-2 rounded-xl border border-cyber-border bg-cyber-surface/40 p-3 sm:p-4"
                aria-labelledby="evidence-note-heading"
              >
                <div>
                  <h4
                    id="evidence-note-heading"
                    className="text-sm font-semibold text-white"
                  >
                    1. What you delivered
                  </h4>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    {getReviewNoteHint(selectedTask.category)}
                  </p>
                </div>
                <label className="sr-only" htmlFor="task-evidence-draft">
                  What you delivered
                </label>
                <textarea
                  id="task-evidence-draft"
                  value={evidenceDraft}
                  onChange={(e) => {
                    setEvidenceDraft(e.target.value);
                    if (evidenceNoteError) setEvidenceNoteError(null);
                  }}
                  rows={4}
                  placeholder={
                    isCodeLikeCategory(selectedTask.category)
                      ? 'e.g. Added dash ability, wired input, tested on keyboard… (no URL here)'
                      : 'Brief summary of what you delivered… (no URL here)'
                  }
                  aria-invalid={Boolean(evidenceNoteError)}
                  aria-describedby={
                    evidenceNoteError
                      ? 'task-evidence-note-error'
                      : 'task-evidence-note-help'
                  }
                  className={`w-full bg-cyber-surface border rounded-lg px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none transition-colors text-sm resize-y min-h-[6rem] ${
                    evidenceNoteError
                      ? 'border-semantic-warning focus:border-semantic-warning'
                      : 'border-cyber-border focus:border-neon-cyan'
                  }`}
                />
                {evidenceNoteError ? (
                  <p
                    id="task-evidence-note-error"
                    role="alert"
                    className="text-xs text-semantic-warning leading-snug"
                  >
                    {evidenceNoteError}
                  </p>
                ) : (
                  <p
                    id="task-evidence-note-help"
                    className="text-[11px] text-text-muted"
                  >
                    Required · at least {REVIEW_EVIDENCE_MIN_CHARS} characters
                    (description only)
                  </p>
                )}
              </section>

              {/* 2. Links */}
              <section
                id="task-evidence-links-section"
                className={`space-y-2 rounded-xl border bg-cyber-surface/40 p-3 sm:p-4 ${
                  evidenceLinkError
                    ? 'border-semantic-warning/70 ring-1 ring-semantic-warning/30'
                    : 'border-cyber-border'
                }`}
                aria-labelledby="evidence-links-heading"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4
                      id="evidence-links-heading"
                      className="text-sm font-semibold text-white"
                    >
                      2. Evidence links
                    </h4>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      {isCodeLikeCategory(selectedTask.category)
                        ? 'Paste the GitHub PR, branch, or commit URL here (not in the description above).'
                        : 'Paste at least one https link a reviewer can open (Drive, Figma, Discord, GitHub, etc.).'}
                    </p>
                    <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed">
                      {getReviewEvidenceHint(selectedTask.category)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addEvidenceLinkRow}
                    disabled={evidenceLinks.length >= 8}
                    className="shrink-0 text-xs text-neon-cyan hover:text-white disabled:opacity-40"
                  >
                    + Add link
                  </button>
                </div>
                <div className="space-y-2">
                  {evidenceLinks.map((link, index) => (
                    <div key={`ev-link-${index}`} className="flex gap-2">
                      <input
                        id={
                          index === 0
                            ? 'task-evidence-link-0'
                            : `task-evidence-link-${index}`
                        }
                        type="url"
                        inputMode="url"
                        value={link}
                        onChange={(e) => {
                          updateEvidenceLink(index, e.target.value);
                          if (evidenceLinkError) setEvidenceLinkError(null);
                          if (evidenceLinkWarning) setEvidenceLinkWarning(null);
                        }}
                        placeholder={getReviewLinkPlaceholder(
                          selectedTask.category
                        )}
                        required={index === 0}
                        aria-invalid={Boolean(evidenceLinkError)}
                        aria-describedby={
                          evidenceLinkError
                            ? 'task-evidence-link-error'
                            : 'task-evidence-link-help'
                        }
                        className={`min-w-0 flex-1 bg-cyber-surface border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none ${
                          evidenceLinkError
                            ? 'border-semantic-warning focus:border-semantic-warning'
                            : 'border-cyber-border focus:border-neon-cyan'
                        }`}
                      />
                      <button
                        type="button"
                        aria-label="Remove link"
                        className="shrink-0 p-2 rounded-lg border border-cyber-border text-text-muted hover:text-red-300 hover:border-red-400/40"
                        onClick={() => removeEvidenceLinkRow(index)}
                        disabled={
                          evidenceLinks.length <= 1 &&
                          !String(link || '').trim()
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {evidenceLinkError ? (
                  <p
                    id="task-evidence-link-error"
                    role="alert"
                    className="text-xs text-semantic-warning leading-snug"
                  >
                    {evidenceLinkError}
                  </p>
                ) : evidenceLinkWarning ? (
                  <p
                    id="task-evidence-link-help"
                    className="text-xs text-semantic-warning/90 leading-snug"
                  >
                    {evidenceLinkWarning}
                  </p>
                ) : (
                  <p
                    id="task-evidence-link-help"
                    className="text-[11px] text-text-muted leading-relaxed"
                  >
                    Required · full https:// URL ·{' '}
                    {isCodeLikeCategory(selectedTask.category)
                      ? 'GitHub PR / branch / commit preferred for Code'
                      : 'Drive, Figma, Discord, GitHub all fine by craft'}
                  </p>
                )}
                <div
                  className="rounded-lg border border-dashed border-cyber-border/60 px-3 py-2 text-[11px] text-text-muted"
                  data-future-attachments="true"
                >
                  File uploads can be added later; a link is enough for now.
                </div>
              </section>

              {claimQuota?.signedIn && (
                <p className="text-[11px] font-mono text-text-muted px-0.5">
                  Submits used: {claimQuota.submitsLast24h ?? 0}/
                  {claimQuota.submitLimit24h ?? 2} (24h)
                  {claimQuota.submitCooldownEndsAt &&
                  new Date(claimQuota.submitCooldownEndsAt) > new Date()
                    ? ' · cooldown active'
                    : ''}
                </p>
              )}
            </div>

            <div>
              <label
                className="block text-xs font-mono tracking-widest text-text-muted uppercase mb-1.5"
                htmlFor="task-depends-on"
              >
                Blocked by / depends on (optional)
              </label>
              <textarea
                id="task-depends-on"
                value={evidenceDependsOn}
                onChange={(e) => setEvidenceDependsOn(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="e.g. Continues from “Player dash VFX” · needs audio bank merge first"
                className="w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none resize-y"
              />
              <p className="text-[11px] text-text-muted mt-1">
                Helps the next person and Project Leads. Not enforced
                automatically.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-cyber-border">
              <Button
                size="sm"
                variant="success"
                onClick={handleSubmitForReview}
                disabled={
                  actionBusy || !isChecklistComplete(subtasksDraft)
                }
              >
                {actionBusy ? 'Submitting…' : 'Submit for Review'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={closeSubmitReviewFlow}
                disabled={actionBusy}
              >
                Back to task
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Staff: project GitHub repository URL */}
      <Modal
        isOpen={githubEditOpen}
        onClose={() => !githubEditBusy && setGithubEditOpen(false)}
        title="Project repository"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Link this project’s GitHub repository or Project board. Contributors
            see a “View on GitHub” button on the Task Board and are guided to do
            technical work there.
          </p>
          <div>
            <label
              className="block text-xs font-mono tracking-widest text-text-muted uppercase mb-1.5"
              htmlFor="project-github-url"
            >
              GitHub URL
            </label>
            <input
              id="project-github-url"
              type="url"
              inputMode="url"
              value={githubEditDraft}
              onChange={(e) => setGithubEditDraft(e.target.value)}
              placeholder="https://github.com/org/repo"
              className="w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none"
            />
            <p className="text-[11px] text-text-muted mt-1.5">
              Leave blank to clear. Requires{' '}
              <code className="text-neon-cyan/80">supabase_project_github.sql</code>{' '}
              if the column is not set up yet.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => void saveProjectGithub()}
              disabled={githubEditBusy || !projectUuid}
            >
              {githubEditBusy ? 'Saving…' : 'Save'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setGithubEditOpen(false)}
              disabled={githubEditBusy}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create / Edit task form (Project Lead + Admin only) */}
      <Modal
        isOpen={taskFormOpen}
        onClose={closeTaskForm}
        title={
          taskFormMode === 'edit'
            ? isStagingBoard
              ? 'Edit Staging Task'
              : 'Edit Task'
            : taskForm.parentTaskId
              ? isStagingBoard
                ? 'Add Staging Sub-task'
                : 'Add Sub-task'
              : String(taskForm.title || '').startsWith('Copy of ')
                ? isStagingBoard
                  ? 'Duplicate Staging Task'
                  : 'Duplicate Task'
                : isStagingBoard
                  ? 'Add Staging Task'
                  : 'Add New Task'
        }
        size="lg"
      >
        <form onSubmit={handleTaskFormSubmit} className="task-scroll space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          <p className="text-sm text-text-secondary leading-relaxed">
            {taskFormMode === 'edit'
              ? isStagingBoard
                ? 'Update this Staging task. Volunteers will not see it until you publish the Epic or Medium.'
                : 'Update task details. Checklist labels keep their done state when unchanged.'
              : String(taskForm.title || '').startsWith('Copy of ')
                ? isStagingBoard
                  ? 'Duplicating as a new Staging task. It stays off the public board until you publish.'
                  : 'Duplicating as a new Unclaimed / To Do task. Edit anything below, then create. Claim, progress, and review data are not copied.'
                : taskForm.parentTaskId
                  ? isStagingBoard
                    ? 'Add a nested Staging task under this parent.'
                    : 'Add a child task under the parent.'
                  : isStagingBoard
                    ? 'Top-level = Epic. Nest Mediums and Smalls here, then publish when the structure is ready.'
                    : 'Top-level = Epic. Nest Medium/Small under it for claimable work.'}
          </p>

          {taskForm.parentTaskId && (
            <div className="rounded-lg border border-cyber-border bg-cyber-surface/60 px-3 py-2 text-sm text-text-secondary">
              Parent:{' '}
              <span className="text-white font-medium">
                {tasks.find((t) => t.id === taskForm.parentTaskId)?.title ||
                  'Selected task'}
              </span>
              {(() => {
                const p = tasks.find((t) => t.id === taskForm.parentTaskId);
                if (!p) return null;
                return (
                  <span className="text-text-muted">
                    {' '}
                    · will be a {taskLevelLabel((p.depth || 0) + 1)}
                  </span>
                );
              })()}
            </div>
          )}

          <div>
            <label className={fieldLabelClass} htmlFor="task-title">
              TITLE *
            </label>
            <input
              id="task-title"
              type="text"
              required
              maxLength={120}
              placeholder="e.g. Prototype player dash"
              className={fieldControlClass}
              value={taskForm.title}
              onChange={(e) => updateTaskFormField('title', e.target.value)}
            />
            <p className="text-xs text-text-muted mt-1">Short and action-oriented. Max 120 characters.</p>
          </div>

          <div>
            <label className={fieldLabelClass} htmlFor="task-description">
              DESCRIPTION
            </label>
            <textarea
              id="task-description"
              rows={4}
              maxLength={2000}
              placeholder="What needs to ship? Any links, acceptance criteria, or gotchas?"
              className={`${fieldControlClass} resize-y min-h-[6rem]`}
              value={taskForm.description}
              onChange={(e) => updateTaskFormField('description', e.target.value)}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={fieldLabelClass} htmlFor="task-category">
                CATEGORY *
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="task-category"
                  required
                  className={`${fieldControlClass} min-w-0 flex-1`}
                  value={taskForm.category}
                  onChange={(e) =>
                    updateTaskFormField('category', e.target.value)
                  }
                >
                  {taskForm.category &&
                    !TASK_CATEGORIES.includes(taskForm.category) && (
                      <option value={taskForm.category}>
                        {taskForm.category}
                      </option>
                    )}
                  {TASK_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                {taskForm.category && (
                  <TaskCategoryBadge
                    category={taskForm.category}
                    size="sm"
                    className="shrink-0"
                  />
                )}
              </div>
            </div>

            <div>
              <label className={fieldLabelClass} htmlFor="task-difficulty">
                DIFFICULTY *
              </label>
              <select
                id="task-difficulty"
                required
                className={fieldControlClass}
                value={taskForm.difficulty}
                onChange={(e) => updateTaskFormField('difficulty', e.target.value)}
              >
                {TASK_DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={fieldLabelClass} htmlFor="task-effort">
              ESTIMATED EFFORT
            </label>
            <select
              id="task-effort"
              className={fieldControlClass}
              value={taskForm.estimatedEffort || ''}
              onChange={(e) =>
                updateTaskFormField('estimatedEffort', e.target.value)
              }
            >
              <option value="">Not set</option>
              {TASK_EFFORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              {/* Legacy free-text values until staff picks a preset */}
              {taskForm.estimatedEffort &&
                !isStructuredTaskEffort(taskForm.estimatedEffort) && (
                  <option value={taskForm.estimatedEffort}>
                    {taskForm.estimatedEffort} (custom — pick a preset)
                  </option>
                )}
            </select>
            <p className="text-xs text-text-muted mt-1">
              Choose a range so volunteers can scan effort at a glance.
            </p>
          </div>

          <div>
            <label className={fieldLabelClass}>STAFF ONLY</label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-cyan-400 shrink-0"
                checked={Boolean(taskForm.staffOnly)}
                onChange={(e) =>
                  updateTaskFormField('staffOnly', e.target.checked)
                }
              />
              <span className="text-sm text-text-secondary leading-snug">
                Volunteers can see this task on the board but cannot claim it.
                Staff and founders can claim, work, and complete it as usual.
              </span>
            </label>
          </div>

          {/* Blocked by — hierarchical multi dependency */}
          <div>
            <label className={fieldLabelClass}>BLOCKED BY (optional)</label>
            <p className="text-xs text-text-muted mb-2 leading-relaxed">
              This task stays locked until every selected blocker is completed
              and accepted. Expand an epic to pick a nested task without
              selecting the whole epic.
            </p>
            <TaskDependencyPicker
              tasks={tasks}
              selectedIds={taskForm.blockedByTaskIds || []}
              onToggle={toggleBlockedByTask}
              excludeTaskId={
                taskFormMode === 'edit' ? editingTaskId : null
              }
            />
            {(taskForm.blockedByTaskIds || []).length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-neon-cyan/80">
                  {(taskForm.blockedByTaskIds || []).length} blocker
                  {(taskForm.blockedByTaskIds || []).length === 1 ? '' : 's'}{' '}
                  selected
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {(taskForm.blockedByTaskIds || []).map((id) => {
                    const t = tasks.find((x) => x.id === id);
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => toggleBlockedByTask(id)}
                          className="inline-flex items-center gap-1 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-2 py-0.5 text-[11px] text-neon-cyan hover:bg-neon-cyan/20"
                          title="Remove blocker"
                        >
                          <span className="max-w-[10rem] truncate">
                            {t?.title || 'Task'}
                          </span>
                          <span aria-hidden className="opacity-70">
                            ×
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <label className="mt-3 flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-cyan-400 shrink-0"
                checked={Boolean(taskForm.dependencyOverride)}
                onChange={(e) =>
                  updateTaskFormField('dependencyOverride', e.target.checked)
                }
              />
              <span className="text-sm text-text-secondary leading-snug">
                <span className="text-text-primary font-medium">
                  Override lock
                </span>
                {' – '}
                allow claiming even while blockers are incomplete (Project Lead
                / Admin only). Dependencies stay recorded for visibility.
              </span>
            </label>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className={`${fieldLabelClass} mb-0`}>
                CHECKLIST (optional)
              </label>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono tracking-widest ${
                    taskForm.subtaskLines.length >= MAX_CHECKLIST_STEPS
                      ? 'text-amber-300'
                      : 'text-text-muted'
                  }`}
                >
                  {taskForm.subtaskLines.length}/{MAX_CHECKLIST_STEPS}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  onClick={addSubtaskLine}
                  disabled={
                    taskForm.subtaskLines.length >= MAX_CHECKLIST_STEPS
                  }
                  title={
                    taskForm.subtaskLines.length >= MAX_CHECKLIST_STEPS
                      ? `Maximum ${MAX_CHECKLIST_STEPS} checklist steps`
                      : 'Add checklist step'
                  }
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add step
                </Button>
              </div>
            </div>
            {taskForm.subtaskLines.length >= MAX_CHECKLIST_STEPS ? (
              <p className="text-xs text-amber-300/90 mb-3">
                Max checklist steps reached ({MAX_CHECKLIST_STEPS}). Remove a
                step to add another.
              </p>
            ) : (
              <p className="text-xs text-text-muted mb-3">
                Optional checklist items (up to {MAX_CHECKLIST_STEPS}).
                Volunteers tick these off while they work.
              </p>
            )}
            <div className="space-y-2">
              {taskForm.subtaskLines.map((line, index) => (
                <div key={`sub-${index}`} className="flex gap-2 items-center">
                  <input
                    type="text"
                    maxLength={200}
                    placeholder={`Step ${index + 1}`}
                    className={fieldControlClass}
                    value={line}
                    onChange={(e) => updateSubtaskLine(index, e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label="Remove checklist step"
                    className="shrink-0 p-2 rounded-lg border border-cyber-border text-text-muted hover:text-red-300 hover:border-red-400/40 transition-colors"
                    onClick={() => removeSubtaskLine(index)}
                    disabled={taskForm.subtaskLines.length <= 1 && !line}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {taskFormError && (
            <div
              role="alert"
              className="rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2 text-sm text-red-200"
            >
              {taskFormError}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" className="gap-2" disabled={taskFormBusy}>
              {taskFormBusy
                ? taskFormMode === 'edit'
                  ? 'Saving…'
                  : 'Creating…'
                : taskFormMode === 'edit'
                  ? 'Save Changes'
                  : 'Create Task'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={closeTaskForm}
              disabled={taskFormBusy}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

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
