import { ArrowLeft, Hammer, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const Projects = () => {
    const projects = [
        {
            phase: "EARLY GAME",
            title: "Proof of Concept",
            status: "In Development",
            icon: Hammer,
            desc: "A small, fun multiplayer game focused on teamwork and cooperation. The main goal is to prove our community systems and make participation easy.",
            color: "neon-cyan"
        },
        {
            phase: "MID GAME",
            title: "Polished Indie Experience",
            status: "Planning",
            icon: Users,
            desc: "A more refined game similar in scope to strong indie titles. Testing deeper mechanics and scaling the volunteer system.",
            color: "neon-magenta"
        },
        {
            phase: "LATE GAME",
            title: "Massive Community Project",
            status: "Vision",
            icon: Zap,
            desc: "Large-scale cooperative experience (MMO-like) where hundreds of players work together against common threats and build something epic.",
            color: "neon-cyan"
        }
    ];

    return (
        <div className="pt-20 min-h-screen">
            <div className="container-custom py-12">
                <Link to="/" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO HOME
                </Link>

                <div className="mb-12">
                    <div className="section-header">OUR PROJECTS</div>
                    <h1 className="text-5xl font-bold tracking-tight text-white">Three Major Games</h1>
                </div>

                <div className="space-y-12">
                    {projects.map((project, index) => (
                        <div key={index} className="cyber-card p-10 grid md:grid-cols-12 gap-10 items-center">
                            <div className="md:col-span-1 flex justify-center md:justify-start">
                                <project.icon className={`w-16 h-16 text-${project.color}`} />
                            </div>
                            <div className="md:col-span-11">
                                <div className="flex items-center gap-4 mb-4">
                                    <span className="font-mono text-sm tracking-widest text-neon-cyan">{project.phase}</span>
                                    <span className="text-xs bg-white/10 px-3 py-1 rounded-full">{project.status}</span>
                                </div>
                                <h3 className="text-3xl font-bold text-white mb-4">{project.title}</h3>
                                <p className="text-text-secondary text-lg leading-relaxed">{project.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="text-center mt-16 text-text-muted text-sm font-mono">
                    Want to help on any of these projects? Visit the Get Involved page.
                </div>
            </div>
        </div>
    );
};

export default Projects;