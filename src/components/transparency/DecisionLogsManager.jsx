/**
 * Lightweight staff editor for Transparency Hub decision logs.
 */
import { useCallback, useEffect, useState } from 'react';
import { Archive, ArchiveRestore, Loader2, Pencil, Plus } from 'lucide-react';
import Button from '../ui/Buttons';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
import {
  DECISION_LOG_BODY_MAX,
  DECISION_LOG_CATEGORIES,
  createDecisionLog,
  listStaffDecisionLogs,
  setDecisionLogArchived,
  updateDecisionLog,
} from '../../services/decisionLogsService';

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none';
const labelClass =
  'block text-[10px] font-mono tracking-widest uppercase text-text-muted mb-1';

const emptyForm = () => ({
  title: '',
  category: 'Governance',
  date: new Date().toISOString().slice(0, 10),
  body: '',
});

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const DecisionLogsManager = ({ userId, onChanged }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await listStaffDecisionLogs();
      setRows(list);
    } catch (e) {
      setError(e?.message || 'Could not load decision logs.');
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
    window.setTimeout(() => setToast(''), 2800);
  };

  const openCreate = () => {
    setForm(emptyForm());
    setEditing({ id: null });
  };

  const openEdit = (row) => {
    setForm({
      title: row.title,
      category: row.category,
      date: row.date,
      body: row.body,
    });
    setEditing(row);
  };

  const closeForm = () => setEditing(null);

  const save = async (e) => {
    e?.preventDefault?.();
    setBusyId(editing?.id || 'new');
    try {
      if (editing?.id) {
        await updateDecisionLog(editing.id, form, userId);
        flash('Entry updated.');
      } else {
        await createDecisionLog(form, userId);
        flash('Entry published.');
      }
      closeForm();
      await load();
      onChanged?.();
    } catch (err) {
      setError(err?.message || 'Could not save.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleArchive = async (row) => {
    setBusyId(row.id);
    try {
      await setDecisionLogArchived(row.id, !row.archived, userId);
      flash(row.archived ? 'Entry restored.' : 'Entry archived.');
      await load();
      onChanged?.();
    } catch (err) {
      setError(err?.message || 'Could not update.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="bg-cyber-card/80 border-neon-cyan/25">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">Manage decision logs</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Founder and moderator tools. Archived entries leave the public list.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Add entry
        </Button>
      </div>

      {toast ? (
        <p className="text-xs text-neon-cyan mb-3" role="status">
          {toast}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-200 mb-3" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-text-muted inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </p>
      ) : (
        <ul className="divide-y divide-cyber-border border-t border-cyber-border">
          {rows.map((row) => (
            <li
              key={row.id}
              className={`py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 ${
                row.archived ? 'opacity-60' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold text-white">
                    {row.title}
                  </span>
                  <span className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
                    {row.category}
                  </span>
                  <span className="text-xs font-mono text-text-muted">
                    {formatDate(row.date)}
                  </span>
                  {row.archived ? (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                      Archived
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                  {row.body}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1"
                  disabled={busyId === row.id}
                  onClick={() => openEdit(row)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1"
                  disabled={busyId === row.id}
                  onClick={() => toggleArchive(row)}
                >
                  {row.archived ? (
                    <ArchiveRestore className="w-3.5 h-3.5" />
                  ) : (
                    <Archive className="w-3.5 h-3.5" />
                  )}
                  {row.archived ? 'Restore' : 'Archive'}
                </Button>
              </div>
            </li>
          ))}
          {!rows.length ? (
            <li className="py-4 text-sm text-text-muted">No entries yet.</li>
          ) : null}
        </ul>
      )}

      <Modal
        isOpen={!!editing}
        onClose={closeForm}
        title={editing?.id ? 'Edit decision log' : 'New decision log'}
        size="md"
      >
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="dl-title">
              Title
            </label>
            <input
              id="dl-title"
              className={fieldClass}
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              maxLength={160}
              required
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="dl-category">
                Category
              </label>
              <select
                id="dl-category"
                className={fieldClass}
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
              >
                {DECISION_LOG_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="dl-date">
                Date
              </label>
              <input
                id="dl-date"
                type="date"
                className={fieldClass}
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
                required
              />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="dl-body">
              Short body
            </label>
            <textarea
              id="dl-body"
              className={`${fieldClass} min-h-[8rem] resize-y`}
              value={form.body}
              maxLength={DECISION_LOG_BODY_MAX}
              onChange={(e) =>
                setForm((f) => ({ ...f, body: e.target.value }))
              }
              required
            />
            <p className="text-[10px] font-mono text-text-muted mt-1 text-right">
              {form.body.length}/{DECISION_LOG_BODY_MAX}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" disabled={!!busyId}>
              {editing?.id ? 'Save' : 'Publish'}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
};

export default DecisionLogsManager;
