/**
 * Staff tools for hybrid idea tags: usage stats, approve, rename, merge, hide, delete.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  EyeOff,
  Eye,
  Loader2,
  Merge,
  Pencil,
  RefreshCw,
  Trash2,
  Tag,
} from 'lucide-react';
import Button from '../ui/Buttons';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
import { ideaTagsService } from '../../services/ideaTagsService';
import { TAG_PROMOTION_THRESHOLD } from '../../constants/ideaTags';
import {
  isTagPubliclySelectable,
  promotionProgress,
  statusLabel,
} from '../../utils/ideaTags';
import useStaffRole from '../../hooks/useStaffRole';

export default function IdeaTagsAdminPanel() {
  const { isAdmin, isModerator } = useStaffRole();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState('all'); // all | public | suggested | hidden
  const [q, setQ] = useState('');

  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [mergeSource, setMergeSource] = useState(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await ideaTagsService.listAllTagsForAdmin();
      setRows(list);
    } catch (e) {
      setError(e?.message || 'Failed to load tags.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3200);
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((t) => {
      if (filter === 'public' && !isTagPubliclySelectable(t)) return false;
      if (filter === 'suggested' && t.status !== 'suggested') return false;
      if (filter === 'hidden' && t.status !== 'hidden') return false;
      if (filter === 'curated' && t.status !== 'curated') return false;
      if (!query) return true;
      return (
        String(t.name || '')
          .toLowerCase()
          .includes(query) ||
        String(t.slug || '').includes(query)
      );
    });
  }, [rows, filter, q]);

  const stats = useMemo(() => {
    const total = rows.length;
    const publicCount = rows.filter((t) => isTagPubliclySelectable(t)).length;
    const suggested = rows.filter((t) => t.status === 'suggested').length;
    const hidden = rows.filter((t) => t.status === 'hidden').length;
    const nearPromo = rows.filter((t) => {
      if (t.status !== 'suggested') return false;
      const p = promotionProgress(t);
      return p.remaining > 0 && p.remaining <= 3;
    }).length;
    return { total, publicCount, suggested, hidden, nearPromo };
  }, [rows]);

  const run = async (id, fn, okMsg) => {
    setBusyId(id || 'global');
    setError('');
    try {
      await fn();
      flash(okMsg);
      await load();
    } catch (e) {
      setError(e?.message || 'Action failed.');
    } finally {
      setBusyId(null);
    }
  };

  if (!isModerator) {
    return (
      <p className="text-sm text-text-muted">Staff access required.</p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2
            id="tags-heading"
            className="text-xl font-bold text-white flex items-center gap-2"
          >
            <Tag className="w-5 h-5 text-neon-cyan" />
            Idea tags
          </h2>
          <p className="text-sm text-text-secondary mt-1 max-w-2xl">
            Hybrid catalog: curated core tags stay public. Community suggestions
            become public after approval or {TAG_PROMOTION_THRESHOLD} uses.
            Merge and rename keep idea text in sync.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={loading || busyId === 'global'}
            onClick={() =>
              void run(
                'global',
                () => ideaTagsService.recomputeUsage(),
                'Usage counts recomputed from ideas.'
              )
            }
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Recompute usage
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={loading}
            onClick={() => void load()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: 'Total', value: stats.total },
          { label: 'Public', value: stats.publicCount },
          { label: 'Suggested', value: stats.suggested },
          { label: 'Hidden', value: stats.hidden },
          { label: 'Near promo', value: stats.nearPromo },
        ].map((s) => (
          <Card
            key={s.label}
            className="bg-cyber-card/70 border border-cyber-border px-3 py-2.5"
          >
            <div className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
              {s.label}
            </div>
            <div className="text-lg font-bold text-white tabular-nums">
              {s.value}
            </div>
          </Card>
        ))}
      </div>

      {toast && (
        <p
          role="status"
          className="text-sm rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-emerald-100"
        >
          {toast}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="text-sm rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-red-100"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tags…"
          className="flex-1 min-w-0 bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-neon-cyan"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-cyan"
        >
          <option value="all">All statuses</option>
          <option value="public">Publicly selectable</option>
          <option value="curated">Curated</option>
          <option value="suggested">Suggested only</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-text-muted text-sm py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading catalog…
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">
          No tags match. Run{' '}
          <code className="text-neon-cyan">supabase_idea_tags.sql</code> if the
          catalog is empty.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-cyber-border">
          <table className="w-full text-sm text-left min-w-[640px]">
            <thead className="bg-cyber-surface/80 text-[10px] font-mono tracking-widest uppercase text-text-muted">
              <tr>
                <th className="px-3 py-2.5 font-medium">Tag</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Uses</th>
                <th className="px-3 py-2.5 font-medium">Public?</th>
                <th className="px-3 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((t) => {
                const pub = isTagPubliclySelectable(t);
                const prog = promotionProgress(t);
                const busy = busyId === t.id;
                return (
                  <tr key={t.id} className="bg-cyber-card/40 hover:bg-white/[0.03]">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-white">#{t.name}</div>
                      <div className="text-[11px] font-mono text-text-muted">
                        {t.slug}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">
                      {statusLabel(t.status)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-white">
                      {t.usage_count}
                      {t.status === 'suggested' && prog.remaining > 0 && (
                        <div className="text-[10px] text-text-muted">
                          {prog.remaining} to public
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {pub ? (
                        <span className="text-emerald-300 text-xs">Yes</span>
                      ) : (
                        <span className="text-text-muted text-xs">No</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {t.status === 'suggested' && (
                          <button
                            type="button"
                            disabled={busy}
                            title="Approve for public list"
                            onClick={() =>
                              void run(
                                t.id,
                                () => ideaTagsService.approveTag(t.id),
                                `Approved #${t.name}`
                              )
                            }
                            className="inline-flex items-center gap-1 rounded border border-emerald-400/40 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Approve
                          </button>
                        )}
                        {t.status !== 'hidden' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void run(
                                t.id,
                                () => ideaTagsService.hideTag(t.id),
                                `Hidden #${t.name}`
                              )
                            }
                            className="inline-flex items-center gap-1 rounded border border-white/20 px-2 py-1 text-[11px] text-text-secondary hover:text-amber-200 hover:border-amber-400/40 disabled:opacity-50"
                          >
                            <EyeOff className="w-3 h-3" />
                            Hide
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void run(
                                t.id,
                                () => ideaTagsService.unhideTag(t.id),
                                `Unhidden #${t.name}`
                              )
                            }
                            className="inline-flex items-center gap-1 rounded border border-white/20 px-2 py-1 text-[11px] text-text-secondary hover:text-neon-cyan disabled:opacity-50"
                          >
                            <Eye className="w-3 h-3" />
                            Unhide
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setRenameTarget(t);
                            setRenameValue(t.name);
                          }}
                          className="inline-flex items-center gap-1 rounded border border-white/20 px-2 py-1 text-[11px] text-text-secondary hover:text-white disabled:opacity-50"
                        >
                          <Pencil className="w-3 h-3" />
                          Rename
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setMergeSource(t);
                            setMergeTargetId('');
                          }}
                          className="inline-flex items-center gap-1 rounded border border-white/20 px-2 py-1 text-[11px] text-text-secondary hover:text-neon-purple disabled:opacity-50"
                        >
                          <Merge className="w-3 h-3" />
                          Merge
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setDeleteTarget(t)}
                            className="inline-flex items-center gap-1 rounded border border-red-400/35 px-2 py-1 text-[11px] text-red-200 hover:bg-red-500/15 disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Rename modal */}
      <Modal
        isOpen={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        title="Rename tag"
        size="sm"
      >
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            Renames the catalog entry and rewrites matching tags on all ideas.
          </p>
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-cyan"
            maxLength={40}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRenameTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!renameValue.trim() || busyId === renameTarget?.id}
              onClick={() =>
                void run(
                  renameTarget.id,
                  async () => {
                    await ideaTagsService.renameTag(
                      renameTarget.id,
                      renameValue
                    );
                    setRenameTarget(null);
                  },
                  `Renamed to #${renameValue.trim()}`
                )
              }
            >
              Save name
            </Button>
          </div>
        </div>
      </Modal>

      {/* Merge modal */}
      <Modal
        isOpen={Boolean(mergeSource)}
        onClose={() => setMergeSource(null)}
        title="Merge tags"
        size="md"
      >
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            Merge <strong className="text-white">#{mergeSource?.name}</strong>{' '}
            into another tag. Source is removed; ideas are rewritten to the
            target name.
          </p>
          <select
            value={mergeTargetId}
            onChange={(e) => setMergeTargetId(e.target.value)}
            className="w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-cyan"
          >
            <option value="">Select target tag…</option>
            {rows
              .filter((r) => r.id !== mergeSource?.id)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  #{r.name} ({r.usage_count} uses · {statusLabel(r.status)})
                </option>
              ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMergeSource(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!mergeTargetId || busyId === mergeSource?.id}
              onClick={() =>
                void run(
                  mergeSource.id,
                  async () => {
                    await ideaTagsService.mergeTags(
                      mergeSource.id,
                      mergeTargetId
                    );
                    setMergeSource(null);
                  },
                  `Merged #${mergeSource.name}`
                )
              }
            >
              Merge
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete tag"
        size="sm"
      >
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            Permanently remove{' '}
            <strong className="text-white">#{deleteTarget?.name}</strong> and
            strip it from all ideas. Prefer hide for low-quality tags you may
            want to review later.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={busyId === deleteTarget?.id}
              onClick={() =>
                void run(
                  deleteTarget.id,
                  async () => {
                    await ideaTagsService.deleteTag(deleteTarget.id);
                    setDeleteTarget(null);
                  },
                  `Deleted #${deleteTarget.name}`
                )
              }
            >
              Delete permanently
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
