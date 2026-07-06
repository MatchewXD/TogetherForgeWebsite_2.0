import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const ProjectsEarlyDetail = () => {
    const { id } = useParams();
    const projectTitle = 'Early Game - Project One';

    return (
        <div className="pt-20 min-h-screen">
            <div className="container-custom py-12">
                <Link to="/projects/early" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO EARLY GAME
                </Link>

                {/* 1. Header / Hero */}
                <div className="mb-12">
                    <div className="section-header">EARLY GAME</div>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <h1 className="text-4xl font-bold tracking-tight text-white">{projectTitle}</h1>
                            <p className="text-text-secondary mt-2 max-w-2xl">Our first cooperative multiplayer prototype - currently in concept and early planning</p>
                        </div>
                        <div className="px-3 py-1 text-xs font-mono tracking-widest border border-neon-cyan/40 text-neon-cyan rounded">IN DEVELOPMENT</div>
                    </div>
                </div>

                {/* 2. Project Overview */}
                <div className="mb-12">
                    <div className="section-header">Project Overview</div>
                    <div className="cyber-card p-6 text-text-secondary space-y-4">
                        <p>This project is in the early concept phase. The specific gameplay, mechanics, and theme are currently being shaped by community ideas and initial prototyping.</p>
                        <p>We are looking for small, focused multiplayer experiences that emphasize cooperation and teamwork.</p>
                        <div>
                            <div className="font-bold text-white mb-2">Core Goals</div>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Validate fast-paced co-op resource and defense loops</li>
                                <li>Keep scope small for quick iteration and feedback</li>
                                <li>Emphasize teamwork and role differentiation</li>
                            </ul>
                        </div>
                        <div>
                                <div className="font-bold text-white mb-2">Target Scope</div>
                                <p>Small multiplayer (4-8 players), quick to build, focused on cooperation.</p>
                            </div>
                            <div>
                                <div className="font-bold text-white mb-2">Examples of the kind of games we want to make in Early Game</div>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>Cooperative survival challenges (inspired by games like Lethal Company or PlateUp!)</li>
                                    <li>Shared vehicle/mech operation or crew-based gameplay</li>
                                    <li>Simple team-based exploration, building, and defense</li>
                                    <li>Light resource management and role differentiation in short, replayable sessions</li>
                                </ul>
                            </div>
                            <p>These early projects are meant to be fun, fast to develop, and excellent at testing our community development systems.</p>
                        </div>
                </div>

                {/* 3. Current Progress */}
                <div className="mb-12">
                    <div className="section-header">Current Progress</div>
                    <div className="cyber-card p-6 text-text-secondary">
                        <p>Currently in concept and early prototyping stage.</p>
                        <p className="mt-2">No major systems have been built yet. We will update this section as development begins.</p>
                        <div className="mt-4 h-2 bg-white/10 rounded overflow-hidden">
                            <div className="h-2 w-1/12 bg-neon-cyan" />
                        </div>
                        <div className="text-xs text-text-muted mt-1">Concept / Early Prototyping</div>
                    </div>
                </div>

                {/* 4. Ideas for This Project */}
                <div className="mb-12">
                    <div className="section-header">Ideas for This Project</div>
                    <div className="cyber-card p-6">
                        <p className="text-text-secondary mb-6">No ideas have been submitted for this project yet.<br />Be one of the first to help shape it!</p>
                        <Link to={`/ideas/submit?project=${id}`} className="btn-primary inline-block">Submit Idea for This Project</Link>
                    </div>
                </div>

                {/* 5. Task Board / How to Contribute */}
                <div className="mb-12">
                    <div className="section-header">Task Board / How to Contribute</div>
                    <div className="cyber-card p-6 text-text-secondary">
                        <p>Tasks and volunteer opportunities will appear here once we move into active development.</p>
                        <p className="mt-2">In the meantime, the best way to help is by submitting ideas above.</p>
                        <div className="mt-6">
                            <Link to="/projects" className="btn-neon">Go to Main Task Board</Link>
                        </div>
                    </div>
                </div>

                {/* 6. Community Credits / Inspired By */}
                <div className="mb-12">
                    <div className="section-header">Community Credits / Inspired By</div>
                    <div className="cyber-card p-6 text-text-secondary">
                        <p>This project is just getting started. Community contributors and adopted ideas will be listed here.</p>
                    </div>
                </div>

                {/* 7. Devlogs & Updates */}
                <div className="mb-12">
                    <div className="section-header">Devlogs &amp; Updates</div>
                    <div className="cyber-card p-6 text-text-secondary">
                        <p>No devlogs yet. Check back soon as we begin sharing progress!</p>
                    </div>
                </div>

                {/* 8. Footer / Next Steps */}
                <div className="pt-4 border-t border-white/10 flex flex-wrap gap-4 items-center">
                    <Link to="/projects/early" className="btn-neon">Back to Early Game Overview</Link>
                    <Link to={`/ideas/submit?project=${id}`} className="btn-primary">Suggest More Ideas</Link>
                </div>
            </div>
        </div>
    );
};

export default ProjectsEarlyDetail;
