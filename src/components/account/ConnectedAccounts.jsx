/**
 * Linked / connected accounts for Task Board identity gate.
 * - Email verification status + resend
 * - Link / unlink Discord, Google, GitHub via Supabase Auth
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Link2, Mail, Unlink, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  canUnlinkProvider,
  findIdentity,
  formatAlreadyLinkedToSelf,
  hasSsoLinked,
  humanizeAuthIdentityError,
  isEmailVerified,
  linkedAccountsRedirectUrl,
  providerDisplayName,
  resolveOAuthReturnState,
  stashOAuthIntent,
  userHasProvider,
} from '../../utils/authIdentities';

const PROVIDERS = [
  {
    id: 'discord',
    label: 'Discord',
    description: 'Community identity used to reduce bot abuse on the Task Board.',
    brandClass: 'text-[#5865F2]',
    borderClass: 'border-[#5865F2]/40',
  },
  {
    id: 'google',
    label: 'Google',
    description: 'Sign-in identity. Any one of Discord, Google, or GitHub satisfies the SSO requirement.',
    brandClass: 'text-white',
    borderClass: 'border-white/25',
  },
  {
    id: 'github',
    label: 'GitHub',
    description: 'Developer identity for Task Board access and technical contributions.',
    brandClass: 'text-white',
    borderClass: 'border-white/25',
  },
];

function providerLabel(id) {
  return PROVIDERS.find((p) => p.id === id)?.label || providerDisplayName(id);
}

/**
 * @param {{
 *   user: object|null,
 *   onUserChange?: (user: object|null) => void,
 *   highlight?: boolean,
 *   className?: string,
 *   title?: string,
 * }} props
 */
