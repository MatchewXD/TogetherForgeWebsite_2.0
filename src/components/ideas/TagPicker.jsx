/**
 * Shared hybrid tag selection UI for Ideas.
 * Large scrollable modal, multi-column grid, usage-sorted public tags.
 * Optional free-form suggest (does not make tag public immediately).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Plus, Search, Tag, X } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Buttons';
import { ideaTagsService } from '../../services/ideaTagsService';
import {
  TAG_MAX_LENGTH,
  TAG_MAX_PER_IDEA,
  TAG_PROMOTION_THRESHOLD,
} from '../../constants/ideaTags';
import {
  isTagPubliclySelectable,
  normalizeTagName,
  slugifyTag,
  sortTagsByUsage,
  uniqueTagNames,
} from '../../utils/ideaTags';

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   selected: string[],
 *   onChange: (names: string[]) => void,
 *   mode?: 'filter' | 'edit',
 *   title?: string,
 *   ideasFallback?: Array,
 *   maxSelected?: number,
 *   allowSuggest?: boolean,
 * }} props
 */
export default function TagPicker({
  isOpen,
  onClose,
  selected = [],
  onChange,
  mode = 'edit',
  title,
  ideasFallback = [],
  maxSelected = TAG_MAX_PER_IDEA,
  allowSuggest,
}) {
  const canSuggest = allowSuggest ?? mode === 'edit';
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [busySuggest, setBusySuggest] = useState(false);
  const [hint, setHint] = useState('');
  const [localSelected, setLocalSelected] = useState(selected);

  // Sync selection when opening
  useEffect(() => {
    if (isOpen) {
      setLocalSelected(uniqueTagNames(selected));
      setQuery('');
      setDraft('');
      setHint('');
    }
  }, [isOpen, selected]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await ideaTagsService.listPublicTags({
        ideasFallback,
        // Keep currently applied filter tags visible even if not public
        extraSelected: mode === 'filter' ? selected : [],
      });
      setCatalog(list);
    } catch (e) {
      console.warn('[TagPicker] load', e);
      setCatalog([]);
    } finally {
      setLoading(false);
    }
  }, [ideasFallback, mode, selected]);

  useEffect(() => {
    if (!isOpen) return;
    void load();
    // Load once when opened (selected is snapshotted at open)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const selectedSlugs = useMemo(
    () => new Set(localSelected.map((t) => slugifyTag(t))),
    [localSelected]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = catalog;
    if (q) {
      list = list.filter(
        (t) =>
          String(t.name || '')
            .toLowerCase()
            .includes(q) ||
          String(t.slug || '').includes(q)
      );
    }
    return sortTagsByUsage(list);
  }, [catalog, query]);

  const toggle = (name) => {
    const n = normalizeTagName(name);
    const slug = slugifyTag(n);
    if (!slug) return;

    setLocalSelected((prev) => {
      const has = prev.some((t) => slugifyTag(t) === slug);
      if (has) {
        setHint('');
        return prev.filter((t) => slugifyTag(t) !== slug);
      }
      if (prev.length >= maxSelected) {
        setHint(`You can select up to ${maxSelected} tags.`);
        return prev;
      }
      setHint('');
      return [...prev, n];
    });
  };

  const applyAndClose = () => {
    onChange?.(uniqueTagNames(localSelected));
    onClose?.();
  };

  const clearAll = () => {
    setLocalSelected([]);
    setHint('');
  };

  const suggestAndSelect = async () => {
    if (!canSuggest) return;
    const name = normalizeTagName(draft);
    if (!name) return;
    if (name.length > TAG_MAX_LENGTH) {
      setHint(`Tags are limited to ${TAG_MAX_LENGTH} characters.`);
      return;
    }
    const slug = slugifyTag(name);
    if (selectedSlugs.has(slug)) {
      setHint(`#${name} is already selected.`);
      setDraft('');
      return;
    }
    if (localSelected.length >= maxSelected) {
      setHint(`You can select up to ${maxSelected} tags.`);
      return;
    }

    setBusySuggest(true);
    setHint('');
    try {
      const row = await ideaTagsService.suggestTag(name);
      // Attach to this idea only — not public unless already selectable
      setLocalSelected((prev) => uniqueTagNames([...prev, row?.name || name]));
      setDraft('');
      if (row && isTagPubliclySelectable(row)) {
        setHint(`#${row.name} is already in the public list.`);
        // Refresh so it appears in grid
        void load();
      } else {
        setHint(
          `#${name} added to this idea. It becomes publicly selectable after staff approval or use on ${TAG_PROMOTION_THRESHOLD} ideas.`
        );
      }
    } catch (e) {
      setHint(e?.message || 'Could not suggest tag.');
    } finally {
      setBusySuggest(false);
    }
  };

  const heading =
    title ||
    (mode === 'filter' ? 'Filter by tags' : 'Select tags');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={heading} size="xl">
      <div className="space-y-4 -mt-1">
        <p className="text-sm text-text-secondary leading-relaxed">
          {mode === 'filter' ? (
            <>
              Choose tags to filter ideas (any match). Tags are sorted by how
              often they appear. Low-quality one-offs stay off this list until
              they earn a place.
            </>
          ) : (
            <>
              Pick from high-quality community tags, or suggest a new one for
              this idea. Suggested tags are not listed publicly until approved
              or used on at least {TAG_PROMOTION_THRESHOLD} ideas.
            </>
          )}
        </p>

        {/* Selected chips */}
        <div className="flex flex-wrap gap-2 min-h-[2rem]">
          {localSelected.length === 0 ? (
            <span className="text-xs text-text-muted">No tags selected</span>
          ) : (
            localSelected.map((t) => (
              <button
                key={slugifyTag(t)}
                type="button"
                onClick={() => toggle(t)}
                className="inline-flex items-center gap-1.5 text-xs font-mono rounded-full border border-neon-purple/45 bg-neon-purple/15 text-neon-purple px-2.5 py-1 hover:bg-neon-purple/25"
              >
                #{t}
                <X className="w-3 h-3 opacity-80" />
              </button>
            ))
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search available tags…"
            className="w-full bg-cyber-surface border border-cyber-border rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-neon-cyan"
          />
        </div>

        {/* Grid */}
        <div className="task-scroll rounded-xl border border-cyber-border bg-cyber-surface/40 max-h-[min(50vh,22rem)] overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-text-muted text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading tags…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-10 px-4">
              {query
                ? 'No public tags match that search.'
                : 'No public tags yet. Curated tags appear after the catalog is installed, or suggest a tag below.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {filtered.map((tag) => {
                const active = selectedSlugs.has(slugifyTag(tag.name));
                const usage = Number(tag.usage_count) || 0;
                return (
                  <button
                    key={tag.id || tag.slug}
                    type="button"
                    onClick={() => toggle(tag.name)}
                    className={`group flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors min-h-[3.25rem] ${
                      active
                        ? 'border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan'
                        : 'border-white/10 bg-cyber-card/60 text-text-secondary hover:border-neon-cyan/35 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 w-full min-w-0">
                      {active ? (
                        <Check className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Tag className="w-3.5 h-3.5 shrink-0 opacity-50 group-hover:opacity-80" />
                      )}
                      <span className="text-sm font-medium truncate">
                        #{tag.name}
                      </span>
                    </span>
                    <span className="text-[10px] font-mono text-text-muted pl-5">
                      {usage} use{usage === 1 ? '' : 's'}
                      {tag.status === 'curated' ? ' · core' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Suggest new (edit mode) */}
        {canSuggest && (
          <div className="rounded-lg border border-dashed border-white/15 bg-cyber-bg/40 p-3 space-y-2">
            <p className="text-[11px] font-mono tracking-widest uppercase text-text-muted">
              Suggest a new tag
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={TAG_MAX_LENGTH}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void suggestAndSelect();
                  }
                }}
                placeholder="Type a new tag for this idea…"
                className="flex-1 min-w-0 bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-neon-purple/50"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busySuggest || !draft.trim()}
                onClick={() => void suggestAndSelect()}
                className="gap-1.5 shrink-0"
              >
                {busySuggest ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add
              </Button>
            </div>
          </div>
        )}

        {hint && (
          <p
            role="status"
            className="text-xs text-neon-cyan/90 leading-relaxed border border-neon-cyan/25 bg-neon-cyan/5 rounded-lg px-3 py-2"
          >
            {hint}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-cyber-border">
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-text-muted hover:text-white font-mono"
            disabled={localSelected.length === 0}
          >
            Clear selection
          </button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={applyAndClose}>
              {mode === 'filter'
                ? `Apply${localSelected.length ? ` (${localSelected.length})` : ''}`
                : `Done${localSelected.length ? ` (${localSelected.length})` : ''}`}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
