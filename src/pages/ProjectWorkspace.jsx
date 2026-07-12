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
 * Uses placeholder data for now. Wire to Supabase later.
 * Navbar + Footer come from App.jsx layout.
 */

import { useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  Trophy,
  MessageCircleQuestion,
  Sparkles,
  Megaphone,
  Hammer,
  ThumbsUp,
  Lightbulb,
} from 'lucide-react';

import Button from '../components/ui/Buttons';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import TaskCard from '../components/ui/TaskCard';
import ActivityItem from '../components/ui/ActivityItem';
import StatWidget from '../components/ui/StatWidget';

// ---------------------------------------------------------------------------
// Placeholder data — replace with API / Supabase fetches by project id
// ---------------------------------------------------------------------------

const PLACEHOLDER_PROJECTS = {
  'prototype-systems': {
    id: 'prototype-systems',
    title: 'Prototype Systems',
    phase: 'Early',
    status: 'In Development',
    description:
      'Core loop prototyping and networking tests. We are validating multiplayer foundations, claim/credit flows, and the volunteer task board itself — with design, code, and art volunteers welcome.',
  },
  'core-features': {
    id: 'core-features',
    title: 'Core Features Sprint',
    phase: 'Mid',
    status: 'Planning',
    description:
      'Design work and early integrations for systems that make cooperative play feel great. Focused sprints, clear ownership, and public progress.',
  },
  'polish-playtests': {
    id: 'polish-playtests',
    title: 'Stability & Polish',
    phase: 'Late',
    status: 'Vision',
    description:
      'Polish passes, optimization, and wider playtests. Help stress-test builds and report what breaks — or what delights.',
  },
};

const DEFAULT_PROJECT = {
  id: 'unknown',
  title: 'Community Project',
  phase: 'Early',
  status: 'In Development',
  description:
    'A collaborative Together Forge project. Claim tasks, ship wins, and help shape the build with the community.',
};

const PULSE = {
  activePeople: 8,
  tasksThisWeek: 12,
  recentWins: 3,
};

const PLACEHOLDER_TASKS = [
  {
    id: 't1',
    title: 'Design core loop doc',
    description: 'Short doc for the collect → deliver → defend loop.',
    difficulty: 'Medium',
    category: 'Design',
    status: 'todo',
    claimedBy: null,
  },
  {
    id: 't2',
    title: 'Enemy pathing prototype',
    description: 'Simple pathfinding and chase for early playtests.',
    difficulty: 'Hard',
    category: 'Code',
    status: 'todo',
    claimedBy: null,
  },
  {
    id: 't3',
    title: 'Networking stomp test',
    description: 'Packet-loss tolerance and prediction smoke test.',
    difficulty: 'Hard',
    category: 'Code',
    status: 'todo',
    claimedBy: null,
  },
  {
    id: 't4',
    title: 'Collectible item icons',
    description: 'Quick icons for prototype pickups and resources.',
    difficulty: 'Easy',
    category: 'Art',
    status: 'todo',
    claimedBy: null,
  },
  {
    id: 't5',
    title: 'Prototype player movement',
    description: 'Basic movement with interpolation and jitter fixes.',
    difficulty: 'Hard',
    category: 'Code',
    status: 'in_progress',
    claimedBy: 'alice',
  },
  {
    id: 't6',
    title: 'UI mockups for HUD',
    description: 'HUD mockups for resources, objectives, and party status.',
    difficulty: 'Medium',
    category: 'Design',
    status: 'in_progress',
    claimedBy: 'erin',
  },
  {
    id: 't7',
    title: 'Add task claim UI',
    description: 'Frontend for claiming tasks and progress notes.',
    difficulty: 'Medium',
    category: 'Code',
    status: 'in_progress',
    claimedBy: 'carol',
  },
  {
    id: 't8',
    title: 'Demo map layout',
    description: 'Small test map with spawn points for playtests.',
    difficulty: 'Easy',
    category: 'Level Design',
    status: 'completed',
    claimedBy: 'bob',
  },
  {
    id: 't9',
    title: 'Placeholder art set A',
    description: 'Placeholder sprites/models for quick playtests.',
    difficulty: 'Easy',
    category: 'Art',
    status: 'completed',
    claimedBy: 'fay',
  },
  {
    id: 't10',
    title: 'Tutorial text flow',
    description: 'First-time player prompts for the prototype session.',
    difficulty: 'Medium',
    category: 'Writing',
    status: 'completed',
    claimedBy: 'carol',
  },
];

