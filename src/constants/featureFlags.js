/**
 * Site-wide feature visibility toggles.
 * Routes stay registered; flags only control public navigation / marketing links.
 */

/**
 * When false, hide “Released Games” from public nav (Navbar, Footer, hub links).
 * Direct URLs /released and /released/:slug still work for internal preview.
 * Flip to true when the first game ships and the catalog should be discoverable.
 */
export const SHOW_RELEASED_GAMES = false;