export default function ConnectedAccounts({
  user: userProp,
  onUserChange,
  highlight = false,
  className = '',
  title = 'Linked accounts',
}) {
  const [user, setUser] = useState(userProp || null);
  const [identities, setIdentities] = useState([]);
  const [busy, setBusy] = useState(null); // provider id | 'email' | 'refresh'
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmUnlink, setConfirmUnlink] = useState(null); // provider id

  // Sync from parent when session user updates
  useEffect(() => {
    setUser(userProp || null);
  }, [userProp]);

  const refreshUser = useCallback(async () => {
    setBusy((b) => b || 'refresh');
    try {
      const { data, error: err } = await supabase.auth.getUser();
      if (err) throw err;
      const next = data?.user || null;
      setUser(next);
      onUserChange?.(next);

      const { data: idData, error: idErr } =
        await supabase.auth.getUserIdentities();
      if (!idErr && idData?.identities) {
        setIdentities(idData.identities);
      } else if (next?.identities) {
        setIdentities(next.identities);
      }
      return next;
    } catch (e) {
      console.warn('[ConnectedAccounts] refresh', e);
      return null;
    } finally {
      setBusy((b) => (b === 'refresh' ? null : b));
    }
  }, [onUserChange]);

  useEffect(() => {
    if (!userProp?.id) {
      setIdentities([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase.auth.getUserIdentities();
      if (cancelled) return;
      if (!err && data?.identities) {
        setIdentities(data.identities);
      } else if (userProp.identities) {
        setIdentities(userProp.identities);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userProp?.id, userProp?.identities, userProp?.email_confirmed_at]);

  // OAuth link / SSO return: success, auto-link notice, or clear errors
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const href = window.location.href;
        // Need freshest user for “just linked” detection
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        const current = data?.user || user;
        let identityList = identities;
        try {
          const { data: idData } = await supabase.auth.getUserIdentities();
          if (idData?.identities) identityList = idData.identities;
        } catch {
          /* ignore */
        }
        if (cancelled) return;

        const result = resolveOAuthReturnState({
          user: current,
          identityList,
          href,
          consumeIntent: true,
        });

        const hasCallback =
          result.params.linked === '1' ||
          result.params.sso === '1' ||
          result.params.error ||
          result.params.error_description ||
          result.params.error_code ||
          result.intent;

        if (!hasCallback) return;

        if (result.cleanPath) {
          window.history.replaceState({}, '', result.cleanPath);
        }

        if (!result.ok && result.message) {
          setError(result.message);
          setMessage('');
        } else if (result.message) {
          setMessage(result.message);
          setError('');
        }

        if (current) {
          setUser(current);
          onUserChange?.(current);
          if (identityList?.length) setIdentities(identityList);
          else await refreshUser();
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // Run once on mount for callback handling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emailOk = isEmailVerified(user);
  const ssoOk = hasSsoLinked(user);
  const gateReady = emailOk && ssoOk;

  const statusLine = useMemo(() => {
    if (gateReady) return 'Ready to contribute on the Task Board.';
    if (!emailOk && !ssoOk) {
      return 'Verify your email and link Discord, Google, or GitHub to claim or submit tasks.';
    }
    if (!emailOk) return 'Verify your email to finish account setup.';
    return 'Link Discord, Google, or GitHub to finish account setup.';
  }, [gateReady, emailOk, ssoOk]);

  const handleLink = async (provider) => {
    if (!user) return;
    setError('');
    setMessage('');

    // Already linked to the current user — friendly notice, not an error
    if (
      userHasProvider(user, provider) ||
      Boolean(findIdentity(user, provider, identities))
    ) {
      setMessage(formatAlreadyLinkedToSelf(provider));
      return;
    }

    setBusy(provider);
    stashOAuthIntent({ intent: 'link', provider });
    try {
      const { data, error: err } = await supabase.auth.linkIdentity({
        provider,
        options: {
          redirectTo: linkedAccountsRedirectUrl(undefined, provider),
          skipBrowserRedirect: false,
          queryParams:
            provider === 'google'
              ? { access_type: 'online', prompt: 'select_account' }
              : undefined,
        },
      });
      if (err) throw err;
      // Browser redirect usually happens; if not, open URL
      if (data?.url && typeof window !== 'undefined') {
        window.location.assign(data.url);
        return;
      }
      setMessage(
        `Continue in the ${providerLabel(provider)} window to finish linking.`
      );
    } catch (e) {
      setError(humanizeAuthIdentityError(e, provider));
    } finally {
      setBusy(null);
    }
  };

  const handleUnlink = async (provider) => {
    if (!user) return;
    setError('');
    setMessage('');
    setBusy(provider);
    try {
      let identity = findIdentity(user, provider, identities);
      if (!identity) {
        const { data, error: idErr } = await supabase.auth.getUserIdentities();
        if (idErr) throw idErr;
        identity = findIdentity(user, provider, data?.identities);
        if (data?.identities) setIdentities(data.identities);
      }
      if (!identity) {
        throw new Error(`No ${provider} identity found on this account.`);
      }
      if (!canUnlinkProvider(user, provider, identities.length ? identities : [identity])) {
        throw new Error(
          'You cannot unlink your only sign-in method. Keep email or another provider linked.'
        );
      }
      const { error: err } = await supabase.auth.unlinkIdentity(identity);
      if (err) throw err;
      setConfirmUnlink(null);
      setMessage(
        `${providerLabel(provider)} unlinked. Link Discord, Google, or GitHub again before claiming tasks if you have no other SSO provider.`
      );
      await refreshUser();
    } catch (e) {
      setError(e?.message || `Could not unlink ${provider}.`);
    } finally {
      setBusy(null);
    }
  };

  const handleResendVerification = async () => {
    if (!user?.email) {
      setError('No email on this account to verify.');
      return;
    }
    setError('');
    setMessage('');
    setBusy('email');
    try {
      const { error: err } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/account/linked?verified=1`,
        },
      });
      if (err) {
        // Fallback for already-signed-in users where signup resend fails
        const retry = await supabase.auth.resend({
          type: 'email_change',
          email: user.email,
        });
        if (retry.error) throw err;
      }
      setMessage(
        `Verification email sent to ${user.email}. Open the link, then return here — status updates automatically.`
      );
    } catch (e) {
      setError(
        e?.message ||
          'Could not send verification email. Check spam, or try again in a minute.'
      );
    } finally {
      setBusy(null);
    }
  };

  if (!user) return null;

  const highlightRing = highlight
    ? 'ring-2 ring-semantic-warning/60 border-semantic-warning/50'
    : 'border-cyber-border';

  return (
    <section
      id="linked-accounts"
      aria-labelledby="linked-accounts-heading"
      className={`rounded-xl border bg-cyber-card/80 p-5 sm:p-6 space-y-4 scroll-mt-28 ${highlightRing} ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-neon-cyan shrink-0" aria-hidden />
            <h2
              id="linked-accounts-heading"
              className="text-sm font-mono tracking-widest text-neon-cyan uppercase"
            >
              {title}
            </h2>
          </div>
          <p className="text-sm text-text-secondary mt-1.5 leading-relaxed max-w-xl">
            {statusLine} Task Board requires a{' '}
            <strong className="text-white font-medium">verified email</strong> and{' '}
            <strong className="text-white font-medium">
              Discord, Google, or GitHub
            </strong>
            .
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-mono tracking-wide ${
            gateReady
              ? 'border-emerald-400/40 text-emerald-300 bg-emerald-500/10'
              : 'border-semantic-warning/40 text-semantic-warning bg-semantic-warning/10'
          }`}
        >
          {gateReady ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" /> Ready
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5" /> Setup needed
            </>
          )}
        </div>
      </div>

      {message && (
        <p
          role="status"
          className="text-sm rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-emerald-100"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="text-sm rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-red-100"
        >
          {error}
        </p>
      )}

      {/* Email verification */}
      <div className="rounded-lg border border-white/10 bg-cyber-surface/50 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <Mail className="w-5 h-5 text-neon-cyan shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0">
            <div className="text-sm font-medium text-white">Email</div>
            <div className="text-xs text-text-muted font-mono truncate">
              {user.email || 'No email on account'}
            </div>
            <div
              className={`text-xs mt-1 ${
                emailOk ? 'text-emerald-300' : 'text-semantic-warning'
              }`}
            >
              {emailOk ? 'Verified' : 'Not verified — check your inbox for a confirmation link'}
            </div>
          </div>
        </div>
        {!emailOk && (
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={busy === 'email'}
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-2 text-xs font-mono tracking-wide text-neon-cyan hover:border-neon-cyan hover:bg-neon-cyan/15 disabled:opacity-50"
          >
            {busy === 'email' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…
              </>
            ) : (
              'Resend verification'
            )}
          </button>
        )}
        {emailOk && (
          <button
            type="button"
            onClick={() => refreshUser()}
            disabled={busy === 'refresh'}
            className="shrink-0 text-xs text-text-muted hover:text-neon-cyan font-mono"
          >
            Refresh status
          </button>
        )}
      </div>

      {/* SSO providers */}
      <div className="space-y-3">
        {PROVIDERS.map((p) => {
          const linked =
            userHasProvider(user, p.id) ||
            Boolean(findIdentity(user, p.id, identities));
          const isBusy = busy === p.id;
          return (
            <div
              key={p.id}
              className={`rounded-lg border bg-cyber-surface/40 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
                linked ? 'border-emerald-400/25' : p.borderClass
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-semibold ${p.brandClass}`}>
                    {p.label}
                  </span>
                  <span
                    className={`text-[10px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded border ${
                      linked
                        ? 'border-emerald-400/40 text-emerald-300'
                        : 'border-white/15 text-text-muted'
                    }`}
                  >
                    {linked ? 'Linked' : 'Not linked'}
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  {p.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 shrink-0">
                {!linked ? (
                  <button
                    type="button"
                    onClick={() => handleLink(p.id)}
                    disabled={Boolean(busy)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-neon-cyan/50 bg-neon-cyan/15 px-3 py-2 text-xs font-semibold text-neon-cyan hover:bg-neon-cyan/25 disabled:opacity-50"
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Linking…
                      </>
                    ) : (
                      <>
                        <Link2 className="w-3.5 h-3.5" />
                        Link {p.label}
                      </>
                    )}
                  </button>
                ) : confirmUnlink === p.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleUnlink(p.id)}
                      disabled={Boolean(busy)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/50 bg-red-500/15 px-3 py-2 text-xs text-red-200 hover:bg-red-500/25 disabled:opacity-50"
                    >
                      {isBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Unlink className="w-3.5 h-3.5" />
                      )}
                      Confirm unlink
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmUnlink(null)}
                      disabled={isBusy}
                      className="rounded-lg border border-white/20 px-3 py-2 text-xs text-text-secondary hover:text-white"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmUnlink(p.id)}
                    disabled={Boolean(busy)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs text-text-secondary hover:border-red-400/40 hover:text-red-200 disabled:opacity-50"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    Unlink
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-text-muted leading-relaxed">
        Linking opens a secure OAuth window while you stay signed into Together
        Forge. Same-email providers can auto-link at sign-in; different emails
        must be linked here after you sign in with your existing method. A
        provider already on another Together Forge account cannot be taken over.
        Profile “Discord” text fields (display handle) are separate from this
        security link.
      </p>
    </section>
  );
}
