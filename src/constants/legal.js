/**
 * Legal document versions for acceptance tracking.
 * Bump these when policy text materially changes.
 */
export const LEGAL_PUBLISH_DATE = 'August 12, 2026';

/** Terms of Service version key (stored on profiles / user_metadata) */
export const TERMS_VERSION = '2026-08-12';

/** Community Guidelines version key */
export const GUIDELINES_VERSION = '2026-08-12';

/** Privacy Policy version (informational; acceptance tied to Terms+Guidelines) */
export const PRIVACY_VERSION = '2026-08-12';

/** Payments and refunds policy — stored on profiles at first payment */
export const PAYMENTS_POLICY_VERSION = '2026-08-30';
export const PAYMENTS_POLICY_PUBLISH_DATE = 'August 30, 2026';
export const PAYMENTS_POLICY_TITLE = 'Payments and refunds';
export const PAYMENTS_POLICY_REQUIRED_MESSAGE =
  'Please agree to the Payments and refunds policy to continue.';

export const LEGAL_PATHS = {
  terms: '/terms',
  privacy: '/privacy',
  guidelines: '/guidelines',
  payments: '/payments',
};
