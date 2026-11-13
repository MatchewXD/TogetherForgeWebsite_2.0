import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...a) => rpc(...a) } }));

import {
  describeError,
  reportClientError,
  resetErrorReporterForTests,
  shouldIgnoreError,
} from '../lib/errorReporter';

describe('errorReporter', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
    resetErrorReporterForTests();
  });

  it('describes Error objects and strings', () => {
    expect(describeError(new TypeError('x is undefined')).message).toBe(
      'TypeError: x is undefined'
    );
    expect(describeError(new Error('plain')).message).toBe('plain');
    expect(describeError('text')).toEqual({ message: 'text', stack: '' });
    expect(describeError(null)).toEqual({ message: '', stack: '' });
  });

  it('ignores browser noise and extension errors', () => {
    expect(shouldIgnoreError('Script error.')).toBe(true);
    expect(shouldIgnoreError('ResizeObserver loop limit exceeded')).toBe(true);
    expect(shouldIgnoreError('boom', 'at chrome-extension://abc/x.js')).toBe(true);
    expect(shouldIgnoreError('')).toBe(true);
    expect(shouldIgnoreError('TypeError: x is undefined')).toBe(false);
  });

  it('sends one bounded report with no user identifiers', async () => {
    const err = new Error('m'.repeat(900));
    expect(await reportClientError('render', err, { componentStack: 'in Foo' })).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe('log_client_error');
    expect(args.p_kind).toBe('render');
    expect(args.p_message.length).toBe(500);
    expect(args.p_stack).toContain('in Foo');
    expect(args.p_path).toBe('/');
    expect(args.p_session_key).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(Object.keys(args).some((k) => /user_id|email/.test(k))).toBe(false);
  });

  it('does not report the same error twice', async () => {
    expect(await reportClientError('error', new Error('same'))).toBe(true);
    expect(await reportClientError('error', new Error('same'))).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('stops after five reports per page session', async () => {
    for (let i = 0; i < 8; i += 1) {
      await reportClientError('error', new Error(`e${i}`));
    }
    expect(rpc).toHaveBeenCalledTimes(5);
  });

  it('never throws when the backend fails', async () => {
    rpc.mockRejectedValue(new Error('network'));
    await expect(reportClientError('error', new Error('x'))).resolves.toBe(false);
    rpc.mockResolvedValue({ error: { code: 'PGRST202', message: 'missing' } });
    await expect(reportClientError('error', new Error('y'))).resolves.toBe(false);
  });
});
