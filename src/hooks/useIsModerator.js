import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useIsModerator() {
    const [isModerator, setIsModerator] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const checkRole = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    if (mounted) {
                        setIsModerator(false);
                        setLoading(false);
                    }
                    return;
                }

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                if (mounted) {
                    // Staff roles that can create/edit tasks and moderate (SDD §3 & §6)
                    const role = profile?.role || 'user';
                    setIsModerator(
                        role === 'moderator' ||
                            role === 'admin' ||
                            role === 'project_lead'
                    );
                }
            } catch (_) {
                if (mounted) setIsModerator(false);
            }
            if (mounted) setLoading(false);
        };

        checkRole();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            checkRole();
        });

        return () => {
            mounted = false;
            subscription?.unsubscribe();
        };
    }, []);

    return { isModerator, loading };
}

export default useIsModerator;