/**
 * Staff Grant Credit list + form. Used on Moderator dashboard and
 * (optionally locked to one project) on a project Contributors page.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Undo2 } from 'lucide-react';
import Button from '../ui/Buttons';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
import UserAvatar from '../ui/UserAvatar';
import {
  STAFF_CREDIT_PENDING_LABEL,
  staffCreditCategoryById,
} from '../../constants/staffCredit';
import { getBadgeDef } from '../../constants/badges';
import {
  listStaffCreditGrants,
  revokeStaffCredit,
} from '../../services/staffCreditService';
import GrantCreditForm from './GrantCreditForm';

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none';
const labelClass =
  'block text-[10px] font-mono tracking-widest uppercase text-text-muted mb-1';

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

/**
 * @param {{
 *   projectId?: string|null,
 *   lockProject?: boolean,
 *   compact?: boolean,
 *   onChanged?: () => void,
 * }} props
 */
const GrantCreditPanel = ({
  projectId = null,
  lockProject = false,
  compact = false,
  onChanged,
}) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [toast, setToast] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [revokeRow, setRevokeRow] = useState(null);
  const [revokeReason, setRevokeReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setMissing(false);
    try {
      const list = await listStaffCreditGrants({
        projectId,
        includeRevoked: !compact,
      });
      setRows(list);
    } catch (e) {
      if (e?.code === 'MISSING_SQL') {
        setMissing(true);
        setError(e.message);
      } else {
        setError(e?.message || 'Could not load credit grants.');
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, compact]);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2800);
  };

  const openCreate = () => setEditing({ id: null });
  const openEdit = (row) => setEditing(row);
  const closeForm = () => setEditing(null);

  const handleSaved = (result) => {
    closeForm();
    if (result?.edited) flash('Credit updated.');
    else flash('Credit granted.');
    void load();
    onChanged?.();
  };

  const confirmRevoke = async () => {
    if (!revokeRow?.id) return;
    setBusyId(revokeRow.id);
    setError('');
    try {
      await revokeStaffCredit(revokeRow.id, revokeReason);
      setRevokeRow(null);
      setRevokeReason('');
      flash('Credit revoked.');
      await load();
      onChanged?.();
    } catch (err) {
      setError(err?.message || 'Could not revoke credit.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="bg-cyber-card/80 border-neon-cyan/25">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">
            {compact ? 'Grant credit on this project' : 'Granted credits'}
          </h3>
          <p className="text-xs text-text-muted mt-0.5 max-w-xl">
            Off-site help (moderation, playtests, videos, writing, organizing)
            gets the same public Contributors line as a completed task. Points
            and badges are optional.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={openCreate}
          disabled={missing}
        >
          <Plus className="w-4 h-4" />
          Grant Credit
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
          {rows.map((row) => {
            const cat = staffCreditCategoryById(row.grantCategory);
            const badge = row.badgeKey ? getBadgeDef(row.badgeKey) : null;
            const name = row.username || STAFF_CREDIT_PENDING_LABEL;
            const revoked = Boolean(row.revokedAt);
            return (
              <li
                key={row.id}
                className={`py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 ${
                  revoked ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <UserAvatar
                    src={row.avatarUrl}
                    name={name}
                    username={row.username}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">
                      {name}
                      {row.pendingAccount ? (
                        <span className="text-text-muted">
                          {' '}
                          · {STAFF_CREDIT_PENDING_LABEL}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-text-secondary truncate">
                      {row.publicLine}
                    </p>
                    <p className="text-[11px] font-mono text-text-muted mt-0.5">
                      {row.projectTitle} · {cat.label} ·{' '}
                      {formatDate(row.creditedOn)}
                      {row.points ? ` · ${row.points} pts` : ''}
                      {badge ? ` · ${badge.name}` : ''}
                      {revoked ? ' · Revoked' : ''}
                    </p>
                    {row.pendingEmail ? (
                      <p className="text-[11px] font-mono text-text-muted truncate">
                        Binds to {row.pendingEmail}
                      </p>
                    ) : null}
                    {row.privateNote ? (
                      <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">
                        Staff note: {row.privateNote}
                      </p>
                    ) : null}
                  </div>
                </div>
                {!revoked && (
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
                      variant="danger"
                      className="gap-1"
                      disabled={busyId === row.id}
                      onClick={() => {
                        setRevokeRow(row);
                        setRevokeReason('');
                      }}
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      Revoke
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
          {!rows.length ? (
            <li className="py-4 text-sm text-text-muted">
              No staff credits yet. Grant Credit adds a public Contributors
              line without creating a task.
            </li>
          ) : null}
        </ul>
      )}

      <Modal
        isOpen={!!editing}
        onClose={closeForm}
        title={editing?.id ? 'Edit credit' : 'Grant Credit'}
        size="lg"
      >
        <GrantCreditForm
          initialProjectId={
            editing?.id ? editing.projectId : projectId || null
          }
          lockProject={lockProject || Boolean(editing?.id)}
          editingGrant={editing?.id ? editing : null}
          onSaved={handleSaved}
          onCancel={closeForm}
        />
      </Modal>

      <Modal
        isOpen={!!revokeRow}
        onClose={() => !busyId && setRevokeRow(null)}
        title="Revoke this credit?"
        size="sm"
      >
        <p className="text-sm text-text-secondary leading-relaxed mb-3">
          Removes the public Contributors entry and profile line. The audit
          row stays. This does not delete the person&apos;s account.
        </p>
        <label className={labelClass} htmlFor="gc-revoke-reason">
          Private reason
        </label>
        <textarea
          id="gc-revoke-reason"
          className={`${fieldClass} min-h-[4.5rem] resize-y mb-4`}
          value={revokeReason}
          onChange={(e) => setRevokeReason(e.target.value)}
          placeholder="Why this credit is being revoked"
        />
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={Boolean(busyId)}
            onClick={() => setRevokeRow(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={Boolean(busyId) || revokeReason.trim().length < 3}
            onClick={() => void confirmRevoke()}
          >
            {busyId ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Revoke credit'
            )}
          </Button>
        </div>
      </Modal>
    </Card>
  );
};

export default GrantCreditPanel;
