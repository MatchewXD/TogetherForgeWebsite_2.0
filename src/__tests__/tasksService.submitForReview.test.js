/**
 * submitForReview enforces checklist + evidence + identity before RPC.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
const getUser = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args) => rpc(...args),
    auth: { getUser: (...a) => getUser(...a) },
    from: vi.fn(),
  },
}));

import { tasksService } from '../services/tasksService';

const verifiedUser = {
  id: 'u1',
  email_confirmed_at: '2024-01-01T00:00:00Z',
  identities: [{ provider: 'discord' }],
};

describe('tasksService.submitForReview', () => {
  beforeEach(() => {
    rpc.mockReset();
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: verifiedUser } });
    rpc.mockImplementation((name) => {
      if (name === 'get_my_claim_quota') {
        return Promise.resolve({
          data: {
            signed_in: true,
            can_submit_now: true,
            is_restricted: false,
            submits_last_24h: 0,
            submit_limit_24h: 2,
            completed_claims: 0,
            claim_limit: 2,
            active_claims: 1,
            can_claim_now: true,
            identity: { meets_gate: true },
          },
          error: null,
        });
      }
      return Promise.resolve({ data: { ok: true }, error: null });
    });
  });

  it('rejects short evidence before calling submit RPC', async () => {
    await expect(
      tasksService.submitForReview('task-1', 'too short')
    ).rejects.toMatchObject({ code: 'EVIDENCE_REQUIRED' });
    expect(rpc).not.toHaveBeenCalledWith(
      'submit_task_for_review',
      expect.anything()
    );
  });

  it('rejects evidence without a URL', async () => {
    await expect(
      tasksService.submitForReview(
        'task-1',
        'Long enough evidence note without any link at all!!'
      )
    ).rejects.toMatchObject({ code: 'EVIDENCE_LINK_REQUIRED' });
  });

  it('rejects incomplete checklist before calling submit RPC', async () => {
    await expect(
      tasksService.submitForReview(
        'task-1',
        'Long enough evidence note here https://example.com/pr/1',
        {
          subtasks: [
            { id: '1', label: 'A', done: true },
            { id: '2', label: 'B', done: false },
          ],
        }
      )
    ).rejects.toMatchObject({ code: 'CHECKLIST_INCOMPLETE' });
    expect(rpc).not.toHaveBeenCalledWith(
      'submit_task_for_review',
      expect.anything()
    );
  });

  it('rejects when identity gate fails', async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: 'u1',
          email_confirmed_at: null,
          identities: [{ provider: 'email' }],
        },
      },
    });
    await expect(
      tasksService.submitForReview(
        'task-1',
        'Implemented feature and linked PR https://example.com/pr/1'
      )
    ).rejects.toMatchObject({ code: 'IDENTITY_GATE' });
  });

  it('calls RPC when evidence ok and checklist complete', async () => {
    await tasksService.submitForReview(
      'task-1',
      'Implemented feature and linked PR https://example.com/pr/1',
      {
        subtasks: [
          { id: '1', label: 'A', done: true },
          { id: '2', label: 'B', done: true },
        ],
      }
    );
    expect(rpc).toHaveBeenCalledWith('submit_task_for_review', {
      p_task_id: 'task-1',
      p_evidence: expect.stringContaining('Implemented'),
    });
  });

  it('allows submit with no checklist items when URL present', async () => {
    await tasksService.submitForReview(
      'task-2',
      'Enough characters for evidence note!! https://example.com/a',
      { subtasks: [] }
    );
    expect(rpc).toHaveBeenCalledWith(
      'submit_task_for_review',
      expect.objectContaining({ p_task_id: 'task-2' })
    );
  });
});
