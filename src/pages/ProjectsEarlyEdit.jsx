import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useIsModerator } from '../hooks/useIsModerator';

const DEFAULT_CONTENT = {
    heroTitle: 'Early Game Project Hub',
    heroSubtitle: 'Early Game (Proof of Concept)\nA small, focused multiplayer game that promotes teamwork and cooperation. The primary goal is to test and refine our community development systems (task management, volunteering, crediting, feedback loops). It should be relatively quick to make while still being genuinely fun and multiplayer.',
    goals: `- Test and prove our community-driven development model works.
- Build and refine core cooperation and teamwork mechanics.
- Create a genuinely fun experience that brings players together.
- Establish transparent systems for volunteering, task tracking, and crediting contributors.
- Gather real community feedback to improve future projects.

Success metric: Strong community engagement during development + positive feedback on cooperative gameplay.`,
    aboutText: 'Early Game is the foundation of Together Forge. We intentionally start small so we can focus on what matters most: building fun cooperative mechanics and proving that a transparent, community-supported development process can create great games.',
    howToHelp: `- Submit game concepts, mechanics, or ideas through the Game Ideas page.
- Volunteer your skills (development, art, design, testing, writing, moderation, etc.).
- Help test prototypes and give honest feedback on what feels fun.
- Join discussions on existing ideas to help refine them.
- Share the project with streamers, communities, and other creators.
- Support the Forge through donations to help fund development tools and time.`,
    targetStyle: `We are looking for small, focused multiplayer games that emphasize cooperation and teamwork.

**Examples of the kind of games we want to make:**
- Cooperative survival challenges (inspired by Lethal Company or PlateUp!)
- Shared vehicle/mech operation or crew-based gameplay
- Simple team-based exploration, building, and defense
- Light resource management with clear role differentiation in short sessions`
};

const ProjectsEarlyEdit = () => {
    const { isModerator, loading: roleLoading } = useIsModerator();
    const navigate = useNavigate();
    const [content, setContent] = useState(DEFAULT_CONTENT);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await supabase.from('page_content').select('content').eq('page_key', 'early_game').single();
            if (data?.content) {
                let loaded = { ...DEFAULT_CONTENT, ...data.content };
                // Normalize goals: convert old array format to markdown string and strip HTML
                if (Array.isArray(loaded.goals)) {
                    loaded.goals = loaded.goals.map(g => `- ${g}`).join('\n');
                } else if (typeof loaded.goals === 'string') {
                    let g = loaded.goals
                        .replace(/<small>(.*?)<\/small>/gi, '_$1_')
                        .replace(/<[^>]*>/g, '');
                    g = g.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');
                    loaded.goals = g;
                } else {
                    loaded.goals = DEFAULT_CONTENT.goals;
                }
                setContent(loaded);
            }
        } catch {
            // fall back to defaults
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    if (roleLoading) return <div className="pt-20 p-8">Checking permissions…</div>;
    if (!isModerator) {
        return (
            <div className="pt-20 p-8">
                <div className="cyber-card p-6 text-center text-text-secondary">Access denied. Moderator role required.</div>
                <Link to="/projects/early" className="inline-block mt-4 text-neon-cyan">← Back to Early Game</Link>
            </div>
        );
    }

    const updateField = (key, value) => setContent(prev => ({ ...prev, [key]: value }));

    const save = async () => {
        setSaving(true);
        try {
            const { error } = await supabase.from('page_content').upsert({ page_key: 'early_game', content }, { onConflict: 'page_key' });
            if (error) {
                console.error('Failed to save page content:', error);
                alert('Failed to save changes. Check console for details.');
            } else {
                navigate('/projects/early');
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="pt-20 min-h-screen bg-red-900/10">
            <div className="container-custom py-12">
                <Link to="/projects/early" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO EARLY GAME
                </Link>

                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="section-header">EARLY GAME</div>
                        <h1 className="text-4xl font-bold tracking-tight text-white">Edit Page Content</h1>
                    </div>
                    <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2"><Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save Changes'}</button>
                </div>

                {loading ? (
                    <div className="cyber-card p-6">Loading…</div>
                ) : (
                    <div className="space-y-8">
                        {/* Hero */}
                        <div className="cyber-card p-6">
                            <div className="section-header mb-4">Hero</div>
                            <input className="w-full bg-cyber-surface border border-white/10 px-3 py-2 rounded text-white mb-3" value={content.heroTitle} onChange={e => updateField('heroTitle', e.target.value)} />
                            <textarea className="w-full bg-cyber-surface border border-white/10 px-3 py-2 rounded text-white h-20" value={content.heroSubtitle} onChange={e => updateField('heroSubtitle', e.target.value)} />
                        </div>

                        {/* Goals */}
                        <div className="cyber-card p-6">
                            <div className="section-header mb-4">Early Game Goals</div>
                            <textarea
                                className="w-full bg-cyber-surface border border-white/10 px-3 py-2 rounded text-white h-40 font-mono text-sm"
                                value={content.goals}
                                onChange={e => updateField('goals', e.target.value)}
                                placeholder="Enter goals in markdown (use - for bullets)"
                            />
                            <p className="text-xs text-text-muted mt-2">Supports markdown. Use `- ` for bullet points.</p>
                        </div>

                        {/* About */}
                        <div className="cyber-card p-6">
                            <div className="section-header mb-4">About Early Game</div>
                            <textarea className="w-full bg-cyber-surface border border-white/10 px-3 py-2 rounded text-white h-28" value={content.aboutText} onChange={e => updateField('aboutText', e.target.value)} />
                        </div>

                        {/* Target Style */}
                        <div className="cyber-card p-6">
                            <div className="section-header mb-4">Target Style for Early Game Projects</div>
                            <textarea
                                className="w-full bg-cyber-surface border border-white/10 px-3 py-2 rounded text-white h-40 font-mono text-sm"
                                value={content.targetStyle || ''}
                                onChange={e => updateField('targetStyle', e.target.value)}
                            />
                        </div>

                        {/* How to Help */}
                        <div className="cyber-card p-6">
                            <div className="section-header mb-4">How to Help</div>
                            <textarea
                                className="w-full bg-cyber-surface border border-white/10 px-3 py-2 rounded text-white h-40 font-mono text-sm"
                                value={content.howToHelp}
                                onChange={e => updateField('howToHelp', e.target.value)}
                                placeholder="Enter how to help in markdown (use - for bullets)"
                            />
                            <p className="text-xs text-text-muted mt-2">Supports markdown. Use `- ` for bullet points.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectsEarlyEdit;