import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const FAQ = () => {
    const faqs = [
        {
            q: "Is Together Forge a non-profit?",
            a: "No. We are a community-first independent studio. Profits are reinvested into growth and making better games."
        },
        {
            q: "How can I contribute?",
            a: "Submit ideas, volunteer your skills (development, content creation, moderation, etc.), or support us through donations."
        },
        {
            q: "Will contributors get credit?",
            a: "Yes. All contributions are publicly credited. We value transparency and recognition."
        },
        {
            q: "What is the Early Game?",
            a: "A small, fun multiplayer game designed to test our community systems and prove the concept."
        },
        {
            q: "How do I submit a game idea?",
            a: "Go to Game Ideas and use the submission form. The community will see and discuss it."
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
                        <div className="section-header">FAQ</div>
                        <h1 className="text-5xl font-bold tracking-tight text-white">Frequently Asked Questions</h1>
                    </div>
                </div>
            </div>

            <div className="container-custom py-12 max-w-3xl">
                <div className="space-y-10">
                    {faqs.map((faq, index) => (
                        <div key={index} className="border-b border-white/10 pb-8">
                            <h3 className="text-xl font-bold text-white mb-4">{faq.q}</h3>
                            <p className="text-text-secondary leading-relaxed">{faq.a}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-16 text-center text-text-muted">
                    Have more questions? <Link to="/get-involved" className="text-neon-cyan hover:underline">Get Involved</Link> or reach out.
                </div>
            </div>
        </div>
    );
};

export default FAQ;