import { describe, it, expect } from 'vitest';
import { normalizeGoals } from '../utils/normalizeGoals';

describe('Goals markdown normalization', () => {
    it('converts literal backslash-n sequences to real newlines', () => {
        const input = '- **Early Game (Proof of Concept)**\\n* Test line';
        const result = normalizeGoals(input);
        expect(result).toContain('\n* Test line');
        expect(result).not.toContain('\\n');
    });

    it('converts <small> tags to markdown italics', () => {
        const input = 'Success metric line\n<small>Success metric: foo</small>';
        const result = normalizeGoals(input);
        expect(result).toContain('_Success metric: foo_');
    });

    it('ensures every bullet line starts with a list marker', () => {
        const input = 'Test and prove our community-driven development model works.';
        const result = normalizeGoals(input);
        expect(result.startsWith('- ')).toBe(true);
    });

    it('preserves exact moderator input with <small> and * bullets', () => {
        const moderatorInput = `**Early Game (Proof of Concept)**

* Test and prove our community-driven development model works.
* Build and refine core cooperation and teamwork mechanics.
* Create a genuinely fun experience that brings players together.
* Establish transparent systems for volunteering, task tracking, and crediting contributors.
* Gather real community feedback to improve future projects.

<small>Success metric: Strong community engagement during development + positive feedback on cooperative gameplay.</small>`;
        const result = normalizeGoals(moderatorInput);
        expect(result).toContain('* Test and prove');
        expect(result).toContain('_Success metric: Strong community engagement');
        expect(result).not.toContain('<small>');
    });
});