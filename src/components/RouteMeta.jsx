import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getRouteMeta, SITE_NAME } from '../utils/routeMeta';

/**
 * Sets document.title and the meta description for the current route.
 * Pages may still set a more specific title in their own effect; child
 * effects run after this one, so theirs wins.
 */
export default function RouteMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = getRouteMeta(pathname);
    document.title = meta.title ? `${meta.title} | ${SITE_NAME}` : SITE_NAME;
    const tag = document.querySelector('meta[name="description"]');
    if (tag && meta.description) tag.setAttribute('content', meta.description);
  }, [pathname]);

  return null;
}
