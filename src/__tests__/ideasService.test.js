import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ideasService } from '../services/ideasService';

vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                order: vi.fn(() => Promise.resolve({ data: [{ id: 1 }], error: null }))
            })),
            insert: vi.fn(() => ({
                select: vi.fn(() => ({
                    single: vi.fn(() => Promise.resolve({ data: { id: 99 }, error: null }))
                }))
            }))
        })),
        rpc: vi.fn(() => Promise.resolve({ data: true, error: null }))
    }
}));

import { supabase } from '../lib/supabase';

describe('ideasService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getAllIdeas returns data from supabase', async () => {
        const result = await ideasService.getAllIdeas();
        expect(result).toEqual([{ id: 1 }]);
    });

    it('createIdea inserts and returns new idea', async () => {
        const idea = { title: 'Test' };
        const result = await ideasService.createIdea(idea);
        expect(result).toEqual({ id: 99 });
    });

    it('addVote calls insert and rpc', async () => {
        await ideasService.addVote(1, 'user-1');
        expect(supabase.from).toHaveBeenCalled();
        expect(supabase.rpc).toHaveBeenCalled();
    });
});