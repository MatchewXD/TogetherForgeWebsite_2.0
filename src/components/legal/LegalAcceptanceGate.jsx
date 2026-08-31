/**
 * Prompts signed-in users who have not accepted the current Terms + Guidelines.
 * Legal pages remain readable without accepting.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  fetchLegalAcceptance,
  hasAcceptedCurrentLegal,
  acceptCurrentLegal,
} from '../../services/legalService';
import { ensureUserProfile } from '../../utils/ensureUserProfile';
import { dismissBootLoader } from '../../lib/bootLoader';
import Button from '../ui/Buttons';
import { LEGAL_PATHS, TERMS_VERSION } from '../../constants/legal';

const OPEN_PATHS = [
  LEGAL_PATHS.terms,
  LEGAL_PATHS.privacy,
  LEGAL_PATHS.guidelines,
  LEGAL_PATHS.payments,
  '/payments-and-refunds',
  '/contact',
  '/confirm-email',
  '/reset-password',
];

function isOpenPath(pathname) {
  return OPEN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export default function LegalAcceptanceGate({ children }) {
  const location = useLocation();
  const [phase, setPhase] = useState('loading'); // loading | need | ok
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);

  const recheck = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const u = session?.user || null;
      setUser(u);
      if (!u) {
        setPhase('ok');
        return;
      }
      await ensureUserProfile(u.id, { email: u.email || null });
      const profile = await fetchLegalAcceptance(u.id);
      if (profile?._columnsMissing) {
        // Do not block the whole site if SQL not applied yet
        console.warn(
          '[legal] acceptance columns missing — run supabase_legal_acceptance.sql'
        );
        setPhase('ok');
        return;
      }
      if (hasAcceptedCurrentLegal(profile, u)) {
        // Backfill profile columns if acceptance was only in auth metadata (signup)
        if (
          !profile?._columnsMissing &&
          String(profile?.terms_version || '') !== TERMS_VERSION
        ) {
          void acceptCurrentLegal(u.id).catch(() => {});
        }
        setPhase('ok');
      } else {
        setPhase('need');
        setAgreed(false);
        setError('');
      }
    } catch {
      setPhase('ok');
    }
  }, []);

  useEffect(() => {
    void recheck();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void recheck();
    });
    return () => data?.subscription?.unsubscribe?.();
  }, [recheck]);

  useEffect(() => {
    if (phase !== 'loading') dismissBootLoader();
  }, [phase]);

  const onAccept = async () => {
    if (!user?.id || !agreed) return;
    setBusy(true);
    setError('');
    try {
      await acceptCurrentLegal(user.id);
      setPhase('ok');
    } catch (e) {
      setError(e?.message || 'Could not save acceptance. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'loading') {
    return null;
  }

  // Allow reading legal pages (and contact) without accepting
  if (phase === 'need' && isOpenPath(location.pathname)) {
    return children;
  }

  if (phase === 'need') {
    return (
      <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
        <div className="container-custom max-w-lg py-12 sm:py-16">
          <div className="cyber-card border border-cyber-border p-6 sm:p-8 space-y-5">
            <div className="section-header mb-0">Legal</div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Review our Terms and Guidelines
            </h1>
            <p className="text-sm text-text-secondary leading-relaxed">
              Before you continue, please confirm that you agree to the Together
              Forge Terms of Service and Community Guidelines. You can read the
              full documents anytime from the footer.
            </p>
            <ul className="text-sm space-y-2 font-mono tracking-wide">
              <li>
                <Link
                  to="/terms"
                  className="text-neon-cyan hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  to="/guidelines"
                  className="text-neon-cyan hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Community Guidelines
                </Link>
              </li>
              <li>
                <Link
                  to="/privacy"
                  className="text-text-muted hover:text-neon-cyan hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>
            <label className="flex items-start gap-3 cursor-pointer text-sm text-text-secondary leading-relaxed">
              <input
                type="checkbox"
                className="mt-1 accent-neon-cyan shrink-0"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>
                I have read and agree to the{' '}
                <Link to="/terms" className="text-neon-cyan hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  to="/guidelines"
                  className="text-neon-cyan hover:underline"
                >
                  Community Guidelines
                </Link>
                .
              </span>
            </label>
            {error ? (
              <p className="text-sm text-red-300" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                disabled={!agreed || busy}
                onClick={() => void onAccept()}
              >
                {busy ? 'Saving…' : 'Continue'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setPhase('ok');
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
