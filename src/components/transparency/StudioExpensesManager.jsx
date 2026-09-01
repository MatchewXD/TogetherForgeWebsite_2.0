/**
 * Staff editor for published Together Forge LLC operating expenses.
 * Relay Operating only — not a bank feed.
 */
import { useCallback, useEffect, useState } from 'react';
import { Archive, ArchiveRestore, Loader2, Pencil, Plus } from 'lucide-react';
import Button from '../ui/Buttons';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
import {
  STUDIO_EXPENSE_CATEGORIES,
  STUDIO_EXPENSE_DESC_MAX,
  STUDIO_EXPENSE_VENDOR_MAX,
  centsToUsdInput,
  createStudioExpense,
  listStaffStudioExpenses,
  setStudioExpenseArchived,
  updateStudioExpense,
} from '../../services/studioExpensesService';

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none';
const labelClass =
  'block text-[10px] font-mono tracking-widest uppercase text-text-muted mb-1';

const emptyForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  category: STUDIO_EXPENSE_CATEGORIES[0].label,
  vendor: '',
  amount: '',
  description: '',
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

function formatUsd(cents) {
  const n = Number(cents) / 100;
  if (!Number.isFinite(n)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

const StudioExpensesManager = ({ userId, onChanged }) => {
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
      const list = await listStaffStudioExpenses();
      setRows(list);
    } catch (e) {
      setError(e?.message || 'Could not load studio expenses.');
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
      date: row.date,
      category: row.category,
      vendor: row.vendor,
      amount: centsToUsdInput(row.amountCents),
      description: row.description,
    });
    setEditing(row);
  };

  const closeForm = () => setEditing(null);

  const save = async (e) => {
    e?.preventDefault?.();
    setBusyId(editing?.id || 'new');
    setError('');
    try {
      if (editing?.id) {
        await updateStudioExpense(editing.id, form, userId);
        flash('Expense updated.');
      } else {
        await createStudioExpense(form, userId);
        flash('Expense published.');
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
    setError('');
    try {
      await setStudioExpenseArchived(row.id, !row.archived, userId);
      flash(row.archived ? 'Expense restored.' : 'Expense unpublished.');
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
          <h3 className="text-base font-semibold text-white">
            Publish studio expenses
          </h3>
          <p className="text-xs text-text-muted mt-0.5 max-w-xl">
            Together Forge LLC spend from Relay Operating only. Do not add Stripe
            payouts, the 25% tax withholding transfer, refunds, or Runway/Ko-fi.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Add expense
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
                  <span className="text-sm font-semibold text-white tabular-nums">
                    {formatUsd(row.amountCents)}
                  </span>
                  <span className="text-sm text-white">{row.vendor}</span>
                  <span className="text-[10px] font-mono tracking-widest uppercase text-text-muted">
                    {row.category}
                  </span>
                  <span className="text-xs font-mono text-text-muted">
                    {formatDate(row.date)}
                  </span>
                  {row.archived ? (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                      Unpublished
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                  {row.description}
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
                  {row.archived ? 'Restore' : 'Unpublish'}
                </Button>
              </div>
            </li>
          ))}
          {!rows.length ? (
            <li className="py-4 text-sm text-text-muted">
              No published expenses yet. $0 on the public report is correct.
            </li>
          ) : null}
        </ul>
      )}

      <Modal
        isOpen={!!editing}
        onClose={closeForm}
        title={editing?.id ? 'Edit published expense' : 'Publish expense'}
        size="md"
      >
        <form onSubmit={save} className="space-y-4">
          <p className="text-xs text-text-muted">
            Public on Transparency. LLC operating spend from Relay Operating
            only.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="se-date">
                Date
              </label>
              <input
                id="se-date"
                type="date"
                className={fieldClass}
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="se-category">
                Category
              </label>
              <select
                id="se-category"
                className={fieldClass}
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
              >
                {STUDIO_EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.label}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="se-vendor">
                Vendor
              </label>
              <input
                id="se-vendor"
                className={fieldClass}
                value={form.vendor}
                maxLength={STUDIO_EXPENSE_VENDOR_MAX}
                onChange={(e) =>
                  setForm((f) => ({ ...f, vendor: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="se-amount">
                Amount (USD)
              </label>
              <input
                id="se-amount"
                className={fieldClass}
                inputMode="decimal"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
                required
              />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="se-desc">
              Short public description
            </label>
            <textarea
              id="se-desc"
              className={`${fieldClass} min-h-[6rem] resize-y`}
              value={form.description}
              maxLength={STUDIO_EXPENSE_DESC_MAX}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              required
            />
            <p className="text-[10px] font-mono text-text-muted mt-1 text-right">
              {form.description.length}/{STUDIO_EXPENSE_DESC_MAX}
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

export default StudioExpensesManager;
