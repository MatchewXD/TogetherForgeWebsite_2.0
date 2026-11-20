import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

import { bugReportsService, BUG_REPORT_COLUMNS } from '../services/bugReportsService';

function chain(result) {
  const q = {
    select: (cols) => {
      mocks.select(cols);
      return q;
    },
    order: () => q,
    limit: () => q,
    in: () => q,
    eq: () => q,
    maybeSingle: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return q;
}

describe('bugReportsService columns', () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.select.mockReset();
  });

  it('never selects the private columns', () => {
    const cols = BUG_REPORT_COLUMNS.split(',').map((c) => c.trim());
    expect(cols).not.toContain('reporter_email');
    expect(cols).not.toContain('staff_notes');
    expect(cols).not.toContain('*');
    expect(cols).toContain('id');
    expect(cols).toContain('reporter_name');
  });

  it('listBugs and getBug use the public column list', async () => {
    mocks.from.mockImplementation(() => chain({ data: [], error: null }));
    await bugReportsService.listBugs({ status: 'all' });
    mocks.from.mockImplementation(() => chain({ data: null, error: null }));
    await bugReportsService.getBug('b1');
    expect(mocks.select).toHaveBeenCalledTimes(2);
    for (const [cols] of mocks.select.mock.calls) {
      expect(cols).toBe(BUG_REPORT_COLUMNS);
    }
  });
});
