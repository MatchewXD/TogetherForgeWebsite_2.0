import { ArrowLeft, MessageCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const IdeaDetail = () => {
    const { id } = useParams();
    const [comment, setComment] = useState('');
    const [threads, setThreads] = useState({});
    const [idea, setIdea] = useState(null);
    const [loading, setLoading] = useState(true);

    const ideaId = parseInt(id);

    useEffect(() => {
        const fetchIdea = async () => {
            const { data, error } = await supabase
                .from('ideas')
                .select('*')
                .eq('id', ideaId)
                .single();

            if (!error && data) {
                setIdea(data);
            } else {
                setIdea({
                    id: ideaId,
                    title: "Idea not found",
                    summary: "This idea does not exist or could not be loaded.",
                    category: "Unknown",
                    votes: 0
                });
            }
            setLoading(false);
        };
        fetchIdea();
    }, [ideaId]);

    const addComment = () => {
        if (!comment.trim()) return;
        const current = threads[ideaId] || [];
        setThreads({ ...threads, [ideaId]: [...current, { text: comment.trim(), replies: [] }] });
        setComment('');
    };

    if (loading) {
        return <div className="pt-20 text-center">Loading...</div>;
    }

    if (!idea) {
        return <div className="pt-20 text-center">Idea not found.</div>;
    }

    return (
        <div className="pt-20 min-h-screen">
            <div className="container-custom py-12 max-w-4xl">
                <Link to="/ideas" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO IDEAS
                </Link>

                <div className="mb-8">
                    <div className="text-xs font-mono text-neon-cyan mb-2">{idea.category}</div>
                    <h1 className="text-5xl font-bold tracking-tight text-white mb-4">{idea.title}</h1>
                    <p className="text-xl text-text-secondary">{idea.summary}</p>
                </div>

                {idea.description && (
                    <div className="mb-10">
                        <div className="bg-cyber-surface/60 p-6 rounded border border-white/10">
                            <p className="text-text-secondary whitespace-pre-line leading-relaxed text-lg">{idea.description}</p>
                        </div>
                    </div>
                )}

                {idea.features && idea.features.length > 0 && idea.features[0].name && (
                    <div className="mb-10">
                        <h2 className="font-mono text-sm tracking-widest text-neon-cyan mb-4">KEY FEATURES</h2>
                        <div className="space-y-4">
                            {idea.features.map((f, i) => (
                                <div key={i} className="bg-cyber-surface/60 p-5 rounded border border-white/10">
                                    <div className="font-bold text-white mb-1">{f.name}</div>
                                    <div className="text-text-secondary">{f.description}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="border-t border-white/10 pt-10">
                    <div className="flex items-center gap-2 mb-6 text-neon-cyan">
                        <MessageCircle className="w-5 h-5" /> <span className="font-mono tracking-widest text-sm">DISCUSSION THREAD</span>
                    </div>

                    <div className="space-y-4 mb-8">
                        {(threads[ideaId] || []).length === 0 && (
                            <p className="text-text-muted">No comments yet. Start the discussion below.</p>
                        )}
                        {(threads[ideaId] || []).map((c, i) => (
                            <div key={i} className="bg-cyber-surface/60 p-5 rounded border border-white/10">
                                {c.text}
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Write a comment or reply..."
                            className="flex-1 bg-cyber-surface border border-white/20 px-5 py-4 text-white focus:border-neon-cyan outline-none rounded"
                            onKeyDown={(e) => e.key === 'Enter' && addComment()}
                        />
                        <button onClick={addComment} className="btn-primary px-8">Post</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IdeaDetail;