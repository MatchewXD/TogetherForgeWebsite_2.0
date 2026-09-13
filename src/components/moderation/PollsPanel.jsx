/**
 * Staff Polls tab: create, edit, open, close, delete.
 * Public /polls is read and vote only.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Plus, RefreshCw } from 'lucide-react';

import Button from '../ui/Buttons';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import CharCount from '../ui/CharCount';
import {
  POLL_CONTEXT_MAX,
  POLL_INFORM_COPY,
  POLL_OPTION_DESC_MAX,
  POLL_OPTION_MAX,
  POLL_OPTION_MIN,
  POLL_OPTION_NAME_MAX,
  POLL_PROJECT_TAGS,
  POLL_STAFF_NOTE_MAX,
  POLL_TITLE_MAX,
  emptyPollOptions,
  formatPollWhen,
  pollPath,
  pollsService,
  projectTagLabel,
} from '../../services/pollsService';

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none';
const labelClass =
  'block text-[10px] font-mono tracking-widest uppercase text-text-muted mb-1';

function toDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyForm() {
  return {
    title: '',
    context: '',
    projectTag: '',
    closesAt: '',
    options: emptyPollOptions(),
    staffNote: '',
  };
}

function formFromPoll(poll) {
  if (!poll) return emptyForm();
  return {
    title: poll.title || '',
    context: poll.context || '',
    projectTag: poll.projectTag || '',
    closesAt: toDatetimeLocal(poll.closesAt),
    options: (poll.options || []).map((o) => ({
      name: o.name,
      description: o.description,
    })),
    staffNote: poll.staffNote || '',
  };
}

function statusBadge(poll) {
  if (poll.isDraft) return { variant: 'warning', label: 'Draft' };
  if (poll.isLive) return { variant: 'neon', label: 'Live' };
  return { variant: 'success', label: 'Closed' };
}

export default function PollsPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busyKey, setBusyKey] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [closeTarget, setCloseTarget] = useState(null);
  const [closeNote, setCloseNote] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const selectedId = searchParams.get('poll');

  const showToast = (msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 6000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await pollsService.listAll();
      setPolls(rows);
    } catch (err) {
      setError(err?.message || 'Could not load polls.');
      setPolls([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedId || !polls.length) return;
    const found = polls.find((p) => p.id === selectedId);
    if (found && !editorOpen) {
      setEditing(found);
      setForm(formFromPoll(found));
      setEditorOpen(true);
    }
  }, [selectedId, polls, editorOpen]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError('');
    setEditorOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('poll');
    next.set('tab', 'polls');
    setSearchParams(next, { replace: true });
  };

  const openEdit = (poll) => {
    setEditing(poll);
    setForm(formFromPoll(poll));
    setFormError('');
    setEditorOpen(true);
    setSearchParams({ tab: 'polls', poll: poll.id }, { replace: true });
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditing(null);
    const next = new URLSearchParams(searchParams);
    next.delete('poll');
    next.set('tab', 'polls');
    setSearchParams(next, { replace: true });
  };

  const setOption = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    }));
  };

  const addOption = () => {
    setForm((prev) => {
      if (prev.options.length >= POLL_OPTION_MAX) return prev;
      return {
        ...prev,
        options: [...prev.options, { name: '', description: '' }],
      };
    });
  };

  const removeOption = (index) => {
    setForm((prev) => {
      if (prev.options.length <= POLL_OPTION_MIN) return prev;
      return {
        ...prev,
        options: prev.options.filter((_, i) => i !== index),
      };
    });
  };

  const payloadFromForm = (publish) => ({
    title: form.title,
    context: form.context,
    projectTag: form.projectTag,
    closesAt: form.closesAt || null,
    options: form.options,
    staffNote: form.staffNote,
    publish,
  });

  const save = async ({ publish = false } = {}) => {
    setBusyKey('save');
    setFormError('');
    try {
      if (editing) {
        await pollsService.update(editing.id, payloadFromForm(false));
        if (publish && editing.isDraft) {
          await pollsService.open(editing.id);
          showToast('Poll is live.');
        } else {
          showToast('Poll saved.');
        }
      } else {
        await pollsService.create(payloadFromForm(publish));
        showToast(publish ? 'Poll is live.' : 'Draft saved.');
      }
      closeEditor();
      await load();
    } catch (err) {
      setFormError(err?.message || 'Could not save poll.');
    } finally {
      setBusyKey(null);
    }
  };

  const openPoll = async (poll) => {
    setBusyKey(`open-${poll.id}`);
    setError('');
    try {
      await pollsService.open(poll.id);
      showToast('Poll is live.');
      await load();
    } catch (err) {
      setError(err?.message || 'Could not open poll.');
    } finally {
      setBusyKey(null);
    }
  };

  const confirmClose = async () => {
    if (!closeTarget) return;
    setBusyKey(`close-${closeTarget.id}`);
    setError('');
    try {
      await pollsService.close(closeTarget.id, { staffNote: closeNote });
      showToast('Poll closed.');
      setCloseTarget(null);
      setCloseNote('');
      await load();
    } catch (err) {
      setError(err?.message || 'Could not close poll.');
    } finally {
      setBusyKey(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyKey(`del-${deleteTarget.id}`);
    setError('');
    try {
      await pollsService.remove(deleteTarget.id);
      showToast('Poll deleted.');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err?.message || 'Could not delete poll.');
    } finally {
      setBusyKey(null);
    }
  };

  const saveNote = async (poll) => {
    setBusyKey(`note-${poll.id}`);
    try {
      await pollsService.setStaffNote(poll.id, form.staffNote);
      showToast('Staff note saved.');
      await load();
    } catch (err) {
      setFormError(err?.message || 'Could not save note.');
    } finally {
      setBusyKey(null);
    }
  };

  const optionsLocked = Boolean(editing && !editing.isDraft);

  const sorted = useMemo(() => polls, [polls]);

  return (
    <section aria-labelledby="polls-heading" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="polls-heading"
            className="text-xl sm:text-2xl font-bold text-white tracking-tight"
          >
            Polls
          </h2>
          <p className="text-sm text-text-secondary mt-1 max-w-2xl leading-relaxed">
            Directed questions with a short list. Members pick one option.{' '}
            {POLL_INFORM_COPY} The public page is read and vote only.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={load} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            New poll
          </Button>
        </div>
      </div>

      {toast ? <p className="text-sm text-semantic-success">{toast}</p> : null}
      {error ? (
        <p className="text-sm text-semantic-danger" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-text-muted text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading polls…
        </div>
      ) : sorted.length === 0 ? (
        <Card variant="subtle" className="p-5">
          <p className="text-text-secondary">
            No polls yet. Do not seed one unless Matthew asks.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((poll) => {
            const badge = statusBadge(poll);
            const busy = Boolean(busyKey && busyKey.includes(poll.id));
            return (
              <Card key={poll.id} variant="subtle" className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-white">{poll.title}</h3>
                      <Badge variant={badge.variant} className="!normal-case">
                        {badge.label}
                      </Badge>
                    </div>
                    <p className="text-xs font-mono text-text-muted">
                      {projectTagLabel(poll.projectTag) || 'No tag'} ·{' '}
                      {poll.optionCount} options · {poll.voteTotal} vote
                      {poll.voteTotal === 1 ? '' : 's'}
                      {poll.closesAt
                        ? ` · closes ${formatPollWhen(poll.closesAt)}`
                        : ''}
                      {poll.openerName ? ` · opened by ${poll.openerName}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {poll.isLive || poll.isClosed ? (
                      <Button
                        to={pollPath(poll.id)}
                        variant="ghost"
                        size="sm"
                      >
                        View
                      </Button>
                    ) : null}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEdit(poll)}
                    >
                      Edit
                    </Button>
                    {poll.isDraft ? (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => openPoll(poll)}
                      >
                        Open
                      </Button>
                    ) : null}
                    {poll.isLive ? (
                      <Button
                        variant="warning"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          setCloseNote(poll.staffNote || '');
                          setCloseTarget(poll);
                        }}
                      >
                        Close
                      </Button>
                    ) : null}
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busy}
                      onClick={() => setDeleteTarget(poll)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={editorOpen}
        onClose={() => !busyKey && closeEditor()}
        title={editing ? 'Edit poll' : 'New poll'}
        size="xl"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save({ publish: false });
          }}
        >
          <p className="text-sm text-text-secondary leading-relaxed">
            {POLL_INFORM_COPY} No write-in. No comments. Two to eight options.
          </p>
          {formError ? (
            <p className="text-sm text-semantic-danger" role="alert">
              {formError}
            </p>
          ) : null}
          <div>
            <label className={labelClass} htmlFor="poll-title">
              Title
            </label>
            <input
              id="poll-title"
              className={fieldClass}
              value={form.title}
              maxLength={POLL_TITLE_MAX}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
            <CharCount value={form.title} max={POLL_TITLE_MAX} />
          </div>
          <div>
            <label className={labelClass} htmlFor="poll-context">
              Short context
            </label>
            <textarea
              id="poll-context"
              className={`${fieldClass} min-h-[5rem]`}
              value={form.context}
              maxLength={POLL_CONTEXT_MAX}
              onChange={(e) =>
                setForm((p) => ({ ...p, context: e.target.value }))
              }
            />
            <CharCount value={form.context} max={POLL_CONTEXT_MAX} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="poll-tag">
                Project tag
              </label>
              <select
                id="poll-tag"
                className={fieldClass}
                value={form.projectTag}
                onChange={(e) =>
                  setForm((p) => ({ ...p, projectTag: e.target.value }))
                }
              >
                {POLL_PROJECT_TAGS.map((t) => (
                  <option key={t.label} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-text-muted mt-1">
                A filter, not a bind on Tether or StyleLock.
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor="poll-closes">
                Closes at (optional)
              </label>
              <input
                id="poll-closes"
                type="datetime-local"
                className={fieldClass}
                value={form.closesAt}
                onChange={(e) =>
                  setForm((p) => ({ ...p, closesAt: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className={labelClass + ' !mb-0'}>Options</p>
              {!optionsLocked && form.options.length < POLL_OPTION_MAX ? (
                <Button type="button" variant="ghost" size="sm" onClick={addOption}>
                  Add option
                </Button>
              ) : null}
            </div>
            {optionsLocked ? (
              <p className="text-xs text-text-muted">
                Options are locked while the poll is live or closed.
              </p>
            ) : null}
            {form.options.map((option, index) => (
              <div
                key={index}
                className="border border-cyber-border rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-mono text-text-muted">
                    Option {index + 1}
                  </p>
                  {!optionsLocked && form.options.length > POLL_OPTION_MIN ? (
                    <button
                      type="button"
                      className="text-xs text-semantic-danger"
                      onClick={() => removeOption(index)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <input
                  className={fieldClass}
                  placeholder="Short name"
                  maxLength={POLL_OPTION_NAME_MAX}
                  disabled={optionsLocked}
                  value={option.name}
                  onChange={(e) => setOption(index, { name: e.target.value })}
                />
                <textarea
                  className={`${fieldClass} min-h-[3.5rem]`}
                  placeholder="One sentence"
                  maxLength={POLL_OPTION_DESC_MAX}
                  disabled={optionsLocked}
                  value={option.description}
                  onChange={(e) =>
                    setOption(index, { description: e.target.value })
                  }
                />
              </div>
            ))}
          </div>

          {editing?.isClosed ? (
            <div>
              <label className={labelClass} htmlFor="poll-note">
                Staff note
              </label>
              <input
                id="poll-note"
                className={fieldClass}
                maxLength={POLL_STAFF_NOTE_MAX}
                value={form.staffNote}
                onChange={(e) =>
                  setForm((p) => ({ ...p, staffNote: e.target.value }))
                }
                placeholder="The pick you made, or still thinking"
              />
              <CharCount value={form.staffNote} max={POLL_STAFF_NOTE_MAX} />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" variant="secondary" disabled={Boolean(busyKey)}>
              {editing && !editing.isDraft ? 'Save' : 'Save draft'}
            </Button>
            {(!editing || editing.isDraft) && (
              <Button
                type="button"
                disabled={Boolean(busyKey)}
                onClick={() => save({ publish: true })}
              >
                Open live
              </Button>
            )}
            {editing?.isClosed ? (
              <Button
                type="button"
                variant="secondary"
                disabled={Boolean(busyKey)}
                onClick={() => saveNote(editing)}
              >
                Save note
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={closeEditor}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(closeTarget)}
        onClose={() => !busyKey && setCloseTarget(null)}
        title="Close poll"
      >
        <p className="text-sm text-text-secondary mb-4">
          Closing stops new votes. Prefer this over delete. You can leave a
          one-line staff note.
        </p>
        <label className={labelClass} htmlFor="close-note">
          Staff note (optional)
        </label>
        <input
          id="close-note"
          className={fieldClass}
          maxLength={POLL_STAFF_NOTE_MAX}
          value={closeNote}
          onChange={(e) => setCloseNote(e.target.value)}
        />
        <div className="flex gap-2 mt-4">
          <Button disabled={Boolean(busyKey)} onClick={confirmClose}>
            Close poll
          </Button>
          <Button variant="ghost" onClick={() => setCloseTarget(null)}>
            Cancel
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !busyKey && setDeleteTarget(null)}
        title="Delete poll"
      >
        <p className="text-sm text-text-secondary mb-4">
          Deleting a live poll should be rare. Prefer close. This cannot be
          undone.
        </p>
        <div className="flex gap-2">
          <Button
            variant="danger"
            disabled={Boolean(busyKey)}
            onClick={confirmDelete}
          >
            Delete
          </Button>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </section>
  );
}
