/**
 * Current user's staff role from profiles.role.
 * Product roles: user | moderator | founder
 * Legacy staff values still honored: admin | project_lead | contributor
 */
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useStaffRole() {
  const [role, setRole] = useState('user');
  const [userId, setUserId] = useState(null);
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
            setUserId(null);
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
          setUserId(user.id);
        }
      } catch {
        if (mounted) {
          setRole('user');
          setUserId(null);
        }
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

  const isFounder = role === 'founder';
  const isAdmin = role === 'admin';
  const isModeratorRole = role === 'moderator';
  const isProjectLead = role === 'project_lead' || isAdmin;
  // Staff who can moderate tasks / use mod dashboard
  const isModerator =
    isFounder || isAdmin || isModeratorRole || role === 'project_lead';
  // Avatar / nav: only Moderator and Founder see the dashboard link
  const canSeeModeratorDashboard = isModeratorRole || isFounder;

  return {
    role,
    userId,
    loading,
    isAdmin,
    isFounder,
    isModerator,
    isModeratorRole,
    isProjectLead,
    isStaff: isModerator,
    canSeeModeratorDashboard,
  };
}

export default useStaffRole;
