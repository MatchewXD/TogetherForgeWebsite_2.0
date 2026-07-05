import { ArrowLeft, Plus, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const GameIdeas = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortMode, setSortMode] = useState('popular');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [filterOpen, setFilterOpen] = useState(false);

    const CATEGORIES = [
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
        'Other'
    ];
    const [allIdeas, setAllIdeas] = useState([]);

    useEffect(() => {
        const fetchIdeas = async () => {
            const { data, error } = await supabase.from('ideas').select('*');
            if (!error && data) setAllIdeas(data);
        };
        fetchIdeas();
    }, []);

    const DECAY_RATE = 0.0000001; // adjust for decay speed
    const now = Date.now();

    const getPopularityScore = (idea) => {
        const votes = idea.votes || 0;
        const lastVoteTime = idea.lastVoteTime || now;
        const age = now - lastVoteTime;
        const weight = Math.exp(-DECAY_RATE * age);
        return votes * weight;
    };

    const filteredIdeas = allIdeas
        .filter(idea => {
            const matchesSearch =
                idea.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                idea.summary.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory =
                selectedCategories.length === 0 || selectedCategories.includes(idea.category);
            return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
            if (sortMode === 'popular') {
                return getPopularityScore(b) - getPopularityScore(a);
            }
            if (sortMode === 'votes') {
                return (b.votes || 0) - (a.votes || 0);
            }
            return a.title.localeCompare(b.title);
        });

    return (
        <div className="pt-20 min-h-screen">
            <div className="container-custom py-12">
                <Link to="/" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO HOME
                </Link>

                <div className="flex justify-between items-end mb-10">
                    <div>
                        <div className="section-header">GAME IDEAS</div>
                        <h1 className="text-5xl font-bold tracking-tight text-white">Community Submissions</h1>
                    </div>
                    <Link
                        to="/ideas/submit"
                        className="btn-primary btn-neon flex items-center gap-3 px-8 py-4"
                    >
                        <Plus className="w-5 h-5" /> SUBMIT AN IDEA
                    </Link>
                </div>

                <div className="mb-8 flex flex-col sm:flex-row gap-4">
                    <input
                        type="text"
                        placeholder="Search ideas..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-cyber-surface border border-white/20 px-6 py-4 w-full max-w-md text-white focus:border-neon-cyan outline-none rounded"
                    />
                    <select
                        value={sortMode}
                        onChange={(e) => setSortMode(e.target.value)}
                        className="bg-cyber-surface border border-white/20 px-4 py-4 text-white focus:border-neon-cyan outline-none rounded"
                    >
                        <option value="popular">Most Popular</option>
                            <option value="votes">Most Votes</option>
                            <option value="title">Sort by Title</option>
                        </select>

                        {/* Category Filter Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setFilterOpen(!filterOpen)}
                                className="bg-cyber-surface border border-white/20 px-4 py-4 text-white rounded flex items-center gap-2 hover:border-neon-cyan"
                            >
                                Filter by Category
                                {selectedCategories.length > 0 && (
                                    <span className="text-xs bg-neon-cyan text-black px-2 py-0.5 rounded-full">
                                        {selectedCategories.length}
                                    </span>
                                )}
                            </button>

                            {filterOpen && (
                                <div className="absolute mt-2 w-72 bg-cyber-surface border border-white/20 rounded p-4 z-50 shadow-lg">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-sm text-text-muted">Categories</span>
                                        <button 
                                            onClick={() => setSelectedCategories([])} 
                                            className="text-xs text-neon-cyan hover:underline"
                                        >
                                            Clear all
                                        </button>
                                    </div>

                                    <div className="max-h-60 overflow-auto space-y-1">
                                        {CATEGORIES.map(cat => (
                                            <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 p-1 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCategories.includes(cat)}
                                                    onChange={() => {
                                                        if (selectedCategories.includes(cat)) {
                                                            setSelectedCategories(selectedCategories.filter(c => c !== cat));
                                                        } else {
                                                            setSelectedCategories([...selectedCategories, cat]);
                                                        }
                                                    }}
                                                />
                                                {cat}
                                            </label>
                                        ))}
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-white/10 text-right">
                                        <button 
                                            onClick={() => setFilterOpen(false)} 
                                            className="text-xs px-3 py-1 border border-white/20 rounded hover:bg-white/10"
                                        >
                                            Done
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                </div>

                {filteredIdeas.length === 0 && (
                    <div className="col-span-2 text-center py-12 text-text-muted">
                        No ideas match your current filters.
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                    {filteredIdeas.map((idea) => (
                        <div key={idea.id} className="cyber-card p-8 hover:border-neon-cyan/40 transition">
                            <Link to={`/ideas/${idea.id}`} className="block">
                                <div className="text-xs font-mono text-neon-cyan mb-3">{idea.category}</div>
                                <h3 className="text-xl font-bold text-white mb-4">{idea.title}</h3>
                                <p className="text-text-secondary line-clamp-4 mb-6">{idea.summary}</p>
                            </Link>
                            <div className="text-xs text-text-muted flex justify-between items-center">
                                <span>{idea.votes || 0} votes</span>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={async () => {
                                            const { data: { user } } = await supabase.auth.getUser();
                                            if (!user) {
                                                alert('Please log in to vote.');
                                                return;
                                            }
                                            await supabase.from('votes').insert([{ idea_id: idea.id, user_id: user.id }]);
                                            await supabase.from('ideas').update({ votes: (idea.votes || 0) + 1 }).eq('id', idea.id);
                                            window.location.reload();
                                        }}
                                        className="text-neon-cyan hover:text-white text-xs px-2 py-1 border border-white/20 rounded"
                                    >
                                        + Vote
                                    </button>
                                    <Link to={`/ideas/${idea.id}`} className="flex items-center gap-1 hover:text-white">
                                        <MessageCircle className="w-3 h-3" /> Discuss
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GameIdeas;