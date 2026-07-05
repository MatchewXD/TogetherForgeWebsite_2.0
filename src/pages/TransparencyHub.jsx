import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

const TransparencyHub = () => {
    const [donations, setDonations] = useState([]);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        const stored = JSON.parse(localStorage.getItem('tf_donations') || '[]');
        setDonations(stored);
        const sum = stored.reduce((acc, d) => acc + (d.amount || 0), 0);
        setTotal(sum);
    }, []);

    return (
        <div className="pt-20 min-h-screen">
            <div className="border-b border-white/10 bg-cyber-surface py-16">
                <div className="container-custom">
                    <Link to="/" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO HOME
                    </Link>

                    <div>
                        <div className="section-header">TRANSPARENCY HUB</div>
                        <h1 className="text-5xl font-bold tracking-tight text-white">Open by Design</h1>
                    </div>
                </div>
            </div>

            <div className="container-custom py-16 max-w-4xl space-y-16">
                {/* Legal & Governance */}
                <section>
                    <div className="section-header mb-4">LEGAL STRUCTURE & GOVERNANCE</div>
                    <p className="text-text-secondary">Together Forge operates as a community-supported independent studio. All incoming support is treated as business revenue. Founder compensation is limited to a living wage with no bonuses or investor payouts. Net proceeds are reinvested into projects and community growth.</p>
                </section>

                {/* Financial Summary */}
                <section>
                    <div className="section-header mb-4">FINANCIAL SUMMARY</div>
                    <div className="cyber-card p-8">
                        <div className="text-4xl font-bold text-neon-cyan mb-2">${total}</div>
                        <div className="text-sm text-text-muted mb-6">Total recorded support (local demo)</div>

                        {donations.length > 0 ? (
                            <ul className="space-y-2 text-sm text-text-secondary">
                                {donations.map((d, i) => (
                                    <li key={i} className="flex justify-between border-b border-white/10 pb-1">
                                        <span>{d.label} (${d.amount})</span>
                                        <span>{new Date(d.timestamp).toLocaleDateString()}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-text-muted">No donations recorded yet. Data will appear here once real support is logged.</p>
                        )}
                    </div>
                </section>

                {/* Project Roadmap */}
                <section>
                    <div className="section-header mb-4">PUBLIC PROJECT ROADMAP</div>
                    <div className="space-y-4 text-text-secondary">
                        <div className="cyber-card p-6">Early Game – In Development</div>
                        <div className="cyber-card p-6">Mid Game – Planning</div>
                        <div className="cyber-card p-6">Late Game – Vision</div>
                    </div>
                </section>

                {/* Volunteer Credits */}
                <section>
                    <div className="section-header mb-4">VOLUNTEER CREDITS & CONTRIBUTOR GALLERY</div>
                    <p className="text-text-secondary">Coming soon. This section will showcase everyone who has contributed time, ideas, or support.</p>
                </section>

                {/* Decision Logs */}
                <section>
                    <div className="section-header mb-4">DECISION LOGS</div>
                    <p className="text-text-secondary">Lightweight archive of why certain directions or ideas were chosen. To be populated over time.</p>
                </section>

                {/* Regular Updates */}
                <section>
                    <div className="section-header mb-4">STATE OF THE FORGE UPDATES</div>
                    <p className="text-text-secondary">Monthly summaries will be posted here once the project is active.</p>
                </section>
            </div>
        </div>
    );
};

export default TransparencyHub;