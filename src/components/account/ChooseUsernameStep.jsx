/**
 * Required username step for OAuth / legacy accounts that never chose a username.
 * Email/password sign-up sets username on the create-account form only — this
 * step is skipped when user_metadata or pending stash can claim it.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Buttons';
import {
  checkUsernameAvailability,
  claimUsernameForUser,
  validatePublicUsername,
} from '../../utils/ensureUserProfile';

/**
 * @param {{
 *   user: object,
 *   onComplete: (username: string) => void,
 * }} props
 */
export default function ChooseUsernameStep({ user, onComplete }) {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('idle'); // idle | checking | available | taken | invalid
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const value = username.trim();
    if (!value) {
      setStatus('idle');
      setHint('');
      return undefined;
    }

    const format = validatePublicUsername(value);
    if (!format.ok) {
      setStatus('invalid');
      setHint(format.message || 'Invalid username');
      return undefined;
    }

    setStatus('checking');
    setHint('Checking availability…');
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const result = await checkUsernameAvailability(value, user?.id);
      if (cancelled) return;
      if (result.available) {
        setStatus('available');
        setHint('Username is available');
      } else {
        setStatus(result.message?.includes('taken') ? 'taken' : 'invalid');
        setHint(result.message || 'Not available');
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [username, user?.id]);

  const canSubmit =
    status === 'available' && !busy && username.trim().length >= 3;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || !user?.id) return;
    setBusy(true);
    setError('');
    try {
      const result = await claimUsernameForUser(
        user.id,
        username,
        user.email || null
      );
      if (!result.ok) {
        setError(result.message || 'Could not save username');
        setStatus('taken');
        setHint(result.message || 'Not available');
        return;
      }
      onComplete?.(result.username);
    } catch (err) {
      setError(err?.message || 'Could not save username');
    } finally {
      setBusy(false);
    }
  };

  const hintClass =
    status === 'available'
      ? 'text-emerald-300'
      : status === 'checking'
        ? 'text-text-muted'
        : status === 'idle'
          ? 'text-text-muted'
          : 'text-red-400';

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg relative">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.08)_0%,transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(0,249,255,0.05)_0%,transparent_45%)]"
        aria-hidden
      />
      <div className="container-custom relative z-10 py-12 max-w-md">
        <div className="text-center mb-8">
          <img
            src="/images/TF_Logo_Ideas_V2.png"
            alt="Together Forge"
            className="w-16 h-16 mx-auto mb-4 object-contain"
          />
          <div className="section-header text-neon-purple justify-center">
            ALMOST THERE
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2 tracking-tight">
            Choose your username
          </h1>
          <p className="text-sm text-text-secondary mt-2 leading-relaxed">
            Finish setting up your account (for example after Google, Discord,
            or GitHub). Pick a unique username so others can find you at{' '}
            <span className="font-mono text-neon-cyan">/u/you</span>. You can
            change it later under Edit Profile.
          </p>
        </div>

        <Card className="bg-cyber-card/90 border border-cyber-border p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="choose-username"
                className="block text-sm font-mono tracking-widest text-neon-cyan mb-2"
              >
                USERNAME
              </label>
              <input
                id="choose-username"
                type="text"
                autoComplete="username"
                autoFocus
                maxLength={24}
                required
                className="w-full bg-cyber-surface border border-white/20 p-3 text-white rounded-lg focus:border-neon-cyan outline-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_handle"
              />
              <p className={`text-xs mt-2 ${hintClass}`}>
                {status === 'checking' && (
                  <Loader2 className="w-3 h-3 inline animate-spin mr-1" />
                )}
                {hint ||
                  '3–24 characters. Letters, numbers, and underscores only.'}
              </p>
              {username.trim() && (
                <p className="text-xs text-text-muted mt-1 font-mono">
                  /u/{username.trim() || '…'}
                </p>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-300 text-center" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full py-3"
              disabled={!canSubmit}
            >
              {busy ? 'Saving…' : 'Continue'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
