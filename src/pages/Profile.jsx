import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, User, Camera } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useIsModerator } from '../hooks/useIsModerator';
import Cropper from 'react-easy-crop';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const Profile = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState(null);
    const [profileData, setProfileData] = useState(null);
    const [form, setForm] = useState({ username: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [profileLoading, setProfileLoading] = useState(true);
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [message, setMessage] = useState('');
    const [showUsernameModal, setShowUsernameModal] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [usernameAvailable, setUsernameAvailable] = useState(null);
    const [usernameError, setUsernameError] = useState('');
    const [confirmedPermanent, setConfirmedPermanent] = useState(false);
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [bio, setBio] = useState('');
    const [editingBio, setEditingBio] = useState(false);

    // Avatar state
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const { isModerator } = useIsModerator();

    useEffect(() => {
        const init = async () => {
            setProfileLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUser(session.user);
                await fetchProfile(session.user.id, session.user.email);
            }
            setProfileLoading(false);
        };
        init();

        const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setProfileLoading(true);
            const newUser = session?.user || null;
            setUser(newUser);
            if (newUser) {
                await fetchProfile(newUser.id, newUser.email);
            } else {
                setProfileData(null);
            }
            setProfileLoading(false);
        });

        return () => listener.subscription.unsubscribe();
    }, []);

    // Re-fetch profile when navigating back to /profile (e.g., after EditProfile save)
    useEffect(() => {
        const refresh = async () => {
            if (user?.id) {
                const { data: existing } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
                if (existing) {
                    setProfileData(existing);
                    setBio(existing.bio || existing.about || '');
                }
            }
        };
        if (location.pathname === '/profile') {
            refresh();
        }
    }, [location.pathname, user]);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setUsernameError('');
        try {
            if (mode === 'register') {
                const username = (form.username || '').trim();
                if (!username) {
                    setUsernameError('Username is required');
                    setLoading(false);
                    return;
                }
                // Check for existing username (case-insensitive)
                const { data: existing } = await supabase
                    .from('profiles')
                    .select('id')
                    .ilike('username', username)
                    .maybeSingle();
                if (existing) {
                    setUsernameError('Username already taken');
                    setLoading(false);
                    return;
                }

                const { data, error } = await supabase.auth.signUp({
                    email: form.email,
                    password: form.password,
                });
                if (error) throw error;
                if (data.user) {
                    // Use upsert to guarantee profile row exists
                    await supabase.from('profiles').upsert({
                        id: data.user.id,
                        username: username,
                        email: form.email,
                        bio: null,
                    }, { onConflict: 'id' });

                    // Wait until the profile row is visible with the username to avoid "No username" flash
                    let readyProfile = null;
                    for (let i = 0; i < 12 && !readyProfile; i++) {
                        const { data: prof } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
                        if (prof && prof.username) readyProfile = prof;
                        else await new Promise(r => setTimeout(r, 250));
                    }

                    if (data.session) {
                        navigate('/profile', { replace: true, state: { profile: readyProfile } });
                    } else {
                        localStorage.setItem('pending_confirmation_email', form.email);
                        navigate('/confirm-email', { replace: true });
                    }
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email: form.email,
                    password: form.password,
                });
                if (error) {
                    setMessage(error.message);
                    setLoading(false);
                    return;
                }
                navigate('/profile', { replace: true });
            }
        } catch (err) {
            setMessage(err.message || 'Failed to update username');
        } finally {
            setLoading(false);
        }
    };

    const fetchProfile = async (userId, userEmail) => {
        // Always try to fetch existing profile first
        const { data: existing, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            console.error('Profile fetch error:', error);
        }

        if (existing) {
            setProfileData(existing);
            setNewUsername(existing.username || '');
            setBio(existing.bio || existing.about || '');
            return;
        }

        // Profile doesn't exist - upsert so we never wipe a username that arrived via registration
        const { data: newProfile, error: upsertError } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                email: userEmail || null,
            }, { onConflict: 'id' })
            .select()
            .single();

        if (upsertError) {
            console.error('Profile upsert error:', upsertError);
            return;
        }

        if (newProfile) {
            setProfileData(newProfile);
            setNewUsername(newProfile.username || '');
            setBio(newProfile.bio || newProfile.about || '');
        }
    };

    // Real-time availability check (debounced)
    useEffect(() => {
        if (!showUsernameModal) return;

        const checkUsername = async () => {
            const username = newUsername.trim();
            if (!username) {
                setUsernameAvailable(null);
                setUsernameError('');
                return;
            }

            // Validation
            if (username.length < 3) {
                setUsernameError('Username must be at least 3 characters');
                setUsernameAvailable(false);
                return;
            }
            if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                setUsernameError('Only letters, numbers, and underscores allowed');
                setUsernameAvailable(false);
                return;
            }

            setCheckingUsername(true);
            setUsernameError('');

            // Check if taken (case-insensitive)
            const { data: existing } = await supabase
                .from('profiles')
                .select('id')
                .ilike('username', username)
                .neq('id', user?.id)
                .maybeSingle();

            // Check recent history (rate limit: 30 days)
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const { data: history } = await supabase
                .from('username_history')
                .select('id')
                .eq('user_id', user?.id)
                .gte('changed_at', thirtyDaysAgo)
                .limit(1);

            if (existing) {
                setUsernameAvailable(false);
                setUsernameError('Username is already taken');
            } else if (history && history.length > 0) {
                setUsernameAvailable(false);
                setUsernameError('You can only change your username once every 30 days');
            } else {
                setUsernameAvailable(true);
            }
            setCheckingUsername(false);
        };

        const timeout = setTimeout(checkUsername, 400);
        return () => clearTimeout(timeout);
    }, [newUsername, showUsernameModal, user?.id]);

    const openUsernameModal = () => {
        setNewUsername(profileData?.username || '');
        setUsernameAvailable(null);
        setUsernameError('');
        // no-op: ensure file indexing includes this file
        setConfirmedPermanent(false);
        setShowUsernameModal(true);
    };

    const closeUsernameModal = () => {
        setShowUsernameModal(false);
        setConfirmedPermanent(false);
    };

    const submitUsernameChange = async () => {
        if (!user || !newUsername.trim() || !usernameAvailable || !confirmedPermanent) return;

        setLoading(true);

        const oldUsername = profileData?.username;

        // Log old username to history
        if (oldUsername) {
            await supabase.from('username_history').insert({
                user_id: user.id,
                old_username: oldUsername,
            });
        }

        // Update profile
        const { error } = await supabase
            .from('profiles')
            .update({ username: newUsername.trim() })
            .eq('id', user.id);

        if (!error) {
            setProfileData({ ...profileData, username: newUsername.trim() });
            closeUsernameModal();
        } else {
            setMessage(error.message || 'Authentication failed');
        }
        setLoading(false);
    };

    // Clear transient message when switching modes
    const switchMode = (newMode) => {
        setMode(newMode);
        setMessage('');
    };

    // Avatar handlers
    const openAvatarModal = () => {
        setAvatarFile(null);
        setAvatarPreview(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setShowAvatarModal(true);
    };

    const closeAvatarModal = () => {
        setShowAvatarModal(false);
        setAvatarFile(null);
        setAvatarPreview(null);
    };

    const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleAvatarSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Allowed types: JPEG, PNG, WebP only + max 2MB
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setMessage('Only JPEG, PNG, and WebP images are allowed.');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setMessage('File size must be under 2MB.');
            return;
        }

        setAvatarFile(file);
        const reader = new FileReader();
        reader.onload = () => setAvatarPreview(reader.result);
        reader.readAsDataURL(file);
    };

    const createCroppedImage = async () => {
        if (!avatarPreview || !croppedAreaPixels) return null;

        const image = await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = avatarPreview;
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 256;
        canvas.width = size;
        canvas.height = size;

        ctx.drawImage(
            image,
            croppedAreaPixels.x,
            croppedAreaPixels.y,
            croppedAreaPixels.width,
            croppedAreaPixels.height,
            0,
            0,
            size,
            size
        );

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.9);
        });
    };

    const uploadAvatar = async () => {
        if (!user || !avatarFile) return;

        setLoading(true);
        try {
            const croppedFile = await createCroppedImage();
            if (!croppedFile) throw new Error('Failed to crop image');

            const fileExt = croppedFile.name.split('.').pop();
            const storagePath = `${user.id}/avatar.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(storagePath, croppedFile, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(storagePath);

            const finalUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

            const { error: updateError, count } = await supabase
                .from('profiles')
                .update({ avatar_url: finalUrl })
                .eq('id', user.id);

            if (updateError) {
                setMessage('Failed to save avatar URL (UPDATE blocked by RLS).');
                setLoading(false);
                return;
            }

            if (count === 0) {
                const { error: insertError } = await supabase
                    .from('profiles')
                    .insert({
                        id: user.id,
                        email: user.email,
                        avatar_url: finalUrl,
                    });

                if (insertError) {
                    setMessage('Failed to save avatar URL (INSERT blocked by RLS).');
                    setLoading(false);
                    return;
                }
            }

            await fetchProfile(user.id, user.email);
            closeAvatarModal();
        } catch (err) {
            setMessage(err.message || 'Upload failed');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setForm({ username: '', email: '', password: '' });
    };

    return (
        <div className="pt-20 min-h-screen">
            <div className="border-b border-white/10 bg-cyber-surface py-16">
                <div className="container-custom">
                    <Link to="/" className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" /> BACK TO HOME
                    </Link>

                    <div>
                        <div className="section-header">PROFILE</div>
                        <h1 className="text-5xl font-bold tracking-tight text-white">Your Forge Account</h1>
                    </div>
                </div>
            </div>

            <div className="container-custom py-16 max-w-5xl">
                {!user ? (
                    <form onSubmit={handleAuth} className="cyber-card p-10 space-y-6">
                        {message && (
                            <p className={`text-sm text-center mb-2 ${/invalid|credentials|failed|error/i.test(message) ? 'text-red-400 font-semibold' : 'text-neon-cyan'}`}>
                                {message}
                            </p>
                        )}
                        {mode === 'register' && (
                            <div>
                                <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">USERNAME</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none"
                                    value={form.username}
                                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                                />
                                {usernameError && <p className="text-xs text-red-400 mt-1">{usernameError}</p>}
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">EMAIL</label>
                            <input
                                type="email"
                                required
                                className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">PASSWORD</label>
                            <input
                                type="password"
                                required
                                className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                            />
                        </div>
                        <button type="submit" disabled={loading} className="btn-primary btn-neon w-full py-4 text-lg">
                            {loading ? 'PLEASE WAIT...' : mode === 'login' ? 'LOG IN' : 'REGISTER'}
                        </button>
                        <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')} className="text-xs text-neon-cyan hover:underline w-full">
                            {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Log in'}
                        </button>
                        <p className="text-xs text-text-muted text-center">Uses Supabase Auth — data stored securely.</p>
                    </form>
                ) : profileLoading ? (
                    <div className="cyber-card p-10 flex flex-col items-center justify-center min-h-[200px]">
                        <div className="w-8 h-8 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-text-muted text-sm">Loading profile...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Sidebar - Profile Card */}
                        <div className="lg:col-span-4">
                            <div className="cyber-card overflow-hidden">
                                {/* Banner */}
                                <div className="h-24 bg-gradient-to-r from-neon-cyan/10 via-white/5 to-neon-cyan/10" />

                                <div className="px-6 pb-6 -mt-10">
                                    {/* Avatar */}
                                    <div className="relative inline-block mb-4">
                                        <div className="relative w-28 h-28 rounded-full ring-4 ring-cyber-surface overflow-hidden border border-white/10 bg-cyber-surface">
                                            {profileData?.avatar_url ? (
                                                <img src={profileData.avatar_url} alt="Avatar" className="w-28 h-28 object-cover" />
                                            ) : (
                                                <div className="w-28 h-28 flex items-center justify-center">
                                                    <User className="w-14 h-14 text-neon-cyan" />
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={openAvatarModal} className="absolute bottom-2 right-2 bg-cyber-surface border border-white/20 rounded-full p-2 hover:border-neon-cyan" title="Change profile picture">
                                            <Camera className="w-4 h-4 text-neon-cyan" />
                                        </button>
                                    </div>

                                    {/* Name & Actions */}
                                    <div className="mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="text-2xl font-bold tracking-tight text-white">{profileData?.username || 'No username'}</div>
                                            {isModerator && (
                                                <span className="px-2 py-0.5 text-[10px] font-mono tracking-widest border border-neon-cyan text-neon-cyan rounded">MODERATOR</span>
                                            )}
                                        </div>
                                        <div className="text-text-secondary text-sm mb-3">{user.email}</div>

                                        <div className="flex flex-wrap gap-2">
                                            <button onClick={openUsernameModal} className="text-xs px-3 py-1.5 rounded-full border border-white/20 hover:border-neon-cyan text-neon-cyan">Change username</button>
                                            <Link to="/profile/edit" className="text-xs px-3 py-1.5 rounded-full border border-white/20 hover:border-neon-cyan text-neon-cyan">Edit profile</Link>
                                        </div>
                                    </div>

                                    {/* Meta */}
                                    <div className="text-xs text-text-muted mt-4 pt-4 border-t border-white/10">
                                        Member since {new Date(user.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="lg:col-span-8 space-y-6">
                            {/* Bio Section */}
                            <div className="cyber-card p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="text-sm font-mono tracking-widest text-neon-cyan">BIO</div>
                                </div>
                                {editingBio ? (
                                    <div>
                                        <textarea
                                            className="w-full bg-cyber-surface border border-white/20 p-3 text-white focus:border-neon-cyan outline-none resize-y min-h-[120px]"
                                            value={bio}
                                            maxLength={300}
                                            onChange={(e) => setBio(e.target.value)}
                                        />
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={async () => {
                                                    setLoading(true);
                                                    const { data: updated, error } = await supabase.from('profiles').update({ bio: bio || null }).eq('id', user.id).select().single();
                                                    if (!error && updated) {
                                                        setProfileData(updated);
                                                        setBio(updated.bio || '');
                                                    } else if (error) {
                                                        setMessage('Failed to save: ' + error.message);
                                                    }
                                                    setEditingBio(false);
                                                    setLoading(false);
                                                }}
                                                className="btn-primary btn-neon px-4 py-1.5 text-sm"
                                            >
                                                SAVE
                                            </button>
                                            <button onClick={() => { setEditingBio(false); setBio(profileData?.bio || ''); }} className="btn-neon px-4 py-1.5 text-sm">CANCEL</button>
                                        </div>
                                        <div className="text-[10px] text-text-muted mt-1.5">{bio.length}/300</div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-text-secondary min-h-[3rem]">
                                        {profileData?.bio ? (
                                            <div className="prose prose-invert break-words">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{profileData.bio}</ReactMarkdown>
                                            </div>
                                        ) : (
                                            <span className="text-text-muted italic">No bio yet. Add one in Edit Profile.</span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Details Grid */}
                            <div className="cyber-card p-6">
                                <div className="text-sm font-mono tracking-widest text-neon-cyan mb-4">DETAILS</div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                    {profileData?.interests && (
                                        <div>
                                            <div className="text-xs uppercase tracking-[2px] text-text-muted mb-1.5">Interests</div>
                                            <div className="flex flex-wrap gap-2">
                                                {profileData.interests.split(',').map((t, i) => {
                                                    const v = t.trim();
                                                    return v ? <span key={i} className="inline-block px-3 py-1 text-xs rounded-full border border-white/20 bg-white/5 text-text-secondary">{v}</span> : null;
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {profileData?.favorite_games && (
                                        <div>
                                            <div className="text-xs uppercase tracking-[2px] text-text-muted mb-1.5">Favorite Games</div>
                                            <div className="flex flex-wrap gap-2">
                                                {profileData.favorite_games.split(',').map((t, i) => {
                                                    const v = t.trim();
                                                    return v ? <span key={i} className="inline-block px-3 py-1 text-xs rounded-full border border-white/20 bg-white/5 text-text-secondary">{v}</span> : null;
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {profileData?.favorite_game_types && (
                                        <div>
                                            <div className="text-xs uppercase tracking-[2px] text-text-muted mb-1.5">Game Types</div>
                                            <div className="flex flex-wrap gap-2">
                                                {profileData.favorite_game_types.split(',').map((t, i) => {
                                                    const v = t.trim();
                                                    return v ? <span key={i} className="inline-block px-3 py-1 text-xs rounded-full border border-white/20 bg-white/5 text-text-secondary">{v}</span> : null;
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {profileData?.signature && (
                                        <div>
                                            <div className="text-xs uppercase tracking-[2px] text-text-muted mb-1.5">Signature</div>
                                            <div className="text-sm text-text-secondary italic">{profileData.signature}</div>
                                        </div>
                                    )}
                                </div>

                                {/* Links */}
                                {(profileData?.discord || profileData?.youtube || profileData?.twitch || profileData?.x_handle) && (
                                    <div className="mt-6 pt-6 border-t border-white/10">
                                        <div className="text-xs uppercase tracking-[2px] text-text-muted mb-3">LINKS</div>
                                        <div className="flex flex-wrap gap-4 text-sm">
                                            {profileData.discord && <a href={`https://discord.com/users/${profileData.discord}`} target="_blank" rel="noreferrer" className="text-neon-cyan hover:underline">Discord</a>}
                                            {profileData.youtube && <a href={profileData.youtube.startsWith('http') ? profileData.youtube : `https://www.youtube.com/@${profileData.youtube}`} target="_blank" rel="noreferrer" className="text-neon-cyan hover:underline">YouTube</a>}
                                            {profileData.twitch && <a href={`https://twitch.tv/${profileData.twitch}`} target="_blank" rel="noreferrer" className="text-neon-cyan hover:underline">Twitch</a>}
                                            {profileData.x_handle && <a href={`https://x.com/${profileData.x_handle.replace('@','')}`} target="_blank" rel="noreferrer" className="text-neon-cyan hover:underline">X</a>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div>
                                <button onClick={handleLogout} className="btn-neon px-6 py-2.5 text-sm">LOG OUT</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Username Change Modal */}
            {showUsernameModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="cyber-card w-full max-w-md p-8">
                        <h2 className="text-2xl font-bold mb-6">Change Username</h2>

                        <div className="mb-4">
                            <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">NEW USERNAME</label>
                            <input
                                type="text"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none"
                                placeholder="Enter new username"
                            />
                            {checkingUsername && <p className="text-xs text-text-muted mt-1">Checking availability...</p>}
                            {usernameError && <p className="text-xs text-red-400 mt-1">{usernameError}</p>}
                            {usernameAvailable && !usernameError && <p className="text-xs text-green-400 mt-1">Username is available</p>}
                        </div>

                        <div className="mb-6 text-sm text-text-secondary">
                            <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={confirmedPermanent}
                                    onChange={(e) => setConfirmedPermanent(e.target.checked)}
                                    className="mt-1"
                                />
                                <span>
                                    I understand this change is permanent for 30 days. Old usernames are reserved to prevent squatting.
                                </span>
                            </label>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={submitUsernameChange}
                                disabled={loading || !usernameAvailable || !confirmedPermanent}
                                className="btn-primary btn-neon flex-1 py-3 disabled:opacity-50"
                            >
                                {loading ? 'UPDATING...' : 'CONFIRM CHANGE'}
                            </button>
                            <button onClick={closeUsernameModal} className="btn-neon flex-1 py-3">CANCEL</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Avatar Upload + Crop Modal */}
            {showAvatarModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
                    <div className="cyber-card w-full max-w-lg p-8">
                        <h2 className="text-2xl font-bold mb-6">Change Profile Picture</h2>

                        {!avatarPreview ? (
                            <div>
                                <label className="block mb-4">
                                    <span className="text-sm text-text-muted">Select an image (max 2MB)</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAvatarSelect}
                                        className="mt-2 block w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-neon-cyan/10 file:text-neon-cyan hover:file:bg-neon-cyan/20"
                                    />
                                </label>
                            </div>
                        ) : (
                            <div className="relative w-full h-80 bg-black rounded overflow-hidden mb-6">
                                <Cropper
                                    image={avatarPreview}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={1}
                                    onCropChange={setCrop}
                                    onZoomChange={setZoom}
                                    onCropComplete={onCropComplete}
                                />
                            </div>
                        )}

                        {avatarPreview && (
                            <div className="mb-6">
                                <input
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    value={zoom}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="w-full accent-neon-cyan"
                                />
                                <div className="text-xs text-center text-text-muted mt-1">Zoom</div>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={uploadAvatar}
                                disabled={loading || !avatarPreview}
                                className="btn-primary btn-neon flex-1 py-3 disabled:opacity-50"
                            >
                                {loading ? 'UPLOADING...' : 'UPLOAD & SAVE'}
                            </button>
                            <button onClick={closeAvatarModal} className="btn-neon flex-1 py-3">CANCEL</button>
                        </div>

                        <p className="text-[10px] text-text-muted text-center mt-4">
                            Images are manually reviewed in early stages.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;