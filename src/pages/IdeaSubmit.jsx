import { useMemo, useState } from 'react';
import { ArrowLeft, Send, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ideasService } from '../services/ideasService';

const IdeaSubmit = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // project slug or id from /ideas/submit?project=prototype-systems
    const linkedProjectId = useMemo(() => {
        const raw = searchParams.get('project');
        return raw ? String(raw).trim() : null;
    }, [searchParams]);

    const [formData, setFormData] = useState({
        title: '',
        category: '',
        summary: '',
        description: '',
        inspiration: '',
        tags: '',
        features: [{ name: '', description: '' }],
        multiplayerType: '',
        twitchIntegration: '',
        visualStyle: '',
        environmentalStorytelling: '',
        enemies: [{ name: '', description: '' }],
        progressionType: '',
        progressionDetails: '',
        economyResource: '',
        economyTrading: '',
        hasMainStory: false,
        storyOverview: '',
        hasEndgame: false,
        endgameDetails: '',
        additionalNotes: [''],
    });
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const addFeature = () => {
        if (formData.features.length >= 15) return;
        setFormData({
            ...formData,
            features: [...formData.features, { name: '', description: '' }]
        });
    };

    const removeFeature = (index) => {
        const newFeatures = formData.features.filter((_, i) => i !== index);
        setFormData({ ...formData, features: newFeatures });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');

        if (submitting) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            setMessage('You must be logged in to submit an idea.');
            return;
        }

        if (!(formData.title || '').trim()) {
            setMessage('Title is required.');
            return;
        }
        if (!(formData.category || '').trim()) {
            setMessage('Category is required.');
            return;
        }
        if (!(formData.summary || '').trim()) {
            setMessage('Short summary is required.');
            return;
        }

        // Deduplicate tags
        const uniqueTags = [...new Set((formData.tags || '').split(',').map(t => t.trim()).filter(Boolean))].join(', ');

        // Schema-safe payload (ideasService maps extras → real columns)
        const newIdea = {
            title: formData.title.trim(),
            summary: formData.summary.trim(),
            category: formData.category || 'Idea',
            votes: 0,
            description: formData.description,
            tags: uniqueTags,
            inspiration: formData.inspiration,
            twitchIntegration: formData.twitchIntegration,
            multiplayerType: formData.multiplayerType,
            visualStyle: formData.visualStyle,
            environmentalStorytelling: formData.environmentalStorytelling,
            progressionType: formData.progressionType,
            progressionDetails: formData.progressionDetails,
            economyResource: formData.economyResource,
            economyTrading: formData.economyTrading,
            storyOverview: formData.storyOverview,
            endgameDetails: formData.endgameDetails,
            // Persist features/enemies/notes as text via additional_notes mapping
            additionalNotes: [
                ...(formData.features || [])
                    .filter((f) => f.name || f.description)
                    .map((f) => `Feature — ${f.name}: ${f.description}`),
                ...(formData.enemies || [])
                    .filter((en) => en.name || en.description)
                    .map((en) => `Enemy — ${en.name}: ${en.description}`),
                ...(formData.additionalNotes || []).filter(Boolean),
            ],
            user_id: session.user.id,
            // Link to project workspace when submitted via ?project=
            ...(linkedProjectId ? { project_id: linkedProjectId } : {}),
        };

        setSubmitting(true);
        try {
            const data = await ideasService.createIdea(newIdea);
            if (!data?.id) {
                throw new Error('Idea was created but no id was returned.');
            }

            if (data._project_id_not_persisted && linkedProjectId) {
                // Column missing in DB — still navigate, but warn briefly via query
                navigate(
                    `/projects/${linkedProjectId}#project-ideas`,
                    { replace: true, state: { ideaSavedWithoutProjectId: true, ideaId: data.id } }
                );
                return;
            }

            if (linkedProjectId) {
                navigate(`/projects/${linkedProjectId}#project-ideas`, {
                    replace: true,
                    state: { newIdeaId: data.id },
                });
            } else {
                navigate(`/ideas/${data.id}`, { replace: true });
            }
        } catch (err) {
            console.error('[IdeaSubmit] create failed', err);
            setMessage(
                'Error submitting idea: ' +
                    (err?.message || err?.error_description || 'Unknown error')
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="pt-20 min-h-screen">
            <div className="container-custom py-12 max-w-4xl">
                <Link to="/ideas" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO IDEAS
                </Link>

                <div>
                    <div className="section-header">SUBMIT IDEA</div>
                    <h1 className="text-5xl font-bold tracking-tight text-white mb-4">Share your vision with the Forge</h1>
                    {linkedProjectId ? (
                        <p className="text-text-secondary mb-12 text-sm font-mono">
                            Linked to project{' '}
                            <span className="text-neon-cyan">{linkedProjectId}</span>
                            {' — '}this idea will show on that project&apos;s board.
                        </p>
                    ) : (
                        <div className="mb-12" />
                    )}
                </div>

                {message && (
                    <div
                        role="alert"
                        className="mb-6 rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-100"
                    >
                        {message}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="static-card p-10 space-y-12">
                    {/* 1. Basic Information */}
                    <div className="space-y-8">
                        <div>
                            <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">TITLE *</label>
                            <input type="text" required maxLength={100} placeholder="Starbound Colony" className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                            <p className="text-xs text-text-muted mt-1">Short, catchy name. Max 100 characters.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">CATEGORY *</label>
                            <select required className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                <option value="">Select a category...</option>
                                <option value="Full Game Idea">Full Game Idea</option>
                                <option value="Game Mechanic">Game Mechanic</option>
                                <option value="Setting / Story / Lore">Setting / Story / Lore</option>
                                <option value="Art / Visual Design">Art / Visual Design</option>
                                <option value="Audio / Sound / Music">Audio / Sound / Music</option>
                                <option value="Multiplayer / Cooperative Systems">Multiplayer / Cooperative Systems</option>
                                <option value="Twitch / Streamer Integration">Twitch / Streamer Integration</option>
                                <option value="Progression / Economy / Crafting">Progression / Economy / Crafting</option>
                                <option value="Enemy / AI / Combat">Enemy / AI / Combat</option>
                                <option value="World Building / Environment">World Building / Environment</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">SHORT SUMMARY *</label>
                            <input type="text" required maxLength={300} placeholder="A co-op strategy game where Twitch viewers vote on resource allocation." className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none" value={formData.summary} onChange={e => setFormData({ ...formData, summary: e.target.value })} />
                            <p className="text-xs text-text-muted mt-1">1–3 sentences. Max 300 characters.</p>
                        </div>

                       


                    </div>

                    {/* 2. Detailed Description */}
                    <div className="space-y-8 pt-6 border-t border-white/10">
                        <div>
                            <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">DETAILED DESCRIPTION</label>
                            <textarea rows={6} maxLength={4000} className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none" placeholder="Expand on gameplay, mechanics, story..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            <p className="text-xs text-text-muted mt-1">Max 4000 characters. Highlight what makes it unique.</p>
                        </div>
                    </div>

                    {/* 3. Key Features (collapsible + dynamic) */}
                    <div className="space-y-4 pt-6 border-t border-white/10">
                        <div className="text-base text-text-secondary mb-2">
                            <span className="font-semibold text-white">Key Features</span> (Recommended for Full Games &amp; Mechanics)<br />
                            Max 15 features. Soft recommendation: 8–10. Each description max 800 characters.
                        </div>
                        <button
                            type="button"
                            onClick={() => setFormData(f => ({ ...f, __open_keyFeatures: !f.__open_keyFeatures }))}
                            className="text-left w-full flex items-center justify-between px-4 py-2 border border-white/20 rounded hover:bg-white/5"
                        >
                            <span>Key Features</span>
                            <span className="text-xs text-text-muted">Core gameplay systems {formData.__open_keyFeatures ? '−' : '+'}</span>
                        </button>
                        {formData.__open_keyFeatures && (
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs text-text-muted">Add or remove as many as needed</span>
                                    <button type="button" onClick={addFeature} disabled={formData.features.length >= 15} className="text-neon-cyan hover:text-white flex items-center gap-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"><Plus size={16} /> Add Feature</button>
                                </div>
                                <div className="mb-3 text-sm text-text-secondary">
                                    <span className="font-medium text-white">Feature Name</span> – Short title<br />
                                    <span className="font-medium text-white">Description</span> – Max 800 characters
                                </div>
                                {formData.features.map((feature, index) => (
                                    <div key={index} className="border border-white/20 p-6 mb-4 rounded">
                                        <div className="flex gap-4">
                                            <input type="text" placeholder="Feature Name" className="flex-1 bg-cyber-surface border border-white/20 p-4 text-white" value={feature.name} onChange={e => {
                                                const nf = [...formData.features]; nf[index].name = e.target.value; setFormData({ ...formData, features: nf });
                                            }} />
                                            <button type="button" onClick={() => removeFeature(index)} className="text-red-400 hover:text-red-500"><Trash2 size={20} /></button>
                                        </div>
                                        <textarea placeholder="Description..." rows={3} maxLength={800} className="w-full mt-4 bg-cyber-surface border border-white/20 p-4 text-white" value={feature.description} onChange={e => {
                                            const nf = [...formData.features]; nf[index].description = e.target.value; setFormData({ ...formData, features: nf });
                                        }} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Optional Sections */}
                    <div className="space-y-4 pt-6 border-t border-white/10 text-sm">
                        {[
                            { key: 'inspiration', label: 'Inspiration', desc: 'What inspired this idea?' },
                            { key: 'tags', label: 'Tags', desc: 'Keywords for discoverability' },
                            { key: 'multiplayerType', label: 'Multiplayer Type', desc: 'Solo, Co-op, MMO, PvP, Other' },
                            { key: 'twitchIntegration', label: 'Twitch / Community Integration', desc: 'How streamers & viewers engage' },
                            { key: 'visualStyle', label: 'Visual Style / Theme', desc: 'Pixel Art, Realistic, etc.' },
                            { key: 'environmentalStorytelling', label: 'Environmental Storytelling', desc: 'How the world conveys narrative' },
                            { key: 'enemies', label: 'Enemies', desc: 'Max 8 enemies' },
                            { key: 'progression', label: 'Progression System', desc: 'Type and details' },
                            { key: 'economy', label: 'Economy System', desc: 'Resource management, trading' },
                            { key: 'story', label: 'Story & Narrative', desc: 'Main story and endgame' },
                            { key: 'notes', label: 'Additional Notes', desc: 'Max 5 notes' },
                        ].map((sec) => {
                            const isOpen = !!formData[`__open_${sec.key}`];
                            return (
                                <div key={sec.key}>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(f => ({ ...f, [`__open_${sec.key}`]: !isOpen }))}
                                        className="text-left w-full flex items-center justify-between px-4 py-2 border border-white/20 rounded hover:bg-white/5"
                                    >
                                        <span>{sec.label}</span>
                                        <span className="text-xs text-text-muted">{sec.desc} {isOpen ? '−' : '+'}</span>
                                    </button>
                                    {isOpen && (
                                        <div className="mt-2 pl-4">
                                            {sec.key === 'inspiration' && <textarea rows={3} maxLength={600} className="w-full bg-cyber-surface border border-white/20 p-4 text-white" placeholder={sec.desc} value={formData.inspiration} onChange={e => setFormData({ ...formData, inspiration: e.target.value })} />}
                                            {sec.key === 'tags' && <input type="text" maxLength={200} className="w-full bg-cyber-surface border border-white/20 p-4 text-white" placeholder="MMO, PvE, Strategy..." value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} />}
                                            {sec.key === 'multiplayerType' && <select className="w-full bg-cyber-surface border border-white/20 p-4 text-white" value={formData.multiplayerType} onChange={e => setFormData({ ...formData, multiplayerType: e.target.value })}>
                                                <option value="">Select...</option>
                                                <option value="Solo">Solo</option>
                                                <option value="Co-op">Co-op</option>
                                                <option value="MMO">MMO</option>
                                                <option value="PvP">PvP</option>
                                                <option value="Other">Other</option>
                                            </select>}
                                            {sec.key === 'twitchIntegration' && <textarea rows={3} maxLength={1500} className="w-full bg-cyber-surface border border-white/20 p-4 text-white" placeholder={sec.desc} value={formData.twitchIntegration} onChange={e => setFormData({ ...formData, twitchIntegration: e.target.value })} />}
                                            {sec.key === 'visualStyle' && <input type="text" maxLength={500} className="w-full bg-cyber-surface border border-white/20 p-4 text-white" placeholder={sec.desc} value={formData.visualStyle} onChange={e => setFormData({ ...formData, visualStyle: e.target.value })} />}
                                            {sec.key === 'environmentalStorytelling' && <textarea rows={3} maxLength={600} className="w-full bg-cyber-surface border border-white/20 p-4 text-white" placeholder={sec.desc} value={formData.environmentalStorytelling} onChange={e => setFormData({ ...formData, environmentalStorytelling: e.target.value })} />}
                                            {sec.key === 'enemies' && (
                                                <div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-xs text-text-muted">Max 8 enemies</span>
                                                        <button type="button" onClick={() => {
                                                            if (formData.enemies.length >= 8) return;
                                                            setFormData(f => ({ ...f, enemies: [...f.enemies, { name: '', description: '' }] }));
                                                        }} className="text-neon-cyan hover:text-white text-sm flex items-center gap-1"><Plus size={16} /> Add Enemy</button>
                                                    </div>
                                                    {formData.enemies.map((enemy, idx) => (
                                                        <div key={idx} className="border border-white/20 p-4 mb-3 rounded">
                                                            <div className="flex gap-4">
                                                                <input type="text" placeholder="Enemy Name" className="flex-1 bg-cyber-surface border border-white/20 p-3 text-white" value={enemy.name} onChange={e => {
                                                                    const ne = [...formData.enemies]; ne[idx].name = e.target.value; setFormData({ ...formData, enemies: ne });
                                                                }} />
                                                                <button type="button" onClick={() => setFormData(f => ({ ...f, enemies: f.enemies.filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-500"><Trash2 size={18} /></button>
                                                            </div>
                                                            <textarea placeholder="Description..." rows={3} maxLength={800} className="w-full mt-3 bg-cyber-surface border border-white/20 p-3 text-white" value={enemy.description} onChange={e => {
                                                                const ne = [...formData.enemies]; ne[idx].description = e.target.value; setFormData({ ...formData, enemies: ne });
                                                            }} />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {sec.key === 'progression' && (
                                                <div className="space-y-3">
                                                    <select className="w-full bg-cyber-surface border border-white/20 p-3 text-white" value={formData.progressionType} onChange={e => setFormData({ ...formData, progressionType: e.target.value })}>
                                                        <option value="">Select Type...</option>
                                                        <option value="Skill Trees">Skill Trees</option>
                                                        <option value="Leveling">Leveling</option>
                                                        <option value="Class-Based">Class-Based</option>
                                                        <option value="Open Progression">Open Progression</option>
                                                        <option value="Other">Other</option>
                                                    </select>
                                                    <textarea rows={4} maxLength={1000} className="w-full bg-cyber-surface border border-white/20 p-4 text-white" placeholder="Progression Details" value={formData.progressionDetails} onChange={e => setFormData({ ...formData, progressionDetails: e.target.value })} />
                                                </div>
                                            )}
                                            {sec.key === 'economy' && (
                                                <div className="space-y-3">
                                                    <textarea rows={4} maxLength={1000} className="w-full bg-cyber-surface border border-white/20 p-4 text-white" placeholder="Resource Management / Crafting" value={formData.economyResource} onChange={e => setFormData({ ...formData, economyResource: e.target.value })} />
                                                    <textarea rows={4} maxLength={800} className="w-full bg-cyber-surface border border-white/20 p-4 text-white" placeholder="Trading / Player Economy" value={formData.economyTrading} onChange={e => setFormData({ ...formData, economyTrading: e.target.value })} />
                                                </div>
                                            )}
                                            {sec.key === 'story' && (
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="flex items-center gap-2 cursor-pointer mb-1"><input type="checkbox" checked={formData.hasMainStory} onChange={e => setFormData({ ...formData, hasMainStory: e.target.checked })} /> Has a main story</label>
                                                        {formData.hasMainStory && <textarea rows={4} maxLength={2000} className="w-full bg-cyber-surface border border-white/20 p-4 text-white" placeholder="Main Story Overview" value={formData.storyOverview} onChange={e => setFormData({ ...formData, storyOverview: e.target.value })} />}
                                                    </div>
                                                    <div>
                                                        <label className="flex items-center gap-2 cursor-pointer mb-1"><input type="checkbox" checked={formData.hasEndgame} onChange={e => setFormData({ ...formData, hasEndgame: e.target.checked })} /> Has Endgame / Sequel Potential</label>
                                                        {formData.hasEndgame && <textarea rows={4} maxLength={1000} className="w-full bg-cyber-surface border border-white/20 p-4 text-white" placeholder="Endgame Details" value={formData.endgameDetails} onChange={e => setFormData({ ...formData, endgameDetails: e.target.value })} />}
                                                    </div>
                                                </div>
                                            )}
                                            {sec.key === 'notes' && (
                                                <div>
                                                    {formData.additionalNotes.map((note, idx) => (
                                                        <div key={idx} className="flex gap-2 mb-2">
                                                            <textarea rows={3} maxLength={1000} className="flex-1 bg-cyber-surface border border-white/20 p-4 text-white" placeholder="Additional note" value={note} onChange={e => {
                                                                const na = [...formData.additionalNotes]; na[idx] = e.target.value; setFormData({ ...formData, additionalNotes: na });
                                                            }} />
                                                            <button type="button" onClick={() => setFormData(f => ({ ...f, additionalNotes: f.additionalNotes.filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-500"><Trash2 size={18} /></button>
                                                        </div>
                                                    ))}
                                                    <button type="button" onClick={() => {
                                                        if (formData.additionalNotes.length >= 5) return;
                                                        setFormData(f => ({ ...f, additionalNotes: [...f.additionalNotes, ''] }));
                                                    }} className="text-neon-cyan hover:text-white text-sm flex items-center gap-1"><Plus size={16} /> Add Note</button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>



                    <button
                        type="submit"
                        disabled={submitting}
                        className="btn-primary btn-neon w-full py-5 text-lg flex items-center justify-center gap-3 mt-8 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <Send className="w-5 h-5" />
                        {submitting ? 'SUBMITTING…' : 'SUBMIT TO THE FORGE'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default IdeaSubmit;