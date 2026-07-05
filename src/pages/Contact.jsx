import { ArrowLeft, Mail, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const Contact = () => {
    return (
        <div className="pt-20 min-h-screen">
            {/* Header Wrapper */}
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

                    <form className="space-y-8">
                        <div>
                            <label className="block text-sm font-mono tracking-widest mb-2 text-neon-cyan">NAME</label>
                            <input type="text" className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none" placeholder="Your name" />
                        </div>
                        <div>
                            <label className="block text-sm font-mono tracking-widest mb-2 text-neon-cyan">EMAIL</label>
                            <input type="email" className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none" placeholder="your@email.com" />
                        </div>
                        <div>
                            <label className="block text-sm font-mono tracking-widest mb-2 text-neon-cyan">MESSAGE</label>
                            <textarea rows="8" className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none" placeholder="Your message..."></textarea>
                        </div>
                        <button type="submit" className="btn-primary btn-neon w-full py-5 text-lg">
                            SEND MESSAGE
                        </button>
                    </form>
                </div>

                <div className="text-center mt-12 text-text-muted text-sm">
                    Or join the conversation on <a href="#" className="text-neon-cyan hover:underline">Discord</a>
                </div>
            </div>
        </div>
    );
};

export default Contact;