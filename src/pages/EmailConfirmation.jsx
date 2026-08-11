import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, Mail } from 'lucide-react';
import { ensureUsernameFromSignup } from '../utils/ensureUserProfile';

const EmailConfirmation = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const pendingEmail = localStorage.getItem('pending_confirmation_email');
    if (pendingEmail) setEmail(pendingEmail);

    // If already signed in with verified email, leave this page
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const u = session?.user;
      if (u?.email_confirmed_at || u?.confirmed_at) {
        localStorage.removeItem('pending_confirmation_email');
        // Apply username chosen on create-account form (no second username screen)
        await ensureUsernameFromSignup(u, null);
        navigate('/dashboard', { replace: true });
      } else if (u?.email && !pendingEmail) {
        setEmail(u.email);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user;
        if (u && (u.email_confirmed_at || u.confirmed_at)) {
          localStorage.removeItem('pending_confirmation_email');
          await ensureUsernameFromSignup(u, null);
          navigate('/dashboard', { replace: true });
        }
      }
    );

    return () => listener.subscription.unsubscribe();
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
      localStorage.setItem('pending_confirmation_email', target);
      const { error: err } = await supabase.auth.resend({
        type: 'signup',
        email: target,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard?verified=1`,
        },
      });
      if (err) throw err;
      setMessage(
        `Another confirmation link was sent to ${target}. Check spam if you do not see it within a few minutes.`
      );
    } catch (e) {
      setError(e?.message || 'Could not resend confirmation email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-20 min-h-screen flex items-center justify-center">
      <div className="container-custom max-w-md text-center">
        <div className="cyber-card p-10">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-neon-cyan/10 flex items-center justify-center">
              <Mail className="w-8 h-8 text-neon-cyan" />
            </div>
          </div>

          <h1 className="text-3xl font-bold mb-4 text-white">Check your email</h1>
          <p className="text-text-secondary mb-6 leading-relaxed">
            We sent a confirmation link to{' '}
            <span className="text-white font-mono">
              {email || 'your email address'}
            </span>
            . Click it to verify your account, then link Discord, Google, or
            GitHub so you can claim tasks.
          </p>

          {!email && (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full mb-4 bg-cyber-surface border border-white/20 p-3 text-white rounded-lg focus:border-neon-cyan outline-none text-sm"
            />
          )}

          {message && (
            <p className="text-sm text-emerald-300 mb-4" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="text-sm text-red-300 mb-4" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={resend}
            disabled={busy}
            className="btn-neon w-full py-3 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Sending…
              </>
            ) : (
              'Resend confirmation email'
            )}
          </button>

          <p className="text-sm text-text-muted mt-6">
            Already verified?{' '}
            <Link
              to="/account/linked?setup=identity"
              className="text-neon-cyan hover:underline"
            >
              Open Profile → Linked accounts
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailConfirmation;
