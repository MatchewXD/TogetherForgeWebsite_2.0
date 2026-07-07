import { ArrowLeft, Hammer, Users, Zap, PlusCircle, CheckSquare, Square, Wrench, ShieldCheck, Search, Tag, Calendar, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useIsModerator } from '../hooks/useIsModerator';

const Projects = () => {
    const projects = [
        {
            phase: "EARLY GAME",
            title: "Proof of Concept",
            status: "In Development",
            icon: Hammer,
            desc: "A small, fun multiplayer game focused on teamwork and cooperation. The main goal is to prove our community systems and make participation easy.",
            color: "neon-cyan"
        },
        {
            phase: "MID GAME",
            title: "Polished Indie Experience",
            status: "Planning",
            icon: Users,
            desc: "A more refined game similar in scope to strong indie titles. Testing deeper mechanics and scaling the volunteer system.",
            color: "neon-magenta"
        },
        {
            phase: "LATE GAME",
            title: "Massive Community Project",
            status: "Vision",
            icon: Zap,
            desc: "Large-scale cooperative experience (MMO-like) where hundreds of players work together against common threats and build something epic.",
            color: "neon-cyan"
        }
    ];
    const [tasks, setTasks] = useState([]);
    const [profiles, setProfiles] = useState({});
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSkill, setFilterSkill] = useState('All');
    // unclaimedOnly removed: use the board filter buttons (activeFilter) instead
    const [expandedTaskId, setExpandedTaskId] = useState(null);
    const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unclaimed' | 'in_progress' | 'completed'
    const { isModerator } = useIsModerator();

    // Sample fallback data to show the UI when no DB rows exist yet
    const SAMPLE_TASKS = [
        { id: 't1', title: 'Prototype player movement', description: 'Implement basic movement and interpolation.', status: 'in_progress', claimed_by: 'u1', updated_at: '2026-07-02T10:00:00Z', priority: 'High', skills: ['Code'], progress: 45 },
        { id: 't2', title: 'Design core loop doc', description: 'Write the short doc describing the collect->deliver->defend loop.', status: 'todo', claimed_by: null, updated_at: '2026-06-28T09:30:00Z', priority: 'Medium', skills: ['Design', 'Writing'], progress: 0 },
        { id: 't3', title: 'Demo map layout', description: 'Create a small test map and spawn points for playtests.', status: 'completed', claimed_by: 'u2', updated_at: '2026-06-20T11:20:00Z', priority: 'Low', skills: ['Art', 'Level Design'], progress: 100 },
        { id: 't4', title: 'Add task claim UI', description: 'Frontend UI for claiming tasks and leaving progress notes.', status: 'in_progress', claimed_by: 'u3', updated_at: '2026-07-01T08:45:00Z', priority: 'High', skills: ['Code', 'UX'], progress: 30 },
        { id: 't5', title: 'Enemy pathing prototype', description: 'Simple pathfinding and chase behavior for early tests.', status: 'todo', claimed_by: null, updated_at: '2026-06-30T15:30:00Z', priority: 'Medium', skills: ['AI', 'Code'], progress: 0 },
        { id: 't6', title: 'Sound FX for footsteps', description: 'Create and integrate basic footstep SFX for prototype surface types.', status: 'todo', claimed_by: 'u4', updated_at: '2026-06-25T12:00:00Z', priority: 'Low', skills: ['Audio'], progress: 0 },
        { id: 't7', title: 'UI mockups for HUD', description: 'Design simple HUD mockups showing resources and objectives.', status: 'in_progress', claimed_by: 'u5', updated_at: '2026-07-03T09:10:00Z', priority: 'Medium', skills: ['Design', 'UX'], progress: 60 },
        { id: 't8', title: 'Networking stomp test', description: 'Automated test for packet loss tolerance and prediction.', status: 'todo', claimed_by: null, updated_at: '2026-06-27T14:00:00Z', priority: 'High', skills: ['Code', 'Networking'], progress: 0 },
        { id: 't9', title: 'Placeholder art set A', description: 'Create placeholder sprites/models for quick playtests.', status: 'completed', claimed_by: 'u6', updated_at: '2026-06-18T10:00:00Z', priority: 'Low', skills: ['Art'], progress: 100 },
        { id: 't10', title: 'Telemetry hook', description: 'Add basic telemetry to record player deaths and objectives.', status: 'in_progress', claimed_by: 'u1', updated_at: '2026-07-02T16:00:00Z', priority: 'Medium', skills: ['Code'], progress: 20 },
        { id: 't11', title: 'Design enemy spawn rules', description: 'Rules for spawn timing and density across the demo map.', status: 'todo', claimed_by: null, updated_at: '2026-06-29T11:00:00Z', priority: 'Medium', skills: ['Design'], progress: 0 },
        { id: 't12', title: 'Accessibility checklist', description: 'Create a checklist to ensure early playtests consider accessibility.', status: 'todo', claimed_by: 'u2', updated_at: '2026-07-01T13:30:00Z', priority: 'Low', skills: ['Writing'], progress: 0 },
        { id: 't13', title: 'Optimize asset pipeline', description: 'Speed up import/export times for art assets.', status: 'in_progress', claimed_by: 'u4', updated_at: '2026-07-02T07:45:00Z', priority: 'High', skills: ['Tooling'], progress: 50 },
        { id: 't14', title: 'Add leaderboards (dev)', description: 'Prototype a dev-only leaderboard to track test performance.', status: 'todo', claimed_by: null, updated_at: '2026-06-26T09:00:00Z', priority: 'Low', skills: ['Code'], progress: 0 },
        { id: 't15', title: 'Tutorial text flow', description: 'Write short tutorial prompts for first-time players.', status: 'completed', claimed_by: 'u3', updated_at: '2026-06-21T12:10:00Z', priority: 'Medium', skills: ['Writing', 'Design'], progress: 100 },
        { id: 't16', title: 'CI test: build pipeline', description: 'Configure build pipeline for prototype automated builds.', status: 'in_progress', claimed_by: 'u5', updated_at: '2026-07-04T08:00:00Z', priority: 'High', skills: ['DevOps'], progress: 25 },
        { id: 't17', title: 'Collectible item icons', description: 'Create quick icons for prototype collectibles.', status: 'todo', claimed_by: null, updated_at: '2026-06-24T10:15:00Z', priority: 'Low', skills: ['Art'], progress: 0 },
        { id: 't18', title: 'Balance: resource spawn rates', description: 'Tune spawn rates for resources to match playtime goals.', status: 'in_progress', claimed_by: 'u6', updated_at: '2026-07-03T18:20:00Z', priority: 'Medium', skills: ['Design'], progress: 40 },
        { id: 't19', title: 'Add progress notes UI', description: 'Allow contributors to write short progress notes on tasks.', status: 'todo', claimed_by: null, updated_at: '2026-06-30T08:00:00Z', priority: 'High', skills: ['Code', 'UX'], progress: 0 },
        { id: 't20', title: 'Visual polish pass A', description: 'Polish lighting and postfx for demo map.', status: 'todo', claimed_by: null, updated_at: '2026-07-04T09:30:00Z', priority: 'Low', skills: ['Art'], progress: 0 }
    ];

    const SAMPLE_PROFILES = {
        u1: { id: 'u1', username: 'alice', avatar_url: null },
        u2: { id: 'u2', username: 'bob', avatar_url: null },
        u3: { id: 'u3', username: 'carol', avatar_url: null },
        u4: { id: 'u4', username: 'dan', avatar_url: null },
        u5: { id: 'u5', username: 'erin', avatar_url: null },
        u6: { id: 'u6', username: 'fay', avatar_url: null }
    };

    const SAMPLE_ACTIVITY = [
        { title: 'Prototype player movement updated', summary: 'Interpolation improvements and jitter fixes.', updated_at: '2026-07-02T10:00:00Z' },
        { title: 'Demo map created', summary: 'Small arena map created for playtests.', updated_at: '2026-06-20T11:20:00Z' },
        { title: 'Task: Add task claim UI', summary: 'Frontend changes pushed for claiming tasks.', updated_at: '2026-07-01T08:45:00Z' }
    ];

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            // attempt to load tasks (if a tasks table exists)
            const { data: taskRows, error: taskErr } = await supabase.from('tasks').select('*').order('updated_at', { ascending: false }).limit(200);
            if (!mounted) return;
            if (taskErr) {
                // silently ignore — show placeholder UI
                setTasks(SAMPLE_TASKS);
                // ensure sample profiles are available for placeholder avatars/usernames
                setProfiles(SAMPLE_PROFILES);
            } else {
                setTasks(taskRows || SAMPLE_TASKS);
                const userIds = [...new Set((taskRows || SAMPLE_TASKS).map(t => t.claimed_by).filter(Boolean))];
                if (userIds.length > 0) {
                    const { data: profileRows } = await supabase.from('profiles').select('id, username, avatar_url').in('id', userIds);
                    if (profileRows && profileRows.length > 0) setProfiles(Object.fromEntries(profileRows.map(p => [p.id, p])));
                    else setProfiles(SAMPLE_PROFILES);
                }
            }

            // activity: try to read a project_activity view/table, fallback to recent task updates
            const { data: actRows } = await supabase.from('project_activity').select('*').order('created_at', { ascending: false }).limit(10);
            if (actRows && actRows.length > 0) setActivity(actRows);
            else setActivity(SAMPLE_ACTIVITY);

            setLoading(false);
        };
        load();
        return () => { mounted = false; };
    }, []);

    const tasksByStatus = {
        todo: tasks.filter(t => t.status === 'todo' || !t.status),
        in_progress: tasks.filter(t => t.status === 'in_progress' || t.status === 'claimed'),
        completed: tasks.filter(t => t.status === 'done' || t.status === 'completed')
    };

    // Apply search / filter state to produce visible tasks
    const visibleTasks = tasks
        .filter(t => {
            // Board-level category filtering is handled by `activeFilter`; visibleTasks only applies search/skill
            if (filterSkill !== 'All' && (!t.skills || !t.skills.includes(filterSkill))) return false;
            if (searchTerm && !(t.title.toLowerCase().includes(searchTerm.toLowerCase()) || t.description.toLowerCase().includes(searchTerm.toLowerCase()))) return false;
            return true;
        });

    const visibleByStatus = {
        todo: visibleTasks.filter(t => t.status === 'todo' || !t.status),
        in_progress: visibleTasks.filter(t => t.status === 'in_progress' || t.status === 'claimed'),
        completed: visibleTasks.filter(t => t.status === 'done' || t.status === 'completed')
    };

    // Metrics
    const totalTasks = tasks.length;
    const claimedThisWeek = tasks.filter(t => t.claimed_by && (Date.now() - new Date(t.updated_at).getTime()) < 7 * 24 * 60 * 60 * 1000).length;
    const avgProgress = Math.round((tasks.reduce((s, t) => s + (t.progress || 0), 0) / Math.max(1, tasks.length)));

    // Utility: distribute an array into N roughly-even columns
    const distributeIntoColumns = (arr, n) => {
        const cols = Array.from({ length: n }, () => []);
        for (let i = 0; i < arr.length; i++) cols[i % n].push(arr[i]);
        return cols;
    };

    const FILTER_META = {
        all: { label: 'All', Icon: Square },
        unclaimed: { label: 'Unclaimed', Icon: PlusCircle },
        in_progress: { label: 'In Progress', Icon: Wrench },
        completed: { label: 'Completed', Icon: CheckSquare }
    };

    const claimTask = async (taskId) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return alert('Please log in to claim a task.');
        const { error } = await supabase.from('tasks').update({ claimed_by: user.id, status: 'in_progress' }).eq('id', taskId);
        if (error) return console.error('Claim error', error.message);
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, claimed_by: user.id, status: 'in_progress' } : t));
    };

    // Derived activity entries from tasks (so recent task updates show user info)
    const activityFromTasks = tasks.slice().sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 20).map(t => ({
        title: t.title,
        summary: t.description || '',
        user_id: t.claimed_by || null,
        action: (t.status === 'completed' || t.status === 'done') ? 'completed' : (t.status === 'in_progress' || t.status === 'claimed') ? 'updated' : 'updated',
        updated_at: t.updated_at
    }));

    // Combine DB activity (if any) with task-derived activity and sort by time
    const recentActivity = [...(activity || []), ...activityFromTasks].slice().sort((a, b) => new Date(b.updated_at || b.created_at || Date.now()).getTime() - new Date(a.updated_at || a.created_at || Date.now()).getTime()).slice(0, 10);

    // Compute volunteer shoutouts: counts of completed tasks per user
    const completedCountsMap = tasks.reduce((acc, t) => {
        if ((t.status === 'completed' || t.status === 'done') && t.claimed_by) {
            acc[t.claimed_by] = (acc[t.claimed_by] || 0) + 1;
        }
        return acc;
    }, {});
    const topContributors = Object.entries(completedCountsMap).map(([id, count]) => ({ id, count, profile: profiles[id] || SAMPLE_PROFILES[id] })).sort((a, b) => b.count - a.count);

    return (
        <div className="pt-20 min-h-screen">
            <div className="container-custom py-12">
                <Link to="/" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO HOME
                </Link>

                {/* Current Active Project */}
                <div className="mb-8">
                    <div className="section-header">CURRENT PROJECT</div>
                    <div className="flex items-center justify-between gap-6">
                        <div>
                            <h1 className="text-5xl font-bold tracking-tight text-white">{projects[0].title} <span className="text-xs align-middle ml-3 bg-white/10 px-3 py-1 rounded">{projects[0].status}</span></h1>
                            <p className="text-text-secondary mt-4 max-w-3xl">{projects[0].desc}</p>
                            {isModerator && (
                                <div className="mt-3">
                                    <Link to="/projects/edit" className="text-xs px-3 py-1.5 rounded-full border border-neon-cyan text-neon-cyan hover:bg-white/5">Edit Page</Link>
                                </div>
                            )}
                        </div>
                        <div className="w-80">
                            <div className="text-xs text-text-muted">Overall Progress</div>
                            <div className="w-full bg-white/5 rounded h-3 mt-2 overflow-hidden">
                                <div className="bg-neon-cyan h-3" style={{ width: `${avgProgress}%` }} />
                            </div>
                            <div className="text-xs text-text-muted mt-2">{totalTasks} tasks • {claimedThisWeek} claimed this week • Avg progress {avgProgress}%</div>
                        </div>
                    </div>
                </div>

                {/* Make the task board span full width */}
                <div className="mb-10">
                    <div className="md:col-span-3">
                        {/* Dashboard header: search and filters */}
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex items-center bg-cyber-surface border border-white/10 px-3 py-2 rounded w-full max-w-lg">
                                <Search className="w-4 h-4 text-text-secondary mr-3" />
                                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search tasks..." className="bg-transparent outline-none text-white w-full" />
                            </div>
                            <div className="flex items-center gap-2">
                                <select value={filterSkill} onChange={(e) => setFilterSkill(e.target.value)} className="bg-cyber-surface border border-white/10 px-3 py-2 rounded text-sm text-white">
                                    <option>All</option>
                                    <option>Code</option>
                                    <option>Design</option>
                                    <option>Art</option>
                                    <option>Writing</option>
                                    <option>AI</option>
                                </select>
                                <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className="bg-cyber-surface border border-white/10 px-3 py-2 rounded text-sm text-white">
                                    <option value="all">All</option>
                                    <option value="unclaimed">Unclaimed</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>
                        </div>

                        <div className="cyber-card p-4 mb-6" style={{ height: '72vh', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                            <div className="section-header mb-4">Task Board</div>
                        {/* Active filter banner (only show when a specific filter is selected) */}
                        {activeFilter !== 'all' && (
                            <div className="flex items-center gap-2 mb-4">
                                <div className="inline-flex items-center gap-2 bg-white/5 px-3 py-1 rounded text-sm text-white">
                                    {(() => {
                                        const Icon = FILTER_META[activeFilter].Icon || Square;
                                        return <Icon className="w-4 h-4" />;
                                    })()}
                                    <span>{FILTER_META[activeFilter].label}</span>
                                </div>
                            </div>
                        )}



                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                            {activeFilter === 'all' ? (
                                <>
                                    {/* To Do Column */}
                                    <div className="md:border-r md:border-white/10 md:pr-4 flex flex-col h-full" style={{ minHeight: 0 }}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <Hammer className="w-5 h-5 text-neon-cyan" />
                                                <div className="font-mono text-sm font-bold text-white uppercase tracking-wider">TO DO</div>
                                            </div>
                                            <div className="text-xs text-text-muted">{(loading ? 0 : visibleByStatus.todo.length)}</div>
                                        </div>
                                        <div className="space-y-3 overflow-auto flex-1 task-scroll" style={{ maxHeight: 'calc(72vh - 6rem)' }}>
                                            {(loading ? Array.from({ length: 3 }) : visibleByStatus.todo).map((task, idx) => (
                                                task ? (
                                                    <div key={task.id} className="cyber-card task-card p-4">
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex-1">
                                                                <div className="font-bold text-white">{task.title}</div>
                                                                <div className="text-text-secondary text-sm line-clamp-2">{task.description}</div>
                                                                <div className="mt-3 flex items-center gap-2">
                                                                    <button onClick={() => claimTask(task.id)} className="text-xs px-2 py-1 border border-white/10 rounded hover:bg-white/5">Claim</button>
                                                                    <Link to={`/tasks/${task.id}`} className="text-xs text-neon-cyan hover:underline">View</Link>
                                                                    <div className="ml-2 inline-flex items-center gap-1 text-xs text-text-secondary">
                                                                        <Tag className="w-3 h-3" />
                                                                        <span>{task.priority}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div key={idx} className="cyber-card task-card p-4">
                                                        <div className="h-4 bg-white/5 rounded w-3/4 mb-2" />
                                                        <div className="h-3 bg-white/5 rounded w-1/2" />
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    </div>

                                    {/* In Progress Column */}
                                    <div className="md:border-r md:border-white/10 md:pr-4 flex flex-col h-full" style={{ minHeight: 0 }}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <Wrench className="w-5 h-5 text-neon-magenta" />
                                                <div className="font-mono text-sm font-bold text-white uppercase tracking-wider">IN PROGRESS</div>
                                            </div>
                                            <div className="text-xs text-text-muted">{(loading ? 0 : visibleByStatus.in_progress.length)}</div>
                                        </div>
                                        <div className="space-y-3 overflow-auto flex-1 task-scroll" style={{ maxHeight: 'calc(72vh - 6rem)' }}>
                                            {(loading ? Array.from({ length: 3 }) : visibleByStatus.in_progress).map((task, idx) => (
                                                task ? (
                                                    <div key={task.id} className="cyber-card task-card p-4">
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex-1">
                                                                <div className="font-bold text-white">{task.title}</div>
                                                                <div className="text-text-secondary text-sm line-clamp-2">{task.description}</div>
                                                                <div className="mt-2 text-xs text-text-muted">Claimed by: {task.claimed_by ? (profiles[task.claimed_by]?.username || task.claimed_by) : 'Unclaimed'}</div>
                                                                <div className="mt-3 flex items-center gap-2">
                                                                    <Link to={`/tasks/${task.id}`} className="text-xs text-neon-cyan hover:underline">View</Link>
                                                                    <button className="text-xs px-2 py-1 border border-white/10 rounded hover:bg-white/5">Comment</button>
                                                                    <div className="ml-2 inline-flex items-center gap-1 text-xs text-text-secondary">
                                                                        <Calendar className="w-3 h-3" />
                                                                        <span>{task.updated_at ? new Date(task.updated_at).toLocaleDateString() : ''}</span>
                                                                    </div>
                                                                    <div className="ml-2 inline-flex items-center gap-1 text-xs text-text-secondary">
                                                                        <Star className="w-3 h-3" />
                                                                        <span>{task.progress || 0}%</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div key={idx} className="cyber-card task-card p-4">
                                                        <div className="h-4 bg-white/5 rounded w-3/4 mb-2" />
                                                        <div className="h-3 bg-white/5 rounded w-1/2" />
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    </div>

                                    {/* Completed Column */}
                                    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <CheckSquare className="w-5 h-5 text-green-400" />
                                                <div className="font-mono text-sm font-bold text-white uppercase tracking-wider">COMPLETED</div>
                                            </div>
                                            <div className="text-xs text-text-muted">{(loading ? 0 : visibleByStatus.completed.length)}</div>
                                        </div>
                                        <div className="space-y-3 overflow-auto flex-1 task-scroll" style={{ maxHeight: 'calc(72vh - 6rem)', minHeight: 0 }}>
                                            {(loading ? Array.from({ length: 3 }) : visibleByStatus.completed).map((task, idx) => (
                                                task ? (
                                                    <div key={task.id} className="cyber-card task-card p-4">
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex-1">
                                                                <div className="font-bold text-white">{task.title}</div>
                                                                <div className="text-text-secondary text-sm line-clamp-2">{task.description}</div>
                                                                <div className="mt-2 text-xs text-text-muted">Completed by: {task.claimed_by ? (profiles[task.claimed_by]?.username || task.claimed_by) : '—'}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div key={idx} className="cyber-card task-card p-4">
                                                        <div className="h-4 bg-white/5 rounded w-3/4 mb-2" />
                                                        <div className="h-3 bg-white/5 rounded w-1/2" />
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                // Single-category view: distribute matching tasks evenly across 3 columns
                                (() => {
                                    let filtered = [];
                                    if (activeFilter === 'unclaimed') filtered = visibleTasks.filter(t => !t.claimed_by);
                                    if (activeFilter === 'in_progress') filtered = visibleTasks.filter(t => t.status === 'in_progress' || t.status === 'claimed');
                                    if (activeFilter === 'completed') filtered = visibleTasks.filter(t => t.status === 'done' || t.status === 'completed');
                                    const cols = distributeIntoColumns(filtered, 3);
                                    return cols.map((col, ci) => (
                                        <div key={`col-${ci}`} className="flex flex-col h-full">
                                            <div className="overflow-auto flex-1 space-y-3 task-scroll" style={{ maxHeight: 'calc(72vh - 6rem)', minHeight: 0 }}>
                                                {col.map(task => (
                                                    <div key={task.id} className="cyber-card task-card p-4">
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex-1">
                                                                <div className="font-bold text-white">{task.title}</div>
                                                                <div className="text-text-secondary text-sm line-clamp-2">{task.description}</div>
                                                                <div className="mt-3 flex items-center gap-2">
                                                                    {!task.claimed_by && <button onClick={() => claimTask(task.id)} className="text-xs px-2 py-1 border border-white/10 rounded hover:bg-white/5">Claim</button>}
                                                                    <Link to={`/tasks/${task.id}`} className="text-xs text-neon-cyan hover:underline">View</Link>
                                                                    <div className="ml-2 inline-flex items-center gap-1 text-xs text-text-secondary">
                                                                        <Tag className="w-3 h-3" />
                                                                        <span>{task.priority}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ));
                                })()
                            )}
                        </div>
                        </div>
                    </div>
                </div>

                {/* Recent Activity and Volunteer Shoutouts below the task board */}
                <div className="grid md:grid-cols-2 gap-6 mb-10">
                    <div>
                        <div className="cyber-card p-4" style={{ height: '42vh', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                            <div className="section-header mb-2">Recent Activity</div>
                            <div className="flex-1 overflow-auto task-scroll" style={{ minHeight: 0 }}>
                                <div className="space-y-3">
                                    {recentActivity.length === 0 ? (
                                        <div className="cyber-card p-4">No recent activity.</div>
                                    ) : recentActivity.map((a, i) => (
                                        <div key={i} className="cyber-card p-3 flex items-start gap-3">
                                            {a.user_id ? (
                                                profiles[a.user_id] ? (
                                                    profiles[a.user_id].avatar_url ? <img src={profiles[a.user_id].avatar_url} className="w-10 h-10 rounded-full" alt="" /> : <div className="w-10 h-10 rounded-full bg-white/10" />
                                                ) : <div className="w-10 h-10 rounded-full bg-white/10" />
                                            ) : <div className="w-10 h-10 rounded-full bg-white/10" />}
                                            <div className="flex-1">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <div className="text-sm text-white font-bold">{a.title || a.name || a.description || 'Activity'}</div>
                                                        <div className="text-xs text-neon-cyan mt-1">{a.user_id ? (profiles[a.user_id]?.username || a.user_id) : 'System'}</div>
                                                    </div>
                                                    <div className="text-xs text-text-muted ml-4">{new Date(a.updated_at || a.created_at || Date.now()).toLocaleString()}</div>
                                                </div>
                                                <div className="text-xs text-text-secondary mt-2">{a.summary || a.description || ''}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <div className="cyber-card p-4" style={{ height: '42vh', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                            <div className="section-header mb-2">Volunteer Shoutouts</div>
                            <div className="flex-1 overflow-auto task-scroll" style={{ minHeight: 0 }}>
                                <div className="space-y-3">
                                    {topContributors.length === 0 ? (
                                        <div className="cyber-card p-4">No shoutouts yet.</div>
                                    ) : topContributors.map(tc => (
                                        <div key={tc.id} className="cyber-card p-3 flex items-center gap-3">
                                            {tc.profile && tc.profile.avatar_url ? <img src={tc.profile.avatar_url} className="w-10 h-10 rounded-full" alt="" /> : <div className="w-10 h-10 rounded-full bg-white/10" />}
                                            <div>
                                                <div className="text-sm text-white font-bold">{(tc.profile && tc.profile.username) || tc.id}</div>
                                                <div className="text-xs text-text-secondary">Completed {tc.count} task{tc.count !== 1 ? 's' : ''}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Phase hubs */}
                <div className="mt-8">
                    <div className="section-header">Phase Hubs</div>
                    <div className="grid md:grid-cols-3 gap-6 mt-4">
                        <Link to="/projects/early" className="cyber-card p-6 hover:border-neon-cyan/40"> 
                            <div className="font-mono text-xs text-text-muted">EARLY GAME</div>
                            <h3 className="text-lg font-bold text-white mt-1">Early Game Projects</h3>
                            <p className="text-text-secondary mt-2">Hub for current and planned early game projects and hubs for volunteers.</p>
                        </Link>
                        <Link to="/projects/mid" className="cyber-card p-6 hover:border-neon-cyan/40"> 
                            <div className="font-mono text-xs text-text-muted">MID GAME</div>
                            <h3 className="text-lg font-bold text-white mt-1">Mid Game</h3>
                            <p className="text-text-secondary mt-2">Future hub for mid game initiatives.</p>
                        </Link>
                        <Link to="/projects/late" className="cyber-card p-6 hover:border-neon-cyan/40"> 
                            <div className="font-mono text-xs text-text-muted">LATE GAME</div>
                            <h3 className="text-lg font-bold text-white mt-1">Late Game</h3>
                            <p className="text-text-secondary mt-2">Future hub for late game scale and polish efforts.</p>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Projects;