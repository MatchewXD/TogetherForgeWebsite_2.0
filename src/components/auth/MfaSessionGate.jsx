/**
 * Blocks the app shell when the session is AAL1 but MFA is enrolled (needs AAL2).
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { mfaService } from '../../services/mfaService';
import { dismissBootLoader } from '../../lib/bootLoader';
import MfaChallengeScreen from './MfaChallengeScreen';

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

  useEffect(() => {
    if (phase === 'challenge') dismissBootLoader();
  }, [phase]);

  if (phase === 'loading') {
    return null;
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
