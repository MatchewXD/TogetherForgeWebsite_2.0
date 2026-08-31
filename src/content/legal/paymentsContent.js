import {
  PAYMENTS_POLICY_PUBLISH_DATE,
  PAYMENTS_POLICY_TITLE,
  LEGAL_PATHS,
} from '../../constants/legal';

/** Payments and refunds — public policy text */
export const paymentsMeta = {
  title: PAYMENTS_POLICY_TITLE,
  shortTitle: PAYMENTS_POLICY_TITLE,
  path: LEGAL_PATHS.payments,
  lastUpdated: PAYMENTS_POLICY_PUBLISH_DATE,
};

export const paymentsSections = [
  {
    body: [
      'This page is how payments work at Together Forge: studio support, Founder Runway, studio subscriptions, and AI Tokens.',
    ],
  },
  {
    heading: 'Studio support and Founder Runway',
    body: [
      'Donations to Together Forge stay with the studio. The founder does not take donations as wages.',
      'Founder Runway is personal support for the founder so he can work on Together Forge full time. It does not go to the studio. The two never mix.',
    ],
  },
  {
    heading: 'Not a charity',
    body: [
      'None of this is a charity gift and none of it is tax-deductible. Together Forge is a for-profit studio.',
    ],
  },
  {
    heading: 'After a payment succeeds',
    body: [
      'After a payment succeeds it is not refunded, except a double charge or a payment that never appears on the account.',
    ],
  },
  {
    heading: 'Studio subscriptions',
    body: [
      'Studio subscriptions can be cancelled anytime in the account billing page. Cancel stops later bills. The current period is not refunded.',
    ],
  },
  {
    heading: 'AI Tokens',
    body: [
      'AI Tokens are not refunded after they are added to the account. Spent tokens are never refunded. If a payment succeeds and tokens never appear, we correct that charge.',
    ],
  },
  {
    heading: 'Courtesy refunds and chargebacks',
    body: [
      'A courtesy refund for an error does not change the policy.',
      'A chargeback after delivery may close the account.',
    ],
  },
  {
    heading: 'Questions',
    body: ['Questions: contact@togetherforge.net.'],
  },
];
