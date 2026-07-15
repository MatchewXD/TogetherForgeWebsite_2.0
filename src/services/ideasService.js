import { supabase } from '../lib/supabase';

/**
 * Normalize a profiles row into a stable creator/commenter shape.
 * Always includes both avatar_url and avatarUrl for UI flexibility.
 */
export function mapProfile(profile, fallbackName = 'Member') {
  if (!profile) {
    return {
      username: fallbackName,
      avatar_url: null,
      avatarUrl: null,
    };
  }
  const username = profile.username || fallbackName;
  const avatar_url =
    (typeof profile.avatar_url === 'string' && profile.avatar_url.trim()) ||
    (typeof profile.avatarUrl === 'string' && profile.avatarUrl.trim()) ||
    null;

  return {
    id: profile.id || null,
    username,
    avatar_url,
    avatarUrl: avatar_url,
  };
}

/** Build id → profile map from a profiles query result. */
export function buildProfileMap(profiles = []) {
  return Object.fromEntries(
    (profiles || []).map((p) => [p.id, mapProfile(p)])
  );
}

/** Attach creator profiles to idea rows. */
export function attachCreators(ideas = [], profileMap = {}) {
  return (ideas || []).map((idea) => ({
    ...idea,
    creator: idea.user_id
      ? profileMap[idea.user_id] || mapProfile(null, 'Member')
      : null,
  }));
}

/** Attach author profiles to comment rows. */
export function attachCommentProfiles(comments = [], profileMap = {}) {
  return (comments || []).map((c) => ({
    ...c,
    profiles: c.user_id
      ? profileMap[c.user_id] || mapProfile(null, 'User')
      : mapProfile(null, 'Anonymous'),
  }));
}

/**
 * Collect string keys that may identify a project on ideas.project_id
 * (slug, uuid, or both).
 */
export function normalizeProjectKeys(projectKey) {
  if (!projectKey) return [];
  if (typeof projectKey === 'string' || typeof projectKey === 'number') {
    const s = String(projectKey).trim();
    return s ? [s] : [];
  }
  const keys = [projectKey.slug, projectKey.id, projectKey.project_id]
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => String(v).trim());
  return [...new Set(keys)];
}

/** Whether an idea row belongs to any of the given project keys. */
export function ideaMatchesProject(idea, keys = []) {
  if (!idea || !keys.length) return false;
  const keySet = new Set(keys.map((k) => String(k).trim().toLowerCase()));
  const candidates = [
    idea.project_id,
    idea.projectId,
    idea.project,
    idea.project_slug,
    idea.projectSlug,
  ]
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => String(v).trim().toLowerCase());
  return candidates.some((c) => keySet.has(c));
}

/**
 * Map a rich form payload into columns that exist on the base ideas table
 * (see supabase_schema.sql) plus optional project_id.
 */
