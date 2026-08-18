/**
 * Profile-picture dropdown for the navbar (desktop + optional mobile panel).
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  LayoutDashboard,
  Pencil,
  Settings,
  CreditCard,
  Shield,
  LogOut,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import UserAvatar from '../ui/UserAvatar';
import { publicProfilePath } from '../../utils/profileLinks';
import { accountPath } from '../../constants/accountSections';
import { useStaffRole } from '../../hooks/useStaffRole';

/**
 * @param {object} props
 * @param {object} props.user
 * @param {string|null} [props.username]
 * @param {string|null} [props.avatarUrl]
 * @param {string} [props.className]
 * @param {'dropdown'|'inline'} [props.variant='dropdown'] - inline = expanded list for mobile drawer
 * @param {() => void} [props.onNavigate]
 */
export default function AvatarMenu({
  user,
  username = null,
  avatarUrl = null,
  className = '',
  variant = 'dropdown',
  onNavigate,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const navigate = useNavigate();
  const { canSeeModeratorDashboard } = useStaffRole();

  const displayName =
    (username && String(username).trim()) ||
    user?.email?.split('@')[0] ||
    'You';
  const email = user?.email || '';
  const profilePath = publicProfilePath(username);

  useEffect(() => {
    if (variant !== 'dropdown' || !open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, variant]);

  const go = (path) => {
    setOpen(false);
    onNavigate?.();
    if (path) navigate(path);
  };

  const signOut = async () => {
    setOpen(false);
    onNavigate?.();
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    navigate('/account', { replace: true });
  };

  const linkClass =
    'flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm text-text-secondary hover:text-white hover:bg-cyber-surface transition-colors text-left';

  const sectionLabel =
    'px-3 pt-2.5 pb-1 text-[10px] font-mono tracking-widest uppercase text-text-muted';

  const menuBody = (
    <div className="py-1 bg-cyber-card">
      {/* Header */}
      <div className="px-3 py-3 border-b border-cyber-border bg-cyber-surface flex items-center gap-3">
        <UserAvatar
          src={avatarUrl}
          name={displayName}
          username={username}
          linkProfile={false}
          size="lg"
          className="!w-11 !h-11"
          borderClass="border border-neon-cyan/40"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">
            {displayName}
          </p>
          {email ? (
            <p className="text-xs text-text-muted truncate mt-0.5">{email}</p>
          ) : null}
        </div>
      </div>

      {/* Main */}
      <div className="py-1.5 px-1">
        {profilePath && (
          <Link to={profilePath} className={linkClass} onClick={() => go()}>
            <User className="w-4 h-4 shrink-0 text-neon-cyan" />
            Profile
          </Link>
        )}
        <Link to="/dashboard" className={linkClass} onClick={() => go()}>
          <LayoutDashboard className="w-4 h-4 shrink-0 text-neon-purple" />
          Dashboard
        </Link>
        <Link
          to={accountPath('profile')}
          className={linkClass}
          onClick={() => go()}
        >
          <Pencil className="w-4 h-4 shrink-0 text-neon-cyan" />
          Edit Profile
        </Link>
      </div>

      {/* Account */}
      <div className="border-t border-cyber-border/60 py-1.5 px-1">
        <p className={sectionLabel}>Account</p>
        <Link
          to={accountPath('profile')}
          className={linkClass}
          onClick={() => go()}
        >
          <Settings className="w-4 h-4 shrink-0" />
          Account Settings
        </Link>
      </div>

      {/* Billing */}
      <div className="border-t border-cyber-border/60 py-1.5 px-1">
        <p className={sectionLabel}>Billing</p>
        <Link
          to={accountPath('plan')}
          className={linkClass}
          onClick={() => go()}
        >
          <CreditCard className="w-4 h-4 shrink-0 text-forge-gold" />
          My Plan
        </Link>
        <Link
          to={accountPath('billing')}
          className={linkClass}
          onClick={() => go()}
        >
          <CreditCard className="w-4 h-4 shrink-0 text-neon-cyan" />
          Billing
        </Link>
      </div>

      {/* Staff — Moderator and Founder only */}
      {canSeeModeratorDashboard && (
        <div className="border-t border-cyber-border/60 py-1.5 px-1">
          <p className={sectionLabel}>Staff</p>
          <Link to="/moderator" className={linkClass} onClick={() => go()}>
            <Shield className="w-4 h-4 shrink-0 text-semantic-warning" />
            Moderator Dashboard
          </Link>
        </div>
      )}

      {/* Sign out */}
      <div className="border-t border-cyber-border/60 py-1.5 px-1">
        <button type="button" className={`${linkClass} text-red-300 hover:text-red-200`} onClick={() => void signOut()}>
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );

  if (variant === 'inline') {
    return <div className={className}>{menuBody}</div>;
  }

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        className="rounded-full hover:opacity-90 transition ring-1 ring-white/20 hover:ring-neon-cyan focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open account menu"
        onClick={() => setOpen((v) => !v)}
      >
        <UserAvatar
          src={avatarUrl}
          name={displayName}
          username={username}
          linkProfile={false}
          size="md"
          className="!w-9 !h-9"
          borderClass="border border-transparent"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-[60] w-[min(18.5rem,calc(100vw-1.5rem))] rounded-xl border border-cyber-border bg-cyber-card shadow-[0_12px_40px_rgba(0,0,0,0.65)] overflow-hidden"
        >
          {menuBody}
        </div>
      )}
    </div>
  );
}
