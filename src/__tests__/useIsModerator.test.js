import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useIsModerator } from '../hooks/useIsModerator';

// Mock the supabase module
vi.mock('../lib/supabase', () => ({
    supabase: {
        auth: {
            getUser: vi.fn(),
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
        },
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn()
                }))
            }))
        }))
    }
}));

import { supabase } from '../lib/supabase';

describe('useIsModerator hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns false when no user is logged in', async () => {
        supabase.auth.getUser.mockResolvedValue({ data: { user: null } });

        const { result } = renderHook(() => useIsModerator());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.isModerator).toBe(false);
    });

    function mockProfileRole(role) {
        supabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-1' } },
        });
        // Hook uses .maybeSingle() (not .single())
        supabase.from.mockReturnValue({
            select: () => ({
                eq: () => ({
                    maybeSingle: () =>
                        Promise.resolve({ data: { role }, error: null }),
                    single: () =>
                        Promise.resolve({ data: { role }, error: null }),
                }),
            }),
        });
    }

    it('returns true for moderator role', async () => {
        mockProfileRole('moderator');

        const { result } = renderHook(() => useIsModerator());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.isModerator).toBe(true);
    });

    it('returns true for admin role', async () => {
        mockProfileRole('admin');

        const { result } = renderHook(() => useIsModerator());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.isModerator).toBe(true);
    });

    it('returns true for project_lead role', async () => {
        mockProfileRole('project_lead');

        const { result } = renderHook(() => useIsModerator());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.isModerator).toBe(true);
    });

    it('returns true for founder role', async () => {
        mockProfileRole('founder');

        const { result } = renderHook(() => useIsModerator());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.isModerator).toBe(true);
    });

    it('returns false for regular user role', async () => {
        mockProfileRole('user');

        const { result } = renderHook(() => useIsModerator());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.isModerator).toBe(false);
    });
});