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
 * Build guided_data JSONB from the guided wizard / edit form.
 *
 * Multi-entry: features (array of {name, description}), additional_notes (string[])
 * Single optional: twitch_community, environmental_storytelling, economy_system, story_narrative
 */
export function buildGuidedData(raw = {}) {
  const existing =
    raw.guided_data && typeof raw.guided_data === 'object' && !Array.isArray(raw.guided_data)
      ? raw.guided_data
      : {};

  const trim = (v) => {
    if (v == null) return null;
    const s = String(v).trim();
    return s || null;
  };

  // Features: prefer form array, then guided_data, filter empties
  let features = [];
  if (Array.isArray(raw.features)) {
    features = raw.features
      .map((f) => {
        if (typeof f === 'string') {
          const t = f.trim();
          return t ? { name: '', description: t } : null;
        }
        if (f && typeof f === 'object') {
          const name = trim(f.name) || '';
          const description = trim(f.description) || '';
          if (!name && !description) return null;
          return { name, description };
        }
        return null;
      })
      .filter(Boolean);
  } else if (Array.isArray(existing.features)) {
    features = existing.features
      .map((f) => {
        if (typeof f === 'string') {
          const t = f.trim();
          return t ? { name: '', description: t } : null;
        }
        if (f && (f.name || f.description)) {
          return {
            name: trim(f.name) || '',
            description: trim(f.description) || '',
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  // Additional notes: string array
  let notes = [];
  const notesRaw = raw.additionalNotes ?? raw.additional_notes ?? existing.additional_notes;
  if (Array.isArray(notesRaw)) {
    notes = notesRaw.map((n) => String(n || '').trim()).filter(Boolean);
  } else if (typeof notesRaw === 'string' && notesRaw.trim()) {
    notes = [notesRaw.trim()];
  }

  const single = (formKey, snakeKey, legacyKeys = []) => {
    const candidates = [
      raw[formKey],
      raw[snakeKey],
      existing[snakeKey],
      ...legacyKeys.map((k) => raw[k] ?? existing[k]),
    ];
    for (const c of candidates) {
      const t = trim(c);
      if (t) return t;
    }
    return null;
  };

  const guided = {
    features: features.length ? features : null,
    twitch_community: single('twitchIntegration', 'twitch_community', [
      'twitch_integration',
      'twitchIntegration',
    ]),
    environmental_storytelling: single(
      'environmentalStorytelling',
      'environmental_storytelling'
    ),
    economy_system: single('economySystem', 'economy_system', [
      'economy_description',
      'economyResource',
      'economy_resource',
    ]),
    story_narrative: single('storyNarrative', 'story_narrative', [
      'story_overview',
      'storyOverview',
    ]),
    additional_notes: notes.length ? notes : null,
    wizard_version: 2,
  };

  Object.keys(guided).forEach((k) => {
    if (guided[k] === null || guided[k] === undefined || guided[k] === '') {
      if (k !== 'wizard_version') delete guided[k];
    }
  });

  return guided;
}

/**
 * Map a rich form payload into columns that exist on the base ideas table
 * (see supabase_schema.sql) plus optional project_id, status, guided_data.
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

  // Prefer explicit guided_data from caller; otherwise build from form fields
  const guided =
    raw.guided_data && typeof raw.guided_data === 'object' && !Array.isArray(raw.guided_data)
      ? { ...buildGuidedData({ ...raw, guided_data: undefined }), ...raw.guided_data }
      : buildGuidedData(raw);

  const description = asText(raw.description);

  const payload = {
    title: (raw.title || '').trim(),
    summary: asText(raw.summary),
    description,
    category: asText(raw.category) || 'Idea',
    votes: typeof raw.votes === 'number' ? raw.votes : 0,
    tags: asText(raw.tags),
    // Mirror optional guided fields into legacy flat columns when present
    twitch_integration: asText(
      raw.twitch_integration ?? raw.twitchIntegration ?? guided.twitch_community
    ),
    environmental_storytelling: asText(
      raw.environmental_storytelling ??
        raw.environmentalStorytelling ??
        guided.environmental_storytelling
    ),
    economy_description: asText(
      raw.economy_description ?? raw.economySystem ?? guided.economy_system
    ),
    story_overview: asText(
      raw.story_overview ?? raw.storyNarrative ?? guided.story_narrative
    ),
    additional_notes: asText(
      raw.additional_notes ??
        raw.additionalNotes ??
        (Array.isArray(guided.additional_notes)
          ? guided.additional_notes.join('\n')
          : null)
    ),
    // Workflow: default Proposed for new ideas
    status: asText(raw.status) || 'Proposed',
    guided_data: guided,
    user_id: raw.user_id || null,
  };

  if (Array.isArray(guided.features) && guided.features.length) {
    payload.features = guided.features;
  } else if (Array.isArray(raw.features) && raw.features.length) {
    payload.features = raw.features.filter(
      (f) => f && (f.name || f.description || (typeof f === 'string' && f.trim()))
    );
  }

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
   * Threaded comments with author profiles + like counts from comment_likes.
   */
  async getCommentsWithProfiles(ideaId) {
    let commentsData = null;
    let error = null;

    // Prefer parent_id for threads; fall back if column missing
    ({ data: commentsData, error } = await supabase
      .from('comments')
      .select('id, content, created_at, user_id, parent_id')
      .eq('idea_id', ideaId)
      .order('created_at', { ascending: true }));

    if (error && isMissingColumnError(error, 'parent_id')) {
      ({ data: commentsData, error } = await supabase
        .from('comments')
        .select('id, content, created_at, user_id')
        .eq('idea_id', ideaId)
        .order('created_at', { ascending: true }));
    }

    if (error) throw error;

    const comments = commentsData || [];
    const profileMap = await this.getProfilesByIds(
      comments.map((c) => c.user_id)
    );

    // Aggregate likes
    const likeCounts = {};
    if (comments.length) {
      const ids = comments.map((c) => c.id);
      const { data: likes, error: likeErr } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .in('comment_id', ids);
      if (!likeErr && likes) {
        for (const row of likes) {
          likeCounts[row.comment_id] = (likeCounts[row.comment_id] || 0) + 1;
        }
      }
    }

    return attachCommentProfiles(
      comments.map((c) => ({
        ...c,
        parent_id: c.parent_id ?? null,
        votes: likeCounts[c.id] || 0,
      })),
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
   * Strip optional columns one-by-one when the remote schema is missing them.
   * Order: features → guided_data → status → project_id.
   */
  _stripOptionalColumns(payload, error) {
    if (!error || !payload) return { payload, stripped: null };
    const optional = ['features', 'guided_data', 'status', 'project_id'];
    for (const col of optional) {
      if (payload[col] !== undefined && isMissingColumnError(error, col)) {
        const next = { ...payload };
        delete next[col];
        return { payload: next, stripped: col };
      }
    }
    return { payload, stripped: null };
  },

  /**
   * Insert a new idea. Uses a schema-safe payload and retries without
   * optional columns (guided_data, status, project_id, features) if missing.
   */
  async createIdea(idea) {
    let payload = buildSafeIdeaPayload(idea);

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

    let data = null;
    let error = null;
    let meta = {
      _project_id_not_persisted: false,
      _guided_data_not_persisted: false,
      _status_not_persisted: false,
    };

    // Up to a few strip-and-retry cycles for missing columns
    for (let i = 0; i < 5; i++) {
      ({ data, error } = await attempt(payload));
      if (!error) break;

      const { payload: next, stripped } = this._stripOptionalColumns(payload, error);
      if (!stripped) break;

      console.warn(
        `[ideasService.createIdea] column "${stripped}" missing — retrying without it. Run supabase_ideas_guided.sql`
      );
      if (stripped === 'project_id') meta._project_id_not_persisted = true;
      if (stripped === 'guided_data') meta._guided_data_not_persisted = true;
      if (stripped === 'status') meta._status_not_persisted = true;
      payload = next;
    }

    // Retry with absolute minimum columns if still failing
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
      if (payload.status) minimal.status = payload.status;

      let body = minimal;
      for (let i = 0; i < 4; i++) {
        const retry = await attempt(body);
        data = retry.data;
        error = retry.error;
        if (!error) break;
        const { payload: next, stripped } = this._stripOptionalColumns(body, error);
        if (!stripped) break;
        if (stripped === 'project_id') meta._project_id_not_persisted = true;
        body = next;
      }
    }

    if (error) {
      console.error('[ideasService.createIdea] failed', error, payload);
      throw new Error(error.message || 'Failed to create idea');
    }

    // Re-attach pseudo fields for client navigation when not persisted
    if (meta._project_id_not_persisted && idea.project_id) {
      data = {
        ...data,
        project_id: idea.project_id || idea.projectId,
        _project_id_not_persisted: true,
      };
    }
    if (meta._guided_data_not_persisted) {
      data = { ...data, _guided_data_not_persisted: true };
    }
    if (meta._status_not_persisted) {
      data = { ...data, status: 'Proposed', _status_not_persisted: true };
    }

    return data;
  },

  // -------------------------------------------------------------------------
  // VOTES — simple insert / delete + recount (no RPC)
  // Requires supabase_votes_rls.sql (SELECT + DELETE policies, unique index).
  // -------------------------------------------------------------------------

  /** @private */
  _toIdeaId(ideaId) {
    const id = Number(ideaId);
    if (!Number.isFinite(id)) {
      throw new Error(`Invalid idea id: ${ideaId}`);
    }
    return id;
  },

  /**
   * Count votes for an idea from the votes table.
   */
  async getIdeaVoteCount(ideaId) {
    const id = this._toIdeaId(ideaId);
    const { count, error } = await supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('idea_id', id);

    if (error) {
      console.warn('[votes] getIdeaVoteCount failed', error);
      // Fallback: denormalized column
      const { data } = await supabase
        .from('ideas')
        .select('votes')
        .eq('id', id)
        .maybeSingle();
      return Math.max(0, Number(data?.votes) || 0);
    }
    return Math.max(0, typeof count === 'number' ? count : 0);
  },

  /**
   * Does this user currently have a vote row for the idea?
   */
  async userHasVoted(ideaId, userId) {
    if (!userId) return false;
    const id = this._toIdeaId(ideaId);
    const { data, error } = await supabase
      .from('votes')
      .select('id')
      .eq('idea_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116') return false;
      console.warn('[votes] userHasVoted failed', error);
      // If SELECT is blocked by RLS, this will always be false until SQL is applied
      return false;
    }
    return !!data;
  },

  /**
   * All idea ids the user has voted on (string keys).
   */
  async getUserVotedIdeaIds(userId) {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('votes')
      .select('idea_id')
      .eq('user_id', userId);

    if (error) {
      console.warn('[votes] getUserVotedIdeaIds failed', error);
      return [];
    }
    return (data || [])
      .map((row) => (row.idea_id == null ? null : String(row.idea_id)))
      .filter(Boolean);
  },

  /**
   * Single toggle entry point used by listing + detail.
   *
   * Pattern:
   *  1. SELECT existing vote for (idea, user)
   *  2. DELETE if exists, else INSERT
   *  3. COUNT votes for idea
   *  4. Return { voted, votes }
   */
  async toggleVote(ideaId, userId) {
    if (!userId) throw new Error('You must be signed in to vote.');
    const id = this._toIdeaId(ideaId);

    console.log('[votes] toggle start', { ideaId: id, userId });

    // 1) current state
    const { data: existing, error: findError } = await supabase
      .from('votes')
      .select('id')
      .eq('idea_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') {
      console.error('[votes] find existing failed', findError);
      throw findError;
    }

    const hadVote = !!existing;
    console.log('[votes] hadVote', hadVote, existing);

    // 2) mutate
    if (hadVote) {
      const { error: delError } = await supabase
        .from('votes')
        .delete()
        .eq('idea_id', id)
        .eq('user_id', userId);
      if (delError) {
        console.error('[votes] delete failed', delError);
        throw delError;
      }
      console.log('[votes] deleted vote row');
    } else {
      const { error: insError } = await supabase
        .from('votes')
        .insert([{ idea_id: id, user_id: userId }]);
      if (insError) {
        // Duplicate: treat as already voted (unique index)
        if (
          insError.code === '23505' ||
          /duplicate|unique/i.test(insError.message || '')
        ) {
          console.warn('[votes] insert duplicate — already voted');
        } else {
          console.error('[votes] insert failed', insError);
          throw insError;
        }
      } else {
        console.log('[votes] inserted vote row');
      }
    }

    // 3) re-read truth from server
    const [voted, votes] = await Promise.all([
      this.userHasVoted(id, userId),
      this.getIdeaVoteCount(id),
    ]);

    // Best-effort denormalized count (trigger should also do this)
    try {
      await supabase.from('ideas').update({ votes }).eq('id', id);
    } catch (e) {
      console.warn('[votes] ideas.votes update skipped', e);
    }

    const result = { voted: !!voted, votes: Math.max(0, votes || 0) };
    console.log('[votes] toggle result', result);
    return result;
  },

  /** @deprecated use toggleVote — kept for call sites during transition */
  async toggleVoteAndSync(ideaId, userId) {
    return this.toggleVote(ideaId, userId);
  },

  /** @deprecated */
  async addVote(ideaId, userId) {
    const id = this._toIdeaId(ideaId);
    const { error } = await supabase
      .from('votes')
      .insert([{ idea_id: id, user_id: userId }]);
    if (
      error &&
      error.code !== '23505' &&
      !/duplicate|unique/i.test(error.message || '')
    ) {
      throw error;
    }
    const votes = await this.getIdeaVoteCount(id);
    return { ok: true, votes };
  },

  /** @deprecated */
  async removeVote(ideaId, userId) {
    const id = this._toIdeaId(ideaId);
    const { error } = await supabase
      .from('votes')
      .delete()
      .eq('idea_id', id)
      .eq('user_id', userId);
    if (error) throw error;
    const votes = await this.getIdeaVoteCount(id);
    return { ok: true, votes };
  },
};

export default ideasService;
