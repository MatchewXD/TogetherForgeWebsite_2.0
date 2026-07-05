import { useState } from 'react';
import { ArrowLeft, Send, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const IdeaSubmit = () => {
    const [formData, setFormData] = useState({
        title: '',
        category: '',
        summary: '',
        description: '',
        features: [{ name: '', description: '' }],
        twitchIntegration: '',
    });

    const addFeature = () => {
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

        const newIdea = {
            title: formData.title,
            summary: formData.summary,
            category: formData.category || 'Idea',
            votes: 0,
            description: formData.description,
        };

        const { error } = await supabase.from('ideas').insert([newIdea]);
        if (error) {
            alert('Error submitting idea: ' + error.message);
            return;
        }

        alert('Idea submitted! It will now appear in the list.');
        window.location.href = '/ideas';
    };

    return (
        <div className="pt-20 min-h-screen">
            <div className="container-custom py-12 max-w-4xl">
                <Link to="/ideas" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO IDEAS
                </Link>

                <div>
                    <div className="section-header">SUBMIT IDEA</div>
                    <h1 className="text-5xl font-bold tracking-tight text-white mb-12">Share your vision with the Forge</h1>
                </div>

                <form onSubmit={handleSubmit} className="static-card p-10 space-y-10">
                    <div>
                        <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">TITLE</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">CATEGORY</label>
                        <select
                            required
                            className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none"
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        >
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
                        <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">SHORT SUMMARY</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none"
                            value={formData.summary}
                            onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">DETAILED DESCRIPTION</label>
                        <textarea
                            rows="6"
                            className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    {/* Dynamic Features */}
                    <div>
                        <div className="flex justify-between mb-4">
                            <label className="block text-sm font-mono tracking-widest text-neon-cyan">KEY FEATURES</label>
                            <button type="button" onClick={addFeature} className="text-neon-cyan hover:text-white flex items-center gap-1 text-sm">
                                <Plus size={16} /> Add Feature
                            </button>
                        </div>

                        {formData.features.map((feature, index) => (
                            <div key={index} className="border border-white/20 p-6 mb-6 rounded">
                                <div className="flex gap-4">
                                    <input
                                        type="text"
                                        placeholder="Feature Name"
                                        className="flex-1 bg-cyber-surface border border-white/20 p-4 text-white"
                                        value={feature.name}
                                        onChange={(e) => {
                                            const newFeatures = [...formData.features];
                                            newFeatures[index].name = e.target.value;
                                            setFormData({ ...formData, features: newFeatures });
                                        }}
                                    />
                                    <button type="button" onClick={() => removeFeature(index)} className="text-red-400 hover:text-red-500">
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                                <textarea
                                    placeholder="Description of this feature..."
                                    rows="3"
                                    className="w-full mt-4 bg-cyber-surface border border-white/20 p-4 text-white"
                                    value={feature.description}
                                    onChange={(e) => {
                                        const newFeatures = [...formData.features];
                                        newFeatures[index].description = e.target.value;
                                        setFormData({ ...formData, features: newFeatures });
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    <button type="submit" className="btn-primary btn-neon w-full py-5 text-lg flex items-center justify-center gap-3">
                        <Send className="w-5 h-5" /> SUBMIT TO THE FORGE
                    </button>
                </form>
            </div>
        </div>
    );
};

export default IdeaSubmit;