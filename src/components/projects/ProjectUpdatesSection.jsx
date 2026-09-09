/**
 * Project hub Updates: staff Devlogs & announcements.
 * Public reads cards. Staff add / edit / delete. Click a card for the full post.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

import Badge from '../ui/Badge';
import Button from '../ui/Buttons';
import Card from '../ui/Card';
import CharCount from '../ui/CharCount';
import Modal from '../ui/Modal';
import {
  UPDATE_CATEGORIES,
  UPDATE_TITLE_MAX,
  bodyMaxForCategory,
  projectUpdatesService,
} from '../../services/projectUpdatesService';
import {
  fieldControl,
  fieldLabel,
  formatDate,
} from '../questions/questionStyles';

function categoryVariant(category) {
  if (category === 'Devlog') return 'neon';
  if (category === 'Announcement') return 'gold';
  if (category === 'Art' || category === 'Audio') return 'purple';
  return 'default';
}

function UpdateFormModal({
  isOpen,
  onClose,
  onSave,
  busy,
  editing,
}) {
  const [category, setCategory] = useState('Devlog');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setCategory(editing?.category || 'Devlog');
    setTitle(editing?.title || '');
    setBody(editing?.body || '');
    setFormError('');
  }, [isOpen, editing]);

  const bodyMax = bodyMaxForCategory(category);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      await onSave({ category, title, body });
    } catch (err) {
      setFormError(err?.message || 'Could not save.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      title={editing ? 'Edit update' : 'Post an update'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          Category, a short header, and the full write-up. Devlogs can be much
          longer than other posts.
        </p>
        <div>
          <label className={fieldLabel} htmlFor="pu-category">
            Category
          </label>
          <select
            id="pu-category"
            className={fieldControl}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {UPDATE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
                {c === 'Devlog' ? ' (longer write-up)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={fieldLabel} htmlFor="pu-title">
            Header
          </label>
          <input
            id="pu-title"
            className={fieldControl}
            value={title}
            maxLength={UPDATE_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Networking pass is in for internal playtests"
            required
          />
          <CharCount value={title} max={UPDATE_TITLE_MAX} />
        </div>
        <div>
          <label className={fieldLabel} htmlFor="pu-body">
            Description
          </label>
          <textarea
            id="pu-body"
            className={`${fieldControl} ${
              category === 'Devlog' ? 'min-h-[14rem]' : 'min-h-[8rem]'
            }`}
            value={body}
            maxLength={bodyMax}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              category === 'Devlog'
                ? 'What shipped, what you tried, what is next, and anything the community should know.'
                : 'A short note the community can scan quickly.'
            }
            required
          />
          <CharCount value={body} max={bodyMax} />
        </div>
        {formError ? (
          <p className="text-sm text-semantic-danger">{formError}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save' : 'Post update'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ProjectUpdatesSection({
  projectId,
  isStaff = false,
  user = null,
}) {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [active, setActive] = useState(null);

  const showToast = (message, kind = 'info') => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 5000);
  };

  const load = useCallback(async () => {
    if (!projectId) {
      setUpdates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const rows = await projectUpdatesService.listForProject(projectId);
      setUpdates(rows);
    } catch (err) {
      setError(err?.message || 'Could not load updates.');
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async ({ category, title, body }) => {
    if (!isStaff || !user?.id || !projectId) return;
    setBusy(true);
    try {
      if (editing) {
        await projectUpdatesService.update(editing.id, {
          category,
          title,
          body,
        });
        showToast('Update saved.', 'success');
      } else {
        await projectUpdatesService.create(
          projectId,
          { category, title, body },
          user.id
        );
        showToast('Update posted.', 'success');
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (!isStaff) return;
    const ok = window.confirm(`Delete “${row.title}”? This cannot be undone.`);
    if (!ok) return;
    setBusy(true);
    try {
      await projectUpdatesService.remove(row.id);
      if (active?.id === row.id) setActive(null);
      showToast('Update deleted.', 'success');
      await load();
    } catch (err) {
      showToast(err?.message || 'Could not delete.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (row, e) => {
    e?.stopPropagation?.();
    setActive(null);
    setEditing(row);
    setFormOpen(true);
  };

  return (
    <section aria-labelledby="updates-heading" className="pb-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <div className="section-header">Updates</div>
          <h2 id="updates-heading" className="text-2xl font-bold text-white">
            Devlogs & announcements
          </h2>
          <p className="text-text-secondary text-sm mt-1 max-w-xl leading-relaxed">
            Open a card to read the full post. Staff write these so the
            community can see what actually shipped.
          </p>
        </div>
        {isStaff && projectId ? (
          <Button
            className="gap-2 self-start sm:self-auto"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            disabled={busy}
          >
            <Plus className="w-4 h-4" />
            Add update
          </Button>
        ) : null}
      </div>

      {toast ? (
        <p
          className={`text-sm mb-4 ${
            toast.kind === 'error'
              ? 'text-semantic-danger'
              : toast.kind === 'success'
                ? 'text-semantic-success'
                : 'text-text-secondary'
          }`}
        >
          {toast.message}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-text-muted py-8">
          <Loader2 className="w-4 h-4 animate-spin text-neon-cyan" />
          Loading updates…
        </div>
      ) : error ? (
        <Card className="bg-cyber-card/80 border-semantic-warning/40">
          <p className="text-sm text-semantic-warning">{error}</p>
        </Card>
      ) : updates.length === 0 ? (
        <Card className="bg-cyber-card/80">
          <p className="text-sm text-text-secondary leading-relaxed">
            No updates yet.
            {isStaff
              ? ' Use “Add update” to post a Devlog or announcement.'
              : ' Staff will post Devlogs and announcements here.'}
          </p>
        </Card>
      ) : (
        <div className="task-scroll max-h-[36rem] overflow-y-auto overscroll-contain pr-1">
          <ul className="grid md:grid-cols-2 gap-4">
            {updates.map((row) => (
              <li key={row.id} className="min-w-0">
                <Card
                  interactive
                  variant="subtle"
                  className="h-full flex flex-col border-l-2 border-l-neon-cyan hover:border-neon-cyan/40"
                  onClick={() => setActive(row)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActive(row);
                    }
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge
                      variant={categoryVariant(row.category)}
                      className="!normal-case"
                    >
                      {row.category}
                    </Badge>
                    <span className="text-xs font-mono text-text-muted">
                      {formatDate(row.createdAt)}
                    </span>
                    {isStaff ? (
                      <div
                        className="ml-auto flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="p-1.5 rounded-md border border-cyber-border text-text-muted hover:text-neon-cyan hover:border-neon-cyan/40"
                          onClick={(e) => openEdit(row, e)}
                          aria-label={`Edit ${row.title}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded-md border border-cyber-border text-text-muted hover:text-red-300 hover:border-red-400/40"
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(row);
                          }}
                          aria-label={`Delete ${row.title}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 leading-snug">
                    {row.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed line-clamp-3 flex-1">
                    {row.body}
                  </p>
                  {row.body && row.body.length > 160 ? (
                    <p className="text-[11px] font-mono text-neon-cyan mt-2">
                      Read more →
                    </p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}

      <UpdateFormModal
        isOpen={formOpen}
        onClose={() => !busy && setFormOpen(false)}
        onSave={save}
        busy={busy}
        editing={editing}
      />

      <Modal
        isOpen={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.title || 'Update'}
        size="lg"
      >
        {active ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={categoryVariant(active.category)}
                className="!normal-case"
              >
                {active.category}
              </Badge>
              <span className="text-xs font-mono text-text-muted">
                {formatDate(active.createdAt)}
              </span>
              {active.author?.username ? (
                <span className="text-xs text-text-muted">
                  by {active.author.username}
                </span>
              ) : null}
            </div>
            <p className="text-sm sm:text-base text-text-secondary leading-relaxed whitespace-pre-wrap">
              {active.body}
            </p>
            {isStaff ? (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-cyber-border">
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1"
                  onClick={() => openEdit(active)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => remove(active)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
