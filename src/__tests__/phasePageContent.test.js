import { describe, it, expect } from 'vitest';
import {
  EARLY_PHASE_DEFAULTS,
  EARLY_CONTENT_VERSION,
  stripMarkup,
  parseBulletList,
  mergePhaseContent,
  parseGoalsBlob,
  parseTargetStyleBlob,
  isLegacyEarlyContent,
} from '../utils/phasePageContent';

describe('phasePageContent sanitization', () => {
  it('strips HTML and markdown asterisks', () => {
    expect(stripMarkup('<small>Success metric: hello</small>')).toBe(
      'Success metric: hello'
    );
    expect(stripMarkup('**Early Game** is cool')).toBe('Early Game is cool');
    expect(stripMarkup('*bullet-ish*')).toBe('bullet-ish');
  });

  it('parses goals without leaking markdown or success metric into bullets', () => {
    const raw = `**Early Game (Proof of Concept)**

* Test and prove our community-driven development model works.
* Build and refine core cooperation and teamwork mechanics.

<small>Success metric: Strong community engagement during development + positive feedback on cooperative gameplay.</small>`;
    const { goals, successMetric, goalsIntro } = parseGoalsBlob(
      raw,
      EARLY_PHASE_DEFAULTS
    );
    expect(goalsIntro).toMatch(/Early Game/i);
    expect(goals.some((g) => g.includes('*'))).toBe(false);
    expect(goals.some((g) => /success metric/i.test(g))).toBe(false);
    expect(goals.some((g) => /<small>/i.test(g))).toBe(false);
    expect(goals.length).toBeGreaterThanOrEqual(2);
    expect(successMetric).toMatch(/Strong community engagement/i);
    expect(successMetric).not.toMatch(/</);
  });

  it('parses targetStyle without duplicating intro as bullets', () => {
    const raw = `We are looking for small, focused multiplayer games that emphasize cooperation and teamwork.

**Examples of the kind of games we want to make:**
- Cooperative survival challenges (ex: Lethal Company, Peak, PlateUp!)
- Shared vehicle/mech operation or crew-based gameplay (ex: Sea of Thieves, Barotrauma)`;
    const parsed = parseTargetStyleBlob(raw, EARLY_PHASE_DEFAULTS);
    expect(parsed.targetIntro).toMatch(/small, focused multiplayer/i);
    expect(parsed.targetIntro).not.toMatch(/\*\*/);
    expect(parsed.targetExamples.length).toBe(2);
    expect(parsed.targetExamples[0]).not.toMatch(/^\*/);
    expect(
      parsed.targetExamples.some((e) => /examples of the kind/i.test(e))
    ).toBe(false);
  });

  it('mergePhaseContent cleans legacy DB blobs', () => {
    const merged = mergePhaseContent(EARLY_PHASE_DEFAULTS, {
      goals: `**Early Game (Proof of Concept)**\n* First goal\n* Second goal\n<small>Success metric: Metrics here</small>`,
      targetStyle: `Intro sentence here.\n\n**Examples:**\n- Example one\n- Example two`,
      aboutText: 'Para one.\n\nPara one.\n\nPara two.',
    });
    expect(Array.isArray(merged.goals)).toBe(true);
    expect(merged.goals.every((g) => !g.includes('*') && !g.includes('<'))).toBe(
      true
    );
    expect(merged.successMetric).toMatch(/Metrics here/);
    expect(merged.targetExamples.every((e) => !e.includes('**'))).toBe(true);
    // about dedupes identical paragraphs
    expect(
      merged.aboutParagraphs.filter((p) => /Para one/i.test(p)).length
    ).toBe(1);
  });

  it('parseBulletList falls back when empty', () => {
    expect(parseBulletList('', ['A', 'B'])).toEqual(['A', 'B']);
  });

  it('treats pre-v3 CMS payloads as legacy', () => {
    expect(isLegacyEarlyContent({})).toBe(true);
    expect(isLegacyEarlyContent({ contentVersion: 1 })).toBe(true);
    expect(
      isLegacyEarlyContent({
        contentVersion: EARLY_CONTENT_VERSION,
        goals: EARLY_PHASE_DEFAULTS.goals,
      })
    ).toBe(false);
    expect(
      isLegacyEarlyContent({
        contentVersion: EARLY_CONTENT_VERSION,
        goals: '**broken**',
      })
    ).toBe(true);
  });

  it('finalized defaults match intended public Goals and Target Style', () => {
    expect(EARLY_PHASE_DEFAULTS.heroSeriesLabel).toBe(
      'Early Game (Proof of Concept Series)'
    );
    expect(EARLY_PHASE_DEFAULTS.goals).toHaveLength(5);
    expect(EARLY_PHASE_DEFAULTS.goals[2]).toMatch(/genuinely fun multiplayer/i);
    expect(EARLY_PHASE_DEFAULTS.targetExamples[0]).toMatch(/Peak/);
    expect(EARLY_PHASE_DEFAULTS.targetExamples[2]).toMatch(/Valheim/);
    expect(EARLY_PHASE_DEFAULTS.successMetric).toMatch(
      /Strong community engagement/
    );
  });
});
