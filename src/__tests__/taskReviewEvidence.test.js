import { describe, it, expect } from 'vitest';
import {
  getReviewEvidenceHint,
  composeReviewEvidence,
} from '../constants/taskReviewEvidence';

describe('getReviewEvidenceHint', () => {
  it('returns code-specific guidance', () => {
    expect(getReviewEvidenceHint('Code')).toMatch(/PR|commit|branch/i);
  });

  it('returns art / design guidance', () => {
    expect(getReviewEvidenceHint('Art')).toMatch(/Figma|image/i);
    expect(getReviewEvidenceHint('Design')).toMatch(/Figma|image/i);
  });

  it('falls back for unknown categories', () => {
    expect(getReviewEvidenceHint('Magic')).toMatch(/proof|complete/i);
  });
});

describe('composeReviewEvidence', () => {
  it('joins note, links, and dependency sections', () => {
    const text = composeReviewEvidence({
      note: 'Implemented dash.',
      links: ['https://github.com/org/repo/pull/1', ''],
      dependsOn: 'Player controller PR',
    });
    expect(text).toContain('Implemented dash.');
    expect(text).toContain('Links:');
    expect(text).toContain('https://github.com/org/repo/pull/1');
    expect(text).toMatch(/Blocked by|depends on/i);
    expect(text).toContain('Player controller PR');
  });

  it('omits empty optional sections', () => {
    const text = composeReviewEvidence({
      note: 'Done the thing properly.',
      links: ['  '],
      dependsOn: '',
    });
    expect(text).toBe('Done the thing properly.');
  });
});
