import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const IdeaEdit = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                navigate('/ideas');
                return;
            }
            setUser(session.user);

            const { data, error } = await supabase.from('ideas').select('*').eq('id', id).single();
            if (error || !data) {
                navigate('/ideas');
                return;
            }
            if (data.user_id && data.user_id !== session.user.id) {
                navigate(`/ideas/${id}`);
                return;
            }

            let parsedFeatures = [{ name: '', description: '' }];
            if (data.features) {
                try {
                    const f = typeof data.features === 'string' ? JSON.parse(data.features) : data.features;
                    if (Array.isArray(f) && f.length) parsedFeatures = f;
                } catch { /* ignore */ }
            }
            let parsedNotes = [''];
            if (data.additional_notes) {
                try {
                    const n = typeof data.additional_notes === 'string' ? JSON.parse(data.additional_notes) : data.additional_notes;
                    if (Array.isArray(n) && n.length) parsedNotes = n;
                } catch { /* ignore */ }
            }
            let parsedEnemies = [{ name: '', description: '' }];
            if (data.enemies) {
                try {
                    const en = typeof data.enemies === 'string' ? JSON.parse(data.enemies) : data.enemies;
                    if (Array.isArray(en) && en.length) parsedEnemies = en;
                } catch { /* ignore */ }
            }

            setFormData({
                title: data.title || '',
                category: data.category || '',
                summary: data.summary || '',
                description: data.description || '',
                inspiration: data.inspiration || '',
                tags: data.tags || '',
                features: parsedFeatures,
                multiplayerType: data.multiplayer_type || '',
                twitchIntegration: data.twitch_integration || '',
                visualStyle: data.visual_style || '',
                environmentalStorytelling: data.environmental_storytelling || '',
                enemies: parsedEnemies,
                progressionType: data.progression_type || '',
                progressionDetails: data.progression_details || '',
                economyResource: data.economy_resource || '',
                economyTrading: data.economy_trading || '',
                hasMainStory: !!data.has_main_story,
                storyOverview: data.story_overview || '',
                hasEndgame: !!data.has_endgame,
                endgameDetails: data.endgame_details || '',
                additionalNotes: parsedNotes,
            });
            setLoading(false);
        };
        init();
    }, [id, navigate]);

    const addFeature = () => {
        if ((formData.features || []).length >= 15) return;
        setFormData(f => ({ ...f, features: [...(f.features || []), { name: '', description: '' }] }));
    };
    const removeFeature = (idx) => setFormData(f => ({ ...f, features: (f.features || []).filter((_, i) => i !== idx) }));

    const handleSave = async (e) => {
        e.preventDefault();
        if (!user) return;
        setSaving(true);
        const ideaIdNum = Number(id);
        const uniqueTags = [...new Set((formData.tags || '').split(',').map(t => t.trim()).filter(Boolean))].join(', ');
        const { data, error } = await supabase.from('ideas').update({
            title: formData.title,
            category: formData.category,
            summary: formData.summary,
            description: formData.description,
            inspiration: formData.inspiration,
            tags: uniqueTags,
            features: formData.features,
            twitch_integration: formData.twitchIntegration,
            multiplayer_type: formData.multiplayerType,
            visual_style: formData.visualStyle,
            environmental_storytelling: formData.environmentalStorytelling,
            enemies: formData.enemies,
            progression_type: formData.progressionType,
            progression_details: formData.progressionDetails,
            economy_resource: formData.economyResource,
            economy_trading: formData.economyTrading,
            has_main_story: formData.hasMainStory,
            story_overview: formData.storyOverview,
            has_endgame: formData.hasEndgame,
            endgame_details: formData.endgameDetails,
            additional_notes: formData.additionalNotes,
        }).eq('id', ideaIdNum).select();

        if (error) {
            setMessage('Update failed: ' + error.message);
            setSaving(false);
            return;
        }
        if (!data || data.length === 0) {
            setMessage('Update did not apply. You may not have permission to edit this idea (RLS policy or missing user_id on the row).');
            setSaving(false);
            return;
        }
        navigate(`/ideas/${id}`);
    };

    if (loading) return <div className="pt-20 text-center">Loading...</div>;

    return (
        <div className="pt-20 min-h-screen">
            <div className="container-custom py-12 max-w-4xl">
                <Link to={`/ideas/${id}`} className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO IDEA
                </Link>

                <div>
                    <div className="section-header">EDIT IDEA</div>
                    <h1 className="text-5xl font-bold tracking-tight text-white mb-12">Update your idea</h1>
                </div>

                <form onSubmit={handleSave} className="static-card p-10 space-y-12">
                    {/* Basic Information */}
                    <div className="space-y-8">
                        <div>
                            <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">TITLE *</label>
                            <input type="text" required maxLength={100} className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
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
                            <input type="text" required maxLength={300} className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none" value={formData.summary} onChange={e => setFormData({ ...formData, summary: e.target.value })} />
                        </div>
                    </div>

                    {/* Detailed Description */}
                    <div className="space-y-8 pt-6 border-t border-white/10">
                        <div>
                            <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">DETAILED DESCRIPTION</label>
                            <textarea rows={6} maxLength={4000} className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                        </div>
                    </div>

                    {/* Key Features (collapsible + dynamic) */}
                    <div className="space-y-4 pt-6 border-t border-white/10">
                        <div className="text-base text-text-secondary mb-2">
                            <span className="font-semibold text-white">Key Features</span> (Recommended for Full Games &amp; Mechanics)<br />
                            Describe the core gameplay systems and standout elements of your idea.<br />
                            <span className="text-xs">Max 15 features. Soft recommendation: 8–10. Each description max 800 characters.</span>
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
                                    <button type="button" onClick={addFeature} disabled={(formData.features || []).length >= 15} className="text-neon-cyan hover:text-white flex items-center gap-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"><Plus size={16} /> Add Feature</button>
                                </div>
                                <div className="mb-3 text-sm text-text-secondary">
                                    <span className="font-medium text-white">Feature Name</span> – Short title<br />
                                    <span className="font-medium text-white">Description</span> – Max 800 characters
                                </div>
                                {(formData.features || []).map((f, idx) => (
                                    <div key={idx} className="border border-white/20 p-6 mb-4 rounded">
                                        <div className="flex gap-4">
                                            <input type="text" placeholder="Feature Name" className="flex-1 bg-cyber-surface border border-white/20 p-4 text-white" value={f.name} onChange={e => {
                                                const nf = [...(formData.features || [])]; nf[idx].name = e.target.value; setFormData({ ...formData, features: nf });
                                            }} />
                                            <button type="button" onClick={() => removeFeature(idx)} className="text-red-400 hover:text-red-500"><Trash2 size={20} /></button>
                                        </div>
                                        <textarea placeholder="Description..." rows={3} maxLength={800} className="w-full mt-4 bg-cyber-surface border border-white/20 p-4 text-white" value={f.description} onChange={e => {
                                            const nf = [...(formData.features || [])]; nf[idx].description = e.target.value; setFormData({ ...formData, features: nf });
                                        }} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Optional Sections – collapsible */}
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
                                                            if ((formData.enemies || []).length >= 8) return;
                                                            setFormData(f => ({ ...f, enemies: [...(f.enemies || []), { name: '', description: '' }] }));
                                                        }} className="text-neon-cyan hover:text-white text-sm flex items-center gap-1"><Plus size={16} /> Add Enemy</button>
                                                    </div>
                                                    {(formData.enemies || []).map((enemy, idx) => (
                                                        <div key={idx} className="border border-white/20 p-4 mb-3 rounded">
                                                            <div className="flex gap-4">
                                                                <input type="text" placeholder="Enemy Name" className="flex-1 bg-cyber-surface border border-white/20 p-3 text-white" value={enemy.name} onChange={e => {
                                                                    const ne = [...(formData.enemies || [])]; ne[idx].name = e.target.value; setFormData({ ...formData, enemies: ne });
                                                                }} />
                                                                <button type="button" onClick={() => setFormData(f => ({ ...f, enemies: (f.enemies || []).filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-500"><Trash2 size={18} /></button>
                                                            </div>
                                                            <textarea placeholder="Description..." rows={3} maxLength={800} className="w-full mt-3 bg-cyber-surface border border-white/20 p-3 text-white" value={enemy.description} onChange={e => {
                                                                const ne = [...(formData.enemies || [])]; ne[idx].description = e.target.value; setFormData({ ...formData, enemies: ne });
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
                                                    {(formData.additionalNotes || ['']).map((note, idx) => (
                                                        <div key={idx} className="flex gap-2 mb-2">
                                                            <textarea rows={3} maxLength={1000} className="flex-1 bg-cyber-surface border border-white/20 p-4 text-white" placeholder="Additional note" value={note} onChange={e => {
                                                                const na = [...(formData.additionalNotes || [''])]; na[idx] = e.target.value; setFormData({ ...formData, additionalNotes: na });
                                                            }} />
                                                            <button type="button" onClick={() => setFormData(f => ({ ...f, additionalNotes: (f.additionalNotes || ['']).filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-500"><Trash2 size={18} /></button>
                                                        </div>
                                                    ))}
                                                    <button type="button" onClick={() => {
                                                        if ((formData.additionalNotes || []).length >= 5) return;
                                                        setFormData(f => ({ ...f, additionalNotes: [...(f.additionalNotes || []), ''] }));
                                                    }} className="text-neon-cyan hover:text-white text-sm flex items-center gap-1"><Plus size={16} /> Add Note</button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {showDeleteConfirm && (
                        <div className="mt-4 p-4 border border-red-500/50 bg-red-950/30 rounded text-sm">
                            <p className="mb-3 text-red-400">Delete this idea permanently? This cannot be undone.</p>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={async () => {
                                        setSaving(true);
                                        const { error } = await supabase.from('ideas').delete().eq('id', Number(id));
                                        setSaving(false);
                                        setShowDeleteConfirm(false);
                                        if (error) {
                                            setMessage('Delete failed: ' + error.message);
                                            console.error('Delete error (possible RLS):', error);
                                        } else {
                                            navigate('/ideas');
                                        }
                                    }}
                                    className="btn-primary bg-red-600 hover:bg-red-700 px-6 py-2"
                                >
                                    Yes, Delete
                                </button>
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="px-6 py-2 border border-white/20 hover:bg-white/5"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-4 mt-8">
                        <button type="submit" disabled={saving} className="btn-primary btn-neon flex-1 py-5 text-lg flex items-center justify-center gap-3 disabled:opacity-60">
                            <Save className="w-5 h-5" /> {saving ? 'SAVING...' : 'SAVE CHANGES'}
                        </button>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => setShowDeleteConfirm(true)}
                            className="btn-primary bg-red-600 hover:bg-red-700 flex-1 py-5 text-lg flex items-center justify-center gap-3 disabled:opacity-60"
                        >
                            DELETE IDEA
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default IdeaEdit;