export function buildSafeIdeaPayload(raw = {}) {
  const asText = (v) => {
    if (v == null) return null;
    if (typeof v === 'string') return v.trim() || null;
    if (Array.isArray(v)) {
      const joined = v
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (item && typeof item === 'object') {
            return [item.name, item.description].filter(Boolean).join(': ');
          }
          return String(item);
        })
        .filter(Boolean)
        .join('\n');
      return joined || null;
    }
    if (typeof v === 'object') {
      try {
        return JSON.stringify(v);
      } catch {
        return null;
      }
    }
    return String(v);
  };

  const payload = {
    title: (raw.title || '').trim(),
    summary: asText(raw.summary),
    description: asText(raw.description),
    category: asText(raw.category) || 'Idea',
    votes: typeof raw.votes === 'number' ? raw.votes : 0,
    tags: asText(raw.tags),
    inspiration: asText(raw.inspiration),
    twitch_integration: asText(
      raw.twitch_integration ?? raw.twitchIntegration
    ),
    multiplayer_type: asText(raw.multiplayer_type ?? raw.multiplayerType),
    visual_style: asText(raw.visual_style ?? raw.visualStyle),
    environmental_storytelling: asText(
      raw.environmental_storytelling ?? raw.environmentalStorytelling
    ),
    progression_system: asText(
      raw.progression_system ??
        [raw.progressionType, raw.progressionDetails, raw.progression_type, raw.progression_details]
          .filter(Boolean)
          .join('\n')
    ),
    economy_description: asText(
      raw.economy_description ??
        [raw.economyResource, raw.economyTrading, raw.economy_resource, raw.economy_trading]
          .filter(Boolean)
          .join('\n')
    ),
    story_overview: asText(raw.story_overview ?? raw.storyOverview),
    endgame_potential: asText(
      raw.endgame_potential ?? raw.endgameDetails ?? raw.endgame_details
    ),
    additional_notes: asText(
      raw.additional_notes ?? raw.additionalNotes ?? raw.enemies
    ),
    user_id: raw.user_id || null,
  };

  const projectId = raw.project_id ?? raw.projectId ?? null;
  if (projectId != null && String(projectId).trim()) {
    payload.project_id = String(projectId).trim();
  }

  // Drop nulls so we don't trip optional column issues
  Object.keys(payload).forEach((k) => {
    if (payload[k] === null || payload[k] === undefined) {
      delete payload[k];
    }
  });

  return payload;
}

function isMissingColumnError(error, column) {
  const msg = error?.message || String(error || '');
  const details = error?.details || '';
  const hint = error?.hint || '';
  const blob = `${msg} ${details} ${hint}`.toLowerCase();
  return (
    blob.includes(column.toLowerCase()) &&
    (blob.includes('column') ||
      blob.includes('schema cache') ||
      blob.includes('could not find'))
  );
}

