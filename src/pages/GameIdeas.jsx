import { ArrowLeft, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

const GameIdeas = () => {
    const ideas = [
        {
            title: "Cooperative Factory Defense",
            summary: "Build and defend automated factories together against waves. Viewers can vote on random events.",
            category: "Full Game",
            votes: 12
        },
        {
            title: "Group Magic System",
            summary: "Players combine spells in real-time for powerful effects. Strong teamwork required.",
            category: "Mechanic",
            votes: 27
        },
    ];

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

                <div className="mb-8">
                    <input
                        type="text"
                        placeholder="Search ideas..."
                        className="bg-cyber-surface border border-white/20 px-6 py-4 w-full max-w-md text-white focus:border-neon-cyan outline-none rounded"
                    />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {ideas.map((idea, index) => (
                        <div key={index} className="cyber-card p-8 hover:border-neon-cyan/40 transition cursor-pointer">
                            <div className="text-xs font-mono text-neon-cyan mb-3">{idea.category}</div>
                            <h3 className="text-xl font-bold text-white mb-4">{idea.title}</h3>
                            <p className="text-text-secondary line-clamp-4 mb-6">{idea.summary}</p>
                            <div className="text-xs text-text-muted flex justify-between">
                                <span>{idea.votes} votes</span>
                                <span>View Details</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default GameIdeas;