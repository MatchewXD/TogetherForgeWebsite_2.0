/**
 * Load / save studio phase page content (Early, Mid, Late).
 * Table: page_content (page_key text PK, content jsonb)
 */

import { supabase } from '../lib/supabase';
import {
  PHASE_IDEA_KEYS,
  EARLY_PHASE_DEFAULTS,
  EARLY_CONTENT_VERSION,
  MID_PHASE_DEFAULTS,
  LATE_PHASE_DEFAULTS,
  mergePhaseContent,
  isLegacyEarlyContent,
  sanitizePhaseContent,
} from '../utils/phasePageContent';
import { ideasService, isDraftIdea } from './ideasService';
import { parseTags } from '../utils/ideaStatus';

const DEFAULTS_BY_PHASE = {
  early: EARLY_PHASE_DEFAULTS,
  mid: MID_PHASE_DEFAULTS,
  late: LATE_PHASE_DEFAULTS,
};

export const phasePageService = {
  getDefaults(phase) {
    return DEFAULTS_BY_PHASE[phase] || {};
  },

  getPhaseMeta(phase) {
    return PHASE_IDEA_KEYS[phase] || null;
  },

  /**
   * @param {'early'|'mid'|'late'} phase
   * @returns {Promise<object>} merged content
   */
  async getPageContent(phase) {
    const meta = PHASE_IDEA_KEYS[phase];
    const defaults = this.getDefaults(phase);
    if (!meta) return mergePhaseContent(defaults, {});

    try {
      const { data, error } = await supabase
        .from('page_content')
        .select('content')
        .eq('page_key', meta.pageKey)
        .maybeSingle();
      if (error) {
        console.warn('[phasePageService.getPageContent]', error);
        return mergePhaseContent(defaults, {});
      }

      const raw = data?.content || {};

      // Early: ignore outdated/corrupt CMS rows so finalized copy always shows
      // until staff re-saves with contentVersion >= EARLY_CONTENT_VERSION.
      if (phase === 'early' && isLegacyEarlyContent(raw)) {
        // Preserve only active-project fields if they look intentional & clean
        const keepProject = {};
        if (
          raw.activeProjectTitle &&
          !/prototype\s*systems/i.test(String(raw.activeProjectTitle)) &&
          !/[*<>]/.test(String(raw.activeProjectTitle))
        ) {
          keepProject.activeProjectTitle = raw.activeProjectTitle;
        }
        if (
          raw.activeProjectSummary &&
          !/[*<>]/.test(String(raw.activeProjectSummary)) &&
          String(raw.activeProjectSummary).length > 40
        ) {
          keepProject.activeProjectSummary = raw.activeProjectSummary;
        }
        if (raw.activeProjectHref) {
          keepProject.activeProjectHref = raw.activeProjectHref;
        }
        if (raw.activeProjectStatus) {
          keepProject.activeProjectStatus = raw.activeProjectStatus;
        }
        return sanitizePhaseContent(
          { ...defaults, ...keepProject, contentVersion: EARLY_CONTENT_VERSION },
          defaults
        );
      }

      return mergePhaseContent(defaults, raw);
    } catch (err) {
      console.warn('[phasePageService.getPageContent]', err);
      return mergePhaseContent(defaults, {});
    }
  },

  /**
   * Staff-only upsert. RLS should enforce role on the server.
   * @param {'early'|'mid'|'late'} phase
   * @param {object} content structured content object
   */
  async savePageContent(phase, content) {
    const meta = PHASE_IDEA_KEYS[phase];
    if (!meta) throw new Error('Unknown phase');
    // Always persist sanitized structured content (no raw markdown/HTML)
    const defaults = this.getDefaults(phase);
    const clean = {
      ...mergePhaseContent(defaults, content || {}),
      contentVersion:
        phase === 'early'
          ? EARLY_CONTENT_VERSION
          : Number(content?.contentVersion) || 1,
    };
    const { data, error } = await supabase
      .from('page_content')
      .upsert(
        {
          page_key: meta.pageKey,
          content: clean,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'page_key' }
      )
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /**
   * Public ideas linked to a phase via project_id and/or tags.
   * Still appear on the global Ideas hub.
   */
  async getIdeasForPhase(phase, { limit = 24 } = {}) {
    const meta = PHASE_IDEA_KEYS[phase];
    if (!meta) return [];

    let ideas = [];
    try {
      ideas = await ideasService.getAllIdeasWithCreators();
    } catch (err) {
      console.warn('[phasePageService.getIdeasForPhase]', err);
      return [];
    }

    const projectSet = new Set(
      (meta.projectIds || []).map((k) => String(k).trim().toLowerCase())
    );
    const tagSet = new Set(
      (meta.tags || []).map((t) => String(t).trim().toLowerCase())
    );

    const matched = (ideas || []).filter((idea) => {
      if (!idea || isDraftIdea(idea)) return false;
      const pid = String(idea.project_id || idea.projectId || '')
        .trim()
        .toLowerCase();
      if (pid && projectSet.has(pid)) return true;
      const tags = parseTags(idea.tags).map((t) => t.toLowerCase());
      if (tags.some((t) => tagSet.has(t))) return true;
      // Also match tag tokens contained in multi-word tags
      if (
        tags.some((t) =>
          [...tagSet].some((key) => t === key || t.includes(key))
        )
      ) {
        return true;
      }
      return false;
    });

    return matched.slice(0, limit);
  },
};

export default phasePageService;
