import { describe, it, expect } from 'vitest';
import { safeNextPath } from '../utils/safeNextPath';

describe('safeNextPath', () => {
  it('keeps same-site paths', () => {
    expect(safeNextPath('/dashboard')).toBe('/dashboard');
    expect(safeNextPath('/report-bug?from=nav#top')).toBe('/report-bug?from=nav#top');
    expect(safeNextPath('  /account  ')).toBe('/account');
  });

  it('rejects empty and relative values', () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath('')).toBeNull();
    expect(safeNextPath('dashboard')).toBeNull();
  });

  it('rejects off-site redirects', () => {
    expect(safeNextPath('https://evil.example')).toBeNull();
    expect(safeNextPath('//evil.example')).toBeNull();
    expect(safeNextPath('/\\evil.example')).toBeNull();
    expect(safeNextPath('/x?u=https://evil.example')).toBeNull();
    expect(safeNextPath('javascript:alert(1)')).toBeNull();
  });

  it('rejects control characters', () => {
    expect(safeNextPath('/\t/evil.example')).toBeNull();
    expect(safeNextPath('/a\nb')).toBeNull();
  });
});
