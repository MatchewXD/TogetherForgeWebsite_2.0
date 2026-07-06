import HeroSection from '../components/HeroSection';
import { Users, Hammer, Zap, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const HomePage = () => {
    const pillars = [
        {
            icon: Hammer,
            title: "BY THE COMMUNITY",
            desc: "Games built collaboratively by gamers, streamers, and volunteers. No corporate agendas. Just real teamwork and fun."
        },
        {
            icon: Users,
            title: "FOR THE COMMUNITY",
            desc: "We create experiences that bring people together. Streamers playing with their audiences, friends uniting against challenges, massive collaboration."
        },
        {
            icon: Zap,
            title: "EARLY GAME FOCUS",
            desc: "Starting with simple, fun multiplayer games that prove the concept and build systems for bigger community-driven projects."
        }
    ];

    return (
        <>
            <HeroSection />

            {/* Forge Status / Quick Hub */}
            <section id="quick-hub" className="py-12 border-t border-white/5">
                <div className="container-custom">
                    <div className="max-w-6xl mx-auto mb-8">
                        <div className="section-header">FORGE STATUS / QUICK HUB</div>
                        <h2 className="text-3xl font-bold tracking-tight text-white">Daily dashboard — scroll to begin</h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                        {/* Project status teasers */}
                        <div className="space-y-4">
                            <div className="cyber-card p-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="text-xs text-text-muted">EARLY GAME</div>
                                        <h3 className="text-xl font-bold text-white">Prototype Systems</h3>
                                        <p className="text-text-secondary mt-2">Core loop prototyping and networking tests. Volunteers: design, code, art.</p>
                                    </div>
                                </div>
                                <div className="mt-4 text-right">
                                    <a href="/projects" className="text-sm text-neon-cyan hover:underline">View projects</a>
                                </div>
                            </div>

                            <div className="cyber-card p-6">
                                <div className="text-xs text-text-muted">MID GAME</div>
                                <h3 className="text-lg font-bold text-white">Core Features</h3>
                                <p className="text-text-secondary mt-2">Design work and early integrations; recruiting volunteers for focused sprints.</p>
                            </div>

                            <div className="cyber-card p-6">
                                <div className="text-xs text-text-muted">LATE GAME</div>
                                <h3 className="text-lg font-bold text-white">Stability & Polish</h3>
                                <p className="text-text-secondary mt-2">Polish passes, optimization, and wider playtests.</p>
                            </div>
                        </div>

                        {/* Latest devlog / update teaser */}
                        <div className="cyber-card p-6">
                            <div className="text-xs text-text-muted">LATEST DEVLOG</div>
                            <h3 className="text-xl font-bold text-white mt-1">State of the Forge — Monthly Devlog</h3>
                            <p className="text-text-secondary mt-3">Quick summary of the latest work: idea form redesign, new submission limits, and RLS improvements. Read the full update for details and contributor shoutouts.</p>
                            <div className="mt-4">
                                <Link to="/transparency" className="text-neon-cyan hover:underline">Read the devlog</Link>
                            </div>
                        </div>

                        {/* Quick links + Community Pulse */}
                        <div className="space-y-4">
                            <div className="cyber-card p-6">
                                <div className="text-xs text-text-muted">QUICK LINKS</div>
                                <div className="mt-3 grid gap-2">
                                    <Link to="/ideas" className="block text-white hover:text-neon-cyan">Browse Ideas</Link>
                                    <Link to="/get-involved" className="block text-white hover:text-neon-cyan">Active Tasks</Link>
                                    <Link to="/transparency" className="block text-white hover:text-neon-cyan">Transparency Report</Link>
                                    <Link to="/ideas" className="block text-white hover:text-neon-cyan">Recent Ideas</Link>
                                </div>
                            </div>

                            <div className="cyber-card p-6">
                                <div className="text-xs text-text-muted">COMMUNITY PULSE</div>
                                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                                    <div>
                                        <div className="text-2xl font-bold text-white">—</div>
                                        <div className="text-xs text-text-secondary">Volunteers</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-white">—</div>
                                        <div className="text-xs text-text-secondary">Ideas</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-white">—</div>
                                        <div className="text-xs text-text-secondary">Donations (this mo.)</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Mission Section */}
            <section id="mission" className="py-20 border-t border-white/10 bg-cyber-surface">
                <div className="container-custom">
                    <div className="max-w-3xl mx-auto text-center mb-14">
                        <div className="section-header">OUR MISSION</div>
                        <h2 className="text-5xl md:text-6xl font-bold tracking-tighter text-white mb-6">
                            By the Community,<br />For the Community!
                        </h2>
                        <p className="text-xl text-text-secondary">
                            Together Forge is a community-first independent game studio.
                            We organize and support games created collaboratively by gamers and streamers.
                            We put quality mechanics, fun, and real connection first.
                        </p>
                    </div>

                    {/* Static Cards */}
                    <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                        {pillars.map((pillar, index) => (
                            <div key={index} className="static-card p-8">
                                <div className="w-12 h-12 mb-6 rounded-xl bg-neon-cyan/10 flex items-center justify-center">
                                    <pillar.icon className="w-6 h-6 text-neon-cyan" />
                                </div>
                                <h3 className="font-mono text-lg tracking-widest mb-4 text-white">{pillar.title}</h3>
                                <p className="text-text-secondary leading-relaxed">{pillar.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Quick CTAs */}
            <section className="py-16 border-t border-white/10">
                <div className="container-custom text-center">
                    <div className="section-header mb-8">GET STARTED</div>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link to="/about" className="btn-primary inline-flex items-center justify-center gap-2">
                            Learn More <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link to="/ideas" className="btn-secondary inline-flex items-center justify-center gap-2">
                            Browse Ideas <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link to="/get-involved" className="btn-secondary inline-flex items-center justify-center gap-2">
                            Get Involved <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </section>
        </>
    );
};

export default HomePage;