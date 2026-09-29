import InfoHoverTip from '../ui/InfoHoverTip';
import {
  CLAIM_AUTO_RELEASE_POLICY_COPY,
  HOLD_CLAIM_DETAIL_COPY,
} from '../../services/tasksService';
import { isCodeLikeCategory } from '../../constants/taskReviewEvidence';

/**
 * Compact claim-rules control for task cards and the claim action.
 * Same copy as the old always-visible paragraphs; shown on hover / tap.
 */
export default function ClaimPolicyInfoTip({
  category,
  holdClaim = false,
  className = '',
}) {
  const workLine = isCodeLikeCategory(category)
    ? 'Do the technical work on GitHub, then submit for review with a PR or branch link.'
    : 'Do the work, then submit for review with a clear proof link.';

  return (
    <InfoHoverTip label="How claiming works" className={className}>
      <span className="block">
        Claiming reserves this task for you on Together Forge. {workLine}
      </span>
      <span className="block mt-1.5">
        {holdClaim ? HOLD_CLAIM_DETAIL_COPY : CLAIM_AUTO_RELEASE_POLICY_COPY}
      </span>
    </InfoHoverTip>
  );
}
