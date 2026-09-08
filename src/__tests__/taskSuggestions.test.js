import { describe, it, expect } from 'vitest';
import {
  SUGGEST_LOCKED_MESSAGE,
  SUGGESTION_STRIKE_LIMIT,
  isSuggestLockedError,
} from '../services/taskSuggestionsService';

describe('task suggestion strikes', () => {
  it('locks after three strikes', () => {
    expect(SUGGESTION_STRIKE_LIMIT).toBe(3);
    expect(isSuggestLockedError({ message: 'SUGGEST_LOCKED: blocked' })).toBe(
      true
    );
    expect(isSuggestLockedError({ message: 'Title is required' })).toBe(false);
    expect(SUGGEST_LOCKED_MESSAGE).toMatch(/three/i);
  });
});
