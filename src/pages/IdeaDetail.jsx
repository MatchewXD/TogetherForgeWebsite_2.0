import { ArrowLeft, MessageCircle, Flame } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const IdeaDetail = () => {
    const { id } = useParams();
    const [comment, setComment] = useState('');
    const [comments, setComments] = useState([]);
    const [idea, setIdea] = useState(null);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [message, setMessage] = useState('');
    const [commentSortMode, setCommentSortMode] = useState('popular'); // 'popular' | 'likes' | 'newest' | 'oldest'
    const [userCommentVotes, setUserCommentVotes] = useState(new Set()); // comment IDs current user has liked
    const [replyTo, setReplyTo] = useState(null); // { id, username }
    const [replyText, setReplyText] = useState('');
    const [collapsed, setCollapsed] = useState(new Set()); // comment ids that are collapsed

    const ideaId = parseInt(id);

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            const currentUser = session?.user || null;
            setUser(currentUser);
            if (currentUser) {
                const { data: voteRows } = await supabase.from('votes').select('idea_id').eq('user_id', currentUser.id);
                // We don't need idea-level state here; IdeaDetail doesn't show a vote button for the idea itself.
                // Load comment likes for this user so we can disable re-liking.
                const { data: commentLikeRows } = await supabase.from('comment_likes').select('comment_id').eq('user_id', currentUser.id);
                if (commentLikeRows) setUserCommentVotes(new Set(commentLikeRows.map(r => r.comment_id)));
            }
        });
    }, []);

    useEffect(() => {
        const fetchIdea = async () => {
            const { data, error } = await supabase
                .from('ideas')
                .select('*')
                .eq('id', ideaId)
                .single();

            if (!error && data) {
                let creator = null;
                if (data.user_id) {
                    const { data: prof } = await supabase.from('profiles').select('username, avatar_url').eq('id', data.user_id).maybeSingle();
                    creator = prof ? { username: prof.username, avatar_url: prof.avatar_url } : null;
                }
                setIdea({ ...data, creator });
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

    const fetchComments = async () => {
        const { data: commentsData, error } = await supabase
            .from('comments')
            .select('id, content, created_at, user_id, parent_id')
            .eq('idea_id', ideaId)
            .order('created_at', { ascending: true });

        if (error || !commentsData) {
            console.error('Error fetching comments:', error);
            return;
        }

        const userIds = [...new Set(commentsData.map(c => c.user_id).filter(Boolean))];

        let profileMap = {};
        if (userIds.length > 0) {
            const { data: profilesData, error: profileError } = await supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .in('id', userIds);

            if (profileError) {
                console.error('Error fetching profiles:', profileError);
            }

            if (profilesData) {
                profileMap = Object.fromEntries(profilesData.map(p => [p.id, { username: p.username, avatar_url: p.avatar_url }]));
            }
        }

        const enriched = commentsData.map(c => ({
            ...c,
            votes: c.votes || 0,
            profiles: profileMap[c.user_id] || { username: 'User', avatar_url: null }
        }));

        setComments(enriched);
    };

    useEffect(() => {
        if (ideaId) fetchComments();
    }, [ideaId]);

    const postComment = async () => {
        if (!comment.trim() || !user) return;

        const { error } = await supabase.from('comments').insert({
            idea_id: ideaId,
            user_id: user.id,
            content: comment.trim(),
        });

        if (!error) {
            setComment('');
            fetchComments();
        } else {
            setMessage(error.message);
        }
    };

    const postReply = async () => {
        if (!replyText.trim() || !user || !replyTo) return;
        const { error } = await supabase.from('comments').insert({
            idea_id: ideaId,
            user_id: user.id,
            content: replyText.trim(),
            parent_id: replyTo.id
        });
        if (!error) {
            setReplyText('');
            setReplyTo(null);
            fetchComments();
        } else {
            setMessage(error.message);
        }
    };

    const toggleCollapse = (id) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
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

                <div className="mb-8 flex items-start justify-between gap-4">
                    <div>
                        <div className="text-xs font-mono text-neon-cyan mb-2">{idea.category}</div>
                        <h1 className="text-5xl font-bold tracking-tight text-white mb-4">{idea.title}</h1>
                        <p className="text-xl text-text-secondary">{idea.summary}</p>
                        {idea.creator && (
                            <div className="mt-1 flex items-center gap-2 text-base text-neon-cyan">
                                {idea.creator.avatar_url ? (
                                    <img src={idea.creator.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                                ) : (
                                    <div className="w-7 h-7 rounded-full bg-neon-cyan/20" />
                                )}
                                <span>{idea.creator.username}</span>
                            </div>
                        )}
                    </div>
                    {user && idea.user_id === user.id && (
                        <Link to={`/ideas/${ideaId}/edit`} className="btn-neon text-sm px-4 py-2 self-start mt-2">EDIT</Link>
                    )}
                </div>

                {idea.description && (
                    <div className="mb-10">
                        <div className="bg-cyber-surface/60 p-6 rounded border border-white/10">
                            <p className="text-text-secondary whitespace-pre-line leading-relaxed text-lg">{idea.description}</p>
                        </div>
                    </div>
                )}

                {/* Additional structured fields */}
                {(idea.inspiration || idea.tags || idea.twitch_integration || idea.multiplayer_type || idea.visual_style || idea.game_setting || idea.environmental_storytelling || idea.progression_system || idea.economy_description || idea.story_overview || idea.endgame_potential || (idea.features && idea.features.length)) && (
                    <div className="mb-10 space-y-8">
                        {idea.inspiration && (
                            <div>
                                <div className="font-mono text-sm tracking-widest text-neon-cyan mb-2">WHAT INSPIRED THIS IDEA</div>
                                <div className="text-text-secondary whitespace-pre-line">{idea.inspiration}</div>
                            </div>
                        )}
                        {idea.tags && (
                            <div>
                                <div className="font-mono text-sm tracking-widest text-neon-cyan mb-2">TAGS</div>
                                <div className="flex flex-wrap gap-2">
                                    {idea.tags.split(',').map((t, i) => <span key={i} className="px-3 py-1 text-xs rounded bg-white/5 border border-white/10 text-white/80">{t.trim()}</span>)}
                                </div>
                            </div>
                        )}
                        {idea.features && Array.isArray(idea.features) && idea.features.length > 0 && (
                            <div>
                                <div className="font-mono text-sm tracking-widest text-neon-cyan mb-3">KEY FEATURES</div>
                                <div className="space-y-3">
                                    {idea.features.map((f, idx) => (
                                        <div key={idx} className="bg-cyber-surface/60 p-4 rounded border border-white/10">
                                            <div className="font-semibold text-white mb-1">{f.name}</div>
                                            <div className="text-text-secondary text-sm whitespace-pre-line">{f.description}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {idea.multiplayer_type && <div><span className="font-mono text-xs text-neon-cyan">MULTIPLAYER:</span> <span className="text-text-secondary">{idea.multiplayer_type}</span></div>}
                        {idea.twitch_integration && <div><div className="font-mono text-sm tracking-widest text-neon-cyan mb-1">TWITCH / COMMUNITY INTEGRATION</div><div className="text-text-secondary whitespace-pre-line">{idea.twitch_integration}</div></div>}
                        {(idea.visual_style || idea.game_setting) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                {idea.visual_style && <div><span className="font-mono text-xs text-neon-cyan">VISUAL STYLE:</span> <span className="text-text-secondary">{idea.visual_style}</span></div>}
                                {idea.game_setting && <div><span className="font-mono text-xs text-neon-cyan">GAME SETTING:</span> <span className="text-text-secondary">{idea.game_setting}</span></div>}
                            </div>
                        )}
                        {idea.environmental_storytelling && <div><div className="font-mono text-sm tracking-widest text-neon-cyan mb-1">ENVIRONMENTAL STORYTELLING</div><div className="text-text-secondary whitespace-pre-line">{idea.environmental_storytelling}</div></div>}
                        {(idea.progression_system || idea.economy_description) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                {idea.progression_system && <div><span className="font-mono text-xs text-neon-cyan">PROGRESSION:</span> <span className="text-text-secondary">{idea.progression_system}</span></div>}
                                {idea.economy_description && <div><span className="font-mono text-xs text-neon-cyan">ECONOMY / CRAFTING:</span> <span className="text-text-secondary">{idea.economy_description}</span></div>}
                            </div>
                        )}
                        {(idea.story_overview || idea.endgame_potential) && (
                            <div>
                                {idea.story_overview && <div className="mb-2"><div className="font-mono text-sm tracking-widest text-neon-cyan mb-1">STORY OVERVIEW</div><div className="text-text-secondary whitespace-pre-line">{idea.story_overview}</div></div>}
                                {idea.endgame_potential && <div><div className="font-mono text-sm tracking-widest text-neon-cyan mb-1">ENDGAME / SEQUEL POTENTIAL</div><div className="text-text-secondary">{idea.endgame_potential}</div></div>}
                            </div>
                        )}
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
                    <div className="flex items-center justify-between mb-4">
                        <div className="font-mono tracking-widest text-sm text-neon-cyan flex items-center gap-2">
                            <MessageCircle className="w-5 h-5" /> DISCUSSION THREAD
                        </div>
                        <select
                            value={commentSortMode}
                            onChange={(e) => setCommentSortMode(e.target.value)}
                            className="bg-cyber-surface border border-white/20 px-3 py-1 text-xs text-white rounded"
                        >
                            <option value="popular">Most Popular</option>
                            <option value="likes">Most Likes</option>
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                        </select>
                    </div>

                    <div className="space-y-4 mb-8">
                        {comments.length === 0 && (
                            <p className="text-text-muted">No comments yet. Start the discussion below.</p>
                        )}
                        {(() => {
                            const now = Date.now();
                            const DECAY = 0.0000005;
                            const topLevel = comments.filter(c => !c.parent_id);
                            const childrenMap = {};
                            comments.forEach(c => { if (c.parent_id) { (childrenMap[c.parent_id] ||= []).push(c); } });

                            const sortFn = (a, b) => {
                                if (commentSortMode === 'popular') {
                                    const va = (a.votes || 0) * Math.exp(-DECAY * (now - (a.created_at ? Date.parse(a.created_at) : now)));
                                    const vb = (b.votes || 0) * Math.exp(-DECAY * (now - (b.created_at ? Date.parse(b.created_at) : now)));
                                    return vb - va;
                                }
                                if (commentSortMode === 'likes') return (b.votes || 0) - (a.votes || 0);
                                if (commentSortMode === 'newest') return new Date(b.created_at) - new Date(a.created_at);
                                return new Date(a.created_at) - new Date(b.created_at);
                            };

                            const renderComment = (c, depth = 0) => {
                                const replies = (childrenMap[c.id] || []).sort(sortFn);
                                const isCollapsed = collapsed.has(c.id);
                                return (
                                    <div key={c.id} className="bg-cyber-surface/60 p-4 rounded border border-white/10" style={{ marginLeft: Math.min(depth * 16, 64) + 'px' }}>
                                        <div className="flex items-center gap-2 text-sm text-neon-cyan mb-1">
                                            {c.profiles?.avatar_url ? (
                                                <img src={c.profiles.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full bg-neon-cyan/20" />
                                            )}
                                            <span>{c.profiles?.username || 'Anonymous'}</span>
                                            <button onClick={() => toggleCollapse(c.id)} className="ml-auto text-[10px] text-text-muted hover:text-white">
                                                {isCollapsed ? 'Expand' : 'Collapse'}
                                            </button>
                                        </div>
                                        {!isCollapsed && (
                                            <>
                                                <div className="text-white">{c.content}</div>
                                                <div className="flex justify-between items-center text-[10px] text-text-muted mt-2">
                                                    <span>{new Date(c.created_at).toLocaleString()}</span>
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={async () => {
                                                                if (!user) return;
                                                                const liked = userCommentVotes.has(c.id);
                                                                if (liked) {
                                                                    setComments(prev => prev.map(x => x.id === c.id ? { ...x, votes: Math.max(0, (x.votes || 0) - 1) } : x));
                                                                    setUserCommentVotes(prev => { const n = new Set(prev); n.delete(c.id); return n; });
                                                                    await supabase.from('comment_likes').delete().eq('comment_id', c.id).eq('user_id', user.id);
                                                                } else {
                                                                    setComments(prev => prev.map(x => x.id === c.id ? { ...x, votes: (x.votes || 0) + 1 } : x));
                                                                    setUserCommentVotes(prev => new Set(prev).add(c.id));
                                                                    await supabase.from('comment_likes').insert([{ comment_id: c.id, user_id: user.id }]);
                                                                }
                                                            }}
                                                            className="flex items-center gap-1 hover:text-white"
                                                            title={userCommentVotes.has(c.id) ? 'Remove like' : 'Like'}
                                                        >
                                                            <Flame className={`w-4 h-4 ${userCommentVotes.has(c.id) ? 'text-orange-500' : 'text-text-muted'}`} />
                                                            <span>{c.votes || 0}</span>
                                                        </button>
                                                        <button onClick={() => { setReplyTo({ id: c.id, username: c.profiles?.username || 'User' }); setReplyText(''); }} className="hover:text-white">Reply</button>
                                                    </div>
                                                </div>
                                                {replyTo && replyTo.id === c.id && (
                                                    <div className="mt-3 pl-6 border-l border-white/10">
                                                        <div className="text-xs text-neon-cyan mb-1">Replying to @{replyTo.username}</div>
                                                        <div className="flex gap-2">
                                                            <input
                                                                className="flex-1 bg-cyber-surface border border-white/20 px-3 py-2 text-sm text-white rounded"
                                                                placeholder="Write a reply..."
                                                                value={replyText}
                                                                onChange={e => setReplyText(e.target.value)}
                                                                onKeyDown={e => e.key === 'Enter' && postReply()}
                                                            />
                                                            <button onClick={postReply} className="btn-primary px-4 text-sm">Send</button>
                                                            <button onClick={() => { setReplyTo(null); setReplyText(''); }} className="px-3 text-xs text-text-muted hover:text-white">Cancel</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {!isCollapsed && replies.length > 0 && (
                                            <div className="mt-3 space-y-3 border-l border-white/10 pl-4">
                                                {replies.map(r => renderComment(r, depth + 1))}
                                            </div>
                                        )}
                                    </div>
                                );
                            };

                            return topLevel.sort(sortFn).map(c => renderComment(c));
                        })()}
                    </div>

                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder={user ? "Write a comment..." : "Log in to comment"}
                            className="flex-1 bg-cyber-surface border border-white/20 px-5 py-4 text-white focus:border-neon-cyan outline-none rounded"
                            onKeyDown={(e) => e.key === 'Enter' && postComment()}
                            disabled={!user}
                        />
                        <button onClick={postComment} disabled={!user} className="btn-primary px-8 disabled:opacity-50">
                            Post
                        </button>
                    </div>
                    {!user && <p className="text-xs text-text-muted mt-2">You must be logged in to post comments.</p>}
                </div>
            </div>
        </div>
    );
};

export default IdeaDetail;