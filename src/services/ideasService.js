import { supabase } from '../lib/supabase';

export const ideasService = {
    async getAllIdeas() {
        const { data, error } = await supabase
            .from('ideas')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async createIdea(idea) {
        const { data, error } = await supabase
            .from('ideas')
            .insert([idea])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async addVote(ideaId, userId) {
        // Insert vote record
        await supabase.from('votes').insert([{ idea_id: ideaId, user_id: userId }]);

        // Increment vote count on idea
        const { data, error } = await supabase.rpc('increment_vote', { idea_id: ideaId });
        if (error) throw error;
        return data;
    }
};