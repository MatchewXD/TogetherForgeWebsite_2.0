/**
 * One-time Payments and refunds acceptance for the first on-site payment.
 * Later purchases hide the checkbox once the account (or this browser, for
 * guests) has the current policy version.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PAYMENTS_POLICY_REQUIRED_MESSAGE } from '../constants/legal';
import {
  acceptPaymentsPolicy,
  fetchPaymentsPolicyAcceptance,
  hasAcceptedCurrentPaymentsPolicy,
  readLocalPaymentsPolicyAcceptance,
  writeLocalPaymentsPolicyAcceptance,
} from '../services/legalService';

export default function usePaymentsPolicyAcceptance() {
  const [loading, setLoading] = useState(true);
  const [needed, setNeeded] = useState(true);
  const [userId, setUserId] = useState(null);
  const [columnsMissing, setColumnsMissing] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');

  const recheck = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const u = session?.user || null;
      setUserId(u?.id || null);

      if (!u?.id) {
        const local = readLocalPaymentsPolicyAcceptance();
        setNeeded(!local);
        setColumnsMissing(false);
        if (local) setAgreed(false);
        return;
      }

      const profile = await fetchPaymentsPolicyAcceptance(u.id);
      if (profile?._columnsMissing) {
        setColumnsMissing(true);
        const local = readLocalPaymentsPolicyAcceptance();
        setNeeded(!local);
        return;
      }
      setColumnsMissing(false);
      if (hasAcceptedCurrentPaymentsPolicy(profile, u)) {
        setNeeded(false);
        setAgreed(false);
      } else {
        setNeeded(true);
      }
    } catch {
      setNeeded(!readLocalPaymentsPolicyAcceptance());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void recheck();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void recheck();
    });
    return () => data?.subscription?.unsubscribe?.();
  }, [recheck]);

  const persistIfNeeded = useCallback(async () => {
    setError('');
    if (!needed) return { ok: true };
    if (!agreed) {
      const msg = PAYMENTS_POLICY_REQUIRED_MESSAGE;
      setError(msg);
      return { ok: false, error: msg };
    }

    if (userId && !columnsMissing) {
      try {
        await acceptPaymentsPolicy(userId);
      } catch (e) {
        if (e?.code === 'LEGAL_SQL_MISSING') {
          writeLocalPaymentsPolicyAcceptance();
          setNeeded(false);
          return { ok: true };
        }
        const msg = e?.message || 'Could not save policy acceptance. Try again.';
        setError(msg);
        return { ok: false, error: msg };
      }
    } else {
      writeLocalPaymentsPolicyAcceptance();
    }

    setNeeded(false);
    return { ok: true };
  }, [needed, agreed, userId, columnsMissing]);

  return {
    loading,
    needed: needed && !loading,
    agreed,
    setAgreed: (value) => {
      setAgreed(Boolean(value));
      if (value) setError('');
    },
    error,
    persistIfNeeded,
    recheck,
  };
}
