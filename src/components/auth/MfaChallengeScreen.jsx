/**
 * Full-screen / page-level MFA challenge after password or OAuth (AAL1 → AAL2).
 */
import { useState } from 'react';
import { Shield, Loader2, KeyRound } from 'lucide-react';
import { mfaService } from '../../services/mfaService';
import { supabase } from '../../lib/supabase';
import Card from '../ui/Card';
import Button from '../ui/Buttons';

/**
 * @param {{ onVerified: () => void, onCancel?: () => void }} props
 */
export default function MfaChallengeScreen({ onVerified, onCancel }) {
  const [mode, setMode] = useState('totp'); // totp | recovery
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e?.preventDefault?.();
    setError('');
    setBusy(true);
    try {
      if (mode === 'totp') {
        await mfaService.verifyLoginCode(code);
        onVerified?.();
      } else {
        await mfaService.recoverWithCode(code);
        // MFA removed — refresh session and continue (AAL no longer needs aal2)
        await supabase.auth.refreshSession();
        onVerified?.();
      }
    } catch (err) {
      setError(err?.message || 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    try {
      await supabase.auth.signOut();
      onCancel?.();
      window.location.assign('/account');
    } catch {
      window.location.assign('/account');
    }
  };

  return (
    <div className="pt-20 min-h-[70vh] flex items-center justify-center px-4">
      <Card className="bg-cyber-card/90 border border-neon-cyan/25 border-l-2 border-l-neon-cyan max-w-md w-full p-6 sm:p-8 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 flex items-center justify-center shrink-0">
            {mode === 'totp' ? (
              <Shield className="w-5 h-5 text-neon-cyan" />
            ) : (
              <KeyRound className="w-5 h-5 text-forge-gold" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              {mode === 'totp' ? 'Two-factor authentication' : 'Recovery code'}
            </h1>
            <p className="text-sm text-text-secondary mt-1 leading-relaxed">
              {mode === 'totp'
                ? 'Enter the 6-digit code from your authenticator app to finish signing in.'
                : 'Enter one of your one-time recovery codes. Use this only if you lost your authenticator — it removes 2FA so you can sign in and set it up again. Recovery codes cannot disable 2FA from Account settings.'}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono tracking-widest text-text-muted uppercase mb-1.5">
              {mode === 'totp' ? 'Authenticator code' : 'Recovery code'}
            </label>
            <input
              type="text"
              inputMode={mode === 'totp' ? 'numeric' : 'text'}
              autoComplete="one-time-code"
              autoFocus
              maxLength={mode === 'totp' ? 8 : 16}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-white font-mono tracking-widest focus:border-neon-cyan outline-none"
              placeholder={mode === 'totp' ? '123456' : 'XXXX-XXXX'}
            />
          </div>

          {error && (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full gap-2" disabled={busy}>
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            {mode === 'totp' ? 'Verify and continue' : 'Use recovery code'}
          </Button>
        </form>

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-between text-xs">
          <button
            type="button"
            className="text-neon-cyan hover:underline text-left"
            disabled={busy}
            onClick={() => {
              setError('');
              setCode('');
              setMode(mode === 'totp' ? 'recovery' : 'totp');
            }}
          >
            {mode === 'totp'
              ? 'Lost authenticator? Use a recovery code'
              : 'Back to authenticator code'}
          </button>
          <button
            type="button"
            className="text-text-muted hover:text-white text-left"
            disabled={busy}
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </Card>
    </div>
  );
}
