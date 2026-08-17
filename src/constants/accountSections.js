/**
 * Account / Settings navigation sections.
 * Paths are under /account/:section
 */

export const ACCOUNT_SECTIONS = [
  {
    id: 'profile',
    label: 'Edit Profile',
    description: 'Username, bio, banner, socials',
    group: 'account',
  },
  {
    id: 'linked',
    label: 'Linked Accounts',
    description: 'Google, Discord, GitHub',
    group: 'account',
  },
  {
    id: 'security',
    label: 'Password & Authentication',
    description: 'Password, 2FA, and sign-in',
    group: 'account',
  },
  {
    id: 'privacy',
    label: 'Privacy',
    description: 'What appears on your profile',
    group: 'account',
  },
  {
    id: 'danger',
    label: 'Danger Zone',
    description: 'Delete account and data export',
    group: 'account',
  },
  {
    id: 'plan',
    label: 'My Plan',
    description: 'Subscription status and renewals',
    group: 'billing',
  },
  {
    id: 'billing',
    label: 'Billing',
    description: 'History, cards, subscriptions',
    group: 'billing',
  },
  {
    id: 'ai-tokens',
    label: 'AI Tokens',
    description: 'Balance, packs, and usage history',
    group: 'billing',
  },
  {
    id: 'forge-marks',
    label: 'Forge Marks',
    description: 'Donation Marks and Community Awards',
    group: 'billing',
  },
  {
    id: 'preferences',
    label: 'Preferences',
    description: 'Notifications and site options',
    group: 'preferences',
  },
];

/** Grouped nav for Account Settings sidebar */
export const ACCOUNT_SECTION_GROUPS = [
  {
    id: 'account',
    label: 'Account',
    sectionIds: ['profile', 'linked', 'security', 'privacy', 'danger'],
  },
  {
    id: 'billing',
    label: 'Billing',
    sectionIds: ['plan', 'billing', 'ai-tokens', 'forge-marks'],
  },
  {
    id: 'preferences',
    label: 'Preferences',
    sectionIds: ['preferences'],
  },
];

export const DEFAULT_ACCOUNT_SECTION = 'profile';

export function isAccountSection(id) {
  return ACCOUNT_SECTIONS.some((s) => s.id === id);
}

export function accountPath(section = DEFAULT_ACCOUNT_SECTION) {
  const id = isAccountSection(section) ? section : DEFAULT_ACCOUNT_SECTION;
  return `/account/${id}`;
}

export function getAccountSection(id) {
  return ACCOUNT_SECTIONS.find((s) => s.id === id) || null;
}
