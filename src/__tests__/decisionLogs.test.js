import { describe, it, expect } from 'vitest';
import {
  DECISION_LOG_CATEGORIES,
  FALLBACK_DECISION_LOGS,
} from '../services/decisionLogsService';

describe('decision logs', () => {
  it('has the four public categories and seeded fallback entries', () => {
    expect(DECISION_LOG_CATEGORIES).toEqual([
      'Governance',
      'Process',
      'Legal',
      'Community',
    ]);
    expect(FALLBACK_DECISION_LOGS).toHaveLength(4);
    expect(FALLBACK_DECISION_LOGS.every((e) => e.title && e.body && e.date)).toBe(
      true
    );
  });
});
