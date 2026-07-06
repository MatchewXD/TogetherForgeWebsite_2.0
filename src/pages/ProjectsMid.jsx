import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const ProjectsMid = () => {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);

    const SAMPLE_GAMES = [
        { id: 'm1', title: 'Mid: Expanded Zones', desc: 'Multiple connected zones and travel systems.', status: 'todo' },
        { id: 'm2', title: 'Mid: Progression Systems', desc: 'Deeper mechanics for persistent progression.', status: 'todo' }
    ];

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase.from('phase_games').select('*').eq('phase', 'mid');
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

    return (
        <div className="pt-20 min-h-screen">
            <div className="container-custom py-12">
                <Link to="/projects" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO PROJECTS
                </Link>

                <div className="mb-8">
                    <div className="section-header">MID GAME</div>
                    <h1 className="text-4xl font-bold tracking-tight text-white">Mid Game — Phase Overview</h1>
                    <p className="text-text-secondary mt-4 max-w-3xl">The Mid Game phase contains projects that expand the core systems validated during Early Game. This includes polishing mechanics, expanding content, and scaling volunteer workflows.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <div className="section-header">Phase Goals</div>
                        <div className="cyber-card p-4 mb-6">
                            <ul className="text-text-secondary list-disc pl-5 space-y-2">
                                <li>Polish core systems and iterate on feedback.</li>
                                <li>Scale content and tooling for volunteer workflows.</li>
                                <li>Build secondary mechanics and larger maps.</li>
                            </ul>
                        </div>

                        <div className="section-header mb-4">Planned Games</div>
                        <div className="grid md:grid-cols-2 gap-4">
                            {(loading ? SAMPLE_GAMES : games).map(g => (
                                <div key={g.id} className="cyber-card p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-bold text-white">{g.title}</div>
                                            <div className="text-text-secondary text-sm mt-1">{g.desc}</div>
                                        </div>
                                        <div className={`font-mono text-xs px-2 py-1 rounded ${g.status === 'completed' ? 'bg-green-600/20 text-green-400' : g.status === 'in_progress' ? 'bg-neon-magenta/10 text-neon-magenta' : 'bg-white/5 text-text-muted'}`}>{g.status.replace('_',' ').toUpperCase()}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="md:col-span-1">
                        <div className="section-header mb-4">Get involved</div>
                        <div className="cyber-card p-4">
                            <p className="text-text-secondary">Join the volunteer pool, subscribe to updates, and help prepare for Mid Game sprints by contributing design documents or tooling.</p>
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

export default ProjectsMid;
