/**
 * Primary social sign-in / sign-up buttons (Google, Discord, GitHub).
 * Uses Supabase signInWithOAuth. Same verified email auto-links to an existing
 * Together Forge account (server-side); different emails do not auto-link.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  authSignInRedirectUrl,
  humanizeAuthIdentityError,
  providerDisplayName,
  stashOAuthIntent,
} from '../../utils/authIdentities';
import {
  DiscordIcon,
  GithubIcon,
} from '../profile/BrandSocialIcon';

const PROVIDERS = [
  {
    id: 'google',
    label: 'Google',
    Icon: GoogleGlyph,
    className:
      'border-white/25 bg-white/[0.04] hover:border-white/50 hover:bg-white/[0.08] text-white',
  },
  {
    id: 'discord',
    label: 'Discord',
    Icon: DiscordIcon,
    className:
      'border-[#5865F2]/45 bg-[#5865F2]/10 hover:border-[#5865F2]/70 hover:bg-[#5865F2]/18 text-[#c5cbff]',
  },
  {
    id: 'github',
    label: 'GitHub',
    Icon: GithubIcon,
    className:
      'border-white/30 bg-cyber-bg/60 hover:border-white/55 hover:bg-cyber-bg text-white',
  },
];

function GoogleGlyph({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.3 14.7 2.3 12 2.3 6.9 2.3 2.8 6.4 2.8 11.5S6.9 20.7 12 20.7c5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.2-1.5H12z"
      />
      <path
        fill="#34A853"
        d="M3.9 7.4l3.2 2.3C8 7.5 9.8 6.2 12 6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.3 14.7 2.3 12 2.3 8.2 2.3 4.9 4.4 3.9 7.4z"
      />
      <path
        fill="#4A90E2"
        d="M12 20.7c2.6 0 4.8-.9 6.4-2.4l-3-2.5c-.8.6-1.9 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1l-3.2 2.5c1.4 2.9 4.4 5 8 5.5z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 12.7c-.2-.5-.3-1.1-.3-1.7s.1-1.2.3-1.7L3.2 6.8C2.6 8.1 2.3 9.5 2.3 11s.3 2.9.9 4.2l3.2-2.5z"
      />
    </svg>
  );
}

/**
 * @param {{
 *   mode?: 'login'|'register',
 *   disabled?: boolean,
 *   className?: string,
 *   onError?: (msg: string) => void,
 *   onNeedAgree?: () => void,
 *   showEmailHint?: boolean,
 *   requireAgree?: boolean,
 *   agreed?: boolean,
 * }} props
 */
export default function OAuthSignInButtons({
  mode = 'login',
  disabled = false,
  className = '',
  onError,
  onNeedAgree,
  showEmailHint = true,
  requireAgree = false,
  agreed = false,
}) {
  const [busy, setBusy] = useState(null);

  const startOAuth = async (provider) => {
    if (disabled || busy) return;
    if (requireAgree && !agreed) {
      if (onNeedAgree) {
        onNeedAgree();
      } else {
        onError?.(
          'Please agree to the Terms of Service and Community Guidelines to continue.'
        );
      }
      return;
    }
    setBusy(provider);
    onError?.('');
    stashOAuthIntent({ intent: 'signin', provider });
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: authSignInRedirectUrl(undefined, provider),
          skipBrowserRedirect: false,
          // Prefer verified email scopes so auto-link by matching email can work.
          queryParams:
            provider === 'google'
              ? { access_type: 'online', prompt: 'select_account' }
              : undefined,
        },
      });
      if (error) throw error;
      if (data?.url && typeof window !== 'undefined') {
        window.location.assign(data.url);
        return;
      }
      onError?.(
        `Could not open ${providerDisplayName(provider)}. Please try again.`
      );
    } catch (e) {
      onError?.(humanizeAuthIdentityError(e, provider));
      setBusy(null);
    }
  };

  const heading =
    mode === 'register' ? 'Sign up with' : 'Continue with';

  return (
    <div className={className}>
      <p className="text-center text-[11px] font-mono tracking-widest text-text-muted uppercase mb-3">
        {heading}
      </p>
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        {PROVIDERS.map(({ id, label, Icon, className: btnClass }) => (
          <button
            key={id}
            type="button"
            disabled={disabled || Boolean(busy)}
            onClick={() => void startOAuth(id)}
            title={
              mode === 'register'
                ? `Sign up with ${label}`
                : `Continue with ${label}`
            }
            aria-label={
              mode === 'register'
                ? `Sign up with ${label}`
                : `Continue with ${label}`
            }
            className={`inline-flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 rounded-xl border px-2 py-3 sm:py-3 text-sm sm:text-base font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-[3.5rem] ${btnClass}`}
          >
            {busy === id ? (
              <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin shrink-0" />
            ) : (
              <Icon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
            )}
            <span className="truncate max-w-full">
              {busy === id ? '…' : label}
            </span>
          </button>
        ))}
      </div>
      {showEmailHint && (
        <p className="mt-3 text-[11px] text-text-muted leading-relaxed text-center">
          Same email as an existing account is linked automatically. Different
          email? Sign in first, then link the provider under Linked Accounts.
        </p>
      )}
    </div>
  );
}
