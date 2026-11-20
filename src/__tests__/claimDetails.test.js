import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: mocks.getSession },
    rpc: mocks.rpc,
  },
}));

import {
  collectClaimIds,
  mergeClaimPrivateDetails,
  fetchClaimPrivateDetails,
  attachClaimPrivateDetails,
} from '../services/tasks/claimDetails';
import { TASK_SELECT } from '../services/tasks/taskSelects';

const rows = () => [
  {
    id: 't1',
    task_claims: [
      { id: 'c1', user_id: 'u1', status: 'Active' },
      { id: 'c2', user_id: 'u2', status: 'Returned' },
    ],
  },
  { id: 't2', task_claims: [] },
  { id: 't3' },
];

describe('claimDetails', () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.rpc.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('keeps private claim columns out of the task select', () => {
    expect(TASK_SELECT).not.toMatch(/\bnotes\b/);
    expect(TASK_SELECT).not.toMatch(/submission_evidence/);
    expect(TASK_SELECT).not.toMatch(/review_feedback/);
    expect(TASK_SELECT).toMatch(/task_claims\s*\(/);
  });

  it('collects unique claim ids from embedded claims', () => {
    expect(collectClaimIds([...rows(), ...rows()])).toEqual(['c1', 'c2']);
    expect(collectClaimIds(null)).toEqual([]);
  });

  it('merges private fields only onto matching claims', () => {
    const merged = mergeClaimPrivateDetails(rows(), [
      {
        id: 'c1',
        notes: 'my notes',
        submission_evidence: 'https://github.com/x/y/pull/1',
        review_feedback: null,
      },
    ]);
    expect(merged[0].task_claims[0]).toMatchObject({
      id: 'c1',
      notes: 'my notes',
      submission_evidence: 'https://github.com/x/y/pull/1',
      review_feedback: null,
    });
    expect(merged[0].task_claims[1]).toEqual({
      id: 'c2',
      user_id: 'u2',
      status: 'Returned',
    });
    expect(merged[2]).toEqual({ id: 't3' });
  });

  it('returns rows unchanged when there are no details', () => {
    const input = rows();
    expect(mergeClaimPrivateDetails(input, [])).toBe(input);
  });

  it('skips the RPC for signed-out visitors', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    expect(await fetchClaimPrivateDetails(['c1'])).toEqual([]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('skips the RPC when there are no claims', async () => {
    expect(await fetchClaimPrivateDetails([])).toEqual([]);
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it('calls the RPC with unique ids for signed-in users', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: {} } } });
    mocks.rpc.mockResolvedValue({
      data: [{ id: 'c1', notes: 'n' }],
      error: null,
    });
    const out = await attachClaimPrivateDetails(rows());
    expect(mocks.rpc).toHaveBeenCalledWith('get_task_claim_private_details', {
      p_claim_ids: ['c1', 'c2'],
    });
    expect(out[0].task_claims[0].notes).toBe('n');
  });

  it('falls back to no details when the RPC fails', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: {} } } });
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'function does not exist' },
    });
    const input = rows();
    expect(await attachClaimPrivateDetails(input)).toBe(input);
  });
});
