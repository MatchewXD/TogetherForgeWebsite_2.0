/**
 * Hybrid idea tags catalog + admin operations.
 * Requires supabase/sql/supabase_idea_tags.sql for full features.
 * Degrades gracefully when the table/RPCs are missing.
 */
import { supabase } from '../lib/supabase';
import { TAG_PROMOTION_THRESHOLD, TAG_STATUS } from '../constants/ideaTags';
import {
  buildFallbackPublicTags,
  isTagPubliclySelectable,
  mapIdeaTagRow,
  normalizeTagName,
  serializeTags,
  slugifyTag,
  sortTagsByUsage,
  uniqueTagNames,
} from '../utils/ideaTags';
import { parseTags } from '../utils/ideaStatus';

let catalogMissingLogged = false;

function isMissingRelation(err) {
  const msg = String(err?.message || err || '');
  const code = String(err?.code || '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /relation .* does not exist|could not find the table|schema cache/i.test(msg)
  );
}

function isMissingRpc(err) {
  const msg = String(err?.message || err || '');
  const code = String(err?.code || '');
  return (
    code === 'PGRST202' ||
    /function .* does not exist|could not find the function/i.test(msg)
  );
}

function warnMissing(context, err) {
  if (catalogMissingLogged) return;
  if (isMissingRelation(err) || isMissingRpc(err)) {
    catalogMissingLogged = true;
    console.warn(
      `[ideaTags] ${context}: run supabase/sql/supabase_idea_tags.sql — falling back to client-side public tags.`,
      err?.message || err
    );
  } else {
    console.warn(`[ideaTags] ${context}`, err);
  }
}

