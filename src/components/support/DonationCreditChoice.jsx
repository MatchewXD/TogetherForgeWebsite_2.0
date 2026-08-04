/**
 * Binary public-credit vs anonymous choice before Stripe Checkout.
 * Must be selected on-site; passed through checkout metadata as isAnonymous.
 */

import { Link } from 'react-router-dom';
import { Eye, EyeOff, User } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';

/**
 * @param {object} props
 * @param {boolean} props.wantPublicCredit - true = show name on Contributors / All Contributors
 * @param {(v: boolean) => void} props.onChange
 * @param {boolean} [props.isSignedIn]
 * @param {string|null} [props.username]
 * @param {string|null} [props.avatarUrl]
 * @param {string|null} [props.displayName] - label next to avatar (defaults to username)
 * @param {string} [props.className]
 * @param {'full'|'compact'} [props.variant='full']
 */
const DonationCreditChoice = ({
  wantPublicCredit,
  onChange,
  isSignedIn = false,
  username = null,
  avatarUrl = null,
  displayName = null,
  className = '',
  variant = 'full',
}) => {
  const showName = Boolean(wantPublicCredit);
  const nameLabel =
    (displayName && String(displayName).trim()) ||
    (username && String(username).trim()) ||
    '';
  const canName = isSignedIn && Boolean(nameLabel);

  return (
    <div
      className={`rounded-xl border-2 border-forge-gold/40 bg-gradient-to-br from-cyber-surface/95 via-cyber-surface/90 to-neon-magenta/5 p-4 sm:p-5 ${className}`}
      role="group"
      aria-labelledby="donation-credit-heading"
    >
      <p
        id="donation-credit-heading"
        className="text-sm sm:text-base font-semibold text-white mb-1"
      >
        Would you like public credit for this donation?
      </p>
      <p className="text-xs sm:text-sm text-text-muted mb-4 leading-relaxed">
        Amount stays private. Named credit appears on the active projects
        Contributor page and on All Contributors page.
      </p>

      <div
        className={`grid gap-2 ${
          variant === 'full' ? 'sm:grid-cols-2' : 'grid-cols-1'
        }`}
      >
        <button
          type="button"
          onClick={() => onChange(true)}
          aria-pressed={showName}
          className={`flex items-start gap-3 rounded-xl border-2 px-3.5 py-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-forge-gold ${
            showName
              ? 'border-forge-gold bg-forge-gold/10 shadow-[0_0_16px_rgba(245,197,66,0.15)]'
              : 'border-cyber-border bg-cyber-bg/40 hover:border-forge-gold/40'
          }`}
        >
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
              showName
                ? 'border-forge-gold bg-forge-gold'
                : 'border-text-muted'
            }`}
            aria-hidden
          >
            {showName && (
              <span className="h-2 w-2 rounded-full bg-cyber-bg" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 font-semibold text-white text-sm sm:text-base">
              <Eye className="w-4 h-4 text-forge-gold shrink-0" aria-hidden />
              Show my name
            </span>
            {/* Live preview of how public credit appears */}
            <span className="mt-2.5 flex items-center gap-2.5 min-w-0">
              {canName ? (
                <>
                  <UserAvatar
                    src={avatarUrl}
                    name={nameLabel}
                    username={username}
                    linkProfile={false}
                    size="sm"
                    className="!w-8 !h-8 shrink-0"
                  />
                  <span className="font-semibold text-white text-sm truncate">
                    {nameLabel}
                  </span>
                </>
              ) : (
                <>
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-cyber-border bg-cyber-bg/60 text-text-muted"
                    aria-hidden
                  >
                    <User className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-sm text-text-muted italic truncate">
                    Your name here
                  </span>
                </>
              )}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChange(false)}
          aria-pressed={!showName}
          className={`flex items-start gap-3 rounded-xl border-2 px-3.5 py-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-magenta ${
            !showName
              ? 'border-neon-magenta bg-neon-magenta/10 shadow-[0_0_16px_rgba(233,64,245,0.15)]'
              : 'border-cyber-border bg-cyber-bg/40 hover:border-neon-magenta/40'
          }`}
        >
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
              !showName
                ? 'border-neon-magenta bg-neon-magenta'
                : 'border-text-muted'
            }`}
            aria-hidden
          >
            {!showName && (
              <span className="h-2 w-2 rounded-full bg-cyber-bg" />
            )}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 font-semibold text-white text-sm sm:text-base">
              <EyeOff
                className="w-4 h-4 text-neon-magenta shrink-0"
                aria-hidden
              />
              Keep this anonymous
            </span>
            <span className="block text-xs sm:text-sm text-text-secondary mt-0.5 leading-snug">
              Still counts toward support totals
            </span>
          </span>
        </button>
      </div>

      {showName && !isSignedIn && (
        <p className="mt-3 text-xs sm:text-sm text-forge-gold leading-relaxed flex items-start gap-2">
          <User className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
          <span>
            Sign in so we can show your username.{' '}
            <Link to="/profile" className="text-neon-cyan hover:underline">
              Sign in
            </Link>
            , or choose anonymous.
          </span>
        </p>
      )}

      {showName && isSignedIn && !canName && (
        <p className="mt-3 text-xs sm:text-sm text-forge-gold leading-relaxed flex items-start gap-2">
          <User className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
          <span>
            Add a username on your{' '}
            <Link
              to="/profile/edit"
              className="text-neon-cyan hover:underline"
            >
              profile
            </Link>{' '}
            for public credit, or choose anonymous.
          </span>
        </p>
      )}
    </div>
  );
};

/**
 * Resolve checkout credit flags from UI choice + auth.
 * @returns {{ isAnonymous: boolean, userId: string|null, displayName: string|null, error: string|null }}
 */
export function resolveDonationCredit({
  wantPublicCredit,
  authUser,
  username,
}) {
  const uid = authUser?.id || null;
  const name = username ? String(username).trim() : '';

  if (!wantPublicCredit) {
    return {
      isAnonymous: true,
      userId: uid,
      displayName: null,
      error: null,
    };
  }

  if (!uid) {
    return {
      isAnonymous: true,
      userId: null,
      displayName: null,
      error:
        'Sign in to show your name on Contributors, or choose “Keep this anonymous”.',
    };
  }

  if (!name) {
    return {
      isAnonymous: true,
      userId: uid,
      displayName: null,
      error:
        'Add a username on your profile for public credit, or choose “Keep this anonymous”.',
    };
  }

  return {
    isAnonymous: false,
    userId: uid,
    displayName: name,
    error: null,
  };
}

export default DonationCreditChoice;
