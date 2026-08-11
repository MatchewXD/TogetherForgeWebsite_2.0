/**
 * Legacy /profile route.
 * Private profile editing moved to /account.
 * Login also lives on /account when signed out.
 */
import { Navigate, useLocation } from 'react-router-dom';

const Profile = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const setup = params.get('setup');
  const linked = params.get('linked');
  const verified = params.get('verified');

  // Identity-gate deep links → Linked Accounts section
  if (
    setup === 'identity' ||
    linked === '1' ||
    verified === '1' ||
    location.hash === '#linked-accounts'
  ) {
    const q = new URLSearchParams();
    if (linked === '1') q.set('linked', '1');
    if (verified === '1') q.set('verified', '1');
    if (setup === 'identity') q.set('setup', 'identity');
    const qs = q.toString();
    return (
      <Navigate
        to={`/account/linked${qs ? `?${qs}` : ''}`}
        replace
      />
    );
  }

  return <Navigate to="/account/profile" replace />;
};

export default Profile;
