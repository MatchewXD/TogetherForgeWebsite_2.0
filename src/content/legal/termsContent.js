import { LEGAL_PUBLISH_DATE } from '../../constants/legal';

/** Terms of Service — exact product text for rendering */
export const termsMeta = {
  title: 'Together Forge Terms of Service',
  shortTitle: 'Terms of Service',
  path: '/terms',
  lastUpdated: LEGAL_PUBLISH_DATE,
};

export const termsSections = [
  {
    body: [
      'Welcome to Together Forge. These Terms of Service (“Terms”) govern your access to and use of the Together Forge website, services, and community features (the “Platform”).',
      'By creating an account or using the Platform you agree to these Terms.',
    ],
  },
  {
    heading: '1. What Together Forge Is',
    body: [
      'Together Forge is an independent, community-driven platform and studio focused on cooperative game development. We operate without outside investors. The Platform exists to support volunteer collaboration, idea sharing, transparent development, and the creation of games.',
    ],
  },
  {
    heading: '2. Accounts',
    list: [
      'You must provide accurate information when creating an account.',
      'You are responsible for keeping your login credentials secure.',
      'You may enable optional two-factor authentication.',
      'We may require additional verification for accounts with elevated permissions (moderators, project leads, etc.).',
      'You must be at least 13 years old (or the minimum age required in your country) to create an account. If you are under 18 you should have parental or guardian permission.',
    ],
  },
  {
    heading: '3. Acceptable Use',
    body: [
      'You agree to use the Platform only for lawful purposes and in accordance with the Community Guidelines. You may not:',
    ],
    list: [
      'Violate any law or regulation.',
      'Infringe the intellectual property or privacy rights of others.',
      'Attempt to gain unauthorized access to the Platform, other accounts, or systems.',
      'Interfere with or disrupt the Platform.',
      'Use the Platform to distribute malware or harmful code.',
      'Scrape, harvest, or systematically collect data without permission.',
      'Use the Platform for commercial advertising or solicitation without prior written permission from Together Forge.',
    ],
    bodyAfter: [
      'Moderation and enforcement decisions will be based on these Terms, the Community Guidelines, and observable conduct. They will not be used to require ideological agreement or to exclude participants solely for lawful viewpoints.',
    ],
  },
  {
    heading: '4. User Content and Ownership',
    list: [
      'You retain ownership of the original content you submit (ideas, comments, Showcase entries, profile information, etc.).',
      'By submitting content you grant Together Forge a non-exclusive, worldwide, royalty-free license to host, display, reproduce, and distribute that content as needed to operate the Platform and credit contributors.',
      'You confirm that you have the rights necessary to submit the content and to grant this license.',
      'You are solely responsible for the content you post.',
      'Together Forge may remove content that violates these Terms or the Community Guidelines.',
    ],
  },
  {
    heading: '5. Contributions, Credit, and Volunteer Nature',
    list: [
      'Most contributions are voluntary.',
      'Public credit systems (contributors lists, badges, Showcase, etc.) exist to recognize work. They do not create employment, partnership, or ownership rights in the studio or its projects unless explicitly agreed in writing.',
      'Paid opportunities, if any, will be clearly labeled and handled under separate agreements.',
    ],
  },
  {
    heading: '6. Donations, Subscriptions, and AI Tokens',
    list: [
      'Donations and membership subscriptions support the studio and are generally non-refundable except where required by law or at our discretion.',
      'Founder Runway is personal support for the founder. It is not studio support and the two never mix.',
      'AI Token purchases are a separate system from donations. Tokens are consumed for specific AI-assisted features and are also generally non-refundable once used or expired according to the rules shown at purchase.',
      'We keep donation records and token purchase records separate in both the interface and the underlying data.',
    ],
    link: {
      to: '/payments',
      label: 'Payments and refunds',
    },
  },
  {
    heading: '7. Moderation, Restrictions, and Bans',
    body: ['We reserve the right to:'],
    list: [
      'Remove or restrict content.',
      'Suspend or terminate accounts.',
      'Ban users who repeatedly or seriously violate these Terms or the Community Guidelines.',
    ],
    bodyAfter: [
      'We will generally reference the published Community Guidelines when taking enforcement actions. We are not obligated to provide prior notice in cases of serious or repeated violations, illegal activity, or risk to others.',
    ],
  },
  {
    heading: '8. Intellectual Property of the Platform',
    body: [
      'The Together Forge name, branding, website design, code, and original Platform content are owned by Together Forge or its licensors. You may not copy, modify, or distribute them except as expressly allowed.',
    ],
  },
  {
    heading: '9. Disclaimers',
    body: [
      'The Platform is provided “as is.” We do not guarantee uninterrupted or error-free service. We are not responsible for user-generated content. To the maximum extent permitted by law we disclaim warranties of merchantability, fitness for a particular purpose, and non-infringement.',
    ],
  },
  {
    heading: '10. Limitation of Liability',
    body: [
      'To the maximum extent permitted by law, Together Forge and its operators will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, data, or goodwill, arising from your use of the Platform. Our total liability for any claim related to the Platform is limited to the greater of (a) the amount you paid us in the twelve months before the claim or (b) fifty US dollars.',
    ],
  },
  {
    heading: '11. Indemnity',
    body: [
      'You agree to indemnify and hold harmless Together Forge and its operators from claims arising out of your content, your use of the Platform, or your violation of these Terms.',
    ],
  },
  {
    heading: '12. Changes to the Terms',
    body: [
      'We may update these Terms. We will post the updated version and update the “Last updated” date. Continued use after changes constitutes acceptance. For material changes we may also provide additional notice.',
    ],
  },
  {
    heading: '13. Termination',
    body: [
      'You may stop using the Platform at any time. We may suspend or terminate access if you violate these Terms or for other legitimate operational reasons.',
    ],
  },
  {
    heading: '14. Governing Law',
    body: [
      'These Terms are governed by the laws of the State of Washington, United States, without regard to conflict-of-law principles. Any disputes will be resolved in the state or federal courts located in Washington, unless applicable law requires otherwise.',
    ],
  },
  {
    heading: '15. Contact',
    body: [
      'Questions about these Terms can be sent through the Contact page or the official support channels listed on the website.',
    ],
  },
];
