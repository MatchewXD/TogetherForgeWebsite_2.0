/**
 * Account → Security: enable / disable TOTP 2FA + recovery codes.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  KeyRound,
} from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Buttons';
import Badge from '../ui/Badge';
import { mfaService } from '../../services/mfaService';
import { useStaffRole } from '../../hooks/useStaffRole';

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-white focus:border-neon-cyan outline-none font-mono tracking-widest';

export default function AccountMfaSection() {
  const { isStaff, isAdmin, isModerator, isProjectLead, loading: roleLoading } =
    useStaffRole();
  const elevated = isStaff || isAdmin || isModerator || isProjectLead;

  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [factor, setFactor] = useState(null);
  const [remainingCodes, setRemainingCodes] = useState(null);

  const [phase, setPhase] = useState('idle'); // idle | enroll | codes | disable | regenerate
  const [enroll, setEnroll] = useState(null); // { factorId, qrCode, secret }
  const [verifyCode, setVerifyCode] = useState('');
  const [freshCodes, setFreshCodes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const status = await mfaService.getStatus();
      setEnabled(status.enabled);
      setFactor(status.factor);
      if (status.enabled) {
        const rs = await mfaService.getRecoveryStatus();
        setRemainingCodes(
          typeof rs.remaining === 'number' ? rs.remaining : null
        );
      } else {
        setRemainingCodes(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startEnable = async () => {
    setError('');
    setMsg('');
    setBusy(true);
    try {
      const data = await mfaService.startEnroll();
      setEnroll(data);
      setVerifyCode('');
      setPhase('enroll');
    } catch (e) {
      setError(e?.message || 'Could not start 2FA setup.');
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async (e) => {
    e?.preventDefault?.();
    if (!enroll?.factorId) return;
    setError('');
    setBusy(true);
    try {
      const codeUsed = verifyCode;
      await mfaService.confirmEnroll(enroll.factorId, codeUsed);
      setEnabled(true);
      setEnroll(null);
      setMsg('Two-factor authentication is on.');
      // Step-up again for recovery codes (requires authenticator, not recovery codes)
      try {
        const gen = await mfaService.generateRecoveryCodes(codeUsed);
        setFreshCodes(gen.codes || []);
        setRemainingCodes((gen.codes || []).length);
        setPhase('codes');
        setVerifyCode('');
      } catch {
        // Same TOTP window may reject re-use — ask for next code
        setPhase('regenerate');
        setVerifyCode('');
        setMsg(
          'Two-factor authentication is on. Enter a fresh authenticator code to create recovery codes.'
        );
      }
      await refresh();
    } catch (err) {
      setError(err?.message || 'Could not verify code.');
    } finally {
      setBusy(false);
    }
  };

  const cancelEnroll = async () => {
    setPhase('idle');
    setEnroll(null);
    setVerifyCode('');
    setError('');
    // Unenroll unverified if any
    try {
      await refresh();
    } catch {
      /* ignore */
    }
  };

  const startDisable = () => {
    setError('');
    setMsg('');
    setVerifyCode('');
    setPhase('disable');
  };

  const confirmDisable = async (e) => {
    e?.preventDefault?.();
    if (!factor?.id) return;
    setError('');
    setBusy(true);
    try {
      await mfaService.disable(factor.id, verifyCode);
      setEnabled(false);
      setFactor(null);
      setRemainingCodes(null);
      setPhase('idle');
      setVerifyCode('');
      setMsg('Two-factor authentication is off.');
    } catch (err) {
      setError(err?.message || 'Could not disable 2FA.');
    } finally {
      setBusy(false);
    }
  };

  const startRegenerate = () => {
    setError('');
    setMsg('');
    setVerifyCode('');
    setPhase('regenerate');
  };

  const confirmRegenerate = async (e) => {
    e?.preventDefault?.();
    setError('');
    setBusy(true);
    try {
      const gen = await mfaService.generateRecoveryCodes(verifyCode);
      setFreshCodes(gen.codes || []);
      setRemainingCodes((gen.codes || []).length);
      setPhase('codes');
      setVerifyCode('');
      setMsg('New recovery codes generated. Previous codes no longer work.');
      await refresh();
    } catch (err) {
      setError(
        err?.message ||
          'Could not generate recovery codes. Use your authenticator app code, not a recovery code.'
      );
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = async () => {
    if (!freshCodes?.length) return;
    try {
      await navigator.clipboard.writeText(freshCodes.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <Card className="bg-cyber-card border border-cyber-border p-6">
        <p className="text-sm text-text-muted flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading 2FA status…
        </p>
      </Card>
    );
  }

  return (
    <Card className="bg-cyber-card border border-cyber-border p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${
              enabled
                ? 'border-emerald-400/40 bg-emerald-500/10'
                : 'border-white/15 bg-cyber-surface/60'
            }`}
          >
            {enabled ? (
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
            ) : (
              <ShieldOff className="w-5 h-5 text-text-muted" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-mono tracking-widest text-neon-purple uppercase">
              Two-factor authentication
            </h3>
            <p className="text-sm text-text-secondary mt-1 leading-relaxed">
              Add a 6-digit code from an authenticator app (Google Authenticator,
              1Password, Authy, etc.) when you sign in.
            </p>
          </div>
        </div>
        <Badge
          variant={enabled ? 'success' : 'default'}
          className="!normal-case shrink-0"
        >
          {enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </div>

      {!roleLoading && elevated && !enabled && (
        <div className="rounded-lg border border-semantic-warning/40 bg-semantic-warning/10 px-3 py-2.5 flex gap-2 text-sm text-semantic-warning">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            <strong className="font-semibold">Recommended for staff:</strong>{' '}
            Project Leads, Moderators, and Admins should enable 2FA. It is not
            required yet, but it strongly protects elevated accounts.
          </p>
        </div>
      )}

      {msg && (
        <p className="text-sm text-emerald-300" role="status">
          {msg}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      {/* Idle: enable / disable / regenerate */}
      {phase === 'idle' && (
        <div className="flex flex-wrap gap-2">
          {!enabled ? (
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={() => void startEnable()}
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Shield className="w-3.5 h-3.5" />
              )}
              Enable 2FA
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1.5"
                disabled={busy}
                onClick={startRegenerate}
              >
                <KeyRound className="w-3.5 h-3.5" />
                Regenerate recovery codes
                {typeof remainingCodes === 'number'
                  ? ` (${remainingCodes} left)`
                  : ''}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={startDisable}
              >
                Disable 2FA
              </Button>
            </>
          )}
        </div>
      )}

      {/* Enroll: QR + secret + verify */}
      {phase === 'enroll' && enroll && (
        <div className="space-y-4 max-w-md border-t border-white/10 pt-4">
          <p className="text-sm text-text-secondary">
            Scan this QR code with your authenticator app, or enter the secret
            manually.
          </p>
          {enroll.qrCode ? (
            <div className="inline-block p-3 rounded-xl bg-white">
              <img
                src={enroll.qrCode}
                alt="Authenticator QR code"
                className="w-48 h-48"
              />
            </div>
          ) : null}
          {enroll.secret ? (
            <div>
              <p className="text-[10px] font-mono tracking-widest text-text-muted uppercase mb-1">
                Manual secret
              </p>
              <code className="block text-xs sm:text-sm font-mono text-neon-cyan break-all bg-cyber-surface/80 border border-cyber-border rounded-lg px-3 py-2">
                {enroll.secret}
              </code>
            </div>
          ) : null}
          <form onSubmit={confirmEnable} className="space-y-3">
            <div>
              <label className="block text-xs font-mono tracking-widest text-text-muted uppercase mb-1.5">
                Confirm with 6-digit code
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                className={fieldClass}
                placeholder="123456"
                required
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? 'Verifying…' : 'Enable 2FA'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void cancelEnroll()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Show recovery codes once */}
      {phase === 'codes' && freshCodes?.length > 0 && (
        <div className="space-y-3 border-t border-white/10 pt-4 max-w-lg">
          <div className="rounded-lg border border-semantic-warning/40 bg-semantic-warning/10 px-3 py-2 text-sm text-semantic-warning">
            Save these recovery codes now. Each works once. We will not show
            this list again. If you lose them, you can create a new set, and
            these codes will stop working.
          </div>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm text-white bg-cyber-surface/80 border border-cyber-border rounded-lg p-3">
            {freshCodes.map((c) => (
              <li key={c} className="tracking-widest">
                {c}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1.5"
              onClick={() => void copyCodes()}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? 'Copied' : 'Copy all'}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setFreshCodes(null);
                setPhase('idle');
              }}
            >
              I saved my codes
            </Button>
          </div>
        </div>
      )}

      {/* Regenerate recovery codes — authenticator TOTP only */}
      {phase === 'regenerate' && (
        <form
          onSubmit={confirmRegenerate}
          className="space-y-3 border-t border-white/10 pt-4 max-w-md"
        >
          <p className="text-sm text-text-secondary">
            Enter a <strong className="text-white">current 6-digit code</strong>{' '}
            from your authenticator app. Recovery codes cannot authorize this.
            Being signed in is not enough.
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            className={fieldClass}
            placeholder="123456"
            required
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? 'Generating…' : 'Create new recovery codes'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setPhase('idle');
                setVerifyCode('');
                setError('');
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Disable confirm — authenticator TOTP only (never recovery codes) */}
      {phase === 'disable' && (
        <form
          onSubmit={confirmDisable}
          className="space-y-3 border-t border-white/10 pt-4 max-w-md"
        >
          <p className="text-sm text-text-secondary">
            Enter a <strong className="text-white">current 6-digit code</strong>{' '}
            from your authenticator app to turn off 2FA. Recovery codes are{' '}
            <strong className="text-white">not</strong> accepted here (use them
            only on the sign-in recovery screen if you lose your authenticator).
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            className={fieldClass}
            placeholder="123456"
            required
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" variant="danger" disabled={busy}>
              {busy ? 'Disabling…' : 'Disable 2FA'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setPhase('idle');
                setVerifyCode('');
                setError('');
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
