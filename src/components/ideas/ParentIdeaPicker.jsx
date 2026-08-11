/**
 * Optional parent idea selector for create / edit.
 * One level deep: only root ideas can be parents.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, Loader2, Search, X } from 'lucide-react';
import { ideasService } from '../../services/ideasService';
import {
  canBeParentIdea,
  normalizeParentIdeaId,
} from '../../utils/ideaRelations';
import UserAvatar from '../ui/UserAvatar';

/**
 * @param {{
 *   value: string|number|null,
 *   onChange: (parentId: string) => void,
 *   excludeIdeaId?: number|null,
 *   disabled?: boolean,
 *   labelClass?: string,
 *   fieldClass?: string,
 * }} props
 */
export default function ParentIdeaPicker({
  value = '',
  onChange,
  excludeIdeaId = null,
  disabled = false,
  labelClass = 'block text-sm font-mono tracking-widest text-neon-cyan mb-2',
  fieldClass = 'w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-neon-cyan',
}) {
  const parentId = normalizeParentIdeaId(value);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMeta, setSelectedMeta] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await ideasService.listParentCandidates({
        excludeIdeaId,
        search: query,
        limit: 40,
      });
      setOptions(list);
    } catch (e) {
      console.warn('[ParentIdeaPicker]', e);
      setOptions([]);
      setError(
        e?.message ||
          'Could not load ideas. Related-parent linking may need supabase_idea_parent.sql.'
      );
    } finally {
      setLoading(false);
    }
  }, [excludeIdeaId, query]);

  useEffect(() => {
    if (!open) return undefined;
    const t = window.setTimeout(() => {
      void load();
    }, 200);
    return () => window.clearTimeout(t);
  }, [open, load]);

  // Resolve selected parent for credit chip
  useEffect(() => {
    let cancelled = false;
    if (!parentId) {
      setSelectedMeta(null);
      return undefined;
    }
    (async () => {
      try {
        const idea = await ideasService.getIdeaWithCreator(parentId);
        if (!cancelled && idea) {
          setSelectedMeta({
            id: idea.id,
            title: idea.title || 'Untitled idea',
            creator: idea.creator || null,
          });
        }
      } catch {
        if (!cancelled) {
          setSelectedMeta({
            id: parentId,
            title: `Idea #${parentId}`,
            creator: null,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parentId]);

  const filtered = useMemo(
    () => options.filter((o) => canBeParentIdea(o, excludeIdeaId)),
    [options, excludeIdeaId]
  );

  const clear = () => {
    onChange?.('');
    setSelectedMeta(null);
    setQuery('');
  };

  const pick = (idea) => {
    onChange?.(String(idea.id));
    setSelectedMeta({
      id: idea.id,
      title: idea.title || 'Untitled idea',
      creator: idea.creator || null,
    });
    setOpen(false);
    setQuery('');
  };

  return (
    <div>
      <label className={labelClass}>Builds on (optional)</label>
      <p className="text-xs text-text-muted mb-2 leading-relaxed">
        Link this idea to a parent it expands or relates to. Related ideas stay
        normal ideas on the main board. One level deep for now.
      </p>

      {selectedMeta ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neon-purple/35 bg-neon-purple/10 px-3 py-2.5 mb-2">
          <Link2 className="w-4 h-4 text-neon-purple shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-white font-medium truncate">
              {selectedMeta.title}
            </div>
            <div className="text-[11px] text-text-muted font-mono">
              by {selectedMeta.creator?.username || 'Community'}
            </div>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={clear}
            className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-white border border-white/15 rounded-md px-2 py-1"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-lg border border-cyber-border bg-cyber-surface/80 px-3 py-2 text-sm text-neon-cyan hover:border-neon-cyan/50 disabled:opacity-50"
        >
          <Link2 className="w-4 h-4" />
          Choose parent idea
        </button>
      )}

      {open && (
        <div className="mt-2 rounded-xl border border-cyber-border bg-cyber-card/95 p-3 space-y-2 shadow-lg">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ideas by title…"
              className={`${fieldClass} !pl-9`}
              autoFocus
            />
          </div>
          <div className="task-scroll max-h-56 overflow-y-auto space-y-1">
            {loading ? (
              <div className="flex items-center gap-2 text-text-muted text-sm py-6 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center px-2">
                No root ideas match. Ideas that already build on something else
                cannot be parents.
              </p>
            ) : (
              filtered.map((idea) => (
                <button
                  key={idea.id}
                  type="button"
                  onClick={() => pick(idea)}
                  className="w-full flex items-start gap-2.5 text-left rounded-lg border border-transparent hover:border-neon-cyan/30 hover:bg-white/5 px-2 py-2"
                >
                  <UserAvatar
                    src={idea.creator?.avatar_url || idea.creator?.avatarUrl}
                    name={idea.creator?.username || 'Community'}
                    username={idea.creator?.username}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white font-medium truncate">
                      {idea.title || 'Untitled idea'}
                    </div>
                    <div className="text-[11px] text-text-muted font-mono truncate">
                      by {idea.creator?.username || 'Community'}
                      {idea.category ? ` · ${idea.category}` : ''}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          {error && (
            <p className="text-xs text-red-300" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className="text-xs text-text-muted hover:text-white font-mono"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
