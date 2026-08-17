/**
 * Understated public display of awards already on a post (icons + counts).
 * Anvil / Masterwork notes live in AwardNotesSection, not here.
 */

import { summarizeAwardsByTier } from '../../utils/forgeMarks';
import { AwardTierIconTip } from './awardIcons';

export default function CommunityAwardStrip({
  awards = [],
  className = '',
}) {
  if (!awards?.length) return null;
  const summary = summarizeAwardsByTier(awards);
  if (!summary.length) return null;

  return (
    <div className={className}>
      <ul className="flex flex-wrap items-center gap-1 list-none p-0 m-0">
        {summary.map((tier) => (
          <li key={tier.id} className="inline-flex items-center">
            <AwardTierIconTip
              tierId={tier.id}
              name={tier.name}
              count={tier.count}
              className="w-6 h-6 sm:w-7 sm:h-7"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
