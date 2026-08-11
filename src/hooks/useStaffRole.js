/**
 * Current user's staff role from profiles.role.
 * Roles: user | contributor | project_lead | moderator | admin
 */
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useStaffRole() {
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkRole = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user || null;
        if (!user) {
          if (mounted) {
            setRole('user');
            setLoading(false);
          }
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (mounted) {
          const r = String(profile?.role || 'user').trim() || 'user';
          setRole(r);
        }
      } catch {
        if (mounted) setRole('user');
      }
      if (mounted) setLoading(false);
    };

    checkRole();

    let subscription = null;
    try {
      const { data } = supabase.auth.onAuthStateChange(() => {
        checkRole();
      });
      subscription = data?.subscription || null;
    } catch {
      subscription = null;
    }

    return () => {
      mounted = false;
      try {
        subscription?.unsubscribe?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const isAdmin = role === 'admin';
  const isModeratorRole = role === 'moderator';
  const isProjectLead = role === 'project_lead' || isAdmin;
  // Staff who can moderate tasks / use mod dashboard
  const isModerator =
    isAdmin || isModeratorRole || role === 'project_lead';

  return {
    role,
    loading,
    isAdmin,
    isModerator,
    isModeratorRole,
    isProjectLead,
    isStaff: isModerator,
  };
}

export default useStaffRole;
