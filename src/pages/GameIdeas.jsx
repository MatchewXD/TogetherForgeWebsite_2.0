import { ArrowLeft, Plus, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

const GameIdeas = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortMode, setSortMode] = useState('popular');

    const storedIdeas = JSON.parse(localStorage.getItem('tf_ideas') || '[]');
    const defaultIdeas = [
        {
            id: 1,
            title: "Cooperative Factory Defense",
            summary: "Build and defend automated factories together against waves. Viewers can vote on random events.",
            category: "Full Game",
            votes: 12
        },
        {
            id: 2,
            title: "Group Magic System",
            summary: "Players combine spells in real-time for powerful effects. Strong teamwork required.",
            category: "Mechanic",
            votes: 27
        },
    ];
    const allIdeas = [...storedIdeas, ...defaultIdeas];

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
        .filter(idea =>
            idea.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            idea.summary.toLowerCase().includes(searchTerm.toLowerCase())
        )
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
                </div>

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
                                        onClick={() => {
                                            const stored = JSON.parse(localStorage.getItem('tf_ideas') || '[]');
                                            const updated = stored.map(i => {
                                                if (i.id === idea.id) {
                                                    return { ...i, votes: (i.votes || 0) + 1, lastVoteTime: Date.now() };
                                                }
                                                return i;
                                            });
                                            localStorage.setItem('tf_ideas', JSON.stringify(updated));
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