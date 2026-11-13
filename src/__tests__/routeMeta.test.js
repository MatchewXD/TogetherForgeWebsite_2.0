import { describe, it, expect } from 'vitest';
import { getRouteMeta, DEFAULT_DESCRIPTION } from '../utils/routeMeta';

describe('getRouteMeta', () => {
  it('uses the bare site name on home', () => {
    expect(getRouteMeta('/')).toEqual({ title: '', description: DEFAULT_DESCRIPTION });
  });

  it('matches exact routes', () => {
    expect(getRouteMeta('/faq').title).toBe('FAQ');
  });

  it('inherits from the longest matching prefix', () => {
    expect(getRouteMeta('/ideas/123').title).toBe('Ideas');
    expect(getRouteMeta('/ideas/submit').title).toBe('Submit an Idea');
    expect(getRouteMeta('/projects/tether/board').title).toBe('Tether');
    expect(getRouteMeta('/projects/other').title).toBe('Projects');
  });

  it('does not match partial segments', () => {
    expect(getRouteMeta('/ideasx').title).toBe('');
    expect(getRouteMeta('/u/someone').title).toBe('Profile');
  });

  it('falls back to the default description', () => {
    expect(getRouteMeta('/contact').description).toBe(DEFAULT_DESCRIPTION);
    expect(getRouteMeta('/nope').description).toBe(DEFAULT_DESCRIPTION);
  });
});
