/**
 * Password reset landing page (/reset-password).
 * User arrives from a Supabase recovery email (time-limited, single-use token).
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// Link used for invalid-session CTA
import { KeyRound, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Card from '../components/ui/Card';
import Button from '../components/ui/Buttons';
import { completePasswordReset } from '../services/authPasswordService';
import {
  passwordStrengthLabel,
  passwordStrengthScore,
  validatePasswordStrength,
  PASSWORD_MIN_LENGTH,
} from '../utils/passwordRules';

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-text-muted focus:border-neon-cyan outline-none';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [sessionOk, setSessionOk] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;

    const finish = (ok, userEmail = '') => {
      if (!mounted) return;
      setSessionOk(ok);
      setEmail(userEmail || '');
      setReady(true);
    };

    // Recovery links establish a session via URL hash / PKCE code
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        finish(true, session.user.email || '');
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        finish(true, session?.user?.email || '');
      }
    });

    // Give hash/code exchange a moment before declaring invalid
    const t = window.setTimeout(() => {
      if (!mounted) return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) finish(true, session.user.email || '');
        else finish(false);
      });
    }, 1200);

    return () => {
      mounted = false;
      window.clearTimeout(t);
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const strength = useMemo(
    () => passwordStrengthScore(password),
    [password]
  );
  const strengthCheck = useMemo(
    () => validatePasswordStrength(password, { email }),
    [password, email]
  );

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await completePasswordReset({
        newPassword: password,
        confirmPassword: confirm,
        email,
      });
      setDone(true);
      window.setTimeout(() => {
        navigate('/account?password_reset=1', { replace: true });
      }, 1800);
    } catch (err) {
      setError(err?.message || 'Could not reset password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div className="border-b border-white/10 bg-cyber-surface py-12">
        <div className="container-custom max-w-lg">
          <div className="section-header text-neon-purple">SECURITY</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Set a new password
          </h1>
          <p className="text-sm text-text-secondary mt-2">
            Choose a strong password for your Together Forge account.
          </p>
        </div>
      </div>

      <div className="container-custom py-10 max-w-lg">
        {!ready ? (
          <Card className="bg-cyber-card border border-cyber-border p-8 flex items-center justify-center gap-2 text-text-muted">
            <Loader2 className="w-5 h-5 animate-spin text-neon-cyan" />
            Checking reset link…
          </Card>
        ) : done ? (
          <Card className="bg-cyber-card border border-emerald-400/30 p-8 space-y-3 text-center">
            <KeyRound className="w-8 h-8 text-emerald-300 mx-auto" />
            <p className="text-white font-medium">Password updated</p>
            <p className="text-sm text-text-secondary">
              Redirecting you to sign in…
            </p>
          </Card>
        ) : !sessionOk ? (
          <Card className="bg-cyber-card border border-cyber-border p-8 space-y-4">
            <p className="text-sm text-text-secondary leading-relaxed">
              This reset link is invalid or has expired. Reset links are
              single-use and expire after about one hour.
            </p>
            <Link
              to="/account?forgot=1"
              className="inline-flex text-sm text-neon-cyan hover:underline"
            >
              Request a new reset link
            </Link>
          </Card>
        ) : (
          <Card className="bg-cyber-card border border-cyber-border p-6 sm:p-8">
            <form onSubmit={onSubmit} className="space-y-4">
              {email && (
                <p className="text-xs font-mono text-text-muted">
                  Account: <span className="text-white">{email}</span>
                </p>
              )}
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
                  className={fieldClass}
                  placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
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
                  className={fieldClass}
                />
              </div>
              {error && (
                <p className="text-sm text-red-300" role="alert">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={busy || !strengthCheck.ok}
              >
                {busy ? 'Saving…' : 'Set new password'}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