const PLACEHOLDER_ACTIVITY = [
  {
    user: 'alice',
    userInitials: 'AL',
    action: 'updated progress on',
    target: 'Prototype player movement',
    time: '2h ago',
  },
  {
    user: 'erin',
    userInitials: 'ER',
    action: 'shared mockups for',
    target: 'UI mockups for HUD',
    time: '5h ago',
  },
  {
    user: 'bob',
    userInitials: 'BO',
    action: 'completed',
    target: 'Demo map layout',
    time: '1d ago',
  },
  {
    user: 'carol',
    userInitials: 'CA',
    action: 'claimed',
    target: 'Add task claim UI',
    time: '1d ago',
  },
  {
    user: 'fay',
    userInitials: 'FA',
    action: 'shipped',
    target: 'Placeholder art set A',
    time: '2d ago',
  },
];

const SHOUTOUTS = [
  {
    name: 'bob',
    initials: 'BO',
    note: 'Shipped the demo map layout ahead of the playtest — clean spawn points and flow.',
    role: 'Level Design',
  },
  {
    name: 'fay',
    initials: 'FA',
    note: 'Placeholder art set unblocked early playtests for the whole squad.',
    role: 'Art',
  },
  {
    name: 'carol',
    initials: 'CA',
    note: 'Tutorial copy + claim UI work is making the forge easier for new volunteers.',
    role: 'Code / Writing',
  },
];

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

