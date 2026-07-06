import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const ProjectsEarly = () => {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);

    const SAMPLE_GAMES = [
        { id: 'g1', title: 'Minimap Mayhem', desc: 'Small co-op arena focusing on resource delivery and defense.', status: 'in_progress' },
        { id: 'g2', title: 'Collector Caravan', desc: 'A short mission-based game that validates item collection loop.', status: 'todo' },
        { id: 'g3', title: 'Prototype PVP-lite', desc: 'Basic competitive prototype to test network and latency concerns.', status: 'completed' }
    ];

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            // try to load phase games from supabase (if table exists), fallback to sample
            try {
                const { data, error } = await supabase.from('phase_games').select('*').eq('phase', 'early');
                if (!mounted) return;
                if (error) setGames(SAMPLE_GAMES);
                else setGames((data && data.length) ? data : SAMPLE_GAMES);
            } catch (e) {
                if (mounted) setGames(SAMPLE_GAMES);
            }
            setLoading(false);
        };
        load();
        return () => { mounted = false; };
    }, []);

    const doneCount = games.filter(g => g.status === 'completed').length;

    return (
        <div className="pt-20 min-h-screen">
            <div className="container-custom py-12">
                <Link to="/projects" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO PROJECTS
                </Link>

                <div className="mb-8">
                    <div className="section-header">EARLY GAME</div>
                    <h1 className="text-4xl font-bold tracking-tight text-white">Early Game Project Hub</h1>
                        <div className="text-text-secondary mt-4 max-w-3xl space-y-4">
                        <div>
                            <div className="font-bold">Early Game (Proof of Concept)</div>
                            <p> A small, focused multiplayer game that promotes teamwork and cooperation. The primary goal is to test and refine our community development systems (task management, volunteering, crediting, feedback loops). It should be relatively quick to make while still being genuinely fun and multiplayer.</p>
                        </div>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <div className="section-header">Early game goals</div>
                        <div className="cyber-card p-4 mb-6">
                            <ul className="text-text-secondary list-disc pl-5 space-y-2">
                                <li>Test and prove our community-driven development model works.</li>
                                <li>Build and refine core cooperation and teamwork mechanics.</li>
                                <li>Create a genuinely fun experience that brings players together.</li>
                                <li>Establish transparent systems for volunteering, task tracking, and crediting contributors.</li>
                                <li>Gather real community feedback to improve future projects.</li>
                            </ul>
                            <div className="text-xs text-text-muted mt-2">Success metric: Strong community engagement during development + positive feedback on cooperative gameplay.</div>
                        </div>

                        <div className="section-header mb-4">Game Overviews</div>
                        <div className="cyber-card p-4 mb-4">
                            <div className="font-bold text-white">What games do we have cooking?</div>
                            <div className="text-text-secondary mt-3">Current Status: We are in the early planning and prototyping stage for our first Early Game title.</div>
                            <div className="mt-4">
                                <div className="cyber-card p-4">
                                    <div className="font-bold text-white">Our First Early Game Project - Coming Soon</div>
                                    <div className="text-text-secondary text-sm mt-2">The specific game concept for our first Early Game title is currently being shaped by community input and initial prototyping. We are looking for small, focused multiplayer experiences that emphasize cooperation. Examples of directions we are exploring include cooperative survival challenges, shared vehicle/mech operation, or simple team-based exploration and building.</div>
                                    <div className="text-text-secondary text-sm mt-3">Submit your ideas in the Game Ideas section to help define what our first game becomes!</div>
                                </div>
                            </div>
                            <div className="text-text-secondary text-sm mt-3">(Once a specific game is chosen we will highlight it here and add placeholders for the next planned Early Game titles.)</div>
                        </div>

                        <div className="mt-6">
                            <div className="section-header">Progress Snapshot</div>
                            <div className="cyber-card p-4">
                                <div className="text-sm text-text-muted mb-2">{doneCount} of {games.length} games completed</div>
                                <div className="w-full bg-white/5 rounded h-3 mt-2 overflow-hidden">
                                    <div className="bg-neon-cyan h-3" style={{ width: `${Math.round((doneCount / Math.max(1, games.length)) * 100)}%` }} />
                                </div>
                            </div>
                        </div>

                        <div className="mt-6">
                            <Link to="/projects" className="btn-primary">Volunteer on Current Project</Link>
                            <Link to="/ideas" className="btn-neon ml-4">Submit Ideas for Early Game</Link>
                        </div>
                    </div>

                    <div className="md:col-span-1">
                        <div className="section-header mb-4">About Early Game</div>
                        <div className="cyber-card p-4 mb-4">
                            <p className="text-text-secondary">Early Game is the foundation of Together Forge. We intentionally start small so we can focus on what matters most: building fun cooperative mechanics and proving that a transparent, community-supported development process can create great games. No flashy graphics. No corporate mandates. Just real teamwork, meaningful systems, and games made by the community, for the community.</p>
                        </div>

                        <div className="section-header mb-2">How to Help</div>
                        <div className="cyber-card p-4">
                            <ul className="text-text-secondary list-disc pl-5 space-y-2">
                                <li>Submit game concepts, mechanics, or ideas through the Game Ideas page.</li>
                                <li>Volunteer your skills (development, art, design, testing, writing, moderation, etc.).</li>
                                <li>Help test prototypes and give honest feedback on what feels fun.</li>
                                <li>Join discussions on existing ideas to help refine them.</li>
                                <li>Share the project with streamers, communities, and other creators.</li>
                                <li>Support the Forge through donations to help fund development tools and time.</li>
                            </ul>
                            <div className="text-text-secondary text-sm mt-3">Every contribution is credited publicly, and we are transparent about how support is used.</div>
                            <div className="mt-4">
                                <Link to="/get-involved" className="btn-primary">Get Involved</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectsEarly;
