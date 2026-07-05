import { useState } from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const Contact = () => {
    const [formData, setFormData] = useState({ name: '', email: '', message: '' });
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        const submissions = JSON.parse(localStorage.getItem('tf_contact_messages') || '[]');
        submissions.push({ ...formData, timestamp: Date.now() });
        localStorage.setItem('tf_contact_messages', JSON.stringify(submissions));
        setSubmitted(true);
        setFormData({ name: '', email: '', message: '' });
    };

    return (
        <div className="pt-20 min-h-screen">
            <div className="border-b border-white/10 bg-cyber-surface py-16">
                <div className="container-custom">
                    <Link to="/" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO HOME
                    </Link>

                    <div>
                        <div className="section-header">CONTACT</div>
                        <h1 className="text-5xl font-bold tracking-tight text-white">Get in touch with the Forge</h1>
                    </div>
                </div>
            </div>

            <div className="container-custom py-12 max-w-2xl">
                <div className="cyber-card p-10">
                    <div className="text-center mb-10">
                        <MessageCircle className="w-16 h-16 mx-auto text-neon-cyan mb-6" />
                        <p className="text-text-secondary">
                            Have questions, ideas, or want to collaborate? Reach out below or join our community on Discord.
                        </p>
                    </div>

                    {submitted ? (
                        <div className="text-center py-10 text-neon-cyan">
                            Thank you! Your message has been received.
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <div>
                                <label className="block text-sm font-mono tracking-widest mb-2 text-neon-cyan">NAME</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none"
                                    placeholder="Your name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-mono tracking-widest mb-2 text-neon-cyan">EMAIL</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none"
                                    placeholder="your@email.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-mono tracking-widest mb-2 text-neon-cyan">MESSAGE</label>
                                <textarea
                                    rows="8"
                                    required
                                    className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none"
                                    placeholder="Your message..."
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                />
                            </div>
                            <button type="submit" className="btn-primary btn-neon w-full py-5 text-lg">
                                SEND MESSAGE
                            </button>
                        </form>
                    )}
                </div>

                <div className="text-center mt-12 text-text-muted text-sm">
                    Or join the conversation on <a href="#" className="text-neon-cyan hover:underline">Discord</a>
                </div>
            </div>
        </div>
    );
};

export default Contact;