import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  Heart,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import AvatarMenu from './account/AvatarMenu';
import { onProfileUpdated } from '../utils/profileEvents';
import { SHOW_RELEASED_GAMES } from '../constants/featureFlags';

const TF_LOGO_SRC = '/images/TF_Logo_Ideas_V2.webp';

/** Always-visible top-level links */
const TOP_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/projects', label: 'Projects' },
  { to: '/ideas', label: 'Ideas' },
  { to: '/get-involved', label: 'Get Involved' },
  { to: '/media', label: 'Media' },
];

const EXPLORE_LINKS = [
  { to: '/about', label: 'About' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/education', label: 'Education' },
  { to: '/demos', label: 'Mechanic Lab' },
  ...(SHOW_RELEASED_GAMES
    ? [{ to: '/released', label: 'Released Games' }]
    : []),
  { to: '/contributors', label: 'Contributors' },
  { to: '/badges', label: 'Badges' },
  { to: '/showcase', label: 'Showcase' },
];

const SUPPORT_LINKS = [
  { to: '/open-work', label: 'Open Work' },
  { to: '/donate', label: 'Donate' },
  { to: '/transparency', label: 'Transparency' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
  { to: '/bugs', label: 'Bug Tracker' },
  { to: '/bugs/report', label: 'Report a Bug' },
];

function pathMatches(pathname, to, end = false) {
  if (end || to === '/') return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function isGroupActive(pathname, links) {
  return links.some((l) => pathMatches(pathname, l.to));
}

/**
 * Desktop hover/focus dropdown. Stays open while pointer is over trigger or panel.
 */
function DesktopDropdown({ label, links, active, children }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);

  const clearClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    clearClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(
    () => () => {
      clearClose();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        clearClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={`inline-flex items-center gap-1 transition-colors ${
          active || open
            ? 'text-neon-cyan'
            : 'text-text-secondary hover:text-neon-cyan'
        }`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        onFocus={() => {
          clearClose();
          setOpen(true);
        }}
      >
        {label}
        <ChevronDown
          className={`w-3.5 h-3.5 opacity-70 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 pt-2 z-50 min-w-[12.5rem]"
          onMouseEnter={clearClose}
          onMouseLeave={scheduleClose}
        >
          <div className="bg-cyber-surface border border-white/20 rounded-lg p-3 shadow-xl text-sm space-y-0.5">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="block rounded-md px-3 py-2 text-text-secondary hover:text-neon-cyan hover:bg-white/5 transition-colors"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [username, setUsername] = useState(null);
  const [mobileExploreOpen, setMobileExploreOpen] = useState(false);
  const [mobileSupportOpen, setMobileSupportOpen] = useState(false);
  const location = useLocation();

  // Close mobile drawer on route change
  useEffect(() => {
    setIsOpen(false);
    setMobileExploreOpen(false);
    setMobileSupportOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;
    let profileChannel = null;
    let authSubscription = null;

    const loadProfile = async (uid) => {
      if (!mounted || !uid) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('avatar_url, username')
          .eq('id', uid)
          .maybeSingle();
        if (mounted) {
          setAvatarUrl(data?.avatar_url || null);
          setUsername(data?.username || null);
        }
      } catch {
        if (mounted) {
          setAvatarUrl(null);
          setUsername(null);
        }
      }
    };

    const applySession = (session) => {
      if (!mounted) return;
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) loadProfile(currentUser.id);
      else {
        setAvatarUrl(null);
        setUsername(null);
      }
    };

    supabase.auth
      .getSession()
      .then((res) => {
        applySession(res?.data?.session);
      })
      .catch(() => {
        if (mounted) {
          setUser(null);
          setAvatarUrl(null);
          setUsername(null);
        }
      });

    try {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        applySession(session);
      });
      authSubscription = data?.subscription || null;
    } catch {
      authSubscription = null;
    }

    // Same-tab save (Edit Profile) — reliable without Realtime publication
    const unsubProfileEvent = onProfileUpdated((detail) => {
      if (!mounted || !detail?.userId) return;
      setUser((prev) => {
        if (!prev || String(prev.id) !== String(detail.userId)) return prev;
        if (detail.avatarUrl !== undefined) {
          setAvatarUrl(detail.avatarUrl || null);
        }
        if (detail.username !== undefined) {
          setUsername(detail.username || null);
        }
        return prev;
      });
      // Also re-fetch so we pick up any server-side normalization
      void loadProfile(detail.userId);
    });

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
                if (newRow.username !== undefined) {
                  setUsername(newRow.username || null);
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
        unsubProfileEvent?.();
      } catch {
        /* ignore */
      }
      try {
        authSubscription?.unsubscribe?.();
      } catch {
        /* ignore */
      }
      if (profileChannel) supabase.removeChannel(profileChannel);
    };
  }, []);

  const isActive = (to, end) => pathMatches(location.pathname, to, end);

  return (
    <nav className="navbar fixed top-0 left-0 right-0 z-50">
      <div className="container-custom flex items-center justify-between h-20">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group min-w-0">
          <div className="relative w-10 h-10 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full bg-semantic-achievement/20 opacity-80 group-hover:opacity-100 transition-opacity"
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
        <div className="hidden lg:flex items-center gap-6 xl:gap-8 text-sm font-mono tracking-widest">
          {TOP_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`transition-colors ${
                isActive(link.to, link.end)
                  ? 'text-neon-cyan'
                  : 'text-text-secondary hover:text-neon-cyan'
              }`}
            >
              {link.label}
            </Link>
          ))}

          <DesktopDropdown
            label="Explore"
            links={EXPLORE_LINKS}
            active={isGroupActive(location.pathname, EXPLORE_LINKS)}
          />

          <DesktopDropdown
            label="Support"
            links={SUPPORT_LINKS}
            active={isGroupActive(location.pathname, SUPPORT_LINKS)}
          />

          {user ? (
            <AvatarMenu
              user={user}
              username={username}
              avatarUrl={avatarUrl}
            />
          ) : (
            <Link
              to="/account"
              className="btn-neon btn-neon-magenta text-xs py-2 px-5"
            >
              <Heart className="w-3.5 h-3.5" /> JOIN THE FORGE
            </Link>
          )}
        </div>

        {/* Mobile / tablet: menu toggle, then profile (right edge) */}
        <div className="lg:hidden flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-neon-cyan p-2"
            aria-label="Toggle menu"
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          {user && (
            <AvatarMenu
              user={user}
              username={username}
              avatarUrl={avatarUrl}
              onNavigate={() => setIsOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="mobile-menu task-scroll lg:hidden border-t border-white/10 bg-cyber-bg max-h-[calc(100vh-5rem)] overflow-y-auto">
          <div className="container-custom py-6 flex flex-col gap-1 text-sm font-mono tracking-widest">
            {TOP_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setIsOpen(false)}
                className={`py-2.5 ${
                  isActive(link.to, link.end)
                    ? 'text-neon-cyan'
                    : 'text-text-secondary hover:text-neon-cyan'
                }`}
              >
                {link.label}
              </Link>
            ))}

            {/* Explore accordion */}
            <button
              type="button"
              className={`flex items-center justify-between py-2.5 text-left ${
                isGroupActive(location.pathname, EXPLORE_LINKS)
                  ? 'text-neon-cyan'
                  : 'text-text-secondary'
              }`}
              onClick={() => setMobileExploreOpen((v) => !v)}
              aria-expanded={mobileExploreOpen}
            >
              Explore
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  mobileExploreOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {mobileExploreOpen && (
              <div className="pl-3 border-l border-white/10 flex flex-col gap-1 mb-2">
                {EXPLORE_LINKS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setIsOpen(false)}
                    className={`py-2 text-sm ${
                      isActive(link.to)
                        ? 'text-neon-cyan'
                        : 'text-text-muted hover:text-neon-cyan'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            {/* Support accordion */}
            <button
              type="button"
              className={`flex items-center justify-between py-2.5 text-left ${
                isGroupActive(location.pathname, SUPPORT_LINKS)
                  ? 'text-neon-cyan'
                  : 'text-text-secondary'
              }`}
              onClick={() => setMobileSupportOpen((v) => !v)}
              aria-expanded={mobileSupportOpen}
            >
              Support
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  mobileSupportOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {mobileSupportOpen && (
              <div className="pl-3 border-l border-white/10 flex flex-col gap-1 mb-2">
                {SUPPORT_LINKS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setIsOpen(false)}
                    className={`py-2 text-sm ${
                      isActive(link.to)
                        ? 'text-neon-cyan'
                        : 'text-text-muted hover:text-neon-cyan'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            {!user && (
              <Link
                to="/account"
                onClick={() => setIsOpen(false)}
                className="btn-neon btn-neon-magenta w-full justify-center mt-4"
              >
                <Heart className="w-4 h-4" /> JOIN THE FORGE
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
