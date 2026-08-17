import { describe, it, expect } from 'vitest';
import {
  deriveIdeaStatus,
  getIdeaVoteHeat,
  getPublicIdeaLabel,
  PROMISING_MIN_VOTES,
  HOT_MIN_VOTES,
} from '../utils/ideaStatus';

describe('idea vote heat thresholds', () => {
  it('uses 50–99 for Promising and 100+ for Hot', () => {
    expect(PROMISING_MIN_VOTES).toBe(50);
    expect(HOT_MIN_VOTES).toBe(100);
    expect(getIdeaVoteHeat({ votes: 49 })).toBeNull();
    expect(getIdeaVoteHeat({ votes: 50 })).toBe('Promising');
    expect(getIdeaVoteHeat({ votes: 99 })).toBe('Promising');
    expect(getIdeaVoteHeat({ votes: 100 })).toBe('Hot');
  });
});

describe('public idea labels', () => {
  it('hides default workflow badges', () => {
    expect(getPublicIdeaLabel({ status: 'Proposed', votes: 0 })).toBeNull();
    expect(getPublicIdeaLabel({ status: 'Draft', votes: 0 })).toBeNull();
    expect(getPublicIdeaLabel({ status: 'Archived', votes: 0 })).toBeNull();
    expect(getPublicIdeaLabel({ votes: 80 })).toBeNull();
  });

  it('shows only TF engagement labels', () => {
    expect(getPublicIdeaLabel({ status: 'UnderReview' })).toBe('UnderReview');
    expect(getPublicIdeaLabel({ status: 'Adopted' })).toBe('Adopted');
  });

  it('Adopted stays Adopted even with high votes', () => {
    expect(deriveIdeaStatus({ status: 'Adopted', votes: 200 })).toBe('Adopted');
    expect(getPublicIdeaLabel({ status: 'Adopted', votes: 200 })).toBe(
      'Adopted'
    );
  });
});
