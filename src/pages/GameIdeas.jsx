import { ArrowLeft, Plus, MessageCircle, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const GameIdeas = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortMode, setSortMode] = useState('popular');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [filterOpen, setFilterOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [userVotes, setUserVotes] = useState(new Set()); // idea IDs the current user has voted on
    const [commentCounts, setCommentCounts] = useState({}); // idea_id -> count

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
        const fetchIdeasAndVotes = async () => {
            const { data: ideasData, error } = await supabase.from('ideas').select('*');
            if (error || !ideasData) return;

            const userIds = [...new Set(ideasData.map(i => i.user_id).filter(Boolean))];
            let creatorMap = {};
            if (userIds.length > 0) {
                const { data: profilesData } = await supabase.from('profiles').select('id, username, avatar_url').in('id', userIds);
                if (profilesData) {
                    creatorMap = Object.fromEntries(profilesData.map(p => [p.id, { username: p.username, avatar_url: p.avatar_url }]));
                }
            }

            const enriched = ideasData.map(idea => ({
                ...idea,
                creator: creatorMap[idea.user_id] || null
            }));
            setAllIdeas(enriched);

            // Load comment counts for all ideas
            const { data: commentRows } = await supabase.from('comments').select('idea_id');
            if (commentRows) {
                const counts = {};
                commentRows.forEach(r => { counts[r.idea_id] = (counts[r.idea_id] || 0) + 1; });
                setCommentCounts(counts);
            }

            // Load current user's existing votes so we can disable re-voting
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: voteRows } = await supabase.from('votes').select('idea_id').eq('user_id', user.id);
                if (voteRows) setUserVotes(new Set(voteRows.map(v => v.idea_id)));
            } else {
                setUserVotes(new Set());
            }
        };
        fetchIdeasAndVotes();
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

                <div className="flex flex-col gap-4 max-w-[780px] mx-auto">
                    {filteredIdeas.map((idea) => (
                        <div key={idea.id} className="cyber-card group flex flex-col rounded-xl p-6 hover:border-neon-cyan/40 transition-all duration-200">
                            <Link to={`/ideas/${idea.id}`} className="block flex-1">
                                <div className="inline-flex items-center rounded-full bg-neon-cyan px-3 py-0.5 text-[10px] font-mono tracking-[1.5px] text-black mb-3">
                                    {idea.category}
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-1.5 pr-1 group-hover:text-neon-cyan transition-colors">
                                    {idea.title}
                                </h3>
                                <p className="text-base text-text-secondary mb-3 line-clamp-2">
                                    {idea.summary}
                                </p>

                                {/* Smaller spacer now that text is larger */}
                                <div className="min-h-[24px]" />

                                {idea.creator && (
                                    <div className="flex items-center gap-2.5 text-xs mt-1 mb-5">
                                        {idea.creator.avatar_url ? (
                                            <img src={idea.creator.avatar_url} alt="" className="w-5 h-5 rounded-full ring-1 ring-white/10 object-cover" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-white/10" />
                                        )}
                                        <span className="font-mono text-neon-cyan/90">{idea.creator.username}</span>
                                    </div>
                                )}
                            </Link>

                            <div className="mt-auto pt-5 border-t border-white/10 flex items-center gap-4 text-xs text-text-muted">
                                <button
                                    onClick={async () => {
                                        const { data: { user } } = await supabase.auth.getUser();
                                        if (!user) {
                                            setMessage('Please log in to vote.');
                                            return;
                                        }

                                        const hasVoted = userVotes.has(idea.id);

                                        if (hasVoted) {
                                            setAllIdeas(prev => prev.map(i =>
                                                i.id === idea.id ? { ...i, votes: Math.max(0, (i.votes || 0) - 1) } : i
                                            ));
                                            setUserVotes(prev => {
                                                const next = new Set(prev);
                                                next.delete(idea.id);
                                                return next;
                                            });
                                            await supabase.from('votes')
                                                .delete()
                                                .eq('idea_id', idea.id)
                                                .eq('user_id', user.id);
                                        } else {
                                            setAllIdeas(prev => prev.map(i =>
                                                i.id === idea.id ? { ...i, votes: (i.votes || 0) + 1 } : i
                                            ));
                                            setUserVotes(prev => new Set(prev).add(idea.id));
                                            await supabase.from('votes').insert([{ idea_id: idea.id, user_id: user.id }]);
                                        }
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded px-2 py-1 -ml-2 hover:bg-white/5 hover:text-white transition"
                                    title={userVotes.has(idea.id) ? 'Remove vote' : 'Vote'}
                                >
                                    <Flame className={`w-4 h-4 transition ${userVotes.has(idea.id) ? 'text-orange-500' : 'text-text-muted group-hover:text-orange-400/70'}`} />
                                    <span className="font-mono tabular-nums">{idea.votes || 0}</span>
                                </button>

                                {idea.created_at && (
                                    <span className="text-[10px] text-text-muted/70 tabular-nums">
                                        {new Date(idea.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                )}

                                <Link to={`/ideas/${idea.id}`} className="inline-flex items-center gap-1.5 ml-auto hover:text-white transition">
                                    <MessageCircle className="w-4 h-4" />
                                    <span className="font-mono tabular-nums">{commentCounts[idea.id] || 0}</span>
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GameIdeas;