/** Community ideas scoped to this project (placeholder) */
const PROJECT_IDEAS = [
  {
    id: 'idea-1',
    title: 'Shared backpack with limited slots',
    summary:
      'Force teamwork by making inventory party-shared — players must coordinate what to carry into each run.',
    votes: 42,
    submitter: 'nova_pixel',
    status: 'Under review',
  },
  {
    id: 'idea-2',
    title: 'Streamer-friendly spectator mode',
    summary:
      'Let audiences watch a live run with delayed POV switch and simple vote prompts for map events.',
    votes: 37,
    submitter: 'mxd_guides',
    status: 'Discussion',
  },
  {
    id: 'idea-3',
    title: 'Modular hazard modules',
    summary:
      'Drop-in hazard “cards” designers can mix per session so playtests stay fresh without new maps.',
    votes: 28,
    submitter: 'forge_kit',
    status: 'New',
  },
  {
    id: 'idea-4',
    title: 'Co-op ping wheel for mute players',
    summary:
      'Fast pings for need / danger / loot so mixed-skill squads coordinate without voice chat.',
    votes: 51,
    submitter: 'quiet_ops',
    status: 'Promising',
  },
];

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
    body: 'New claim flow draft is live on the board. Leave progress notes when you hand off a task so the next person can pick up cleanly.',
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ProjectWorkspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState(PLACEHOLDER_TASKS);
  const [claimNote, setClaimNote] = useState(null);
  const [ideaVotes, setIdeaVotes] = useState(() =>
    Object.fromEntries(PROJECT_IDEAS.map((idea) => [idea.id, idea.votes]))
  );

  const project = useMemo(() => {
    if (!id) return { ...DEFAULT_PROJECT };
    return (
      PLACEHOLDER_PROJECTS[id] || {
        ...DEFAULT_PROJECT,
        id,
        title: id
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
      }
    );
  }, [id]);

  const tasksByStatus = useMemo(() => {
    const groups = { todo: [], in_progress: [], completed: [] };
    for (const task of tasks) {
      const key = groups[task.status] ? task.status : 'todo';
      groups[key].push(task);
    }
    return groups;
  }, [tasks]);

  const sortedIdeas = useMemo(
    () =>
      [...PROJECT_IDEAS].sort(
        (a, b) => (ideaVotes[b.id] ?? b.votes) - (ideaVotes[a.id] ?? a.votes)
      ),
    [ideaVotes]
  );

  const handleClaim = (taskId) => {
    // Placeholder claim — swap for auth + Supabase mutation later
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId && !t.claimedBy
          ? { ...t, status: 'in_progress', claimedBy: 'you' }
          : t
      )
    );
    setClaimNote(`Task ${taskId} claimed (placeholder). Sign in will wire real claims.`);
    window.setTimeout(() => setClaimNote(null), 3500);
  };

  const handleViewTask = (taskId) => {
    // Detail drawer/page not built yet — keep navigation-friendly hook
    const el = document.getElementById(`task-${taskId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleVoteIdea = (ideaId) => {
    // Local placeholder vote — wire to auth + ideas service later
    setIdeaVotes((prev) => ({
      ...prev,
      [ideaId]: (prev[ideaId] ?? 0) + 1,
    }));
  };

  const phaseVariant =
    project.phase === 'Mid' ? 'purple' : project.phase === 'Late' ? 'default' : 'neon';

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      {/* Soft cyber atmosphere */}
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.05)_0%,transparent_50%)]"
        aria-hidden="true"
      />

      <div className="container-custom relative z-10 py-10 md:py-14 space-y-12 md:space-y-16">
        {/* Back link */}
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
          BACK TO PROJECTS
        </Link>

        {/* ============================================================
            1. PROJECT HEADER
            ============================================================ */}
        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="section-header mb-0">Project Workspace</div>
            <Badge variant={phaseVariant}>{project.phase} Game</Badge>
            <Badge variant="default">{project.status}</Badge>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-3xl">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
                {project.title}
              </h1>
              <p className="mt-4 text-text-secondary text-base sm:text-lg leading-relaxed">
                {project.description}
              </p>
              <p className="mt-2 text-xs font-mono text-text-muted tracking-widest">
                ID // {project.id}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Button
                className="gap-2"
                onClick={() => navigate('/get-involved')}
              >
                <Hammer className="w-4 h-4" />
                Get Involved
              </Button>
              <Button
                variant="secondary"
                className="gap-2"
                onClick={() => navigate(`/ideas/submit?project=${project.id}`)}
              >
                <Sparkles className="w-4 h-4" />
                Submit Idea
              </Button>
            </div>
          </div>
        </header>

        {/* ============================================================
            2. PROJECT PULSE
            ============================================================ */}
        <section aria-labelledby="pulse-heading">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <div className="section-header">Project Pulse</div>
              <h2 id="pulse-heading" className="text-2xl font-bold text-white">
                Live momentum
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatWidget
              label="Active People"
              value={PULSE.activePeople}
              icon={<Users className="w-7 h-7 text-neon-cyan mx-auto" />}
            />
            <StatWidget
              label="Tasks This Week"
              value={PULSE.tasksThisWeek}
              icon={<CheckCircle2 className="w-7 h-7 text-neon-cyan mx-auto" />}
            />
            <StatWidget
              label="Recent Wins"
              value={PULSE.recentWins}
              icon={<Trophy className="w-7 h-7 text-neon-cyan mx-auto" />}
            />
          </div>
        </section>

        {/* Claim toast (placeholder) */}
        {claimNote && (
          <div
            role="status"
            className="status-bar text-xs w-full sm:w-auto justify-center sm:justify-start"
          >
            {claimNote}
          </div>
        )}

        {/* ============================================================
            3. KANBAN TASK BOARD
            ============================================================ */}
        <section aria-labelledby="board-heading">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
            <div>
              <div className="section-header">Task Board</div>
              <h2 id="board-heading" className="text-2xl font-bold text-white">
                Claim work. Ship wins.
              </h2>
              <p className="text-text-secondary text-sm mt-1 max-w-xl">
                Drag-and-drop comes later — for now claim from To Do and track
                progress across columns.
              </p>
            </div>
            <Badge variant="neon">
              {tasks.length} tasks · placeholder data
            </Badge>
          </div>

          {/* Horizontal scroll on small screens; 3-col grid on lg+ */}
          <div className="flex lg:grid lg:grid-cols-3 gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
            {KANBAN_COLUMNS.map((col) => {
              const colTasks = tasksByStatus[col.key] || [];
              return (
                <div
                  key={col.key}
                  className={`snap-start shrink-0 w-[min(100%,20rem)] sm:w-[22rem] lg:w-auto flex flex-col rounded-xl border bg-cyber-surface/80 ${col.accent} min-h-[20rem]`}
                >
                  {/* Column header */}
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

                  {/* Cards */}
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
                            onClaim={
                              col.key === 'todo' ? handleClaim : undefined
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
        </section>

        {/* ============================================================
            4 + 5. ACTIVITY + SHOUTOUTS (side-by-side on large screens)
            ============================================================ */}
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Recent Activity */}
          <section
            aria-labelledby="activity-heading"
            className="lg:col-span-3"
          >
            <div className="section-header">Recent Activity</div>
            <h2 id="activity-heading" className="text-2xl font-bold text-white mb-4">
              What just happened
            </h2>
            <Card className="bg-cyber-card/80">
              {PLACEHOLDER_ACTIVITY.map((activity, i) => (
                <ActivityItem
                  key={`${activity.user}-${i}`}
                  activity={activity}
                />
              ))}
            </Card>
          </section>

          {/* Volunteer Shoutouts */}
          <section
            aria-labelledby="shoutouts-heading"
            className="lg:col-span-2"
          >
            <div className="section-header">Shoutouts</div>
            <h2 id="shoutouts-heading" className="text-2xl font-bold text-white mb-4">
              Volunteer wins
            </h2>
            <div className="space-y-3">
              {SHOUTOUTS.map((person) => (
                <Card
                  key={person.name}
                  className="bg-cyber-card/80 border-neon-cyan/20"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-cyber-surface border border-neon-cyan/40 flex items-center justify-center text-neon-cyan text-xs font-mono shrink-0">
                      {person.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-medium text-text-primary">
                          {person.name}
                        </span>
                        <Badge variant="default">{person.role}</Badge>
                      </div>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {person.note}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </div>

        {/* ============================================================
            6. OPEN QUESTIONS
            ============================================================ */}
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
              onClick={() => navigate(`/ideas?project=${project.id}`)}
            >
              <MessageCircleQuestion className="w-4 h-4" />
              Browse ideas
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {OPEN_QUESTIONS.map((q) => (
              <Card
                key={q.id}
                className="bg-cyber-card/80 flex flex-col h-full hover:border-neon-cyan/40"
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
                      navigate(`/ideas/submit?project=${project.id}`)
                    }
                  >
                    Add take →
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* ============================================================
            7. PROJECT IDEAS
            ============================================================ */}
        <section id="project-ideas" aria-labelledby="project-ideas-heading">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
            <div className="max-w-2xl">
              <div className="section-header">Project Ideas</div>
              <h2
                id="project-ideas-heading"
                className="text-2xl font-bold text-white"
              >
                Ideas for {project.title}
              </h2>
              <p className="text-text-secondary text-sm mt-2 leading-relaxed">
                Community ideas specifically for this project. Vote, discuss,
                and help shape what we build next.
              </p>
            </div>

            <Button
              className="gap-2 self-start lg:self-auto shrink-0"
              onClick={() => navigate(`/ideas/submit?project=${project.id}`)}
            >
              <Lightbulb className="w-4 h-4" />
              Submit Idea for this Project
            </Button>
          </div>

          <div className="space-y-3 max-w-4xl">
            {sortedIdeas.map((idea) => (
              <Card
                key={idea.id}
                className="bg-cyber-card/80 hover:border-neon-cyan/40"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Vote control */}
                  <div className="flex sm:flex-col items-center gap-2 sm:gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="!px-2.5 gap-1.5"
                      onClick={() => handleVoteIdea(idea.id)}
                      aria-label={`Vote for ${idea.title}`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5 text-neon-cyan" />
                      <span className="font-mono text-neon-cyan">
                        {ideaVotes[idea.id] ?? idea.votes}
                      </span>
                    </Button>
                    <span className="text-[10px] font-mono tracking-widest text-text-muted uppercase sm:hidden">
                      votes
                    </span>
                  </div>

                  {/* Idea body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-base sm:text-lg font-semibold text-white">
                        {idea.title}
                      </h3>
                      <Badge variant="default">{idea.status}</Badge>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed mb-3">
                      {idea.summary}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-text-muted">
                      <span>
                        by{' '}
                        <span className="text-neon-cyan">{idea.submitter}</span>
                      </span>
                      <button
                        type="button"
                        className="text-text-secondary hover:text-neon-cyan transition-colors"
                        onClick={() => navigate(`/ideas/${idea.id}`)}
                      >
                        Discuss →
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate(`/ideas/submit?project=${project.id}`)}
            >
              <Sparkles className="w-4 h-4" />
              Submit Idea for this Project
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => navigate(`/ideas?project=${project.id}`)}
            >
              View all ideas
            </Button>
          </div>
        </section>

        {/* ============================================================
            8. UPDATES
            ============================================================ */}
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
    </div>
  );
};

export default ProjectWorkspace;
