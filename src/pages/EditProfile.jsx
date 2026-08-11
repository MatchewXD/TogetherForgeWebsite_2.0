/**
 * Legacy /profile/edit → Account → Profile section
 */
import { Navigate, useLocation } from 'react-router-dom';

const EditProfile = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (
    params.get('setup') === 'identity' ||
    location.hash === '#linked-accounts'
  ) {
    return <Navigate to="/account/linked" replace />;
  }
  return <Navigate to="/account/profile" replace />;
};

export default EditProfile;
