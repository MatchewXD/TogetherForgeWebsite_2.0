import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Heart, User, LayoutDashboard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import UserAvatar from './ui/UserAvatar';
import useIsModerator from '../hooks/useIsModerator';

const TF_LOGO_SRC = '/images/TF_Logo_Ideas_V2.png';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const location = useLocation();
  const { isModerator } = useIsModerator();

  useEffect(() => {
    let mounted = true;
    let profileChannel = null;
    let authSubscription = null;

    const loadAvatar = async (uid) => {
      if (!mounted || !uid) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', uid)
          .maybeSingle();
        if (mounted) setAvatarUrl(data?.avatar_url || null);
      } catch {
        if (mounted) setAvatarUrl(null);
      }
    };

    const applySession = (session) => {
      if (!mounted) return;
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) loadAvatar(currentUser.id);
      else setAvatarUrl(null);
    };

    // Initial session
    supabase.auth
      .getSession()
      .then((res) => {
        applySession(res?.data?.session);
      })
      .catch(() => {
        if (mounted) {
          setUser(null);
          setAvatarUrl(null);
        }
      });

    // Auth state listener
    try {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        applySession(session);
      });
      authSubscription = data?.subscription || null;
    } catch {
      authSubscription = null;
    }

    // Realtime avatar updates
    try {
      profileChannel = supabase
        .channel('navbar-profile-avatar')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          (payload) => {
            if (!mounted) return;
            const newRow = payload?.new;
            setUser((prev) => {
              if (prev && newRow && newRow.id === prev.id) {
                if (newRow.avatar_url !== undefined) {
                  setAvatarUrl(newRow.avatar_url || null);
                }
              }
              return prev;
            });
          }
        )
        .subscribe();
    } catch {
      profileChannel = null;
    }

    return () => {
      mounted = false;
      try {
        if (profileChannel) supabase.removeChannel(profileChannel);
      } catch {
        /* ignore */
      }
      try {
        authSubscription?.unsubscribe?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const navLinks = [
    { to: '/', label: 'HOME' },
    { to: '/ideas', label: 'GAME IDEAS' },
    { to: '/projects', label: 'PROJECTS' },
    { to: '/get-involved', label: 'GET INVOLVED' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar fixed top-0 left-0 right-0 z-50">
      <div className="container-custom flex items-center justify-between h-20">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group min-w-0">
          <div className="relative w-10 h-10 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full bg-semantic-achievement/15 blur-md opacity-70 group-hover:opacity-100 transition-opacity"
              aria-hidden="true"
            />
            <img
              src={TF_LOGO_SRC}
              alt="Together Forge"
              width={44}
              height={44}
              className="relative z-10 w-full h-full object-contain"
              decoding="async"
            />
          </div>
          <div className="min-w-0">
            <div className="font-mono text-base sm:text-xl tracking-[2px] sm:tracking-[3px] font-bold text-white truncate">
              TOGETHER<span className="text-neon-purple">FORGE</span>
            </div>
            <div className="text-[10px] text-text-secondary -mt-0.5 tracking-[2px]">
              EST 2026
            </div>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8 text-sm font-mono tracking-widest">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className={`transition-colors ${
                isActive(link.to)
                  ? 'text-neon-cyan'
                  : 'text-text-secondary hover:text-neon-cyan'
              }`}
            >
              {link.label}
            </Link>
          ))}

          {/* More Dropdown */}
          <div className="relative group">
            <button
              type="button"
              className="text-text-secondary hover:text-neon-cyan flex items-center gap-1"
            >
              MORE
            </button>
            <div className="absolute hidden group-hover:block pt-2 right-0">
              <div className="bg-cyber-surface border border-white/20 rounded p-4 w-48 text-sm space-y-3">
                <Link to="/about" className="block hover:text-neon-cyan">
                  About
                </Link>
                <Link to="/how-it-works" className="block hover:text-neon-cyan">
                  How It Works
                </Link>
                <Link to="/education" className="block hover:text-neon-cyan">
                  Education
                </Link>
                <Link to="/demos" className="block hover:text-neon-cyan">
                  Mechanic Lab
                </Link>
                <Link to="/faq" className="block hover:text-neon-cyan">
                  FAQ
                </Link>
                <Link to="/bugs" className="block hover:text-neon-cyan">
                  Bug Tracker
                </Link>
                <Link to="/bugs/report" className="block hover:text-neon-cyan">
                  Report a Bug
                </Link>
                <Link to="/support" className="block hover:text-neon-cyan">
                  Support
                </Link>
                <Link to="/transparency" className="block hover:text-neon-cyan">
                  Transparency
                </Link>
                <Link to="/contact" className="block hover:text-neon-cyan">
                  Contact
                </Link>
                {user ? (
                  <div className="border-t border-white/10 pt-3 mt-1 space-y-3">
                    <Link to="/dashboard" className="block hover:text-neon-cyan">
                      My Dashboard
                    </Link>
                    <Link to="/profile" className="block hover:text-neon-cyan">
                      Profile
                    </Link>
                  </div>
                ) : (
                  <Link to="/profile" className="block hover:text-neon-cyan">
                    Profile
                  </Link>
                )}
                {isModerator && (
                  <Link to="/moderator" className="block hover:text-neon-cyan">
                    Moderator
                  </Link>
                )}
              </div>
            </div>
          </div>

          {!user ? (
            <Link
              to="/profile"
              className="btn-neon btn-neon-magenta text-xs py-2 px-5"
            >
              <Heart className="w-3.5 h-3.5" /> JOIN THE FORGE
            </Link>
          ) : (
            <Link
              to="/dashboard"
              className="rounded-full hover:opacity-90 transition ring-1 ring-white/20 hover:ring-neon-cyan"
              title="My Dashboard"
            >
              <UserAvatar
                src={avatarUrl}
                name={user?.email || 'You'}
                linkProfile={false}
                size="md"
                className="!w-9 !h-9"
                borderClass="border border-transparent"
              />
            </Link>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
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
                className={`py-1 ${
                  isActive(link.to)
                    ? 'text-neon-cyan'
                    : 'text-text-secondary hover:text-neon-cyan'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/about"
              onClick={() => setIsOpen(false)}
              className="py-1 text-text-secondary hover:text-neon-cyan"
            >
              About
            </Link>
            <Link
              to="/how-it-works"
              onClick={() => setIsOpen(false)}
              className="py-1 text-text-secondary hover:text-neon-cyan"
            >
              How It Works
            </Link>
            <Link
              to="/education"
              onClick={() => setIsOpen(false)}
              className="py-1 text-text-secondary hover:text-neon-cyan"
            >
              Education
            </Link>
            <Link
              to="/demos"
              onClick={() => setIsOpen(false)}
              className="py-1 text-text-secondary hover:text-neon-cyan"
            >
              Mechanic Lab
            </Link>
            <Link
              to="/faq"
              onClick={() => setIsOpen(false)}
              className="py-1 text-text-secondary hover:text-neon-cyan"
            >
              FAQ
            </Link>
            <Link
              to="/bugs"
              onClick={() => setIsOpen(false)}
              className="py-1 text-text-secondary hover:text-neon-cyan"
            >
              Bug Tracker
            </Link>
            <Link
              to="/bugs/report"
              onClick={() => setIsOpen(false)}
              className="py-1 text-text-secondary hover:text-neon-cyan"
            >
              Report a Bug
            </Link>
            <Link
              to="/support"
              onClick={() => setIsOpen(false)}
              className="py-1 text-text-secondary hover:text-neon-cyan"
            >
              Support
            </Link>
            <Link
              to="/transparency"
              onClick={() => setIsOpen(false)}
              className="py-1 text-text-secondary hover:text-neon-cyan"
            >
              Transparency
            </Link>
            <Link
              to="/contact"
              onClick={() => setIsOpen(false)}
              className="py-1 text-text-secondary hover:text-neon-cyan"
            >
              Contact
            </Link>
            {user && (
              <Link
                to="/dashboard"
                onClick={() => setIsOpen(false)}
                className="py-1 text-text-secondary hover:text-neon-cyan"
              >
                My Dashboard
              </Link>
            )}
            <Link
              to="/profile"
              onClick={() => setIsOpen(false)}
              className="py-1 text-text-secondary hover:text-neon-cyan"
            >
              Profile
            </Link>
            {isModerator && (
              <Link
                to="/moderator"
                onClick={() => setIsOpen(false)}
                className="py-1 text-text-secondary hover:text-neon-cyan"
              >
                Moderator
              </Link>
            )}

            {!user ? (
              <Link
                to="/profile"
                onClick={() => setIsOpen(false)}
                className="btn-neon btn-neon-magenta w-full justify-center mt-4"
              >
                <Heart className="w-4 h-4" /> JOIN THE FORGE
              </Link>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  to="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-2 border border-neon-cyan/40 rounded hover:border-neon-cyan text-neon-cyan"
                >
                  <LayoutDashboard className="w-4 h-4" /> MY DASHBOARD
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-2 border border-white/20 rounded hover:border-neon-cyan"
                >
                  <User className="w-4 h-4 text-neon-cyan" /> PROFILE
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
