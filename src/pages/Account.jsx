/**
 * Account / Settings hub at /account/:section?
 * Private area for profile editing, linked accounts, security, billing stubs, etc.
 * Profile page for others remains /u/:username.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import {
  User,
  Link2,
  Shield,
  CreditCard,
  Bell,
  Eye,
  AlertTriangle,
  LayoutDashboard,
  ExternalLink,
  Pencil,
  Sparkles,
  Hexagon,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import Card from '../components/ui/Card';
import Button from '../components/ui/Buttons';
import LoadingScreen from '../components/ui/LoadingScreen';
import ConnectedAccounts from '../components/account/ConnectedAccounts';
import ProfileSettingsForm from '../components/account/ProfileSettingsForm';
import OAuthSignInButtons from '../components/account/OAuthSignInButtons';
import ChooseUsernameStep from '../components/account/ChooseUsernameStep';
import { publicProfilePath } from '../utils/profileLinks';
import {
  ensureUserProfile,
  checkUsernameAvailability,
  validatePublicUsername,
  claimUsernameForUser,
  stashPendingUsername,
  ensureUsernameFromSignup,
} from '../utils/ensureUserProfile';
import {
  acceptCurrentLegal,
  legalAcceptanceMetadata,
} from '../services/legalService';
import {
  ACCOUNT_SECTIONS,
  ACCOUNT_SECTION_GROUPS,
  DEFAULT_ACCOUNT_SECTION,
  accountPath,
  isAccountSection,
  getAccountSection,
} from '../constants/accountSections';
import { changePasswordWhileLoggedIn, requestPasswordReset } from '../services/authPasswordService';
import {
  PASSWORD_MIN_LENGTH,
  getPasswordRequirementStatus,
  passwordStrengthLabel,
  passwordStrengthScore,
  validatePasswordStrength,
} from '../utils/passwordRules';
import {
  resolveOAuthReturnState,
} from '../utils/authIdentities';
import AccountPlanSection from '../components/account/AccountPlanSection';
import AccountBillingSection from '../components/account/AccountBillingSection';
import AccountAiTokensSection from '../components/account/AccountAiTokensSection';
import AccountForgeMarksSection from '../components/account/AccountForgeMarksSection';
import AccountMfaSection from '../components/account/AccountMfaSection';

const SSO_FLASH_KEY = 'tf_sso_flash';

function safeNextPath(raw) {
  const s = String(raw || '').trim();
  if (!s.startsWith('/') || s.startsWith('//') || s.includes('://')) {
    return null;
  }
  return s;
}

function stashSsoFlash(payload) {
  try {
    if (!payload?.message) return;
    sessionStorage.setItem(
      SSO_FLASH_KEY,
      JSON.stringify({
        message: payload.message,
        ok: payload.ok !== false,
        at: Date.now(),
      })
    );
  } catch {
    /* ignore */
  }
}

function consumeSsoFlash(maxAgeMs = 10 * 60 * 1000) {
  try {
    const raw = sessionStorage.getItem(SSO_FLASH_KEY);
    sessionStorage.removeItem(SSO_FLASH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.message) return null;
    if (parsed.at && Date.now() - parsed.at > maxAgeMs) return null;
    return { message: parsed.message, ok: parsed.ok !== false };
  } catch {
    return null;
  }
}

const SECTION_ICONS = {
  profile: User,
  linked: Link2,
  security: Shield,
  plan: CreditCard,
  billing: CreditCard,
  'ai-tokens': Sparkles,
  'forge-marks': Hexagon,
  preferences: Bell,
  privacy: Eye,
  danger: AlertTriangle,
};

function LegalAgreeCheckbox({ checked, onChange, className = '' }) {
  return (
    <label
      className={`flex items-start gap-3 cursor-pointer text-sm text-text-secondary leading-relaxed ${className}`}
    >
      <input
        type="checkbox"
        className="mt-1 accent-neon-cyan shrink-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
      />
      <span>
        I agree to the{' '}
        <Link
          to="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-neon-cyan hover:underline"
        >
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link
          to="/guidelines"
          target="_blank"
          rel="noopener noreferrer"
          className="text-neon-cyan hover:underline"
        >
          Community Guidelines
        </Link>
        . See also our{' '}
        <Link
          to="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-neon-cyan hover:underline"
        >
          Privacy Policy
        </Link>
        .
      </span>
    </label>
  );
}

