/**
 * Blocks the app shell when the session is AAL1 but MFA is enrolled (needs AAL2).
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { mfaService } from '../../services/mfaService';
import MfaChallengeScreen from './MfaChallengeScreen';
import LoadingScreen from '../ui/LoadingScreen';

export default function MfaSessionGate({ children }) {
  const [phase, setPhase] = useState('loading'); // loading | challenge | ok

  const recheck = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setPhase('ok');
        return;
      }
      const needs = await mfaService.needsMfaChallenge();
      setPhase(needs ? 'challenge' : 'ok');
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

  if (phase === 'loading') {
    return (
      <div className="pt-20 min-h-screen bg-cyber-bg">
        <LoadingScreen variant="section" message="Checking sign-in…" />
      </div>
    );
  }

  if (phase === 'challenge') {
    return (
      <MfaChallengeScreen
        onVerified={() => setPhase('ok')}
        onCancel={() => setPhase('ok')}
      />
    );
  }

  return children;
}
