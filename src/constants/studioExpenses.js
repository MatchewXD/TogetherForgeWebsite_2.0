/**
 * Published Together Forge LLC expense report (Transparency Hub).
 * Relay Operating spend only. Not a bank feed.
 */

export const STUDIO_EXPENSE_DESC_MAX = 280;
export const STUDIO_EXPENSE_VENDOR_MAX = 80;

export const STUDIO_EXPENSE_CATEGORIES = [
  {
    key: 'dev',
    label: 'Development & tools',
    tone: 'cyan',
    desc: 'Engines, licenses, pipelines, software that ship games.',
  },
  {
    key: 'infra',
    label: 'Tools & infrastructure',
    tone: 'purple',
    desc: 'Hosting, databases, build systems, and studio tooling.',
  },
  {
    key: 'community',
    label: 'Community',
    tone: 'magenta',
    desc: 'Site features, credit systems, moderation, volunteer tools.',
  },
  {
    key: 'ops',
    label: 'Operations',
    tone: 'success',
    desc: 'Day-to-day operating costs outside the tax reserve.',
  },
];

export const STUDIO_EXPENSE_CATEGORY_LABELS = STUDIO_EXPENSE_CATEGORIES.map(
  (c) => c.label
);

export function studioExpenseCategoryByLabel(label) {
  return (
    STUDIO_EXPENSE_CATEGORIES.find((c) => c.label === label) ||
    STUDIO_EXPENSE_CATEGORIES[0]
  );
}