export const ideasService = {
  async getProfilesByIds(userIds = []) {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (ids.length === 0) return {};

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', ids);

    if (error) {
      console.warn('[ideasService.getProfilesByIds]', error);
      return {};
    }
    return buildProfileMap(data || []);
  },

  async _withCreators(ideas = []) {
    const list = ideas || [];
    const profileMap = await this.getProfilesByIds(list.map((i) => i.user_id));
    return attachCreators(list, profileMap);
  },

  async getAllIdeas() {
    const { data, error } = await supabase
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  /**
   * Ideas with creator: { username, avatar_url, avatarUrl }.
   */
  async getAllIdeasWithCreators() {
    const { data, error } = await supabase
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return this._withCreators(data || []);
  },

  /**
   * Comment counts keyed by idea_id (for listing cards / "most discussed").
   */
  async getCommentCounts() {
    const { data, error } = await supabase.from('comments').select('idea_id');
    if (error) {
      console.warn('[ideasService.getCommentCounts]', error);
      return {};
    }
    const counts = {};
    for (const row of data || []) {
      if (row.idea_id == null) continue;
      counts[row.idea_id] = (counts[row.idea_id] || 0) + 1;
    }
    return counts;
  },

  /**
   * Full listing payload for the global Ideas hub.
   */
  async getIdeasListing() {
    const [ideas, commentCounts] = await Promise.all([
      this.getAllIdeasWithCreators(),
      this.getCommentCounts(),
    ]);
    return {
      ideas: (ideas || []).map((idea) => ({
        ...idea,
        commentCount: commentCounts[idea.id] || 0,
      })),
      commentCounts,
    };
  },

  /**
   * Single idea with creator profile.
   */
  async getIdeaWithCreator(ideaId) {
    const { data, error } = await supabase
      .from('ideas')
      .select('*')
      .eq('id', ideaId)
      .single();
    if (error) throw error;
    if (!data) return null;

    if (!data.user_id) {
      return { ...data, creator: null };
    }

    const profileMap = await this.getProfilesByIds([data.user_id]);
    return {
      ...data,
      creator: profileMap[data.user_id] || mapProfile(null, 'Member'),
    };
  },

  /**
   * Threaded comments with author profiles (avatar_url included).
   */
  async getCommentsWithProfiles(ideaId) {
    const { data: commentsData, error } = await supabase
      .from('comments')
      .select('id, content, created_at, user_id, parent_id')
      .eq('idea_id', ideaId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const comments = commentsData || [];
    const profileMap = await this.getProfilesByIds(
      comments.map((c) => c.user_id)
    );

    return attachCommentProfiles(
      comments.map((c) => ({ ...c, votes: c.votes || 0 })),
      profileMap
    );
  },

  /**
   * Recent community ideas (not project-scoped). Prefer getIdeasForProject for workspaces.
   */
  async getRecentIdeasWithCreators({ limit = 8 } = {}) {
    let { data, error } = await supabase
      .from('ideas')
      .select('*')
      .order('votes', { ascending: false })
      .limit(limit);

    if (error) {
      const fallback = await supabase
        .from('ideas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (fallback.error) throw fallback.error;
      data = fallback.data;
    }

    return this._withCreators(data || []);
  },

  /**
   * Ideas linked to a project (project_id matches slug and/or uuid).
   * Falls back to client-side filtering if the column is missing or the
   * server filter returns nothing while client matches exist.
   */
  async getIdeasForProject(projectKey) {
    const keys = normalizeProjectKeys(projectKey);
    if (keys.length === 0) {
      console.warn('[ideasService.getIdeasForProject] no project keys');
      return [];
    }

    // --- Prefer server-side filter ---
    try {
      let query = supabase.from('ideas').select('*');
      if (keys.length === 1) {
        query = query.eq('project_id', keys[0]);
      } else {
        query = query.in('project_id', keys);
      }

      const { data, error } = await query.order('created_at', {
        ascending: false,
      });

      if (error) throw error;

      if ((data || []).length > 0) {
        return this._withCreators(data);
      }

      // Empty from server: verify with a full scan in case of key mismatch
      // (e.g. stored uuid vs slug, whitespace). If still empty, return [].
      const { data: all, error: allErr } = await supabase
        .from('ideas')
        .select('*')
        .order('created_at', { ascending: false });

      if (allErr) {
        console.warn(
          '[ideasService.getIdeasForProject] full scan after empty filter failed',
          allErr
        );
        return [];
      }

      const filtered = (all || []).filter((idea) =>
        ideaMatchesProject(idea, keys)
      );
      return this._withCreators(filtered);
    } catch (err) {
      console.warn(
        '[ideasService.getIdeasForProject] server filter failed, client fallback',
        err
      );

      // Column missing or query error → fetch all and filter in JS
      const { data: all, error: allErr } = await supabase
        .from('ideas')
        .select('*')
        .order('created_at', { ascending: false });

      if (allErr) throw allErr;

      const filtered = (all || []).filter((idea) =>
        ideaMatchesProject(idea, keys)
      );
      return this._withCreators(filtered);
    }
  },

  /**
   * Insert a new idea. Uses a schema-safe payload and retries without
   * project_id if that column is not migrated yet.
   */
  async createIdea(idea) {
    const payload = buildSafeIdeaPayload(idea);

    if (!payload.title) {
      throw new Error('Title is required.');
    }

    const attempt = async (body) => {
      const { data, error } = await supabase
        .from('ideas')
        .insert([body])
        .select()
        .single();
      return { data, error };
    };

    let { data, error } = await attempt(payload);

    // Retry without project_id if the column is missing
    if (error && payload.project_id && isMissingColumnError(error, 'project_id')) {
      console.warn(
        '[ideasService.createIdea] project_id column missing — retrying without it. Run supabase_ideas_project_id.sql'
      );
      const { project_id: _drop, ...withoutProject } = payload;
      ({ data, error } = await attempt(withoutProject));
      if (!error && data) {
        // Attach pseudo project_id for client navigation/display
        data = { ...data, project_id: payload.project_id, _project_id_not_persisted: true };
      }
    }

    // Retry with absolute minimum columns if still failing on unknown fields
    if (error) {
      console.warn('[ideasService.createIdea] retrying minimal payload', error);
      const minimal = {
        title: payload.title,
        summary: payload.summary || null,
        description: payload.description || null,
        category: payload.category || 'Idea',
        votes: 0,
        user_id: payload.user_id || null,
      };
      if (payload.project_id) minimal.project_id = payload.project_id;

      let retry = await attempt(minimal);
      if (
        retry.error &&
        minimal.project_id &&
        isMissingColumnError(retry.error, 'project_id')
      ) {
        const { project_id: _drop, ...minNoProject } = minimal;
        retry = await attempt(minNoProject);
        if (!retry.error && retry.data) {
          retry.data = {
            ...retry.data,
            project_id: payload.project_id,
            _project_id_not_persisted: true,
          };
        }
      }
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('[ideasService.createIdea] failed', error, payload);
      throw new Error(error.message || 'Failed to create idea');
    }

    return data;
  },

  async _bumpIdeaVotes(ideaId, delta) {
    const id = Number(ideaId);
    if (!Number.isFinite(id) || !delta) return;

    if (delta > 0) {
      const { error: rpcError } = await supabase.rpc('increment_vote', {
        idea_id: id,
      });
      if (!rpcError) return;
    }

    const { data: row } = await supabase
      .from('ideas')
      .select('votes')
      .eq('id', id)
      .maybeSingle();
    const current = row?.votes || 0;
    const next = Math.max(0, current + delta);
    const patch = { votes: next };
    if (delta > 0) patch.last_vote_time = new Date().toISOString();
    const { error } = await supabase.from('ideas').update(patch).eq('id', id);
    if (error) {
      console.warn('[ideasService._bumpIdeaVotes]', error);
    }
  },

  /**
   * Add a user vote. Idempotent: if the vote row already exists, succeeds
   * without double-incrementing (prevents re-like flicker after race).
   * Own ideas are allowed.
   */
  async addVote(ideaId, userId) {
    const id = Number(ideaId);
    if (!userId) throw new Error('You must be signed in to vote.');
    if (!Number.isFinite(id)) throw new Error('Invalid idea id.');

    const { error: insertError } = await supabase
      .from('votes')
      .insert([{ idea_id: id, user_id: userId }]);

    if (insertError) {
      // Already voted — treat as success (UI already shows liked)
      if (
        insertError.code === '23505' ||
        /duplicate|unique/i.test(insertError.message || '')
      ) {
        return { ok: true, alreadyHad: true };
      }
      throw insertError;
    }

    await this._bumpIdeaVotes(id, +1);
    return { ok: true, alreadyHad: false };
  },

  /**
   * Remove a user vote. Idempotent if no row existed.
   */
  async removeVote(ideaId, userId) {
    const id = Number(ideaId);
    if (!userId) throw new Error('You must be signed in.');
    if (!Number.isFinite(id)) throw new Error('Invalid idea id.');

    // Check existence first so we only decrement when a row is removed
    const { data: existing } = await supabase
      .from('votes')
      .select('id')
      .eq('idea_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      return { ok: true, removed: false };
    }

    const { error } = await supabase
      .from('votes')
      .delete()
      .eq('idea_id', id)
      .eq('user_id', userId);
    if (error) throw error;

    await this._bumpIdeaVotes(id, -1);
    return { ok: true, removed: true };
  },

  /**
   * Toggle vote for a user. Server is source of truth for the votes row;
   * count bump is best-effort. Returns { voted: boolean }.
   */
  async toggleVote(ideaId, userId, currentlyVoted) {
    if (currentlyVoted) {
      await this.removeVote(ideaId, userId);
      return { voted: false };
    }
    await this.addVote(ideaId, userId);
    return { voted: true };
  },
};

export default ideasService;
