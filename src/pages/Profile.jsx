import { useState, useEffect } from 'react';
import { ArrowLeft, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const Profile = () => {
    const [user, setUser] = useState(null);
    const [form, setForm] = useState({ username: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState('login'); // 'login' | 'register'

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) setUser(session.user);
        });
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user || null);
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
                        username: form.username || form.email.split('@')[0],
                        email: form.email,
                    });
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email: form.email,
                    password: form.password,
                });
                if (error) throw error;
            }
        } catch (err) {
            alert(err.message);
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
                        <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-xs text-neon-cyan hover:underline w-full">
                            {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Log in'}
                        </button>
                        <p className="text-xs text-text-muted text-center">Uses Supabase Auth — data stored securely.</p>
                    </form>
                ) : (
                    <div className="cyber-card p-10">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-16 h-16 rounded-full bg-neon-cyan/10 flex items-center justify-center">
                                <User className="w-8 h-8 text-neon-cyan" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">{user.user_metadata?.username || user.email?.split('@')[0]}</div>
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
        </div>
    );
};

export default Profile;