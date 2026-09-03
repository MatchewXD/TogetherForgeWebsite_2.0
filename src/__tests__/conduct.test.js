import { describe, it, expect } from 'vitest';
import {
  CONDUCT_REASONS,
  CONDUCT_PRIVATE_FIELDS,
  buildConductNotice,
  isFirstDeclineReason,
  shouldBlockFirstStrike,
  stripConductPrivateFields,
  strikeNextStep,
} from '../constants/conduct';

describe('conduct reason codes', () => {
  it('uses published-rule labels, not faction names', () => {
    const blob = CONDUCT_REASONS.map((r) => `${r.id} ${r.label}`).join(' ');
    expect(blob).not.toMatch(/woke/i);
    expect(blob).not.toMatch(/ideological propaganda/i);
    expect(blob).not.toMatch(/democrat|republican|maga/i);
    expect(CONDUCT_REASONS.map((r) => r.id)).toEqual([
      'off_brief',
      'political_branding',
      'harassment',
      'brigading',
      'spam',
      'impersonation',
      'other_coc',
    ]);
  });

  it('treats first off-brief as a decline, not a strike', () => {
    expect(isFirstDeclineReason('off_brief')).toBe(true);
    expect(isFirstDeclineReason('political_branding')).toBe(true);
    expect(isFirstDeclineReason('harassment')).toBe(false);
    expect(
      shouldBlockFirstStrike({
        reasonId: 'off_brief',
        priorNotice: false,
        skipReason: '',
      })
    ).toBe(true);
    expect(
      shouldBlockFirstStrike({
        reasonId: 'off_brief',
        priorNotice: true,
        skipReason: '',
      })
    ).toBe(false);
    expect(
      shouldBlockFirstStrike({
        reasonId: 'harassment',
        priorNotice: false,
        skipReason: '',
      })
    ).toBe(false);
    expect(
      shouldBlockFirstStrike({
        reasonId: 'off_brief',
        priorNotice: false,
        skipReason: 'Repeat of the same rejected payload',
      })
    ).toBe(false);
  });
});

describe('conduct notices', () => {
  it('is calm, names the rule, and points to the dispute email', () => {
    const text = buildConductNotice({
      contentLabel: 'idea',
      projectName: 'Tether',
      documentName: 'Code of Conduct · Content and discussion standards',
      caseCode: 'C-ABC12345',
      addedStrike: false,
      firstDecline: true,
    });
    expect(text).toMatch(/Tether/);
    expect(text).toMatch(/Code of Conduct/);
    expect(text).toMatch(/first decline with no strike/i);
    expect(text).toMatch(/conduct@togetherforge\.net/);
    expect(text).toMatch(/C-ABC12345/);
    expect(text).not.toMatch(/woke|ideolog/i);
  });

  it('states strike count and the next ladder step when a strike is added', () => {
    const text = buildConductNotice({
      contentLabel: 'task submission',
      caseCode: 'C-STRIKE01',
      addedStrike: true,
      strikeCount: 2,
      firstDecline: false,
    });
    expect(text).toMatch(/2 strikes/);
    expect(text).toContain(strikeNextStep(2));
  });
});

describe('conduct privacy', () => {
  it('strips reporter identity and staff notes from member-facing payloads', () => {
    const publicRow = stripConductPrivateFields({
      caseCode: 'C-ABC12345',
      strikeCount: 1,
      reporterId: 'secret-user',
      reporter_id: 'secret-user',
      staffNotes: 'ban evasion',
      linkedAccountsNote: 'alt of x',
      body: 'Your idea was declined',
    });
    for (const key of CONDUCT_PRIVATE_FIELDS) {
      expect(publicRow).not.toHaveProperty(key);
    }
    expect(publicRow.caseCode).toBe('C-ABC12345');
    expect(publicRow.body).toBe('Your idea was declined');
  });
});
