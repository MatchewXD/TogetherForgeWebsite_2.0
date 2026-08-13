/**
 * Live AI token balance + platform availability for Idea AI panels.
 */
import { useCallback, useEffect, useState } from 'react';
import { fetchAiTokenStatus } from '../services/aiTokensService';
import { AI_SERVICES_DISABLED_MESSAGE } from '../constants/aiTokens';

export default function useAiTokenStatus({ enabled = true } = {}) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return null;
    }
    setLoading(true);
    setError('');
    try {
      const st = await fetchAiTokenStatus();
      setStatus(st);
      return st;
    } catch (e) {
      setError(e?.message || 'Could not load token balance.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // platformEnabled = kill-switch + spend caps (from get_ai_service_availability)
  // servicesEnabled may also require XAI_API_KEY on the Edge Function — that is a
  // separate "provider" issue, not usage limits.
  const platformOk =
    status == null ? true : status.platformEnabled !== false;
  const providerOk =
    status == null ? true : status.servicesEnabled !== false || platformOk;
  // Only block the UI for real platform disable; missing API key still surfaces
  // on run via a clearer error from the generation endpoint.
  const disabledMessage = !platformOk
    ? status?.disabledMessage || AI_SERVICES_DISABLED_MESSAGE
    : null;

  return {
    status,
    loading,
    error,
    refresh,
    balance: status?.balance ?? null,
    signedIn: status?.signedIn,
    platformOk,
    servicesEnabled: platformOk,
    providerReady: status == null ? null : status.servicesEnabled !== false,
    disabledMessage,
    setBalanceFromServer: (n) => {
      if (n == null || !Number.isFinite(Number(n))) return;
      setStatus((prev) =>
        prev ? { ...prev, balance: Number(n) } : { balance: Number(n) }
      );
    },
  };
}
