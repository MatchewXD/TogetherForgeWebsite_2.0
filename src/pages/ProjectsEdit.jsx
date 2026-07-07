import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useIsModerator } from '../hooks/useIsModerator';

const emptyProject = { id: '', title: '', description: '', status: 'todo', phase: 'early' };

const ProjectsEdit = () => {
    const { isModerator, loading: roleLoading } = useIsModerator();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyProject);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('phase_games').select('*').order('phase');
            if (!error && data) setProjects(data);
            else setProjects([]);
        } catch {
            setProjects([]);
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    if (roleLoading) return <div className="pt-20 p-8">Checking permissions…</div>;
    if (!isModerator) {
        return (
            <div className="pt-20 p-8">
                <div className="cyber-card p-6 text-center text-text-secondary">Access denied. Moderator role required.</div>
                <Link to="/projects" className="inline-block mt-4 text-neon-cyan">← Back to Projects</Link>
            </div>
        );
    }

    const startEdit = (p) => {
        setEditing(p.id);
        setForm({ ...p });
    };

    const startNew = () => {
        setEditing('new');
        setForm({ ...emptyProject, id: 'p' + Date.now() });
    };

    const cancel = () => {
        setEditing(null);
        setForm(emptyProject);
    };

    const save = async () => {
        if (!form.id || !form.title) return;
        setSaving(true);
        try {
            const payload = {
                id: form.id,
                title: form.title,
                description: form.description || null,
                status: form.status,
                phase: form.phase
            };
            const { error } = await supabase.from('phase_games').upsert(payload, { onConflict: 'id' });
            if (!error) {
                await load();
                cancel();
            }
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id) => {
        if (!confirm('Delete this project?')) return;
        await supabase.from('phase_games').delete().eq('id', id);
        await load();
    };

    return (
        <div className="pt-20 min-h-screen">
            <div className="container-custom py-12">
                <Link to="/projects" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO PROJECTS
                </Link>

                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="section-header">OFFICIAL PROJECTS</div>
                        <h1 className="text-4xl font-bold tracking-tight text-white">Edit Projects</h1>
                    </div>
                    <button onClick={startNew} className="btn-primary inline-flex items-center gap-2"><Plus className="w-4 h-4" /> New Project</button>
                </div>

                {loading ? (
                    <div className="cyber-card p-6 text-text-secondary">Loading…</div>
                ) : (
                    <div className="space-y-4">
                        {projects.length === 0 && <div className="text-text-secondary">No projects yet. Create one above.</div>}

                        {projects.map(p => (
                            <div key={p.id} className="cyber-card p-4">
                                {editing === p.id ? (
                                    <div className="space-y-3">
                                        <input className="w-full bg-cyber-surface border border-white/10 px-3 py-2 rounded text-white" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title" />
                                        <textarea className="w-full bg-cyber-surface border border-white/10 px-3 py-2 rounded text-white h-24" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" />
                                        <div className="flex gap-3">
                                            <select className="bg-cyber-surface border border-white/10 px-3 py-2 rounded text-white" value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })}>
                                                <option value="early">Early</option>
                                                <option value="mid">Mid</option>
                                                <option value="late">Late</option>
                                            </select>
                                            <select className="bg-cyber-surface border border-white/10 px-3 py-2 rounded text-white" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                                <option value="todo">Planned</option>
                                                <option value="in_progress">In Development</option>
                                                <option value="completed">Completed</option>
                                            </select>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2"><Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save'}</button>
                                            <button onClick={cancel} className="btn-neon">Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="font-bold text-white">{p.title} <span className="text-xs text-text-muted">({p.phase})</span></div>
                                            <div className="text-text-secondary text-sm mt-1">{p.description}</div>
                                            <div className="text-xs text-text-muted mt-2">Status: {p.status}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => startEdit(p)} className="text-xs px-3 py-1 border border-white/20 rounded hover:border-neon-cyan text-neon-cyan">Edit</button>
                                            <button onClick={() => remove(p.id)} className="text-xs px-3 py-1 border border-white/20 rounded hover:border-red-400 text-red-400">Delete</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {editing === 'new' && (
                            <div className="cyber-card p-4 space-y-3">
                                <input className="w-full bg-cyber-surface border border-white/10 px-3 py-2 rounded text-white" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title" />
                                <textarea className="w-full bg-cyber-surface border border-white/10 px-3 py-2 rounded text-white h-24" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" />
                                <div className="flex gap-3">
                                    <select className="bg-cyber-surface border border-white/10 px-3 py-2 rounded text-white" value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })}>
                                        <option value="early">Early</option>
                                        <option value="mid">Mid</option>
                                        <option value="late">Late</option>
                                    </select>
                                    <select className="bg-cyber-surface border border-white/10 px-3 py-2 rounded text-white" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                        <option value="todo">Planned</option>
                                        <option value="in_progress">In Development</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2"><Save className="w-4 h-4" />{saving ? 'Saving…' : 'Create'}</button>
                                    <button onClick={cancel} className="btn-neon">Cancel</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectsEdit;