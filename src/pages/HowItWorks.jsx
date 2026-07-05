import { ArrowLeft, CheckCircle, Users, Hammer } from 'lucide-react';
import { Link } from 'react-router-dom';

const HowItWorks = () => {
    const steps = [
        {
            number: "01",
            title: "Submit Your Idea",
            desc: "Share game concepts, mechanics, or improvements through the Game Ideas page.",
            icon: Hammer
        },
        {
            number: "02",
            title: "Community Feedback",
            desc: "The community discusses, votes, and refines ideas together.",
            icon: Users
        },
        {
            number: "03",
            title: "Selection & Planning",
            desc: "Promising ideas move to Projects. Volunteers can claim tasks.",
            icon: CheckCircle
        },
        {
            number: "04",
            title: "Build Together",
            desc: "Community members contribute code, art, testing, content, and more.",
            icon: Hammer
        },
        {
            number: "05",
            title: "Credit & Launch",
            desc: "Contributors get recognized. The game is released for everyone to enjoy.",
            icon: CheckCircle
        }
    ];

    return (
        <div className="pt-20 min-h-screen">
            {/* Header Wrapper */}
            <div className="border-b border-white/10 bg-cyber-surface py-16">
                <div className="container-custom">
                    <Link to="/" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO HOME
                    </Link>

                    <div>
                        <div className="section-header">HOW IT WORKS</div>
                        <h1 className="text-5xl font-bold tracking-tight text-white">From Idea to Game, Together</h1>
                    </div>
                </div>
            </div>

            <div className="container-custom py-12">
                <div className="space-y-16">
                    {steps.map((step, index) => (
                        <div key={index} className="flex gap-10 items-start">
                            <div className="w-16 h-16 rounded-2xl bg-neon-cyan/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-3xl font-mono text-neon-cyan font-bold">{step.number}</span>
                            </div>
                            <div>
                                <div className="flex items-center gap-4 mb-4">
                                    <step.icon className="w-8 h-8 text-neon-cyan" />
                                    <h3 className="text-3xl font-bold text-white">{step.title}</h3>
                                </div>
                                <p className="text-xl text-text-secondary">{step.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-20 text-center">
                    <Link to="/ideas" className="btn-primary btn-neon inline-block px-12 py-5 text-lg">
                        SUBMIT YOUR FIRST IDEA
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default HowItWorks;