import { ArrowLeft, Users, Hammer, Video, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

const GetInvolved = () => {
    const ways = [
        {
            icon: Hammer,
            title: "Game Development",
            desc: "Code, design mechanics, art, sound, or testing. Help build Early Game and beyond."
        },
        {
            icon: Video,
            title: "Content Creation",
            desc: "Make videos, thumbnails, social posts, or streams to promote Together Forge. (Paid when we have consistent income)"
        },
        {
            icon: Users,
            title: "Community & Moderation",
            desc: "Help review ideas, manage discussions, welcome new members."
        },
        {
            icon: Heart,
            title: "Other Skills",
            desc: "Marketing, writing, translation, bug reporting, every skill helps."
        }
    ];

    return (
        <div className="pt-20 min-h-screen">
            {/* Header Wrapper like About page */}
            <div className="border-b border-white/10 bg-cyber-surface py-16">
                <div className="container-custom">
                    <Link to="/" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO HOME
                    </Link>

                    <div>
                        <div className="section-header">GET INVOLVED</div>
                        <h1 className="text-5xl font-bold tracking-tight text-white mb-6">Be part of the Forge</h1>
                        <p className="max-w-2xl text-xl text-text-secondary">
                            Together Forge is built by volunteers and community members.
                            Whether you want to make games, create content, or help run things, there's a place for you.
                        </p>
                    </div>
                </div>
            </div>

            <div className="container-custom py-12">
                <div className="grid md:grid-cols-2 gap-6">
                    {ways.map((way, index) => (
                        <div key={index} className="cyber-card p-8">
                            <div className="flex items-center gap-4 mb-6">
                                <way.icon className="w-8 h-8 text-neon-cyan" />
                                <h3 className="text-2xl font-bold text-white">{way.title}</h3>
                            </div>
                            <p className="text-text-secondary leading-relaxed">{way.desc}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-16 text-center">
                    <Link to="/ideas" className="btn-primary btn-neon inline-block px-10 py-4 text-lg">
                        START BY SUBMITTING AN IDEA
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default GetInvolved;