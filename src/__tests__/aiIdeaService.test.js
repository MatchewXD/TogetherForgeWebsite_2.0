import { describe, it, expect } from 'vitest';
import { ideaSnapshotFromForm } from '../services/aiIdeaService';
import {
  applyAiFieldsToForm,
  applyAllAiFieldsToForm,
  applySparseAiFieldsToForm,
} from '../components/ideas/IdeaAiToolsPanel';
import { emptyOptionalForm } from '../utils/ideaOptionalSections';
import {
  isIdeaTooEmptyForGapFill,
  findSparseFieldsOnForm,
} from '../utils/ideaAiSparse';

describe('ideaSnapshotFromForm', () => {
  it('copies core and optional fields for gap-fill', () => {
    const snap = ideaSnapshotFromForm({
      title: 'Test',
      category: 'Game Mechanic',
      summary: 'A short summary that is long enough',
      description: 'Desc',
      artStyle: 'Pixel',
      features: [{ name: 'A', description: 'B' }],
    });
    expect(snap.title).toBe('Test');
    expect(snap.artStyle).toBe('Pixel');
    expect(snap.features).toHaveLength(1);
  });
});

describe('applyAiFieldsToForm', () => {
  it('activates optional sections when accepting AI content', () => {
    const form = {
      title: 'T',
      category: 'Other',
      summary: 'S',
      description: 'D',
      ...emptyOptionalForm(),
    };
    const next = applyAiFieldsToForm(form, 'artStyle', 'Neon low-poly');
    expect(next.artStyle).toBe('Neon low-poly');
  });

  it('applies feature arrays', () => {
    const form = { ...emptyOptionalForm(), features: null };
    const next = applyAiFieldsToForm(form, 'features', [
      { name: 'Dash', description: 'Short burst' },
    ]);
    expect(next.features[0].name).toBe('Dash');
  });
});

describe('applyAllAiFieldsToForm', () => {
  it('writes core + optional structuring payload into the form', () => {
    const form = {
      title: '',
      category: '',
      summary: '',
      description: '',
      tags: '',
      ...emptyOptionalForm(),
    };
    const next = applyAllAiFieldsToForm(form, {
      title: 'Shared Backpack Co-op',
      category: 'Full Game Idea',
      summary: 'Squad shares one inventory.',
      description: 'A co-op loop about resource tension.',
      artStyle: 'Stylized low-poly',
      features: [{ name: 'Shared bag', description: 'One inventory for all' }],
    });
    expect(next.title).toBe('Shared Backpack Co-op');
    expect(next.category).toBe('Full Game Idea');
    expect(next.summary).toMatch(/inventory/i);
    expect(next.description).toMatch(/co-op/i);
    expect(next.artStyle).toBe('Stylized low-poly');
    expect(next.features[0].name).toBe('Shared bag');
  });
});

describe('gap fill safety', () => {
  it('treats blank forms as too empty', () => {
    expect(
      isIdeaTooEmptyForGapFill({
        title: '',
        summary: '',
        description: '',
      })
    ).toBe(true);
  });

  it('allows gap fill when core content exists', () => {
    expect(
      isIdeaTooEmptyForGapFill({
        title: 'Shared Backpack',
        summary: 'A co-op game about sharing inventory under pressure.',
        description: '',
      })
    ).toBe(false);
  });

  it('does not overwrite solid fields when applying sparse results', () => {
    const form = {
      title: 'Keep This Title',
      category: 'Game Mechanic',
      summary: 'This summary is long enough to count as real content for the idea.',
      description: 'A full description that is definitely longer than eighty characters so it is not sparse at all.',
      ...emptyOptionalForm(),
      artStyle: null,
    };
    const sparse = findSparseFieldsOnForm(form);
    expect(sparse).not.toContain('title');
    expect(sparse).not.toContain('summary');
    expect(sparse).toContain('artStyle');

    const { form: next, applied } = applySparseAiFieldsToForm(
      form,
      {
        title: 'Hijacked Title',
        artStyle: 'Pixel neon',
      },
      sparse
    );
    expect(next.title).toBe('Keep This Title');
    expect(next.artStyle).toBe('Pixel neon');
    expect(applied).toBeGreaterThanOrEqual(1);
  });
});
