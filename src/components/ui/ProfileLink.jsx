/**
 * Link to a user's public profile when username is real; otherwise plain span.
 */

import { Link } from 'react-router-dom';
import { publicProfilePath } from '../../utils/profileLinks';

const ProfileLink = ({
  username,
  children,
  className = '',
  title,
  stopPropagation = true,
  onClick,
}) => {
  const to = publicProfilePath(username);

  if (!to) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link
      to={to}
      title={title || `View ${username}'s profile`}
      className={`hover:text-neon-cyan transition-colors ${className}`}
      onClick={(e) => {
        if (stopPropagation) {
          e.stopPropagation();
        }
        onClick?.(e);
      }}
    >
      {children}
    </Link>
  );
};

export default ProfileLink;
