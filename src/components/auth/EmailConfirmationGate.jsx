/**
 * Email/password accounts must confirm before they count as fully signed in.
 * OAuth sessions are never sent through this wall.
 * Unconfirmed sessions are signed out so public pages stay browsable and
 * contribute/account actions cannot run as that user.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  isAccountGatedPath,
  needsEmailConfirmation,
  stashPendingConfirmEmail,
} from '../../utils/authIdentities';

function shouldSendToConfirm(pathname) {
  const path = pathname || '/';
  return path !== '/confirm-email' && isAccountGatedPath(path);
}

export default function EmailConfirmationGate({ children }) {
  const location = useLocation();
  const [redirect, setRedirect] = useState(false);
  const pendingConfirmRedirect = useRef(false);

  const recheck = useCallback(async () => {
    const path = location.pathname || '/';
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user || null;

      if (user && !needsEmailConfirmation(user)) {
        pendingConfirmRedirect.current = false;
        setRedirect(false);
        return;
      }

      if (user && needsEmailConfirmation(user)) {
        stashPendingConfirmEmail(user.email);
        const sendToConfirm = shouldSendToConfirm(path);
        pendingConfirmRedirect.current = sendToConfirm;
        await supabase.auth.signOut();
        setRedirect(sendToConfirm);
        return;
      }

      if (pendingConfirmRedirect.current && shouldSendToConfirm(path)) {
        setRedirect(true);
        return;
      }
      pendingConfirmRedirect.current = false;
      setRedirect(false);
    } catch {
      setRedirect(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    void recheck();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void recheck();
    });
    return () => data?.subscription?.unsubscribe?.();
  }, [recheck]);

  if (redirect) {
    return <Navigate to="/confirm-email" replace />;
  }

  return children;
}
