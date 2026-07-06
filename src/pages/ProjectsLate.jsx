import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const ProjectsLate = () => {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);

    const SAMPLE_GAMES = [
        { id: 'l1', title: 'Late: Matchmaking Core', desc: 'Matchmaking and session orchestration for large player counts.', status: 'todo' },
        { id: 'l2', title: 'Late: Scale & Ops', desc: 'Server scaling, observability, and reliability systems.', status: 'todo' }
    ];

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase.from('phase_games').select('*').eq('phase', 'late');
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
                    <div className="section-header">LATE GAME</div>
                    <h1 className="text-4xl font-bold tracking-tight text-white">Late Game — Phase Overview</h1>
                    <p className="text-text-secondary mt-4 max-w-3xl">Late Game focuses on polish, optimization, and scaling to larger audiences. This includes matchmaking, server scaling, and wide playtests. Projects here will be chosen based on progress in earlier phases and community priorities.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <div className="section-header">Phase Goals</div>
                        <div className="cyber-card p-4 mb-6">
                            <ul className="text-text-secondary list-disc pl-5 space-y-2">
                                <li>Scale systems for large concurrent audiences.</li>
                                <li>Deliver robust matchmaking and session management.</li>
                                <li>Polish and QA for broad player retention.</li>
                            </ul>
                        </div>

                        <div className="section-header mb-4">Planned Games / Initiatives</div>
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
                        <div className="section-header mb-4">Preparation</div>
                        <div className="cyber-card p-4">
                            <p className="text-text-secondary">Help prepare tooling, docs, and automation so Late Game transitions are smooth. Repo and CI contributions are especially valuable here.</p>
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

export default ProjectsLate;