export const ideaTagsService = {
  TAG_PROMOTION_THRESHOLD,

  /**
   * Public selectable tags for pickers / filters (usage-sorted).
   * @param {{ ideasFallback?: Array, extraSelected?: string[] }} [opts]
   */
  async listPublicTags(opts = {}) {
    const { ideasFallback = [], extraSelected = [] } = opts;
    try {
      const { data, error } = await supabase
        .from('idea_tags')
        .select(
          'id, slug, name, status, usage_count, created_at, updated_at'
        )
        .order('usage_count', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;

      const rows = (data || [])
        .map(mapIdeaTagRow)
        .filter((t) => isTagPubliclySelectable(t));

      // Keep currently selected filter tags visible even if not public
      const bySlug = new Map(rows.map((t) => [t.slug, t]));
      for (const name of extraSelected) {
        const n = normalizeTagName(name);
        const slug = slugifyTag(n);
        if (!slug || bySlug.has(slug)) continue;
        bySlug.set(slug, {
          id: `selected:${slug}`,
          slug,
          name: n,
          status: TAG_STATUS.SUGGESTED,
          usage_count: 0,
        });
      }

      return sortTagsByUsage([...bySlug.values()]);
    } catch (err) {
      warnMissing('listPublicTags', err);
      return buildFallbackPublicTags(ideasFallback, extraSelected);
    }
  },

  /**
   * Full catalog for staff (includes suggested / hidden).
   */
  async listAllTagsForAdmin() {
    try {
      const { data, error } = await supabase
        .from('idea_tags')
        .select(
          'id, slug, name, status, usage_count, suggested_by, approved_by, approved_at, hidden_at, notes, created_at, updated_at'
        )
        .order('usage_count', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []).map(mapIdeaTagRow);
    } catch (err) {
      warnMissing('listAllTagsForAdmin', err);
      throw new Error(
        err?.message ||
          'Could not load tags. Run supabase/sql/supabase_idea_tags.sql as admin.'
      );
    }
  },

  /**
   * Ensure each name exists as a catalog row (suggested if new), then recompute usage.
   * Safe no-op when SQL is not deployed.
   * @param {string|string[]} tags
   * @param {{ userId?: string|null }} [opts]
   */
  async syncTagsAfterSave(tags, opts = {}) {
    const names = uniqueTagNames(
      Array.isArray(tags) ? tags : parseTags(tags)
    );
    if (names.length === 0 && !opts.forceRecompute) {
      // Still recompute so removals drop usage
    }

    try {
      const { error } = await supabase.rpc('sync_idea_tags_after_save', {
        p_tag_names: names,
      });
      if (error) throw error;
      return { ok: true, names };
    } catch (err) {
      if (isMissingRpc(err) || isMissingRelation(err)) {
        warnMissing('syncTagsAfterSave', err);
        // Best-effort direct inserts
        try {
          for (const name of names) {
            const slug = slugifyTag(name);
            if (!slug) continue;
            await supabase.from('idea_tags').upsert(
              {
                slug,
                name: normalizeTagName(name),
                status: TAG_STATUS.SUGGESTED,
                suggested_by: opts.userId || null,
              },
              { onConflict: 'slug', ignoreDuplicates: true }
            );
          }
        } catch (e2) {
          warnMissing('syncTagsAfterSave upsert', e2);
        }
        return { ok: false, degraded: true, names };
      }
      console.warn('[ideaTags] syncTagsAfterSave', err);
      return { ok: false, error: err, names };
    }
  },

  /**
   * Client-side only ensure (no recompute) — used when suggesting a tag in UI.
   * Does not make the tag public.
   * @param {string} rawName
   * @param {{ userId?: string|null }} [opts]
   */
  async suggestTag(rawName, opts = {}) {
    const name = normalizeTagName(rawName);
    const slug = slugifyTag(name);
    if (!slug) throw new Error('Enter a valid tag name.');

    try {
      const { data, error } = await supabase.rpc('ensure_idea_tag', {
        p_name: name,
        p_as_curated: false,
      });
      if (error) throw error;
      return mapIdeaTagRow(data);
    } catch (err) {
      if (isMissingRpc(err)) {
        // Direct insert as suggested
        const { data, error } = await supabase
          .from('idea_tags')
          .upsert(
            {
              slug,
              name,
              status: TAG_STATUS.SUGGESTED,
              suggested_by: opts.userId || null,
            },
            { onConflict: 'slug' }
          )
          .select()
          .maybeSingle();
        if (error) {
          if (isMissingRelation(error)) {
            // Offline catalog: return ephemeral suggested tag
            return {
              id: `local:${slug}`,
              slug,
              name,
              status: TAG_STATUS.SUGGESTED,
              usage_count: 0,
              _local: true,
            };
          }
          throw error;
        }
        return mapIdeaTagRow(data) || {
          id: `local:${slug}`,
          slug,
          name,
          status: TAG_STATUS.SUGGESTED,
          usage_count: 0,
        };
      }
      throw err;
    }
  },

  async recomputeUsage() {
    const { data, error } = await supabase.rpc('recompute_idea_tag_usage');
    if (error) throw error;
    return data;
  },

  async approveTag(id) {
    const { data, error } = await supabase.rpc('admin_approve_idea_tag', {
      p_id: id,
    });
    if (error) throw error;
    return mapIdeaTagRow(data);
  },

  async hideTag(id) {
    const { data, error } = await supabase.rpc('admin_hide_idea_tag', {
      p_id: id,
    });
    if (error) throw error;
    return mapIdeaTagRow(data);
  },

  async unhideTag(id) {
    const { data, error } = await supabase.rpc('admin_unhide_idea_tag', {
      p_id: id,
    });
    if (error) throw error;
    return mapIdeaTagRow(data);
  },

  async renameTag(id, newName) {
    const { data, error } = await supabase.rpc('admin_rename_idea_tag', {
      p_id: id,
      p_new_name: newName,
    });
    if (error) throw error;
    return mapIdeaTagRow(data);
  },

  async mergeTags(sourceId, targetId) {
    const { data, error } = await supabase.rpc('admin_merge_idea_tags', {
      p_source_id: sourceId,
      p_target_id: targetId,
    });
    if (error) throw error;
    return mapIdeaTagRow(data);
  },

  async deleteTag(id) {
    const { error } = await supabase.rpc('admin_delete_idea_tag', {
      p_id: id,
    });
    if (error) throw error;
    return true;
  },

  /** Normalize + serialize helper for forms */
  formatTagsForSave(namesOrString) {
    if (Array.isArray(namesOrString)) return serializeTags(namesOrString);
    return serializeTags(parseTags(namesOrString));
  },
};

export default ideaTagsService;
