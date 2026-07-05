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