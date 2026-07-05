import { ArrowLeft, Heart, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';

const Donations = () => {
    return (
        <div className="pt-20 min-h-screen">
            {/* Header Wrapper */}
            <div className="border-b border-white/10 bg-cyber-surface py-16">
                <div className="container-custom">
                    <Link to="/" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO HOME
                    </Link>

                    <div>
                        <div className="section-header">SUPPORT US</div>
                        <h1 className="text-5xl font-bold tracking-tight text-white">Help Fuel the Forge</h1>
                    </div>
                </div>
            </div>

            <div className="container-custom py-12 max-w-3xl">
                <div className="prose prose-invert max-w-none text-text-secondary space-y-8">
                    <p className="text-xl">
                        Every donation goes directly into development, community projects, and growth.
                        No investor pressure. No waste. Just better games and a stronger community.
                    </p>

                    <div className="cyber-card p-10">
                        <div className="text-center mb-8">
                            <DollarSign className="w-16 h-16 mx-auto text-neon-cyan mb-6" />
                            <h2 className="text-3xl font-bold">Your support makes a difference</h2>
                        </div>

                        <div className="grid md:grid-cols-3 gap-6 text-center">
                            <div>
                                <div className="text-4xl font-bold text-neon-cyan">$5</div>
                                <p className="text-sm text-text-muted">Monthly Supporter</p>
                            </div>
                            <div>
                                <div className="text-4xl font-bold text-neon-cyan">$20</div>
                                <p className="text-sm text-text-muted">Forge Member</p>
                            </div>
                            <div>
                                <div className="text-4xl font-bold text-neon-cyan">$50+</div>
                                <p className="text-sm text-text-muted">Founding Forger</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-16 text-center">
                    <a href="#" className="btn-primary btn-neon inline-block px-12 py-5 text-lg">
                        DONATE NOW
                    </a>
                </div>

                <p className="text-center text-xs text-text-muted mt-12 font-mono">
                    Full financial transparency coming soon.
                </p>
            </div>
        </div>
    );
};

export default Donations;