import { useStaffRole } from './useStaffRole';

/**
 * Back-compat: true when user is moderator, admin, or project_lead.
 */
export function useIsModerator() {
  const { isModerator, loading } = useStaffRole();
  return { isModerator, loading };
}

export default useIsModerator;