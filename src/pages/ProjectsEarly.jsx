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
                        <div className="grid md:grid-cols-3 gap-4 mb-4">
                            <Link to="/projects/early/g1" className="cyber-card p-4 hover:border-neon-cyan/40">
                                <div className="font-bold text-white">Early Game Project 1</div>
                                <div className="text-text-secondary text-sm mt-2">Current / In Development</div>
                            </Link>

                            <Link to="/projects/early/g2" className="cyber-card p-4">
                                <div className="font-bold text-white">Early Game Project 2</div>
                                <div className="text-text-secondary text-sm mt-2">Planned</div>
                            </Link>

                            <Link to="/projects/early/g3" className="cyber-card p-4">
                                <div className="font-bold text-white">Early Game Project 3</div>
                                <div className="text-text-secondary text-sm mt-2">Planned</div>
                            </Link>
                        </div>

                        <div className="mt-6">
                            <div className="section-header">Target Style for Early Game Projects</div>
                            <div className="cyber-card p-4 text-text-secondary">
                                <p>We are looking for small, focused multiplayer games that emphasize cooperation and teamwork.</p>
                                <div className="mt-3">
                                    <div className="font-bold text-white mb-2">Examples of the kind of games we want to make:</div>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li>Cooperative survival challenges (inspired by Lethal Company or PlateUp!)</li>
                                        <li>Shared vehicle/mech operation or crew-based gameplay</li>
                                        <li>Simple team-based exploration, building, and defense</li>
                                        <li>Light resource management with clear role differentiation in short sessions</li>
                                    </ul>
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
