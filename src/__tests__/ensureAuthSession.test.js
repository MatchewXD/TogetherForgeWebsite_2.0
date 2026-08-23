import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSession = vi.fn();
const getUser = vi.fn();
const refreshSession = vi.fn();
const rpc = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...a) => rpc(...a),
    auth: {
      getSession: (...a) => getSession(...a),
      getUser: (...a) => getUser(...a),
      refreshSession: (...a) => refreshSession(...a),
    },
  },
}));

import {
  ensureAuthSession,
  isAuthFailureError,
  rpcWithFreshAuth,
} from '../utils/ensureAuthSession';

describe('ensureAuthSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the session user when the token is still fresh', async () => {
    const user = { id: 'bot7' };
    getSession.mockResolvedValue({
      data: {
        session: {
          user,
          access_token: 'eyJhbGciOiJub25l.eyJzdWIiOiJib3Q3.signature',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
      error: null,
    });
    await expect(ensureAuthSession()).resolves.toEqual(user);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('refreshes when the access token is about to expire', async () => {
    const user = { id: 'bot7' };
    getSession.mockResolvedValue({
      data: {
        session: {
          user,
          access_token: 'old',
          expires_at: Math.floor(Date.now() / 1000) + 10,
        },
      },
      error: null,
    });
    refreshSession.mockResolvedValue({
      data: { session: { user, access_token: 'new', expires_at: 9e9 } },
      error: null,
    });
    await expect(ensureAuthSession()).resolves.toEqual(user);
    expect(refreshSession).toHaveBeenCalled();
  });
});

describe('rpcWithFreshAuth', () => {
  it('retries once after a JWT error', async () => {
    const user = { id: 'bot7' };
    const jwt = 'eyJhbGciOiJub25l.eyJzdWIiOiJib3Q3.signature';
    getSession.mockResolvedValue({
      data: {
        session: {
          user,
          access_token: jwt,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
      error: null,
    });
    let toggleCalls = 0;
    const fetchMock = vi.fn(async () => {
      toggleCalls += 1;
      if (toggleCalls === 1) {
        return {
          ok: false,
          status: 401,
          text: async () =>
            JSON.stringify({ message: 'JWT expired', code: 'PGRST301' }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ liked: true, likes: 1 }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    refreshSession.mockResolvedValue({
      data: { session: { user, access_token: jwt } },
      error: null,
    });

    const result = await rpcWithFreshAuth('toggle_showcase_like', {
      p_post_id: 'p1',
    });
    expect(result.data).toEqual({ liked: true, likes: 1 });
    expect(toggleCalls).toBe(2);
  });

  it('detects auth failures', () => {
    expect(isAuthFailureError({ message: 'SIGN_IN_REQUIRED' })).toBe(true);
    expect(isAuthFailureError({ message: 'JWT expired' })).toBe(true);
    expect(isAuthFailureError({ message: 'RATE_LIMITED' })).toBe(false);
  });
});
