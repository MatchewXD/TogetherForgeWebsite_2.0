import { describe, it, expect, beforeEach } from 'vitest';
import {
  readStructureFreeform,
  writeStructureFreeform,
  clearStructureFreeform,
  structureFreeformStorageKey,
} from '../utils/ideaComposeDraft';

describe('structure freeform draft', () => {
  const userId = 'user-1';
  const mode = 'submit';

  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips text for a user and mode', () => {
    writeStructureFreeform(userId, mode, 'co-op dungeon crawler');
    expect(readStructureFreeform(userId, mode)).toBe('co-op dungeon crawler');
    expect(localStorage.getItem(structureFreeformStorageKey(userId, mode))).toBeTruthy();
  });

  it('keeps submit and wizard drafts separate', () => {
    writeStructureFreeform(userId, 'submit', 'guided pitch');
    writeStructureFreeform(userId, 'wizard', 'wizard pitch');
    expect(readStructureFreeform(userId, 'submit')).toBe('guided pitch');
    expect(readStructureFreeform(userId, 'wizard')).toBe('wizard pitch');
  });

  it('clears empty text and explicit clear', () => {
    writeStructureFreeform(userId, mode, 'keep me');
    writeStructureFreeform(userId, mode, '   ');
    expect(readStructureFreeform(userId, mode)).toBe('');
    writeStructureFreeform(userId, mode, 'keep me');
    clearStructureFreeform(userId, mode);
    expect(readStructureFreeform(userId, mode)).toBe('');
  });
});
