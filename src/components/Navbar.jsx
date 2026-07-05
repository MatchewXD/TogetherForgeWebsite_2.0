import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Hammer, Users, Youtube, Heart, CheckCircle, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [user, setUser] = useState(null);
    const location = useLocation();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user || null);
        });
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user || null);
        });
        return () => listener.subscription.unsubscribe();
    }, []);

    const navLinks = [
        { to: '/', label: 'HOME', icon: Hammer },
        { to: '/about', label: 'ABOUT', icon: Users },
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
                                <Link to="/how-it-works" className="block hover:text-neon-cyan">How It Works</Link>
                                <Link to="/faq" className="block hover:text-neon-cyan">FAQ</Link>
                                <Link to="/donations" className="block hover:text-neon-cyan">Support / Donations</Link>
                                <Link to="/contact" className="block hover:text-neon-cyan">Contact</Link>
                                <Link to="/profile" className="block hover:text-neon-cyan">Profile / Account</Link>
                            </div>
                        </div>
                    </div>

                    {/* Auth-aware right side action */}
                    {!user ? (
                        <Link to="/profile" className="btn-neon btn-neon-magenta text-xs py-2 px-5">
                            <Heart className="w-3.5 h-3.5" /> JOIN THE FORGE
                        </Link>
                    ) : (
                        <Link to="/profile" className="w-9 h-9 rounded-full bg-neon-cyan/10 flex items-center justify-center border border-white/20 hover:border-neon-cyan transition" title="Profile">
                            <User className="w-4 h-4 text-neon-cyan" />
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
                        <Link to="/how-it-works" onClick={() => setIsOpen(false)} className="py-1 text-text-secondary hover:text-neon-cyan">How It Works</Link>
                        <Link to="/faq" onClick={() => setIsOpen(false)} className="py-1 text-text-secondary hover:text-neon-cyan">FAQ</Link>

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