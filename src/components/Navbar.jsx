import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Hammer, Users, Youtube, Heart, CheckCircle, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import UserAvatar from './ui/UserAvatar';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [user, setUser] = useState(null);
    const [avatarUrl, setAvatarUrl] = useState(null);
    const location = useLocation();

    useEffect(() => {
        let mounted = true;
        let profileChannel = null;

        const loadAvatar = async (uid) => {
            if (!mounted) return;
            const { data } = await supabase.from('profiles').select('avatar_url').eq('id', uid).maybeSingle();
            if (mounted) setAvatarUrl(data?.avatar_url || null);
        };

        // Initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!mounted) return;
            const currentUser = session?.user || null;
            setUser(currentUser);
            if (currentUser) loadAvatar(currentUser.id);
            else setAvatarUrl(null);
        });

        // Auth state listener (stable)
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!mounted) return;
            const currentUser = session?.user || null;
            setUser(currentUser);
            if (currentUser) loadAvatar(currentUser.id);
            else setAvatarUrl(null);
        });

        // Realtime subscription for avatar updates (subscribe once)
        profileChannel = supabase
            .channel('navbar-profile-avatar')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
                if (!mounted) return;
                const newRow = payload.new;
                // Only react if we currently have a user and the row matches
                setUser(prev => {
                    if (prev && newRow && newRow.id === prev.id) {
                        if (newRow.avatar_url !== undefined) {
                            setAvatarUrl(newRow.avatar_url || null);
                        }
                    }
                    return prev;
                });
            })
            .subscribe();

        return () => {
            mounted = false;
            if (profileChannel) supabase.removeChannel(profileChannel);
            listener.subscription.unsubscribe();
        };
    }, []); // run once, stable listeners only

    // Main nav (always visible): Home, Game Ideas, Projects, Get Involved
    const navLinks = [
        { to: '/', label: 'HOME', icon: Hammer },
        { to: '/ideas', label: 'GAME IDEAS', icon: Users },
        { to: '/projects', label: 'PROJECTS', icon: Hammer },
        { to: '/get-involved', label: 'GET INVOLVED', icon: Users },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="navbar fixed top-0 left-0 right-0 z-50">
            <div className="container-custom flex items-center justify-between h-20">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-3 group">
                    <div className="relative w-9 h-9 flex items-center justify-center">
                        <div className="absolute inset-0 bg-neon-cyan/20 rounded-full blur-md group-hover:bg-neon-cyan/30 transition-all" />
                        <Hammer className="w-6 h-6 text-neon-cyan relative z-10" />
                    </div>
                    <div>
                        <div className="font-mono text-xl tracking-[3px] font-bold text-white">
                            TOGETHER<span className="neon-magenta">FORGE</span>
                        </div>
                        <div className="text-[10px] text-text-secondary -mt-1 tracking-[2px]">EST 2026</div>
                    </div>
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-8 text-sm font-mono tracking-widest">
                    {navLinks.map((link) => (
                        <Link
                            key={link.label}
                            to={link.to}
                            className={`transition-colors ${isActive(link.to) ? 'text-neon-cyan' : 'text-text-secondary hover:text-neon-cyan'}`}
                        >
                            {link.label}
                        </Link>
                    ))}

                    {/* More Dropdown */}
                    <div className="relative group">
                        <button className="text-text-secondary hover:text-neon-cyan flex items-center gap-1">
                            MORE
                        </button>
                        <div className="absolute hidden group-hover:block pt-2">
                            <div className="bg-cyber-surface border border-white/20 rounded p-4 w-48 text-sm space-y-3">
                                <Link to="/about" className="block hover:text-neon-cyan">About</Link>
                                <Link to="/how-it-works" className="block hover:text-neon-cyan">How It Works</Link>
                                <Link to="/faq" className="block hover:text-neon-cyan">FAQ</Link>
                                <Link to="/support" className="block hover:text-neon-cyan">Support</Link>
                                <Link to="/transparency" className="block hover:text-neon-cyan">Transparency</Link>
                                <Link to="/contact" className="block hover:text-neon-cyan">Contact</Link>
                                <Link to="/profile" className="block hover:text-neon-cyan">Profile</Link>
                            </div>
                        </div>
                    </div>

                    {/* Auth-aware right side action */}
                    {!user ? (
                        <Link to="/profile" className="btn-neon btn-neon-magenta text-xs py-2 px-5">
                            <Heart className="w-3.5 h-3.5" /> JOIN THE FORGE
                        </Link>
                    ) : (
                        <Link
                            to="/profile"
                            className="rounded-full hover:opacity-90 transition ring-1 ring-white/20 hover:ring-neon-cyan"
                            title="Profile"
                        >
                            <UserAvatar
                                src={avatarUrl}
                                name={user?.email || 'You'}
                                size="md"
                                className="!w-9 !h-9"
                                borderClass="border border-transparent"
                                alt="Profile"
                            />
                        </Link>
                    )}
                </div>

                {/* Mobile Menu Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="md:hidden text-neon-cyan p-2"
                    aria-label="Toggle menu"
                >
                    {isOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div className="mobile-menu md:hidden border-t border-white/10 bg-cyber-bg/98 backdrop-blur-xl">
                    <div className="container-custom py-8 flex flex-col gap-6 text-sm font-mono tracking-widest">
                        {navLinks.map((link) => (
                            <Link
                                key={link.label}
                                to={link.to}
                                onClick={() => setIsOpen(false)}
                                className={`py-1 ${isActive(link.to) ? 'text-neon-cyan' : 'text-text-secondary hover:text-neon-cyan'}`}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <Link to="/about" onClick={() => setIsOpen(false)} className="py-1 text-text-secondary hover:text-neon-cyan">About</Link>
                        <Link to="/how-it-works" onClick={() => setIsOpen(false)} className="py-1 text-text-secondary hover:text-neon-cyan">How It Works</Link>
                        <Link to="/faq" onClick={() => setIsOpen(false)} className="py-1 text-text-secondary hover:text-neon-cyan">FAQ</Link>
                        <Link to="/support" onClick={() => setIsOpen(false)} className="py-1 text-text-secondary hover:text-neon-cyan">Support</Link>
                        <Link to="/transparency" onClick={() => setIsOpen(false)} className="py-1 text-text-secondary hover:text-neon-cyan">Transparency</Link>
                        <Link to="/contact" onClick={() => setIsOpen(false)} className="py-1 text-text-secondary hover:text-neon-cyan">Contact</Link>
                        <Link to="/profile" onClick={() => setIsOpen(false)} className="py-1 text-text-secondary hover:text-neon-cyan">Profile</Link>

                        {!user ? (
                            <Link to="/profile" onClick={() => setIsOpen(false)} className="btn-neon btn-neon-magenta w-full justify-center mt-4">
                                <Heart className="w-4 h-4" /> JOIN THE FORGE
                            </Link>
                        ) : (
                            <Link to="/profile" onClick={() => setIsOpen(false)} className="w-full mt-4 flex items-center justify-center gap-2 py-2 border border-white/20 rounded hover:border-neon-cyan">
                                <User className="w-4 h-4 text-neon-cyan" /> PROFILE
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;