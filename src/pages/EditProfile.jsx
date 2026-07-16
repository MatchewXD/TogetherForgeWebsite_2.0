import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { publicProfilePath } from '../utils/profileLinks';

const EditProfile = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [bio, setBio] = useState('');
    const [interests, setInterests] = useState('');
    const [favoriteGames, setFavoriteGames] = useState('');
    const [favoriteTypes, setFavoriteTypes] = useState('');
    const [discord, setDiscord] = useState('');
    const [youtube, setYoutube] = useState('');
    const [twitch, setTwitch] = useState('');
    const [xHandle, setXHandle] = useState('');
    const [signature, setSignature] = useState('');

    // Tag input helpers (comma-separated strings <-> chips)
    const TagInput = ({ label, value, onChange }) => {
        const [draft, setDraft] = useState('');
        const tags = value ? value.split(',').map(t => t.trim()).filter(Boolean) : [];

        const addTag = () => {
            const t = draft.trim();
            if (!t) return;
            if (tags.includes(t)) { setDraft(''); return; }
            const next = [...tags, t].join(', ');
            onChange(next);
            setDraft('');
        };
        const removeTag = (tag) => {
            const next = tags.filter(t => t !== tag).join(', ');
            onChange(next);
        };
        const onKeyDown = (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTag();
            }
        };

        return (
            <div className="mb-4">
                <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">{label}</label>
                <div className="flex flex-wrap gap-2 mb-2">
                    {tags.length === 0 && <span className="text-xs text-text-muted">No tags yet</span>}
                    {tags.map((tag, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 bg-cyber-surface border border-white/20 px-3 py-1 rounded text-sm">
                            {tag}
                            <button type="button" onClick={() => removeTag(tag)} className="text-neon-cyan hover:text-white">×</button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input
                        className="flex-1 bg-cyber-surface border border-white/20 p-3 text-white outline-none rounded"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={onKeyDown}
                        onBlur={addTag}
                        placeholder="Type and press Enter"
                    />
                    <button type="button" onClick={addTag} className="btn-neon px-4">Add</button>
                </div>
            </div>
        );
    };

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                navigate('/profile');
                return;
            }
            setUser(session.user);

            const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
            if (data) {
                setProfile(data);
                setBio(data.bio || data.about || '');
                setInterests(data.interests || '');
                setFavoriteGames(data.favorite_games || '');
                setFavoriteTypes(data.favorite_game_types || '');
                setDiscord(data.discord || '');
                setYoutube(data.youtube || '');
                setTwitch(data.twitch || '');
                setXHandle(data.x_handle || '');
                setSignature(data.signature || '');
            }
        };
        init();
    }, [navigate]);

    const save = async () => {
        if (!user) return;
        setLoading(true);
        const { error, data } = await supabase.from('profiles').update({
            bio: bio || null,
            interests: interests || null,
            favorite_games: favoriteGames || null,
            favorite_game_types: favoriteTypes || null,
            discord: discord || null,
            youtube: youtube || null,
            twitch: twitch || null,
            x_handle: xHandle || null,
            signature: signature || null,
        }).eq('id', user.id).select().single();

        if (error) {
            console.error('Save failed:', error.message);
            setLoading(false);
            return;
        }

        navigate('/profile');
    };

    return (
        <div className="pt-20 min-h-screen">
            <div className="border-b border-white/10 bg-cyber-surface py-16">
                <div className="container-custom">
                    <Link to="/profile" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8">Back to Profile</Link>
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                        <div>
                            <div className="section-header">EDIT PROFILE</div>
                            <h1 className="text-4xl font-bold tracking-tight text-white">Edit your profile</h1>
                        </div>
                        {publicProfilePath(profile?.username) && (
                            <Link
                                to={publicProfilePath(profile.username)}
                                className="text-xs px-4 py-2 rounded-full border border-neon-cyan/40 hover:border-neon-cyan text-neon-cyan bg-neon-cyan/5 font-mono tracking-widest uppercase self-start sm:self-auto"
                            >
                                View Public Profile
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            <div className="container-custom py-16 max-w-2xl">
                <div className="cyber-card p-8">
                    <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">Bio (Markdown supported)</label>
                    <textarea className="w-full bg-cyber-surface border border-white/20 p-3 text-white outline-none mb-4 min-h-[120px]" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1000}></textarea>

                    <TagInput label="Interests" value={interests} onChange={setInterests} />
                    <TagInput label="Favorite Games" value={favoriteGames} onChange={setFavoriteGames} />
                    <TagInput label="Favorite Game Types" value={favoriteTypes} onChange={setFavoriteTypes} />

                    <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">Discord</label>
                    <input className="w-full bg-cyber-surface border border-white/20 p-3 text-white outline-none mb-4" value={discord} onChange={(e) => setDiscord(e.target.value)} />

                    <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">YouTube</label>
                    <input className="w-full bg-cyber-surface border border-white/20 p-3 text-white outline-none mb-4" value={youtube} onChange={(e) => setYoutube(e.target.value)} />

                    <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">Twitch</label>
                    <input className="w-full bg-cyber-surface border border-white/20 p-3 text-white outline-none mb-4" value={twitch} onChange={(e) => setTwitch(e.target.value)} />

                    <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">X (Twitter)</label>
                    <input className="w-full bg-cyber-surface border border-white/20 p-3 text-white outline-none mb-4" value={xHandle} onChange={(e) => setXHandle(e.target.value)} />

                    <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">Signature</label>
                    <input className="w-full bg-cyber-surface border border-white/20 p-3 text-white outline-none mb-6" value={signature} onChange={(e) => setSignature(e.target.value)} maxLength={200} />

                    <div className="flex gap-3">
                        <button onClick={save} className="btn-primary btn-neon px-4 py-2" disabled={loading}>{loading ? 'SAVING...' : 'SAVE'}</button>
                        <Link to="/profile" className="btn-neon px-4 py-2">CANCEL</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditProfile;
