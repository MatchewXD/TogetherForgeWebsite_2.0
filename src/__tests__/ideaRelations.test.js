import { describe, it, expect } from 'vitest';
import {
  getParentIdeaId,
  ideaHasParent,
  normalizeParentIdeaId,
  validateParentLink,
  canBeParentIdea,
  relatedCreditLine,
  humanizeParentLinkError,
  IDEA_RELATION_MAX_DEPTH,
} from '../utils/ideaRelations';

describe('ideaRelations', () => {
  it('exports one-level depth for v1', () => {
    expect(IDEA_RELATION_MAX_DEPTH).toBe(1);
  });

  it('reads parent id from snake or camel case', () => {
    expect(getParentIdeaId({ parent_idea_id: 12 })).toBe(12);
    expect(getParentIdeaId({ parentIdeaId: '7' })).toBe(7);
    expect(getParentIdeaId({})).toBeNull();
    expect(ideaHasParent({ parent_idea_id: 1 })).toBe(true);
  });

  it('normalizes parent ids', () => {
    expect(normalizeParentIdeaId('')).toBeNull();
    expect(normalizeParentIdeaId('42')).toBe(42);
    expect(normalizeParentIdeaId(0)).toBeNull();
  });

  it('blocks self-parent and non-root parents', () => {
    expect(
      validateParentLink({ childId: 5, parentId: 5 }).ok
    ).toBe(false);
    expect(
      validateParentLink({
        childId: 2,
        parentId: 9,
        parentIdea: { id: 9, parent_idea_id: 1 },
      }).ok
    ).toBe(false);
    expect(
      validateParentLink({
        childId: 2,
        parentId: 9,
        parentIdea: { id: 9, parent_idea_id: null },
      }).ok
    ).toBe(true);
  });

  it('blocks parenting when child already has children', () => {
    expect(
      validateParentLink({
        childId: 3,
        parentId: 1,
        childHasChildren: true,
      }).ok
    ).toBe(false);
  });

  it('canBeParentIdea requires root', () => {
    expect(canBeParentIdea({ id: 1, parent_idea_id: null })).toBe(true);
    expect(canBeParentIdea({ id: 1, parent_idea_id: 2 })).toBe(false);
    expect(canBeParentIdea({ id: 5 }, 5)).toBe(false);
  });

  it('credit line includes creator when present', () => {
    const withBy = relatedCreditLine('Tether Loop', 'alice');
    expect(withBy.text).toMatch(/Tether Loop/);
    expect(withBy.text).toMatch(/alice/);
    expect(relatedCreditLine('Solo', '').by).toBe('');
  });

  it('humanizes server parent errors', () => {
    expect(
      humanizeParentLinkError({ message: 'IDEA_PARENT_NOT_ROOT: x' })
    ).toMatch(/one level/i);
    expect(
      humanizeParentLinkError({ message: 'IDEA_PARENT_SELF' })
    ).toMatch(/itself/i);
  });
});
