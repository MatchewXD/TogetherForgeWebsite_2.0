import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Card from '../components/ui/Card';
import Button from '../components/ui/Buttons';
import { ensureUsernameFromSignup } from '../utils/ensureUserProfile';
import {
  clearPendingConfirmEmail,
  emailConfirmRedirectUrl,
  needsEmailConfirmation,
  readPendingConfirmEmail,
  stashPendingConfirmEmail,
} from '../utils/authIdentities';
import { AUTH_FROM_HINT } from '../constants/authEmail';

const EmailConfirmation = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const pending = readPendingConfirmEmail();
    if (pending) setEmail(pending);

    let mounted = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const u = session?.user;
      if (!mounted) return;
      if (u && !needsEmailConfirmation(u)) {
        clearPendingConfirmEmail();
        await ensureUsernameFromSignup(u, null);
        navigate('/dashboard', { replace: true });
        return;
      }
      if (u?.email && !pending) setEmail(u.email);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user;
        if (u && !needsEmailConfirmation(u)) {
          clearPendingConfirmEmail();
          await ensureUsernameFromSignup(u, null);
          navigate('/dashboard', { replace: true });
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  const resend = async () => {
    const target = (email || '').trim();
    if (!target) {
      setError('Enter the email you registered with.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      stashPendingConfirmEmail(target);
      const { error: err } = await supabase.auth.resend({
        type: 'signup',
        email: target,
        options: {
          emailRedirectTo: emailConfirmRedirectUrl(),
        },
      });
      if (err) throw err;
      setMessage(`Another confirmation link was sent to ${target}.`);
    } catch (e) {
      setError(e?.message || 'Could not resend confirmation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page pt-20 min-h-screen">
      <div className="auth-page__atmosphere" aria-hidden="true" />
      <div className="auth-page__content container-custom py-12 sm:py-16 max-w-md">
        <div className="text-center mb-8">
          <div className="auth-page__heading section-header text-neon-purple justify-center mx-auto">
            CONFIRM
          </div>
        </div>
        <Card className="auth-page__card border border-cyber-border p-6 sm:p-8 text-center">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-full bg-neon-cyan/10 flex items-center justify-center">
              <Mail className="w-7 h-7 text-neon-cyan" aria-hidden />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Check your email to confirm your account
          </h1>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed mb-6">
            We sent a confirmation link to{' '}
            <span className="text-white font-mono break-all">
              {email || 'your email address'}
            </span>
            . Look for mail from {AUTH_FROM_HINT}.
          </p>

          {!email ? (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full mb-4 bg-cyber-surface border border-cyber-border p-3 text-white rounded-lg focus:border-neon-cyan outline-none text-sm"
              autoComplete="email"
            />
          ) : null}

          {message ? (
            <p className="text-sm text-emerald-300 mb-4" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-red-300 mb-4" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            className="w-full gap-2"
            disabled={busy}
            onClick={() => void resend()}
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending…
              </>
            ) : (
              'Resend confirmation'
            )}
          </Button>

          <p className="text-sm text-text-muted mt-6">
            <Link to="/account" className="text-neon-cyan hover:underline">
              Back to sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
};

export default EmailConfirmation;
