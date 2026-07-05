import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, User, Camera } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Cropper from 'react-easy-crop';

const Profile = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [profileData, setProfileData] = useState(null);
    const [form, setForm] = useState({ username: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [message, setMessage] = useState('');
    const [showUsernameModal, setShowUsernameModal] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [usernameAvailable, setUsernameAvailable] = useState(null);
    const [usernameError, setUsernameError] = useState('');
    const [confirmedPermanent, setConfirmedPermanent] = useState(false);
    const [checkingUsername, setCheckingUsername] = useState(false);

    // Avatar state
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser(session.user);
                fetchProfile(session.user.id);
            }
        });
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            const newUser = session?.user || null;
            setUser(newUser);
            if (newUser) fetchProfile(newUser.id);
        });
        return () => listener.subscription.unsubscribe();
    }, []);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (mode === 'register') {
                const { data, error } = await supabase.auth.signUp({
                    email: form.email,
                    password: form.password,
                });
                if (error) throw error;
                if (data.user) {
                    await supabase.from('profiles').insert({
                        id: data.user.id,
                        username: form.username.trim(),
                        email: form.email,
                    });
                    if (data.session) {
                        navigate('/profile', { replace: true });
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
                if (error) throw error;
                navigate('/profile', { replace: true });
            }
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchProfile = async (userId) => {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (data) {
            setProfileData(data);
            setNewUsername(data.username || '');
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
            alert(error.message);
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
            alert('Only JPEG, PNG, and WebP images are allowed.');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            alert('File size must be under 2MB.');
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
            const fileName = `${user.id}/avatar.${fileExt}?v=${Date.now()}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, croppedFile, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName.split('?')[0]);

            const finalUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

            await supabase
                .from('profiles')
                .update({ avatar_url: finalUrl })
                .eq('id', user.id);

            setProfileData({ ...profileData, avatar_url: finalUrl });
            closeAvatarModal();
        } catch (err) {
            alert(err.message || 'Upload failed');
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

            <div className="container-custom py-16 max-w-xl">
                {!user ? (
                    <form onSubmit={handleAuth} className="cyber-card p-10 space-y-6">
                        {mode === 'register' && (
                            <div>
                                <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">USERNAME</label>
                                <input
                                    type="text"
                                    className="w-full bg-cyber-surface border border-white/20 p-4 text-white focus:border-neon-cyan outline-none"
                                    value={form.username}
                                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                                />
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
                        {message && <p className="text-sm text-neon-cyan text-center mt-2">{message}</p>}
                    </form>
                ) : (
                    <div className="cyber-card p-10">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="relative w-20 h-20">
                                {profileData?.avatar_url ? (
                                    <img
                                        src={profileData.avatar_url}
                                        alt="Avatar"
                                        className="w-20 h-20 rounded-full object-cover border border-white/20"
                                    />
                                ) : (
                                    <div className="w-20 h-20 rounded-full bg-neon-cyan/10 flex items-center justify-center">
                                        <User className="w-10 h-10 text-neon-cyan" />
                                    </div>
                                )}
                                <button
                                    onClick={openAvatarModal}
                                    className="absolute bottom-0 right-0 bg-cyber-surface border border-white/20 rounded-full p-1.5 hover:border-neon-cyan"
                                    title="Change profile picture"
                                >
                                    <Camera className="w-4 h-4 text-neon-cyan" />
                                </button>
                            </div>

                            <div className="flex-1">
                                <div className="flex items-center gap-3">
                                    <div className="text-2xl font-bold text-white">{profileData?.username || 'No username'}</div>
                                    <button onClick={openUsernameModal} className="text-xs text-neon-cyan hover:underline flex items-center gap-1">
                                        Change Username
                                    </button>
                                </div>
                                <div className="text-text-secondary">{user.email}</div>
                            </div>
                        </div>

                        <div className="text-sm text-text-muted mb-8">
                            Member since {new Date(user.created_at).toLocaleDateString()}
                        </div>

                        <button onClick={handleLogout} className="btn-neon w-full py-4">LOG OUT</button>
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