import { describe, it, expect } from 'vitest';
import {
  displayIdeaVotes,
  mapPublicIdeaMetrics,
} from '../services/ideasService';
import {
  humanizeAbuseError,
  isMissingRpcError,
} from '../utils/abuseErrors';
import {
  optimisticPublicCount,
  reconcilePublicCount,
} from '../utils/publicCounts';

describe('abuseErrors', () => {
  it('maps rate-limit and duplicate codes to safe copy', () => {
    expect(humanizeAbuseError({ message: 'RATE_LIMITED' })).toMatch(/too quickly/i);
    expect(humanizeAbuseError({ message: 'DUPLICATE_CONTENT' })).toMatch(/same as something/i);
    expect(
      humanizeAbuseError({
        message: 'duplicate key value violates unique constraint',
      })
    ).toBe('Something went wrong. Please try again.');
    expect(
      humanizeAbuseError({ message: 'permission denied for table votes' })
    ).toMatch(/permission/i);
    expect(
      humanizeAbuseError({
        message: 'function public.foo(bigint) does not exist',
      })
    ).toBe('Something went wrong. Please try again.');
  });

  it('detects missing RPC errors', () => {
    expect(
      isMissingRpcError({ code: 'PGRST202', message: 'Could not find the function' })
    ).toBe(true);
    expect(isMissingRpcError({ message: 'RATE_LIMITED' })).toBe(false);
  });
});

describe('publicCounts hybrid display', () => {
  it('bumps live totals under 10 and holds delayed totals at 10+', () => {
    expect(optimisticPublicCount(3, true)).toBe(4);
    expect(optimisticPublicCount(3, false)).toBe(2);
    expect(optimisticPublicCount(12, true)).toBe(12);
    expect(reconcilePublicCount(4, 5)).toBe(5);
    expect(reconcilePublicCount(12, 14)).toBe(12);
    expect(reconcilePublicCount(9, 10)).toBe(10);
  });
});

describe('displayIdeaVotes', () => {
  it('prefers votes_public when present', () => {
    expect(displayIdeaVotes({ votes: 41, votes_public: 40 })).toBe(40);
    expect(displayIdeaVotes({ votes: 3 })).toBe(3);
    expect(mapPublicIdeaMetrics({ id: 1, votes: 41, votes_public: 40 }).votes).toBe(
      40
    );
  });
});
