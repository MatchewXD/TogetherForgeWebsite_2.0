import { describe, it, expect } from 'vitest';
import {
  isCodeLikeCategory,
  getReviewNoteHint,
  getReviewEvidenceHint,
  getContributionWorkflowSteps,
  isGithubEvidenceUrl,
  extractGithubUrlsFromEvidence,
  validateReviewEvidencePackage,
} from '../constants/taskReviewEvidence';

describe('GitHub-centric contribution evidence helpers', () => {
  it('detects code-like categories', () => {
    expect(isCodeLikeCategory('Code')).toBe(true);
    expect(isCodeLikeCategory('Art')).toBe(false);
  });

  it('separates note vs link guidance', () => {
    expect(getReviewNoteHint('Code')).toMatch(/not here/i);
    expect(getReviewEvidenceHint('Code')).toMatch(/GitHub|PR/i);
    expect(getReviewEvidenceHint('Art')).toMatch(/images|Figma|Drive/i);
  });

  it('builds a clear claim → work → review → credit loop', () => {
    const steps = getContributionWorkflowSteps('Code', {
      githubUrl: 'https://github.com/org/repo',
    });
    expect(steps).toHaveLength(4);
    expect(steps[0]).toMatch(/Claim/i);
    expect(steps[1]).toMatch(/GitHub/i);
    expect(steps[2]).toMatch(/review|PR/i);
    expect(steps[3]).toMatch(/credit/i);
  });

  it('detects GitHub evidence URLs', () => {
    expect(isGithubEvidenceUrl('https://github.com/org/repo/pull/1')).toBe(
      true
    );
    expect(isGithubEvidenceUrl('https://drive.google.com/file/x')).toBe(false);
  });

  it('extracts GitHub links from composed evidence for cards / future notify', () => {
    const urls = extractGithubUrlsFromEvidence(
      'Done.\n\nLinks:\n- https://github.com/a/b/pull/3\n- https://drive.google.com/x'
    );
    expect(urls[0]).toContain('github.com/a/b/pull/3');
  });

  it('soft-warns code submits without GitHub but does not hard-block', () => {
    const result = validateReviewEvidencePackage({
      note: 'Implemented feature and tested thoroughly.',
      links: ['https://drive.google.com/folder/abc'],
      category: 'Code',
    });
    expect(result.ok).toBe(true);
    expect(result.warning).toMatch(/GitHub/i);
  });

  it('accepts code submits with a PR link cleanly', () => {
    const result = validateReviewEvidencePackage({
      note: 'Implemented feature and tested thoroughly.',
      links: ['https://github.com/org/repo/pull/12'],
      category: 'Code',
    });
    expect(result.ok).toBe(true);
    expect(result.warning).toBeUndefined();
  });
});
