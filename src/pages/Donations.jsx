import { useState } from 'react';
import { ArrowLeft, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';

const Donations = () => {
    const [submitted, setSubmitted] = useState(false);
    const [selectedTier, setSelectedTier] = useState(null);

    const tiers = [
        { amount: 5, label: 'Supporter', perk: 'Public thank you + name in credits list' },
        { amount: 20, label: 'Forge Member', perk: 'Exclusive Discord role, monthly devlog access, vote priority on minor decisions' },
        { amount: 50, label: 'Builder', perk: 'Early access to prototypes, name in specific game credits, occasional digital rewards' },
    ];

    const handleDonate = (tier) => {
        const donations = JSON.parse(localStorage.getItem('tf_donations') || '[]');
        donations.push({ ...tier, timestamp: Date.now() });
        localStorage.setItem('tf_donations', JSON.stringify(donations));
        setSelectedTier(tier);
        setSubmitted(true);
    };

    return (
        <div className="pt-20 min-h-screen">
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

            <div className="container-custom py-12 max-w-4xl">
                <div className="prose prose-invert max-w-none text-text-secondary space-y-8">
                    <p className="text-xl">
                        Every contribution goes directly into development, community projects, and growth.
                        No investor pressure. No waste. Just better games and a stronger community.
                    </p>

                    <div className="cyber-card p-10">
                        <div className="text-center mb-8">
                            <DollarSign className="w-16 h-16 mx-auto text-neon-cyan mb-6" />
                            <h2 className="text-3xl font-bold">Choose your support level</h2>
                            <p className="text-sm text-text-muted mt-2">
                                Perks are thank-you incentives. Pure donations without perks are also accepted.
                            </p>
                        </div>

                        {submitted ? (
                            <div className="text-center py-8 text-neon-cyan text-xl">
                                Thank you! Your interest in the <strong>{selectedTier.label}</strong> tier (${selectedTier.amount}) has been recorded.
                                <div className="text-sm text-text-muted mt-4">
                                    (Payment processing coming later — Stripe integration required for real transactions)
                                </div>
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-3 gap-6">
                                {tiers.map((tier, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleDonate(tier)}
                                        className="cyber-card p-8 hover:border-neon-cyan/60 transition text-left"
                                    >
                                        <div className="text-4xl font-bold text-neon-cyan mb-1">${tier.amount}</div>
                                        <div className="font-bold text-white mb-3">{tier.label}</div>
                                        <div className="text-sm text-text-secondary">{tier.perk}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-12 max-w-3xl mx-auto">
                    <div className="cyber-card p-8 text-sm text-text-secondary">
                        <strong className="text-white">Important:</strong> Contributions are treated as support for our for-profit studio.
                        They are <strong>not tax-deductible</strong> for donors. All funds are used responsibly with full transparency.
                    </div>
                </div>

                <div className="mt-16 text-center">
                    <div className="section-header mb-4">TRANSPARENCY</div>
                    <p className="text-text-muted text-sm max-w-md mx-auto mb-4">
                        Income/expense reports and project impact tracking will appear here once we begin receiving support.
                    </p>
                    <Link to="/transparency" className="text-neon-cyan hover:underline text-sm">Visit the Transparency Hub →</Link>
                </div>
            </div>
        </div>
    );
};

export default Donations;