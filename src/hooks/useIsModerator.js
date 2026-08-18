import { useStaffRole } from './useStaffRole';

/**
 * Back-compat: true when user can open the Moderator Dashboard
 * (founder | moderator | admin | project_lead).
 */
export function useIsModerator() {
  const { isModerator, loading } = useStaffRole();
  return { isModerator, loading };
}

export default useIsModerator;