function AccountLogin({ onAuthed, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // login | register | forgot
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageOk, setMessageOk] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [usernameHint, setUsernameHint] = useState('');
  const [usernameStatus, setUsernameStatus] = useState('idle');
  const [showEmailForm, setShowEmailForm] = useState(false);
  /** Required on register: Terms of Service + Community Guidelines */
  const [legalAgreed, setLegalAgreed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('forgot') === '1') {
        setMode('forgot');
        setShowEmailForm(true);
      }
      if (params.get('password_reset') === '1') {
        setMessageOk(true);
        setMessage('Password updated. Sign in with your new password.');
        setMode('login');
        setShowEmailForm(true);
      }
      if (params.get('signup') === '1' || params.get('register') === '1') {
        setMode('register');
        setShowEmailForm(true);
      }

      // OAuth / SSO failures land here without a session (e.g. cancelled,
      // or rare server errors). Never fail silently.
      const oauth = resolveOAuthReturnState({
        user: null,
        href: window.location.href,
        consumeIntent: true,
      });
      const hasOAuthNoise =
        oauth.params.error ||
        oauth.params.error_code ||
        oauth.params.error_description ||
        oauth.params.sso === '1';
      if (hasOAuthNoise) {
        if (oauth.cleanPath) {
          window.history.replaceState({}, '', oauth.cleanPath);
        }
        if (!oauth.ok && oauth.message) {
          setMessageOk(false);
          setMessage(oauth.message);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Live username availability on register
  useEffect(() => {
    if (mode !== 'register') {
      setUsernameStatus('idle');
      setUsernameHint('');
      return undefined;
    }
    const value = form.username.trim();
    if (!value) {
      setUsernameStatus('idle');
      setUsernameHint('');
      setUsernameError('');
      return undefined;
    }
    const format = validatePublicUsername(value);
    if (!format.ok) {
      setUsernameStatus('invalid');
      setUsernameHint(format.message || '');
      setUsernameError(format.message || '');
      return undefined;
    }
    setUsernameStatus('checking');
    setUsernameHint('Checking availability…');
    setUsernameError('');
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const result = await checkUsernameAvailability(value);
      if (cancelled) return;
      if (result.available) {
        setUsernameStatus('available');
        setUsernameHint('Username is available');
        setUsernameError('');
      } else {
        setUsernameStatus('taken');
        setUsernameHint(result.message || 'Username already taken');
        setUsernameError(result.message || 'Username already taken');
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [form.username, mode]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setMessageOk(false);
    setUsernameError('');
    try {
      if (mode === 'forgot') {
        const result = await requestPasswordReset(form.email);
        setMessageOk(true);
        setMessage(result.message);
        setLoading(false);
        return;
      }
      if (mode === 'register') {
        if (!legalAgreed) {
          setMessage(
            'Please agree to the Terms of Service and Community Guidelines to create an account.'
          );
          setLoading(false);
          return;
        }
        const format = validatePublicUsername(form.username);
        if (!format.ok) {
          setUsernameError(format.message || 'Username is required');
          setUsernameStatus('invalid');
          setLoading(false);
          return;
        }
        const avail = await checkUsernameAvailability(form.username);
        if (!avail.ok || !avail.available) {
          setUsernameError(avail.message || 'Username is required');
          setUsernameStatus('taken');
          setLoading(false);
          return;
        }
        if (usernameStatus === 'taken' || usernameStatus === 'invalid') {
          setUsernameError(usernameError || 'Pick an available username');
          setLoading(false);
          return;
        }
        const strength = validatePasswordStrength(form.password, {
          email: form.email,
        });
        if (!strength.ok) {
          setMessage(strength.message);
          setLoading(false);
          return;
        }
        // Persist choice so we never ask again after confirm-email / first login
        stashPendingUsername(avail.value);
        const legalMeta = legalAcceptanceMetadata();
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: { username: avail.value, ...legalMeta },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        if (data.user) {
          // Prefer session claim; without session, metadata + stash apply on first sign-in
          if (data.session) {
            await claimUsernameForUser(
              data.user.id,
              avail.value,
              form.email
            );
            try {
              await acceptCurrentLegal(data.user.id);
            } catch {
              /* gate will re-prompt if profile columns missing */
            }
            onAuthed?.(data.user);
            const next = safeNextPath(
              new URLSearchParams(window.location.search).get('next')
            );
            navigate(next || '/dashboard', { replace: true });
          } else {
            localStorage.setItem('pending_confirmation_email', form.email);
            navigate('/confirm-email', { replace: true });
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) {
          setMessage(error.message);
          setLoading(false);
          return;
        }
        // Apply username chosen at sign-up if profile is still empty
        if (data.user) {
          await ensureUsernameFromSignup(data.user, null);
        }
        onAuthed?.(data.user);
        // MFA challenge (if enrolled) is handled by MfaSessionGate at app root
        const next = safeNextPath(
          new URLSearchParams(window.location.search).get('next')
        );
        navigate(next || '/dashboard', { replace: true });
      }
    } catch (err) {
      setMessage(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const eyebrow =
    mode === 'forgot' ? 'PASSWORD' : mode === 'register' ? 'JOIN' : 'SIGN IN';
  return (
    <div className="auth-page pt-20">
      <div className="auth-page__atmosphere" aria-hidden="true" />

      <div className="auth-page__content container-custom py-12 sm:py-16 max-w-md">
        <div className="text-center mb-8">
          <div className="auth-page__heading section-header text-neon-purple justify-center mx-auto">
            {eyebrow}
          </div>
          {mode === 'forgot' && (
            <p className="text-sm text-text-secondary mt-3 max-w-sm mx-auto leading-relaxed">
              We will email a single-use reset link if an account exists for that
              address.
            </p>
          )}
        </div>

        <Card
          className="auth-page__card border border-cyber-border p-6 sm:p-8"
        >
          {message && (
            <p
              className={`text-sm text-center mb-5 ${
                messageOk ? 'text-emerald-300' : 'text-red-300'
              }`}
              role={messageOk ? 'status' : 'alert'}
            >
              {message}
            </p>
          )}

          {mode !== 'forgot' && (
            <>
              <OAuthSignInButtons
                mode={mode === 'register' ? 'register' : 'login'}
                disabled={loading}
                requireAgree={mode === 'register'}
                agreed={legalAgreed}
                onError={(msg) => {
                  setMessageOk(false);
                  setMessage(msg || '');
                }}
              />
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center" aria-hidden>
                  <div className="w-full border-t border-cyber-border" />
                </div>
                <div className="relative flex justify-center text-[10px] font-mono tracking-widest uppercase">
                  <span className="bg-cyber-card/95 px-3 text-text-muted">
                    or use email
                  </span>
                </div>
              </div>
              {!showEmailForm ? (
                <button
                  type="button"
                  className="w-full text-sm text-neon-cyan hover:text-white border border-cyber-border hover:border-neon-cyan/40 rounded-xl py-3 transition-colors"
                  onClick={() => setShowEmailForm(true)}
                >
                  {mode === 'register'
                    ? 'Sign up with email and password'
                    : 'Sign in with email and password'}
                </button>
              ) : null}
            </>
          )}

          {(mode === 'forgot' || showEmailForm) && (
            <form
              onSubmit={handleAuth}
              className={`space-y-4 ${mode !== 'forgot' ? 'mt-5' : ''}`}
            >
              {mode === 'register' && (
                <div>
                  <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">
                    USERNAME *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={24}
                    autoComplete="username"
                    className="w-full bg-cyber-surface border border-white/20 p-3 text-white rounded-lg focus:border-neon-cyan outline-none"
                    value={form.username}
                    onChange={(e) =>
                      setForm({ ...form, username: e.target.value })
                    }
                    placeholder="your_handle"
                    aria-describedby="register-username-hint"
                  />
                  <p
                    id="register-username-hint"
                    className={`text-xs mt-1.5 ${
                      usernameStatus === 'available'
                        ? 'text-emerald-300'
                        : usernameError ||
                            usernameStatus === 'taken' ||
                            usernameStatus === 'invalid'
                          ? 'text-red-400'
                          : usernameStatus === 'checking'
                            ? 'text-neon-cyan'
                            : 'text-text-muted'
                    }`}
                  >
                    {usernameError ||
                      usernameHint ||
                      '3–24 characters. Letters, numbers, and underscores only. We check if it is taken as you type.'}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">
                  EMAIL
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full bg-cyber-surface border border-white/20 p-3 text-white rounded-lg focus:border-neon-cyan outline-none"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              {mode !== 'forgot' && (
                <div>
                  <label className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">
                    PASSWORD
                  </label>
                  <input
                    type="password"
                    required
                    autoComplete={
                      mode === 'register' ? 'new-password' : 'current-password'
                    }
                    className="w-full bg-cyber-surface border border-white/20 p-3 text-white rounded-lg focus:border-neon-cyan outline-none"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    aria-describedby={
                      mode === 'register' ? 'password-requirements' : undefined
                    }
                  />
                  {mode === 'register' && (
                    <div
                      id="password-requirements"
                      className="mt-3 rounded-lg border border-white/10 bg-cyber-bg/50 px-3 py-2.5"
                    >
                      <p className="text-[11px] font-mono tracking-widest uppercase text-text-muted mb-2">
                        Password requirements
                      </p>
                      <ul className="space-y-1.5" aria-live="polite">
                        {getPasswordRequirementStatus(form.password, {
                          email: form.email,
                        }).map((req) => (
                          <li
                            key={req.id}
                            className={`flex items-start gap-2 text-xs leading-snug ${
                              req.met
                                ? 'text-emerald-300'
                                : 'text-text-secondary'
                            }`}
                          >
                            <span
                              className={`mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                                req.met
                                  ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
                                  : 'border-white/20 text-text-muted'
                              }`}
                              aria-hidden
                            >
                              {req.met ? '✓' : '·'}
                            </span>
                            <span>
                              {req.label}
                              <span className="sr-only">
                                {req.met ? ' — met' : ' — not met'}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {mode === 'login' && (
                    <button
                      type="button"
                      className="mt-2 text-xs text-neon-cyan hover:underline"
                      onClick={() => {
                        setMode('forgot');
                        setMessage('');
                        setMessageOk(false);
                      }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
              )}
              {mode === 'register' && (
                <LegalAgreeCheckbox
                  checked={legalAgreed}
                  onChange={setLegalAgreed}
                />
              )}
              <button
                type="submit"
                disabled={
                  loading ||
                  (mode === 'register' &&
                    (!legalAgreed ||
                      usernameStatus === 'taken' ||
                      usernameStatus === 'invalid' ||
                      usernameStatus === 'checking' ||
                      !form.username.trim()))
                }
                className="btn-primary btn-neon w-full py-3"
              >
                {loading
                  ? 'Please wait…'
                  : mode === 'forgot'
                    ? 'Send reset link'
                    : mode === 'login'
                      ? 'Sign in with email'
                      : 'Create account'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-cyber-border/80 text-center space-y-2">
            {mode === 'forgot' ? (
              <button
                type="button"
                className="text-xs text-neon-cyan hover:underline"
                onClick={() => {
                  setMode('login');
                  setMessage('');
                  setMessageOk(false);
                  setShowEmailForm(true);
                }}
              >
                Back to sign in
              </button>
            ) : (
              <button
                type="button"
                className="text-xs text-neon-cyan hover:underline"
                onClick={() => {
                  const next = mode === 'login' ? 'register' : 'login';
                  setMode(next);
                  setMessage('');
                  setMessageOk(false);
                  setUsernameError('');
                  setLegalAgreed(false);
                  if (next === 'register') setShowEmailForm(true);
                }}
              >
                {mode === 'login'
                  ? 'New here? Create an account'
                  : 'Already have an account? Sign in'}
              </button>
            )}
          </div>
        </Card>

        <p className="text-center text-[11px] text-text-muted mt-6 leading-relaxed max-w-sm mx-auto">
          {mode === 'register' ? (
            <>
              Creating an account requires accepting our{' '}
              <Link to="/terms" className="text-neon-cyan hover:underline">
                Terms
              </Link>
              ,{' '}
              <Link
                to="/guidelines"
                className="text-neon-cyan hover:underline"
              >
                Guidelines
              </Link>
              , and reviewing the{' '}
              <Link to="/privacy" className="text-neon-cyan hover:underline">
                Privacy Policy
              </Link>
              . Link Discord, Google, or GitHub anytime under Account → Linked
              accounts.
            </>
          ) : (
            <>
              Link Discord, Google, or GitHub anytime under Account → Linked
              accounts.{' '}
              <Link to="/terms" className="text-neon-cyan hover:underline">
                Terms
              </Link>
              {' · '}
              <Link to="/privacy" className="text-neon-cyan hover:underline">
                Privacy
              </Link>
              {' · '}
              <Link
                to="/guidelines"
                className="text-neon-cyan hover:underline"
              >
                Guidelines
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function ComingSoon({ title, body }) {
  return (
    <Card className="bg-cyber-card border border-cyber-border p-6 sm:p-8 space-y-3">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <p className="text-sm text-text-secondary leading-relaxed">{body}</p>
      <p className="text-xs font-mono text-text-muted tracking-widest uppercase">
        Coming soon
      </p>
    </Card>
  );
}

/** Multi-step delete confirmation (backend still pending). */
function DangerZoneSection({ user }) {
  const [step, setStep] = useState(0);
  const [confirmText, setConfirmText] = useState('');
  const expected = 'DELETE';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Danger zone</h2>
        <p className="text-sm text-text-secondary mt-1">
          Irreversible account actions. Credits and history are tied to your
          user ID, not just your username.
        </p>
      </div>
      <Card className="bg-cyber-card border border-red-400/40 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-red-200">Delete account</h3>
        {step === 0 && (
          <>
            <p className="text-sm text-text-secondary leading-relaxed">
              Deleting your account will remove access to this site. Public
              credits and historical records may be retained in anonymized form.
              This flow is staged for safety; full deletion is not enabled yet.
            </p>
            <Button size="sm" variant="danger" onClick={() => setStep(1)}>
              I understand, continue
            </Button>
          </>
        )}
        {step === 1 && (
          <>
            <p className="text-sm text-text-secondary leading-relaxed">
              You are signed in as{' '}
              <span className="text-white">{user?.email || 'this account'}</span>
              . Type <span className="font-mono text-red-200">{expected}</span>{' '}
              to confirm.
            </p>
            <input
              type="text"
              className="w-full max-w-xs bg-cyber-surface border border-red-400/30 rounded-lg px-3 py-2 text-white text-sm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={expected}
              autoComplete="off"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={() => setStep(0)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={confirmText !== expected}
                onClick={() => setStep(2)}
              >
                Final step
              </Button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <p className="text-sm text-red-200/90 leading-relaxed">
              Account deletion is not fully available yet. Contact a Project Lead
              on Discord if you need your account removed sooner.
            </p>
            <Button size="sm" variant="danger" disabled>
              Delete account (not yet available)
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
          </>
        )}
      </Card>
      <ComingSoon
        title="Download my data"
        body="Export profile, contributions, and donation receipts."
      />
    </div>
  );
}

function SecuritySection({ user }) {
  const [openPassword, setOpenPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [needsMfa, setNeedsMfa] = useState(false);
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const strength = useMemo(
    () => passwordStrengthScore(password),
    [password]
  );
  const strengthCheck = useMemo(
    () => validatePasswordStrength(password, { email: user?.email }),
    [password, user?.email]
  );

  const closePasswordForm = () => {
    setOpenPassword(false);
    setCurrentPassword('');
    setPassword('');
    setConfirm('');
    setMfaCode('');
    setNeedsMfa(false);
    setErr('');
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    setBusy(true);
    try {
      const result = await changePasswordWhileLoggedIn({
        email: user?.email,
        currentPassword,
        newPassword: password,
        confirmPassword: confirm,
        mfaCode: needsMfa ? mfaCode : undefined,
        signOutOtherSessions: signOutOthers,
      });
      setMsg(
        result.signedOutOthers
          ? 'Password updated. Other sessions were signed out. Check your email for a security notice if enabled on this project.'
          : 'Password updated. Check your email for a security notice if enabled on this project.'
      );
      closePasswordForm();
    } catch (ex) {
      if (ex?.code === 'MFA_REQUIRED') {
        setNeedsMfa(true);
        setErr(ex.message);
      } else {
        setErr(ex?.message || 'Could not update password.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Security</h2>
        <p className="text-sm text-text-secondary mt-1">
          Password, two-factor authentication, and sign-in for{' '}
          {user?.email || 'your account'}.
        </p>
      </div>
      <Card className="bg-cyber-card border border-cyber-border p-6 space-y-4">
        <h3 className="text-sm font-mono tracking-widest text-neon-purple uppercase">
          Password
        </h3>
        {!openPassword ? (
          <div className="space-y-3">
            {msg && (
              <p className="text-sm text-emerald-300 leading-relaxed" role="status">
                {msg}
              </p>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setMsg('');
                setErr('');
                setNeedsMfa(false);
                setOpenPassword(true);
              }}
            >
              Change password
            </Button>
          </div>
        ) : (
          <form onSubmit={changePassword} className="space-y-3 max-w-md">
            <div>
              <label className="block text-xs font-mono tracking-widest text-text-muted uppercase mb-1.5">
                Current password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-white focus:border-neon-cyan outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-mono tracking-widest text-text-muted uppercase mb-1.5">
                New password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-white focus:border-neon-cyan outline-none"
                placeholder={`At least ${PASSWORD_MIN_LENGTH} characters, letter + number`}
              />
              {password && (
                <p className="text-[11px] text-text-muted mt-1.5">
                  Strength:{' '}
                  <span className="text-white">
                    {passwordStrengthLabel(strength)}
                  </span>
                  {!strengthCheck.ok && (
                    <span className="text-semantic-warning">
                      {' '}
                      · {strengthCheck.message}
                    </span>
                  )}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-mono tracking-widest text-text-muted uppercase mb-1.5">
                Confirm new password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-white focus:border-neon-cyan outline-none"
              />
            </div>
            {needsMfa && (
              <div>
                <label className="block text-xs font-mono tracking-widest text-text-muted uppercase mb-1.5">
                  Authenticator code (2FA)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className="w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-white focus:border-neon-cyan outline-none"
                  placeholder="6-digit code"
                />
              </div>
            )}
            <label className="flex items-start gap-2 text-xs text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-neon-cyan"
                checked={signOutOthers}
                onChange={(e) => setSignOutOthers(e.target.checked)}
              />
              <span>
                Sign out other devices after password change (recommended)
              </span>
            </label>
            {err && (
              <p className="text-xs text-red-300" role="alert">
                {err}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={busy || (password.length > 0 && !strengthCheck.ok)}
              >
                {busy ? 'Saving…' : 'Update password'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={closePasswordForm}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Card>
      <AccountMfaSection />
      <ComingSoon
        title="Active sessions"
        body="Review and sign out other devices will be available here. Password change can already sign out other sessions."
      />
    </div>
  );
}

function PrivacySection({ profile, userId, onUpdated }) {
  const savedShowTotal = Boolean(profile?.show_donation_total);
  const [showTotal, setShowTotal] = useState(savedShowTotal);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setShowTotal(Boolean(profile?.show_donation_total));
  }, [profile?.show_donation_total]);

  const isDirty = showTotal !== savedShowTotal;

  const save = async () => {
    if (!userId || !isDirty) return;
    setBusy(true);
    setMsg('');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ show_donation_total: showTotal })
        .eq('id', userId);
      if (error) throw error;
      setMsg('Privacy settings saved.');
      onUpdated?.({ show_donation_total: showTotal });
    } catch (e) {
      setMsg(e?.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Privacy</h2>
        <p className="text-sm text-text-secondary mt-1">
          Control what appears on your profile.
        </p>
      </div>
      <Card className="bg-cyber-card border border-cyber-border p-6 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer text-sm text-text-secondary">
          <input
            type="checkbox"
            className="mt-1 accent-semantic-achievement"
            checked={showTotal}
            onChange={(e) => {
              setShowTotal(e.target.checked);
              setMsg('');
            }}
          />
          <span>
            <span className="text-white font-medium">
              Show my total donations on my profile
            </span>
            <span className="block text-xs text-text-muted mt-1 leading-relaxed">
              When off, supporters still get recognition and the project list,
              with no dollar amount. Anonymous donations won&apos;t count
              towards the total donations.
            </span>
          </span>
        </label>
        <Button
          size="sm"
          onClick={() => void save()}
          disabled={busy || !isDirty}
          className="disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none"
          title={!isDirty && !busy ? 'No changes to save' : undefined}
        >
          {busy ? 'Saving…' : 'Save privacy'}
        </Button>
        {msg && <p className="text-xs text-text-muted">{msg}</p>}
      </Card>
    </div>
  );
}

/** Resolve /account/:section even if useParams is briefly stale */
function sectionFromLocation(pathname, param) {
  if (param && isAccountSection(param)) return param;
  const raw = String(pathname || '')
    .replace(/^\/account\/?/i, '')
    .split('/')
    .filter(Boolean)[0];
  if (raw && isAccountSection(raw)) return raw;
  return param || null;
}

const Account = () => {
  const { section: sectionParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const resolvedSection = sectionFromLocation(
    location.pathname,
    sectionParam
  );
  const section = isAccountSection(resolvedSection)
    ? resolvedSection
    : DEFAULT_ACCOUNT_SECTION;

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [ssoBanner, setSsoBanner] = useState(null); // { message, ok }

  const refreshProfile = useCallback(async (uid, email = null, authUser = null) => {
    if (!uid) {
      setProfile(null);
      return;
    }
    // Ensure a profiles row exists for legacy / SSO accounts
    let ensured = await ensureUserProfile(uid, { email });
    if (!ensured) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();
      ensured = data || null;
    }
    // Email/password sign-up already chose a username — claim it here once
    // so we never show a second username screen for that path.
    if (authUser && !String(ensured?.username || '').trim()) {
      ensured = await ensureUsernameFromSignup(authUser, ensured);
    }
    setProfile(ensured);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(session?.user || null);
      if (session?.user) {
        await refreshProfile(
          session.user.id,
          session.user.email,
          session.user
        );

        // After Google / Discord / GitHub redirect: auto-link notice or errors
        try {
          let identityList = session.user.identities || [];
          try {
            const { data: idData } = await supabase.auth.getUserIdentities();
            if (idData?.identities) identityList = idData.identities;
          } catch {
            /* optional */
          }
          const oauth = resolveOAuthReturnState({
            user: session.user,
            identityList,
            href: window.location.href,
            consumeIntent: true,
          });
          const hasCallback =
            oauth.params.sso === '1' ||
            oauth.params.linked === '1' ||
            oauth.params.error ||
            oauth.params.error_description ||
            oauth.params.error_code ||
            oauth.intent;
          if (hasCallback) {
            if (oauth.cleanPath) {
              window.history.replaceState({}, '', oauth.cleanPath);
            }
            if (oauth.message) {
              const flash = { message: oauth.message, ok: oauth.ok };
              stashSsoFlash(flash);
              setSsoBanner(flash);
            }
          } else {
            const flash = consumeSsoFlash();
            if (flash) setSsoBanner(flash);
          }
        } catch {
          /* ignore */
        }
      } else {
        // Signed-out: still clean SSO errors if AccountLogin did not mount yet
        const flash = consumeSsoFlash();
        if (flash) setSsoBanner(flash);
      }
      setLoading(false);
      setAuthReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        setUser(session?.user || null);
        if (session?.user) {
          await refreshProfile(
            session.user.id,
            session.user.email,
            session.user
          );
        } else setProfile(null);
      }
    );
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [refreshProfile]);

  // Hooks must run every render (before any conditional return)
  const publicPath = publicProfilePath(profile?.username);
  const activeSection = useMemo(
    () => ACCOUNT_SECTIONS.find((s) => s.id === section) || ACCOUNT_SECTIONS[0],
    [section]
  );

  // After login from a deep link (e.g. Report a Bug)
  if (authReady && user && profile?.username) {
    const next = safeNextPath(
      new URLSearchParams(location.search).get('next')
    );
    if (next) return <Navigate to={next} replace />;
  }

  // /account → Edit Profile when signed in (and username is set)
  if (authReady && user && !resolvedSection && profile?.username) {
    return <Navigate to={accountPath('profile')} replace />;
  }
  // Legacy /account/settings hub → Edit Profile
  if (authReady && user && resolvedSection === 'settings') {
    return <Navigate to={accountPath('profile')} replace />;
  }
  // Invalid section → canonical path (never treat "plan" / "billing" as invalid)
  if (
    authReady &&
    user &&
    resolvedSection &&
    !isAccountSection(resolvedSection) &&
    resolvedSection !== 'settings'
  ) {
    return <Navigate to={accountPath('profile')} replace />;
  }

  if (loading) {
    return (
      <div className="pt-20 min-h-screen bg-cyber-bg">
        <LoadingScreen variant="section" message="Loading account…" />
      </div>
    );
  }

  if (!user) {
    return (
      <AccountLogin
        onAuthed={(u) => {
          setUser(u);
        }}
      />
    );
  }

  // OAuth / legacy accounts must pick a unique username before using Account
  const needsUsername = !String(profile?.username || '').trim();
  if (needsUsername) {
    return (
      <ChooseUsernameStep
        user={user}
        onComplete={async (uname) => {
          await refreshProfile(user.id, user.email);
          setProfile((prev) => ({
            ...(prev || {}),
            id: user.id,
            username: uname,
          }));
          navigate('/dashboard', { replace: true });
        }}
      />
    );
  }

  const renderSection = () => {
    // Explicit map so "plan" never falls through to Edit Profile (default)
    if (section === 'linked') {
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-white">Linked accounts</h2>
            <p className="text-sm text-text-secondary mt-1">
              Connect Google, Discord, or GitHub to claim tasks and submit for
              review.
            </p>
          </div>
          <ConnectedAccounts
            user={user}
            onUserChange={(u) => {
              if (u) setUser(u);
            }}
            highlight
          />
        </div>
      );
    }
    if (section === 'security') {
      return <SecuritySection user={user} />;
    }
    if (section === 'plan') {
      return <AccountPlanSection />;
    }
    if (section === 'billing') {
      return <AccountBillingSection />;
    }
    if (section === 'ai-tokens') {
      return <AccountAiTokensSection />;
    }
    if (section === 'forge-marks') {
      return <AccountForgeMarksSection />;
    }
    if (section === 'preferences') {
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-white">Preferences</h2>
            <p className="text-sm text-text-secondary mt-1">
              Notifications and site options.
            </p>
          </div>
          <ComingSoon
            title="Notifications"
            body="Email and Discord digests for claims, reviews, and project updates."
          />
          <ComingSoon
            title="Site preferences"
            body="Theme and display options when available."
          />
        </div>
      );
    }
    if (section === 'privacy') {
      return (
        <PrivacySection
          profile={profile}
          userId={user.id}
          onUpdated={(patch) =>
            setProfile((p) => (p ? { ...p, ...patch } : p))
          }
        />
      );
    }
    if (section === 'danger') {
      return <DangerZoneSection user={user} />;
    }
    // profile (default)
    return (
      <ProfileSettingsForm
        user={user}
        onUserChange={(u) => u && setUser(u)}
        onSaved={() => refreshProfile(user.id)}
      />
    );
  };

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.06)_0%,transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(0,249,255,0.04)_0%,transparent_45%)]"
        aria-hidden
      />

      <div className="border-b border-white/10 bg-cyber-surface/90 relative">
        <div className="container-custom py-10 sm:py-12">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="section-header text-neon-purple">ACCOUNT</div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Settings
              </h1>
              <p className="text-sm text-text-secondary mt-2 max-w-xl">
                Profile, linked accounts, security, and billing for{' '}
                <span className="text-white">{user.email}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-neon-purple/40 text-neon-purple hover:bg-neon-purple/10"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Dashboard
              </Link>
              {publicPath && (
                <Link
                  to={publicPath}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/10"
                >
                  Profile
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container-custom relative z-10 py-8 sm:py-10 max-w-6xl">
        {ssoBanner?.message && (
          <div
            role={ssoBanner.ok ? 'status' : 'alert'}
            className={`mb-6 rounded-xl border px-4 py-3 text-sm leading-relaxed ${
              ssoBanner.ok
                ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100'
                : 'border-red-400/40 bg-red-500/10 text-red-100'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p>{ssoBanner.message}</p>
              <button
                type="button"
                className="shrink-0 text-xs text-text-muted hover:text-white font-mono uppercase tracking-wide"
                onClick={() => setSsoBanner(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          {/* Sidebar */}
          <aside className="lg:w-60 shrink-0">
            <nav
              className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 -mx-1 px-1"
              aria-label="Account sections"
            >
              {ACCOUNT_SECTION_GROUPS.map((group) => (
                <div key={group.id} className="mb-3 lg:mb-4 shrink-0">
                  <p className="hidden lg:block px-3 mb-1.5 text-[10px] font-mono tracking-widest uppercase text-text-muted">
                    {group.label}
                  </p>
                  <div className="flex lg:flex-col gap-1">
                    {group.sectionIds.map((sid) => {
                      const s = getAccountSection(sid);
                      if (!s) return null;
                      const Icon = SECTION_ICONS[s.id] || User;
                      const active = s.id === section;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => navigate(accountPath(s.id))}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm whitespace-nowrap lg:whitespace-normal transition-colors ${
                            active
                              ? s.id === 'danger'
                                ? 'bg-red-500/15 text-red-200 border border-red-400/40'
                                : 'bg-neon-purple/15 text-neon-purple border border-neon-purple/40'
                              : 'text-text-secondary hover:text-white hover:bg-cyber-surface border border-transparent'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="font-medium">{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
            <button
              type="button"
              className="mt-4 text-xs font-mono text-text-muted hover:text-red-300 tracking-widest uppercase"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('/account', { replace: true });
              }}
            >
              Log out
            </button>
          </aside>

          {/* Content — key forces remount when section changes */}
          <main className="flex-1 min-w-0" key={section}>
            <p className="text-[11px] font-mono tracking-widest text-text-muted uppercase mb-4 lg:hidden">
              {activeSection.label}
            </p>
            {renderSection()}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Account;
