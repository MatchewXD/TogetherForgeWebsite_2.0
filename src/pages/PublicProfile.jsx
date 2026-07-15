import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import UserAvatar from '../components/ui/UserAvatar';

const PublicProfile = () => {
    const { username } = useParams();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setNotFound(false);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('username', username)
                .maybeSingle();

            if (error || !data) {
                setNotFound(true);
            } else {
                setProfile(data);
            }
            setLoading(false);
        };
        if (username) load();
    }, [username]);

    const chip = (text) => (text || '').split(',').map(t => t.trim()).filter(Boolean);

    if (loading) return <div className="pt-20 text-center">Loading...</div>;
    if (notFound || !profile) return (
        <div className="pt-20 min-h-screen">
            <div className="container-custom py-12 max-w-3xl">
                <Link to="/ideas" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8"><ArrowLeft className="w-4 h-4" /> BACK</Link>
                <div className="text-2xl">Profile not found.</div>
            </div>
        </div>
    );

    return (
        <div className="pt-20 min-h-screen">
            <div className="container-custom py-12 max-w-5xl">
                <Link to="/ideas" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8"><ArrowLeft className="w-4 h-4" /> BACK</Link>

                <div className="relative mb-8">
                    <div className="h-48 w-full rounded-xl overflow-hidden bg-cyber-surface border border-white/10">
                        {profile.banner_url ? (
                            <img src={profile.banner_url} alt="Banner" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-[radial-gradient(circle_at_center,#00f9ff08_0%,transparent_70%)]" />
                        )}
                    </div>
                    <div className="-mt-16 ml-6 relative z-10 flex items-end gap-4">
                        <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-cyber-bg bg-cyber-surface">
                            <UserAvatar
                                src={profile.avatar_url}
                                name={profile.username}
                                size="xl"
                                className="!w-28 !h-28"
                                borderClass="border-0"
                                alt={`${profile.username}'s avatar`}
                            />
                        </div>
                        <div className="mb-2">
                            <div className="text-3xl font-bold tracking-tight">{profile.username}</div>
                            <div className="text-xs text-text-muted">Member since {new Date(profile.joined_at || Date.now()).getFullYear()}</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4 space-y-6">
                        <div className="cyber-card p-6">
                            <div className="font-mono tracking-widest text-xs text-neon-cyan mb-3">CONTACT</div>
                            <div className="space-y-2 text-sm">
                                {profile.discord && <div className="text-text-secondary">Discord: <span className="text-white">{profile.discord}</span></div>}
                                {profile.youtube && <a href={`https://youtube.com/@${profile.youtube.replace('@','')}`} target="_blank" rel="noreferrer" className="block text-neon-cyan hover:underline">YouTube</a>}
                                {profile.twitch && <a href={`https://twitch.tv/${profile.twitch}`} target="_blank" rel="noreferrer" className="block text-neon-cyan hover:underline">Twitch</a>}
                                {profile.x_handle && <a href={`https://x.com/${profile.x_handle.replace('@','')}`} target="_blank" rel="noreferrer" className="block text-neon-cyan hover:underline">X</a>}
                                {!profile.discord && !profile.youtube && !profile.twitch && !profile.x_handle && (
                                    <div className="text-text-muted">No external links set.</div>
                                )}
                            </div>
                        </div>

                        <div className="cyber-card p-6">
                            <div className="font-mono tracking-widest text-xs text-neon-cyan mb-3">SIGNATURE</div>
                            <div className="text-sm text-text-secondary whitespace-pre-wrap">{profile.signature || '—'}</div>
                        </div>
                    </div>

                    <div className="lg:col-span-8 space-y-8">
                        <div className="cyber-card p-8">
                            <div className="font-mono tracking-widest text-xs text-neon-cyan mb-3">BIO</div>
                            {profile.bio ? (
                                <div className="prose prose-invert max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{profile.bio}</ReactMarkdown>
                                </div>
                            ) : (
                                <p className="text-text-muted">No bio yet.</p>
                            )}
                        </div>

                        {[
                            { label: 'INTERESTS', key: 'interests' },
                            { label: 'FAVORITE GAMES', key: 'favorite_games' },
                            { label: 'FAVORITE GAME TYPES', key: 'favorite_game_types' }
                        ].map(({ label, key }) => {
                            const items = chip(profile[key]);
                            return (
                                <div key={key} className="cyber-card p-8">
                                    <div className="font-mono tracking-widest text-xs text-neon-cyan mb-4">{label}</div>
                                    {items.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {items.map((t, i) => (
                                                <span key={i} className="px-3 py-1 text-sm rounded border border-white/20 bg-cyber-surface/60">{t}</span>
                                            ))}
                                        </div>
                                    ) : <div className="text-text-muted">None listed.</div>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicProfile;
