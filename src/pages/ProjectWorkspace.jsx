/**
 * ProjectWorkspace — single-project hub at /projects/:id
 *
 * Sections (SDD):
 *  1. Project Header (title, phase badge, description)
 *  2. Project Pulse (active people, tasks this week, recent wins)
 *  3. Kanban Task Board (To Do / In Progress / Completed)
 *  4. Recent Activity feed
 *  5. Volunteer Shoutouts
 *  6. Open Questions
 *  7. Project Ideas (community ideas for this project)
 *  8. Updates section
 *
 * Task board, pulse, activity, and shoutouts load from Supabase.
 * Navbar + Footer come from App.jsx layout.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  Trophy,
  MessageCircleQuestion,
  Sparkles,
  Megaphone,
  Hammer,
  Lightbulb,
  Loader2,
  Plus,
  Trash2,
  Pencil,
} from 'lucide-react';

import Button from '../components/ui/Buttons';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import TaskCard from '../components/ui/TaskCard';
import SubTaskList from '../components/ui/SubTaskList';
import ActivityItem from '../components/ui/ActivityItem';
import StatWidget from '../components/ui/StatWidget';
import Modal from '../components/ui/Modal';
import UserAvatar from '../components/ui/UserAvatar';
import ProfileLink from '../components/ui/ProfileLink';
import IdeaCard from '../components/ui/IdeaCard';
import { useIsModerator } from '../hooks/useIsModerator';
import {
  tasksService,
  getChildTasks,
  getTaskBreadcrumb,
  taskLevelLabel,
  getTaskClaimBlockedReason,
  normalizeChecklist,
  progressFromChecklist,
} from '../services/tasksService';
import { ideasService } from '../services/ideasService';
import { supabase } from '../lib/supabase';
import { phaseImageSrc, phaseImageAlt } from '../utils/phaseImages';

// ---------------------------------------------------------------------------
// Fallback copy when projects table has no matching slug yet
// ---------------------------------------------------------------------------

const FALLBACK_PROJECTS = {
  'prototype-systems': {
    slug: 'prototype-systems',
    title: 'Prototype Systems',
    phase: 'Early',
    status: 'In Development',
    description:
      'Core loop prototyping and networking tests. We are validating multiplayer foundations, claim/credit flows, and the volunteer task board itself — with design, code, and art volunteers welcome.',
  },
  'core-features': {
    slug: 'core-features',
    title: 'Core Features Sprint',
    phase: 'Mid',
    status: 'Planning',
    description:
      'Design work and early integrations for systems that make cooperative play feel great. Focused sprints, clear ownership, and public progress.',
  },
  'polish-playtests': {
    slug: 'polish-playtests',
    title: 'Stability & Polish',
    phase: 'Late',
    status: 'Vision',
    description:
      'Polish passes, optimization, and wider playtests. Help stress-test builds and report what breaks — or what delights.',
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

const OPEN_QUESTIONS = [
  {
    id: 'q1',
    title: 'How long should a co-op session feel?',
    blurb: 'Aiming for 15–20 minutes vs. 40+ for early prototypes.',
    replies: 6,
  },
  {
    id: 'q2',
    title: 'Role differentiation without hard classes?',
    blurb: 'Soft roles via tools/loadouts vs. explicit class pick.',
    replies: 4,
  },
  {
    id: 'q3',
    title: 'What counts as a “win” for credit tracking?',
    blurb: 'Task complete, PR merged, playtest notes, or design docs?',
    replies: 9,
  },
];

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
    title: 'Weekly pulse — networking & map',
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
    title: 'Art drop — placeholder set A',
    date: 'Jun 28, 2026',
    body: 'First placeholder sprites are in. Enough visual language to run co-op loops without blocking on final art.',
    tag: 'Art',
  },
];

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
  {
    key: 'completed',
    label: 'Completed',
    accent: 'border-neon-purple/40',
    header: 'text-neon-purple',
    dot: 'bg-neon-purple',
  },
];

const TASK_CATEGORIES = [
  'Code',
  'Art',
  'Design',
  'Writing',
  'Level Design',
  'Audio',
  'QA',
  'Other',
];

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
  const { isModerator } = useIsModerator();

  const [project, setProject] = useState(null);
  const [projectUuid, setProjectUuid] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [activity, setActivity] = useState([]);
  const [shoutouts, setShoutouts] = useState([]);
  const [pulse, setPulse] = useState({
    activePeople: 0,
    activeWorkers: [],
    tasksThisWeek: 0,
    tasksThisMonth: 0,
    recentWins: 0,
  });

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [boardError, setBoardError] = useState(null);
  const [toast, setToast] = useState(null);
  const [claimingId, setClaimingId] = useState(null);
  const [joiningId, setJoiningId] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [claimQuota, setClaimQuota] = useState(null);
  const [joinRequests, setJoinRequests] = useState([]);
  /** Task ids where the current user already has a pending join request */
  const [myPendingJoinTaskIds, setMyPendingJoinTaskIds] = useState(
    () => new Set()
  );

  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [progressDraft, setProgressDraft] = useState(0);
  const [notesDraft, setNotesDraft] = useState('');
  const [subtasksDraft, setSubtasksDraft] = useState([]);

  // Create / edit task form (Project Lead + Admin via useIsModerator)
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskFormMode, setTaskFormMode] = useState('create'); // 'create' | 'edit'
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [taskFormError, setTaskFormError] = useState(null);
  const [taskFormBusy, setTaskFormBusy] = useState(false);
  /** Kanban: top-level only (default) or full tree flattened */
  const [boardScope, setBoardScope] = useState('top'); // 'top' | 'all'

  const [projectIdeas, setProjectIdeas] = useState([]);
  const [ideasLoading, setIdeasLoading] = useState(true);
  const [ideasError, setIdeasError] = useState(null);
  // Same pattern as GameIdeas: Set of idea ids the user has voted on
  const [userIdeaVotes, setUserIdeaVotes] = useState(() => new Set());
  const [ideaSortMode, setIdeaSortMode] = useState('popular'); // popular | votes | newest | title
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
        tasksService.getTasksForProject(uuid),
        tasksService.getActivityForProject(uuid, { limit: 25 }),
        tasksService.getProjectPulse(uuid),
        tasksService.getShoutouts(uuid, { limit: 6 }),
      ]);
      setTasks(taskRows);
      setActivity(activityRows);
      setPulse(pulseData);
      setShoutouts(shoutoutRows);
    },
    []
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

  // Scroll to Project Ideas after submit redirect — do NOT re-fetch here
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
        (projectSlug
          ? {
              ...DEFAULT_PROJECT,
              slug: projectSlug,
              title: projectSlug
                .split('-')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' '),
            }
          : DEFAULT_PROJECT);

      try {
        const dbProject = await tasksService.getProjectBySlug(projectSlug);
        if (cancelled) return;

        if (dbProject) {
          setProject({
            id: dbProject.slug,
            slug: dbProject.slug,
            title: dbProject.title,
            description: dbProject.description || fallback.description,
            phase: dbProject.phase || fallback.phase,
            status: dbProject.status || fallback.status,
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

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  // Sync modal drafts when opening a task
  useEffect(() => {
    if (!selectedTask) return;
    setNotesDraft(selectedTask.claim?.notes || '');
    const checklist = normalizeChecklist(selectedTask.subtasks);
    setSubtasksDraft(checklist);
    // Progress follows checklist when present; otherwise claim/task progress
    const fromList = progressFromChecklist(checklist);
    if (fromList != null) {
      setProgressDraft(fromList);
    } else {
      setProgressDraft(selectedTask.progressPercent ?? 0);
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

  const boardTasks = useMemo(() => {
    if (boardScope === 'all') return tasks;
    // Default: top-level only (no parent) for a clean kanban
    return tasks.filter((t) => !t.parentTaskId);
  }, [tasks, boardScope]);

  const tasksByStatus = useMemo(() => {
    const groups = { todo: [], in_progress: [], completed: [] };
    for (const task of boardTasks) {
      const key = groups[task.status] ? task.status : 'todo';
      groups[key].push(task);
    }
    return groups;
  }, [boardTasks]);

  const selectedChildren = useMemo(() => {
    if (!selectedTaskId) return [];
    return getChildTasks(tasks, selectedTaskId);
  }, [tasks, selectedTaskId]);

  const selectedBreadcrumb = useMemo(() => {
    if (!selectedTaskId) return [];
    return getTaskBreadcrumb(tasks, selectedTaskId);
  }, [tasks, selectedTaskId]);

  const sortedIdeas = useMemo(() => {
    const now = Date.now();
    const DECAY_RATE = 0.0000001;
    const popularity = (idea) => {
      const votes = idea.votes || 0;
      const last =
        idea.lastVoteTime || idea.createdAt
          ? new Date(idea.lastVoteTime || idea.createdAt).getTime()
          : now;
      const age = Math.max(0, now - last);
      return votes * Math.exp(-DECAY_RATE * age);
    };

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
        if (ideaSortMode === 'popular') return popularity(b) - popularity(a);
        if (ideaSortMode === 'votes') {
          return (b.votes || 0) - (a.votes || 0);
        }
        if (ideaSortMode === 'newest') {
          return (
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
          );
        }
        return (a.title || '').localeCompare(b.title || '');
      });
  }, [projectIdeas, ideaSortMode, ideaSearch, ideaCategoryFilter]);

  /** Active claim holder (not staff override) — required for progress/checklist */
  const isClaimHolder = useMemo(() => {
    if (!selectedTask || !user?.id) return false;
    if (selectedTask.claim?.status !== 'Active') return false;
    const ownerId =
      selectedTask.claim?.userId ?? selectedTask.claim?.user_id ?? null;
    if (!ownerId) return false;
    return String(ownerId) === String(user.id);
  }, [selectedTask, user]);

  /**
   * Progress + checklist for claim holder on leaf tasks only
   * (no hierarchical children). Parent containers use rollup only.
   */
  const canEditProgress = useMemo(() => {
    if (!isClaimHolder || !selectedTask) return false;
    if (selectedTask.hasChildren || selectedTask.progressFromChildren) {
      return false;
    }
    return selectedTask.status !== 'completed';
  }, [isClaimHolder, selectedTask]);

  /** Leaf = no hierarchical children (checklists live on leaves, including Small). */
  const selectedIsLeaf = Boolean(
    selectedTask && !selectedTask.hasChildren && !selectedTask.progressFromChildren
  );

  /** Complete / return: claim holder; staff may force-return for moderation */
  const canCompleteOrReturn = useMemo(() => {
    if (!selectedTask || selectedTask.status === 'completed') return false;
    if (selectedTask.hasChildren) return false;
    return isClaimHolder || isModerator;
  }, [selectedTask, isClaimHolder, isModerator]);

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
      estimatedEffort: task.estimatedEffort || '',
      subtaskLines:
        Array.isArray(task.subtasks) && task.subtasks.length > 0
          ? task.subtasks.map((s) => s.label || s.title || '')
          : [''],
      parentTaskId: task.parentTaskId || null,
    });
    setTaskFormError(null);
    setSelectedTaskId(null);
    setTaskFormOpen(true);
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
      estimatedEffort: (taskForm.estimatedEffort || '').trim() || null,
      subtasks: parseSubtaskLines(taskForm.subtaskLines),
      parentTaskId: taskForm.parentTaskId || null,
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
          payload.parentTaskId
            ? 'Sub-task created under its parent. Open the parent to claim nested work.'
            : 'Task created — it is live in To Do and ready to claim!',
          'success'
        );
      }
      const reopenParent = payload.parentTaskId;
      setTaskFormOpen(false);
      setEditingTaskId(null);
      setTaskForm({ ...EMPTY_TASK_FORM, subtaskLines: [''], parentTaskId: null });
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
  }, [user?.id, refreshClaimQuota]);

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

  // Release stale claims when opening a workspace (server is source of truth)
  useEffect(() => {
    if (!projectUuid) return;
    tasksService.returnStaleClaims(14).catch(() => {});
  }, [projectUuid]);

  const handleClaim = async (taskId) => {
    if (!user) {
      showToast('Sign in to claim a task. It will show on your profile.', 'warn');
      navigate('/profile');
      return;
    }
    if (!projectUuid) {
      showToast('Project is not wired to the database yet.', 'error');
      return;
    }

    const task = tasks.find((t) => t.id === taskId);
    const blocked = getTaskClaimBlockedReason(task);
    if (blocked) {
      showToast(blocked, 'warn');
      return;
    }

    setClaimingId(taskId);
    try {
      await tasksService.claimTask(taskId, { task });
      await refreshBoard(projectUuid);
      await refreshClaimQuota();
      showToast('Task claimed! Update progress as you go, then mark completed.', 'success');
      setSelectedTaskId(taskId);
    } catch (err) {
      const msg = friendlyError(err);
      const soft =
        err?.code === 'CLAIM_LIMIT' ||
        err?.code === 'CLAIM_COOLDOWN' ||
        err?.code === 'CLAIM_HIERARCHY';
      showToast(msg, soft ? 'warn' : 'error');
      refreshClaimQuota();
    } finally {
      setClaimingId(null);
    }
  };

  const handleRequestJoin = async (taskId) => {
    if (!user) {
      showToast('Sign in to request joining a claim.', 'warn');
      navigate('/profile');
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
        showToast(friendlyError(err), 'error');
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
    setSelectedTaskId(taskId);
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

  const closeTaskModal = () => {
    if (actionBusy) return;
    setSelectedTaskId(null);
  };

  const handleSaveProgress = async () => {
    if (!selectedTask || !projectUuid) return;
    if (!user) {
      showToast('Sign in to update progress.', 'warn');
      navigate('/profile');
      return;
    }
    if (!isClaimHolder) {
      showToast('Claim this task first before saving progress or checklist items.', 'warn');
      return;
    }
    if (selectedTask.hasChildren) {
      showToast(
        'Progress on this task comes from completed sub-tasks. Update a child task instead.',
        'warn'
      );
      return;
    }
    setActionBusy(true);
    try {
      // Do not send helpers — they are managed when join requests are approved
      await tasksService.updateProgress(selectedTask.id, {
        progressPercent: Number(progressDraft) || 0,
        subtasks: subtasksDraft,
        notes: notesDraft,
      });

      const checklistComplete =
        subtasksDraft.length > 0 && subtasksDraft.every((s) => s.done);

      if (checklistComplete) {
        await tasksService.completeTask(selectedTask.id);
        await refreshBoard(projectUuid);
        showToast('All checklist items done — task completed!', 'success');
        setSelectedTaskId(null);
      } else {
        await refreshBoard(projectUuid);
        showToast('Progress saved.', 'success');
      }
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleComplete = async () => {
    if (!selectedTask || !projectUuid) return;
    if (!user) {
      showToast('Sign in to complete tasks.', 'warn');
      navigate('/profile');
      return;
    }
    setActionBusy(true);
    try {
      // Persist latest progress before completing (claim holder on leaf only)
      if (isClaimHolder && !selectedTask.hasChildren) {
        try {
          await tasksService.updateProgress(selectedTask.id, {
            progressPercent: 100,
            subtasks: subtasksDraft.map((s) => ({ ...s, done: true })),
            notes: notesDraft,
          });
        } catch {
          // complete_task will still finish the claim
        }
      }
      await tasksService.completeTask(selectedTask.id);
      await refreshBoard(projectUuid);
      showToast('Task completed — shoutout unlocked! Thanks for shipping.', 'success');
      setSelectedTaskId(null);
    } catch (err) {
      showToast(friendlyError(err), 'error');
    } finally {
      setActionBusy(false);
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

  /** Toggle checklist item and derive progress % from completed items. */
  const toggleSubtask = (subId) => {
    setSubtasksDraft((prev) => {
      const next = prev.map((s) =>
        s.id === subId ? { ...s, done: !s.done } : s
      );
      if (next.length > 0) {
        const done = next.filter((s) => s.done).length;
        setProgressDraft(Math.round((100 * done) / next.length));
      }
      return next;
    });
  };

  // Per-idea lock — prevents unlike→like race flicker
  const voteInflight = useRef(new Map());

  const voteKey = (id) => {
    if (id == null) return null;
    const n = Number(id);
    return Number.isFinite(n) ? n : String(id);
  };

  /**
   * Vote toggle — matches GameIdeas:
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
      navigate('/profile');
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

    // Optimistic
    if (hasVoted) {
      setProjectIdeas((prev) =>
        prev.map((i) =>
          voteKey(i.id) === key
            ? { ...i, votes: Math.max(0, (i.votes || 0) - 1) }
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
          voteKey(i.id) === key ? { ...i, votes: (i.votes || 0) + 1 } : i
        )
      );
      setUserIdeaVotes((prev) => new Set(prev).add(key));
    }

    try {
      await ideasService.toggleVote(ideaId, authUser.id, hasVoted);
    } catch (err) {
      const soft =
        /already voted|duplicate|unique/i.test(err?.message || '') ||
        err?.code === '23505';
      if (!soft) {
        // Roll back only on hard failure
        if (hasVoted) {
          setProjectIdeas((prev) =>
            prev.map((i) =>
              voteKey(i.id) === key ? { ...i, votes: (i.votes || 0) + 1 } : i
            )
          );
          setUserIdeaVotes((prev) => new Set(prev).add(key));
        } else {
          setProjectIdeas((prev) =>
            prev.map((i) =>
              voteKey(i.id) === key
                ? { ...i, votes: Math.max(0, (i.votes || 1) - 1) }
                : i
            )
          );
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

  const phaseVariant =
    project?.phase === 'Mid'
      ? 'purple'
      : project?.phase === 'Late'
        ? 'default'
        : 'neon';

  if (!project && loading) {
    return (
      <div className="pt-20 min-h-screen flex items-center justify-center text-text-secondary gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-neon-cyan" />
        Loading workspace…
      </div>
    );
  }

  const displayProject = project || DEFAULT_PROJECT;
  const projectSubmitPath = `/ideas/submit?project=${
    displayProject.slug || displayProject.id || projectSlug || ''
  }`;

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.05)_0%,transparent_50%)]"
        aria-hidden="true"
      />

      <div className="container-custom relative z-10 py-10 md:py-14 space-y-12 md:space-y-16">
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
          BACK TO PROJECTS
        </Link>

        {/* 1. PROJECT HEADER */}
        <header className="space-y-4">
          {phaseImageSrc(displayProject.phase) && (
            <div className="relative w-full h-40 sm:h-52 md:h-56 rounded-xl overflow-hidden border border-cyber-border bg-cyber-surface">
              <img
                src={phaseImageSrc(displayProject.phase)}
                alt={phaseImageAlt(displayProject.phase, displayProject.title)}
                className="absolute inset-0 w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-cyber-bg via-cyber-bg/40 to-transparent pointer-events-none"
                aria-hidden="true"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="section-header mb-0">Project Workspace</div>
            <Badge variant={phaseVariant}>{displayProject.phase} Game</Badge>
            <Badge variant="default">{displayProject.status}</Badge>
          </div>

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
              <Button className="gap-2" onClick={() => navigate('/get-involved')}>
                <Hammer className="w-4 h-4" />
                Get Involved
              </Button>
              <Button
                variant="secondary"
                className="gap-2"
                onClick={() =>
                  navigate(
                    `/ideas/submit?project=${displayProject.slug || displayProject.id}`
                  )
                }
              >
                <Sparkles className="w-4 h-4" />
                Submit Idea
              </Button>
            </div>
          </div>
        </header>

        {/* 2. PROJECT PULSE */}
        <section aria-labelledby="pulse-heading">
          <div className="mb-6">
            <h2 id="pulse-heading" className="section-header">
              Project Pulse
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatWidget
              label="Active People"
              value={pulse.activePeople}
              icon={<Users className="w-7 h-7 text-neon-cyan mx-auto" />}
            />
            <StatWidget
              label="Tasks This Week"
              value={pulse.tasksThisWeek}
              icon={<CheckCircle2 className="w-7 h-7 text-neon-cyan mx-auto" />}
            />
            <StatWidget
              label="Recent Wins"
              value={pulse.recentWins}
              icon={<Trophy className="w-7 h-7 text-neon-cyan mx-auto" />}
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
                    <ProfileLink
                      username={w.username}
                      className="text-sm text-text-primary"
                    >
                      {w.username}
                    </ProfileLink>
                  </div>
                ))}
              </div>
              {pulse.tasksThisMonth > 0 && (
                <span className="text-xs font-mono text-text-muted ml-auto">
                  {pulse.tasksThisMonth} completed this month
                </span>
              )}
            </div>
          )}
        </section>

        {toast && (
          <div
            role="status"
            className={`status-bar text-xs w-full sm:w-auto justify-center sm:justify-start ${
              toast.kind === 'error'
                ? 'border-red-400/40 text-red-200'
                : toast.kind === 'success'
                  ? 'border-neon-cyan/50'
                  : ''
            }`}
          >
            {toast.message}
          </div>
        )}

        {boardError && (
          <div
            role="alert"
            className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-100/90"
          >
            {boardError}
          </div>
        )}

        {/* 3. KANBAN TASK BOARD */}
        <section aria-labelledby="board-heading">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
            <div>
              <div className="section-header">Task Board</div>
              <h2 id="board-heading" className="text-2xl font-bold text-white">
                Claim work. Ship wins.
              </h2>
              <p className="text-text-secondary text-sm mt-1 max-w-xl">
                Claim a task with a Claim button, ship it, earn credit.
              </p>
              {claimQuota?.signedIn && (
                <p className="mt-2 text-xs font-mono text-text-muted">
                  Your claims: {claimQuota.activeClaims ?? 0}/
                  {claimQuota.claimLimit ?? 2} active
                  {claimQuota.completedClaims != null
                    ? ` · ${claimQuota.completedClaims} completed`
                    : ''}
                  {claimQuota.cooldownEndsAt &&
                  new Date(claimQuota.cooldownEndsAt) > new Date()
                    ? ' · cooldown after last claim'
                    : ''}
                  . Idle claims auto-release after 14 days.
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <div className="inline-flex rounded-lg border border-cyber-border overflow-hidden text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setBoardScope('top')}
                  className={`px-3 py-2 transition-colors ${
                    boardScope === 'top'
                      ? 'bg-neon-cyan/15 text-neon-cyan'
                      : 'text-text-muted hover:text-white'
                  }`}
                  title="Show only top-level epics/tasks"
                >
                  Top-level
                </button>
                <button
                  type="button"
                  onClick={() => setBoardScope('all')}
                  className={`px-3 py-2 border-l border-cyber-border transition-colors ${
                    boardScope === 'all'
                      ? 'bg-neon-cyan/15 text-neon-cyan'
                      : 'text-text-muted hover:text-white'
                  }`}
                  title="Show every task including nested sub-tasks"
                >
                  All tasks
                </button>
              </div>
              {isModerator && (
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
              <Badge variant="neon" className="justify-center">
                {loading
                  ? 'Loading…'
                  : `${boardTasks.length} shown · ${tasks.length} total${
                      user ? '' : ' · sign in to claim'
                    }`}
              </Badge>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-text-secondary">
              <Loader2 className="w-5 h-5 animate-spin text-neon-cyan" />
              Loading board…
            </div>
          ) : (
            <div className="flex lg:grid lg:grid-cols-3 gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
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
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 4 + 5. ACTIVITY + SHOUTOUTS */}
        <div className="grid lg:grid-cols-5 gap-6">
          <section aria-labelledby="activity-heading" className="lg:col-span-3">
            <h2 id="activity-heading" className="section-header mb-4">
              Recent Activity
            </h2>
            <Card className="bg-cyber-card/80">
              {activity.length === 0 ? (
                <p className="text-sm text-text-muted py-4 text-center">
                  No activity yet — claim a task to light up the feed.
                </p>
              ) : (
                activity.map((item) => (
                  <ActivityItem key={item.id} activity={item} />
                ))
              )}
            </Card>
          </section>

          <section aria-labelledby="shoutouts-heading" className="lg:col-span-2">
            <h2 id="shoutouts-heading" className="section-header mb-4">
              Shoutouts
            </h2>
            <div className="space-y-3">
              {shoutouts.length === 0 ? (
                <Card className="bg-cyber-card/80 border-neon-cyan/20">
                  <p className="text-sm text-text-secondary">
                    Complete a task to earn a public shoutout here. The forge
                    celebrates shippers.
                  </p>
                </Card>
              ) : (
                shoutouts.map((person) => (
                  <Card
                    key={person.id}
                    className="bg-cyber-card/80 border-neon-cyan/20"
                  >
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        src={person.avatarUrl || person.avatar_url}
                        name={person.name}
                        initials={person.initials}
                        size="lg"
                        className="shrink-0 mt-0.5"
                        borderClass="border border-neon-cyan/40"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-medium text-text-primary">
                            {person.name}
                          </span>
                          <Badge variant="default">{person.role}</Badge>
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

        {/* 6. OPEN QUESTIONS */}
        <section aria-labelledby="questions-heading">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
            <div>
              <div className="section-header">Open Questions</div>
              <h2 id="questions-heading" className="text-2xl font-bold text-white">
                Help shape the build
              </h2>
              <p className="text-text-secondary text-sm mt-1 max-w-xl">
                Community prompts and idea teasers for this project. Full idea
                board lives under Game Ideas.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 self-start sm:self-auto"
              onClick={() =>
                navigate(`/ideas?project=${displayProject.slug || displayProject.id}`)
              }
            >
              <MessageCircleQuestion className="w-4 h-4" />
              Browse ideas
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {OPEN_QUESTIONS.map((q) => (
              <Card
                key={q.id}
                className="bg-cyber-card/80 flex flex-col h-full"
              >
                <h3 className="text-base font-semibold text-white mb-2">
                  {q.title}
                </h3>
                <p className="text-sm text-text-secondary flex-1 mb-4">
                  {q.blurb}
                </p>
                <div className="flex items-center justify-between text-xs font-mono text-text-muted">
                  <span className="text-neon-cyan">{q.replies} replies</span>
                  <button
                    type="button"
                    className="text-text-secondary hover:text-neon-cyan transition-colors"
                    onClick={() =>
                      navigate(
                        `/ideas/submit?project=${displayProject.slug || displayProject.id}`
                      )
                    }
                  >
                    Add take →
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* 7. PROJECT IDEAS — scoped to this project only */}
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
              onClick={() => navigate(projectSubmitPath)}
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
              <option value="popular">Most Popular</option>
              <option value="votes">Most Votes</option>
              <option value="newest">Newest</option>
              <option value="title">Sort by Title</option>
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
                  <div className="max-h-60 overflow-auto space-y-1">
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
                    ? 'No ideas linked to this project yet. Be the first — submit an idea and it will land here for the team.'
                    : 'No ideas match your search or filters. Clear filters to see everything for this project.'}
                </p>
                <Button
                  className="gap-2 mt-4"
                  size="sm"
                  onClick={() => navigate(projectSubmitPath)}
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
                    projectSlug={projectKey}
                    onProjectClick={() => {
                      // From workspace: jump to global Ideas filtered to this project
                      navigate(
                        `/ideas?project=${encodeURIComponent(projectKey)}&feed=together`
                      );
                    }}
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
              onClick={() => navigate(projectSubmitPath)}
            >
              <Sparkles className="w-4 h-4" />
              Submit Idea for this Project
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() =>
                navigate(
                  `/ideas?project=${displayProject.slug || displayProject.id}`
                )
              }
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
              onClick={() => navigate('/transparency')}
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
      </div>

      {/* Task detail / manage modal */}
      <Modal
        isOpen={Boolean(selectedTask)}
        onClose={closeTaskModal}
        title={selectedTask?.title || 'Task'}
        size="lg"
      >
        {selectedTask && (
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            {selectedBreadcrumb.length > 1 && (
              <nav
                aria-label="Task hierarchy"
                className="flex flex-wrap items-center gap-1.5 text-xs font-mono text-text-muted"
              >
                {selectedBreadcrumb.map((crumb, i) => {
                  const isLast = i === selectedBreadcrumb.length - 1;
                  return (
                    <span key={crumb.id} className="inline-flex items-center gap-1.5">
                      {i > 0 && <span className="text-white/30">/</span>}
                      {isLast ? (
                        <span className="text-neon-cyan truncate max-w-[12rem]">
                          {crumb.title}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedTaskId(crumb.id)}
                          className="hover:text-neon-cyan truncate max-w-[10rem] transition-colors"
                        >
                          {crumb.title}
                        </button>
                      )}
                    </span>
                  );
                })}
              </nav>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {selectedTask.levelShort && (
                <Badge variant="default">{selectedTask.levelShort}</Badge>
              )}
              {selectedTask.category && (
                <Badge variant="purple">{selectedTask.category}</Badge>
              )}
              <Badge variant="neon">
                {selectedTask.status === 'todo'
                  ? 'To Do'
                  : selectedTask.status === 'in_progress'
                    ? 'In Progress'
                    : 'Completed'}
              </Badge>
              {/* Difficulty / estimate only on claimable leaf tasks */}
              {!selectedTask.isEpic &&
                !selectedTask.hasChildren &&
                (selectedTask.difficulty || selectedTask.estimatedEffort) && (
                  <Badge variant="default">
                    {[selectedTask.difficulty, selectedTask.estimatedEffort]
                      .filter(Boolean)
                      .join(' · ')}
                  </Badge>
                )}
              {selectedTask.hasChildren && (
                <Badge variant="default">
                  {selectedTask.completedChildCount}/{selectedTask.childCount}{' '}
                  sub-tasks
                </Badge>
              )}
              {isModerator && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 ml-auto"
                  onClick={() => openEditTaskForm(selectedTask)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Task
                </Button>
              )}
            </div>

            {selectedTask.description ? (
              <p className="text-sm text-text-secondary leading-relaxed">
                {selectedTask.description}
              </p>
            ) : null}

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
                  <div className="flex items-center justify-between text-[10px] font-mono tracking-widest text-text-muted mb-1">
                    <span>PROGRESS</span>
                    <span className="text-neon-cyan">
                      {selectedTask.status === 'completed'
                        ? 100
                        : selectedTask.progressPercent ?? 0}
                      %
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-cyber-surface border border-cyber-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-neon-cyan"
                      style={{
                        width: `${
                          selectedTask.status === 'completed'
                            ? 100
                            : Math.min(
                                100,
                                Math.max(0, selectedTask.progressPercent ?? 0)
                              )
                        }%`,
                      }}
                    />
                  </div>
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

            {/* Requester (not claim owner): read-only status only — no Approve/Decline */}
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
                <div>
                  <label className="block text-sm text-text-secondary font-mono mb-2">
                    Progress — {progressDraft}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={subtasksDraft.length > 0 ? 1 : 5}
                    value={progressDraft}
                    onChange={(e) => {
                      // When a checklist exists, progress is driven by checkboxes only
                      if (subtasksDraft.length > 0) return;
                      setProgressDraft(Number(e.target.value));
                    }}
                    readOnly={subtasksDraft.length > 0}
                    disabled={subtasksDraft.length > 0}
                    className={`w-full accent-cyan-400 ${
                      subtasksDraft.length > 0
                        ? 'opacity-90 cursor-default'
                        : ''
                    }`}
                  />
                </div>

                {subtasksDraft.length > 0 && (
                  <div>
                    <div className="text-sm text-text-secondary font-mono mb-2">
                      Checklist
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
                    Notes
                  </label>
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={3}
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

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={handleSaveProgress}
                    disabled={actionBusy}
                  >
                    {actionBusy ? 'Saving…' : 'Save Progress'}
                  </Button>
                  {canCompleteOrReturn && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleComplete}
                        disabled={actionBusy}
                      >
                        Mark Completed
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleReturn}
                        disabled={actionBusy}
                      >
                        Return Claim
                      </Button>
                    </>
                  )}
                </div>
              </>
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

            {!canEditProgress &&
              canCompleteOrReturn &&
              isModerator &&
              !isClaimHolder &&
              selectedTask.claim?.status === 'Active' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReturn}
                  disabled={actionBusy}
                >
                  Return Claim
                </Button>
              )}

            {selectedTask.volunteerClaimable &&
              selectedTask.status === 'todo' &&
              !selectedTask.claimedBy && (
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
              )}
          </div>
        )}
      </Modal>

      {/* Create / Edit task form (Project Lead + Admin only) */}
      <Modal
        isOpen={taskFormOpen}
        onClose={closeTaskForm}
        title={
          taskFormMode === 'edit'
            ? 'Edit Task'
            : taskForm.parentTaskId
              ? 'Add Sub-task'
              : 'Add New Task'
        }
        size="lg"
      >
        <form onSubmit={handleTaskFormSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          <p className="text-sm text-text-secondary leading-relaxed">
            {taskFormMode === 'edit'
              ? 'Update task details. Checklist labels keep their done state when unchanged.'
              : taskForm.parentTaskId
                ? 'Add a child task under the parent.'
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
              <select
                id="task-category"
                required
                className={fieldControlClass}
                value={taskForm.category}
                onChange={(e) => updateTaskFormField('category', e.target.value)}
              >
                {taskForm.category &&
                  !TASK_CATEGORIES.includes(taskForm.category) && (
                    <option value={taskForm.category}>{taskForm.category}</option>
                  )}
                {TASK_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
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
            <input
              id="task-effort"
              type="text"
              maxLength={40}
              placeholder="e.g. 2-4h, 1 day, weekend sprint"
              className={fieldControlClass}
              value={taskForm.estimatedEffort}
              onChange={(e) => updateTaskFormField('estimatedEffort', e.target.value)}
            />
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
    </div>
  );
};

export default ProjectWorkspace;
