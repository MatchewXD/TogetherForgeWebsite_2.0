import { LEGAL_PUBLISH_DATE } from '../../constants/legal';

/** Privacy Policy — exact product text for rendering */
export const privacyMeta = {
  title: 'Together Forge Privacy Policy',
  shortTitle: 'Privacy Policy',
  path: '/privacy',
  lastUpdated: LEGAL_PUBLISH_DATE,
};

export const privacySections = [
  {
    body: [
      'This Privacy Policy explains what information we collect, how we use it, and your choices.',
    ],
  },
  {
    heading: '1. Who We Are',
    body: [
      'Together Forge operates the website and related services. We are an independent community-driven project.',
    ],
  },
  {
    heading: '2. Information We Collect',
    subheading: 'Information you provide',
    list: [
      'Account information (email, username, password or authentication provider data, optional profile details).',
      'Content you submit (ideas, comments, Showcase entries, bug reports, etc.).',
      'Payment and billing information when you donate, subscribe, or purchase AI Tokens (processed by Stripe; we do not store full payment card numbers).',
      'Communications you send us.',
    ],
  },
  {
    subheading: 'Information collected automatically',
    list: [
      'Basic technical data such as IP address, browser type, device information, and pages visited.',
      'Log data related to authentication, security, and abuse prevention.',
      'Cookie and similar technologies needed for the site to function (session, authentication, preferences).',
    ],
  },
  {
    subheading: 'Information from third parties',
    list: [
      'Authentication providers (for example Google or GitHub) if you choose to sign in with them.',
      'Stripe, for payment processing and related fraud prevention.',
    ],
  },
  {
    heading: '3. How We Use Information',
    body: ['We use the information to:'],
    list: [
      'Provide and improve the Platform.',
      'Create and manage accounts.',
      'Process donations, subscriptions, and AI Token purchases.',
      'Display public contributor credit and Showcase content as designed.',
      'Enforce the Terms of Service and Community Guidelines.',
      'Prevent abuse, spam, and security threats.',
      'Communicate with you about your account or important service changes.',
      'Comply with legal obligations.',
    ],
    bodyAfter: ['We do not sell your personal information.'],
  },
  {
    heading: '4. Public Information',
    body: [
      'Some information is intentionally public or semi-public as part of the Platform’s design, including:',
    ],
    list: [
      'Username and public profile details you choose to show.',
      'Ideas, Showcase entries, and contribution credits.',
      'Certain donation acknowledgments (name or “Anonymous” according to the choice you make).',
    ],
  },
  {
    heading: '5. AI Features',
    body: [
      'When you use AI-assisted features (Idea Structuring, Gap Filling, etc.):',
    ],
    list: [
      'The text or data you submit is sent to the AI provider solely to generate the requested result.',
      'We log usage for billing, rate limiting, abuse prevention, and cost tracking.',
      'We aim to minimize retention of prompt content beyond what is needed for these purposes.',
    ],
  },
  {
    heading: '6. How We Share Information',
    body: [
      'We share information only in these situations:',
    ],
    list: [
      'With service providers who help us operate the Platform (hosting, database, authentication, payment processing, email delivery, error tracking). These providers are bound by contractual obligations.',
      'When required by law or to protect rights, safety, or security.',
      'In connection with a merger, acquisition, or sale of assets (with notice where required).',
      'With your consent.',
    ],
  },
  {
    heading: '7. Data Retention',
    body: [
      'We keep information as long as needed to provide the service, comply with legal obligations, resolve disputes, and enforce agreements. You may request deletion of your account; some information may remain in backups or where we are legally required to retain it.',
    ],
  },
  {
    heading: '8. Security',
    body: [
      'We use reasonable technical and organizational measures to protect information, including encryption in transit, access controls, and optional two-factor authentication. No method of transmission or storage is completely secure.',
    ],
  },
  {
    heading: '9. Your Choices and Rights',
    body: [
      'Depending on where you live you may have rights to:',
    ],
    list: [
      'Access the personal information we hold about you.',
      'Correct inaccurate information.',
      'Request deletion of your account and associated personal data.',
      'Object to or restrict certain processing.',
      'Withdraw consent where processing is based on consent.',
    ],
    bodyAfter: [
      'You can update much of your information directly in your account settings. For other requests, contact us through the official channels on the website.',
    ],
  },
  {
    heading: '10. Children',
    body: [
      'The Platform is not directed at children under 13. We do not knowingly collect personal information from children under 13. If we learn we have done so we will delete it.',
    ],
  },
  {
    heading: '11. International Users',
    body: [
      'The Platform is operated from the United States. If you access it from another country, you understand that your information may be processed in the United States.',
    ],
  },
  {
    heading: '12. Changes to This Policy',
    body: [
      'We may update this Privacy Policy. We will post the new version and update the “Last updated” date. Material changes will be communicated more prominently when appropriate.',
    ],
  },
  {
    heading: '13. Contact',
    body: [
      'For privacy-related questions or requests, use the Contact page or the support channels listed on the website.',
    ],
  },
];
