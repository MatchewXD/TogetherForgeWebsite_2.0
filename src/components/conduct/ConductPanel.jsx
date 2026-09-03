/**
 * Moderator Conduct: open queue, case detail, account action history.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Shield } from 'lucide-react';
import Button from '../ui/Buttons';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import {
  CONDUCT_STATUSES,
  CONDUCT_STRIKE_RESTRICT_DAYS,
  conductActionLabel,
  conductContentLabel,
  conductReasonById,
  conductStatusLabel,
  isFirstDeclineReason,
  requiresConfirm,
} from '../../constants/conduct';
import {
  addConductNote,
  applyConductReview,
  getConductCase,
  isConductMissing,
  listAccountConductHistory,
  listConductCases,
  previewConductNotice,
  setLinkedAccountsNote,
  setNoisyReporter,
} from '../../services/conductService';

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none';
const labelClass =
  'block text-[10px] font-mono tracking-widest uppercase text-text-muted mb-1';

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const emptyForm = () => ({
  actions: [],
  status: '',
  citedDocument: '',
  staffNote: '',
  noticeBody: '',
  notify: true,
  skipLadderReason: '',
  restrictClaims: true,
  restrictIdeas: false,
  restrictComments: false,
  restrictShowcase: false,
  restrictDays: String(CONDUCT_STRIKE_RESTRICT_DAYS),
  restrictPermanent: false,
  suspendDays: '7',
  liftReason: '',
});

function toggleAction(form, id) {
  const has = form.actions.includes(id);
  return {
    ...form,
    actions: has ? form.actions.filter((a) => a !== id) : [...form.actions, id],
  };
}

const ConductPanel = () => {
  const [view, setView] = useState('queue');
  const [statusFilter, setStatusFilter] = useState('queue');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [toast, setToast] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historyUserId, setHistoryUserId] = useState('');
  const [historyRows, setHistoryRows] = useState([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [linkedNote, setLinkedNote] = useState('');

  const flash = (msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3200);
  };

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    setMissing(false);
    try {
      const list = await listConductCases({ status: statusFilter });
      setRows(list);
    } catch (e) {
      if (e?.code === 'MISSING_SQL' || isConductMissing(e)) {
        setMissing(true);
        setError(e.message);
      } else {
        setError(e?.message || 'Could not load cases.');
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (view === 'queue') void loadQueue();
  }, [view, loadQueue]);

  const openCase = async (id) => {
    setSelectedId(id);
    setView('detail');
    setBusy(true);
    setError('');
    try {
      const row = await getConductCase(id);
      setDetail(row);
      setForm({
        ...emptyForm(),
        citedDocument: row?.citedDocument || '',
      });
      setLinkedNote(row?.account?.linkedAccountsNote || '');
    } catch (e) {
      setError(e?.message || 'Could not load the case.');
      setDetail(null);
    } finally {
      setBusy(false);
    }
  };

  const firstDeclineBlocked = useMemo(() => {
    if (!detail) return false;
    return (
      form.actions.includes('strike') &&
      isFirstDeclineReason(detail.reasonCode) &&
      !detail.priorNotice &&
      !form.skipLadderReason.trim()
    );
  }, [detail, form.actions, form.skipLadderReason]);

  useEffect(() => {
    if (!detail) return;
    const addedStrike = form.actions.includes('strike');
    const firstDecline =
      isFirstDeclineReason(detail.reasonCode) &&
      !detail.priorNotice &&
      !addedStrike;
    setForm((f) => ({
      ...f,
      noticeBody: previewConductNotice(
        { ...detail, citedDocument: f.citedDocument || detail.citedDocument },
        { addedStrike, firstDecline }
      ),
    }));
  }, [
    detail,
    form.actions,
    form.citedDocument,
  ]);

  const runApply = async () => {
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      await applyConductReview(detail, form);
      flash('Review saved.');
      setConfirmOpen(false);
      await openCase(detail.id);
      void loadQueue();
    } catch (e) {
      setError(e?.message || 'Could not apply the review.');
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const requestApply = (e) => {
    e?.preventDefault?.();
    if (!form.actions.length) {
      setError('Choose at least one outcome.');
      return;
    }
    if (firstDeclineBlocked) {
      setError(
        'A first off-brief miss is a content action, not a strike. Add a skip reason to escalate.'
      );
      return;
    }
    if (requiresConfirm(form.actions)) {
      setConfirmOpen(true);
      return;
    }
    void runApply();
  };

  const saveNote = async () => {
    if (!detail || !noteDraft.trim()) return;
    setBusy(true);
    try {
      await addConductNote(detail.id, noteDraft);
      setNoteDraft('');
      await openCase(detail.id);
    } catch (e) {
      setError(e?.message || 'Could not save the note.');
    } finally {
      setBusy(false);
    }
  };

  const loadHistory = async () => {
    if (!detail?.targetUserId) return;
    setBusy(true);
    try {
      const list = await listAccountConductHistory(detail.targetUserId);
      setHistoryRows(list);
      setHistoryUserId(detail.targetUserId);
      setView('history');
    } catch (e) {
      setError(e?.message || 'Could not load history.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="conduct-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="conduct-heading"
            className="text-xl sm:text-2xl font-bold text-white tracking-tight"
          >
            Conduct
          </h2>
          <p className="text-sm text-text-secondary mt-1 max-w-2xl leading-relaxed">
            Review reports and handle bad actors in private. Public profiles and
            Contributor lists do not show strikes or staff notes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['queue', 'detail', 'history'].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id === 'detail' && !selectedId ? 'queue' : id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono tracking-widest uppercase border ${
                view === id
                  ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/10'
                  : 'border-cyber-border text-text-muted'
              }`}
            >
              {id === 'queue'
                ? 'Open queue'
                : id === 'detail'
                  ? 'Case'
                  : 'Account history'}
            </button>
          ))}
          <Button size="sm" variant="ghost" className="gap-1" onClick={() => void loadQueue()}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {toast ? (
        <p className="text-xs text-neon-cyan" role="status">
          {toast}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}

      {view === 'queue' && (
        <>
          <div>
            <label className={labelClass} htmlFor="conduct-status">
              Status
            </label>
            <select
              id="conduct-status"
              className={`${fieldClass} max-w-xs`}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="queue">Open queue</option>
              <option value="all">All</option>
              {CONDUCT_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {loading ? (
            <p className="text-sm text-text-muted inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => void openCase(row.id)}
                  >
                    <Card className="bg-cyber-card/80 hover:border-neon-cyan/40 transition-colors">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-mono text-xs text-neon-cyan">
                              {row.caseCode}
                            </span>
                            <Badge variant="default">{conductStatusLabel(row.status)}</Badge>
                            <span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
                              {conductContentLabel(row.contentType)}
                            </span>
                          </div>
                          <p className="text-sm text-white">
                            {row.targetUsername || 'Member'} ·{' '}
                            {conductReasonById(row.reasonCode).label}
                          </p>
                          <p className="text-[11px] font-mono text-text-muted mt-1">
                            {row.source === 'staff' ? 'Staff' : 'Member report'}
                            {row.reporterUsername ? ` · reporter ${row.reporterUsername}` : ''}
                            {' · '}
                            {formatWhen(row.createdAt)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </button>
                </li>
              ))}
              {!rows.length ? (
                <Card className="bg-cyber-card/80 text-sm text-text-muted">
                  {missing
                    ? 'Conduct SQL is not installed yet.'
                    : 'No cases in this view.'}
                </Card>
              ) : null}
            </ul>
          )}
        </>
      )}

      {view === 'detail' && detail && (
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-cyber-card/80 space-y-2">
              <p className="font-mono text-sm text-neon-cyan">{detail.caseCode}</p>
              <p className="text-white font-semibold">
                {detail.targetUsername || 'Member'}
              </p>
              <p className="text-sm text-text-secondary">
                {conductReasonById(detail.reasonCode).label}
              </p>
              <p className="text-xs font-mono text-text-muted">
                {conductContentLabel(detail.contentType)}
                {detail.projectTitle ? ` · ${detail.projectTitle}` : ''}
                {detail.contentPath ? ` · ${detail.contentPath}` : ''}
              </p>
              {detail.contentPath ? (
                <a
                  href={detail.contentPath}
                  className="text-xs font-mono text-neon-cyan hover:underline"
                >
                  Open linked content
                </a>
              ) : null}
              <p className="text-xs text-text-muted">
                Source: {detail.source === 'staff' ? 'Staff' : 'Member report'}
                {detail.reporterUsername
                  ? ` · reporter ${detail.reporterUsername}`
                  : ''}
              </p>
              {detail.details ? (
                <p className="text-sm text-text-secondary whitespace-pre-wrap">
                  {detail.details}
                </p>
              ) : null}
              <p className="text-xs font-mono text-text-muted">
                Strikes: {detail.account?.strikeCount || 0}
                {detail.account?.bannedAt ? ' · banned' : ''}
                {detail.account?.suspendedUntil
                  ? ` · suspended until ${formatWhen(detail.account.suspendedUntil)}`
                  : ''}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="secondary" onClick={() => void loadHistory()}>
                  Account history
                </Button>
                {detail.reporterId ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void setNoisyReporter(detail.reporterId, true).then(() =>
                        openCase(detail.id)
                      )
                    }
                  >
                    Mark reporter noisy
                  </Button>
                ) : null}
              </div>
            </Card>

            <Card className="bg-cyber-card/80 space-y-2">
              <h3 className="text-sm font-semibold text-white">Staff notes</h3>
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {(detail.notes || []).map((n) => (
                  <li key={n.id} className="text-sm text-text-secondary">
                    <span className="text-text-muted text-[11px] font-mono">
                      {n.authorUsername || 'Staff'} · {formatWhen(n.createdAt)}
                    </span>
                    <p className="whitespace-pre-wrap">{n.body}</p>
                  </li>
                ))}
                {!(detail.notes || []).length ? (
                  <li className="text-xs text-text-muted">No staff notes yet.</li>
                ) : null}
              </ul>
              <textarea
                className={`${fieldClass} min-h-[3.5rem]`}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Private staff note"
              />
              <Button size="sm" variant="secondary" onClick={() => void saveNote()}>
                Add note
              </Button>
            </Card>

            <Card className="bg-cyber-card/80 space-y-2">
              <h3 className="text-sm font-semibold text-white">
                Linked accounts (private)
              </h3>
              <textarea
                className={`${fieldClass} min-h-[3.5rem]`}
                value={linkedNote}
                onChange={(e) => setLinkedNote(e.target.value)}
                placeholder="Ban-evasion notes. Never shown publicly."
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void setLinkedAccountsNote(detail.targetUserId, linkedNote)
                }
              >
                Save private file
              </Button>
            </Card>

            <Card className="bg-cyber-card/80">
              <h3 className="text-sm font-semibold text-white mb-2">Audit</h3>
              <ul className="space-y-1 max-h-48 overflow-y-auto text-xs font-mono text-text-muted">
                {(detail.audit || []).map((a) => (
                  <li key={a.id}>
                    {formatWhen(a.createdAt)} · {a.actorUsername || 'Staff'} ·{' '}
                    {conductActionLabel(a.action)}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <form onSubmit={requestApply} className="lg:col-span-3 space-y-4">
            <Card className="bg-cyber-card/80 space-y-3">
              <h3 className="text-sm font-semibold text-white">Review outcomes</h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {[
                  'dismiss',
                  'decline_content',
                  'notify_cite',
                  'warn',
                  'strike',
                  'restrict',
                  'suspend',
                  'ban',
                  'unban',
                  'lift_strike',
                  'lift_restriction',
                  'mark_disputed',
                ].map((id) => (
                  <label
                    key={id}
                    className="flex items-center gap-2 text-sm text-text-secondary"
                  >
                    <input
                      type="checkbox"
                      checked={form.actions.includes(id)}
                      onChange={() => setForm((f) => toggleAction(f, id))}
                    />
                    {conductActionLabel(id)}
                  </label>
                ))}
              </div>
              {firstDeclineBlocked ? (
                <p className="text-xs text-amber-200">
                  First off-brief miss: cite and decline only, unless you record
                  why the ladder is skipped.
                </p>
              ) : null}
              {form.actions.includes('strike') &&
                isFirstDeclineReason(detail.reasonCode) &&
                !detail.priorNotice && (
                  <div>
                    <label className={labelClass} htmlFor="skip-reason">
                      Why skip the first-decline rule
                    </label>
                    <input
                      id="skip-reason"
                      className={fieldClass}
                      value={form.skipLadderReason}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, skipLadderReason: e.target.value }))
                      }
                      placeholder="Harassment, repeat payload, ban evasion…"
                    />
                  </div>
                )}
              {form.actions.includes('restrict') && (
                <div className="grid sm:grid-cols-2 gap-2">
                  {['Claims', 'Ideas', 'Comments', 'Showcase'].map((k) => {
                    const key = `restrict${k}`;
                    return (
                      <label key={k} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(form[key])}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, [key]: e.target.checked }))
                          }
                        />
                        Block {k.toLowerCase()}
                      </label>
                    );
                  })}
                  <input
                    type="number"
                    min="1"
                    className={fieldClass}
                    value={form.restrictDays}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, restrictDays: e.target.value }))
                    }
                  />
                </div>
              )}
              {form.actions.includes('suspend') && (
                <div>
                  <label className={labelClass}>Suspend days</label>
                  <input
                    type="number"
                    min="1"
                    className={fieldClass}
                    value={form.suspendDays}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, suspendDays: e.target.value }))
                    }
                  />
                </div>
              )}
              <div>
                <label className={labelClass} htmlFor="cited-doc">
                  Code of Conduct section or project document
                </label>
                <input
                  id="cited-doc"
                  className={fieldClass}
                  value={form.citedDocument}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, citedDocument: e.target.value }))
                  }
                  placeholder="Code of Conduct · Content and discussion standards"
                  maxLength={240}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="staff-note">
                  Private staff note
                </label>
                <textarea
                  id="staff-note"
                  className={`${fieldClass} min-h-[3.5rem]`}
                  value={form.staffNote}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, staffNote: e.target.value }))
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={form.notify}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notify: e.target.checked }))
                  }
                />
                Send in-site notice (and email when configured)
              </label>
              {form.notify && (
                <textarea
                  className={`${fieldClass} min-h-[6rem]`}
                  value={form.noticeBody}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, noticeBody: e.target.value }))
                  }
                />
              )}
              <div>
                <label className={labelClass}>Case status after this review</label>
                <select
                  className={fieldClass}
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value }))
                  }
                >
                  <option value="">Automatic</option>
                  {CONDUCT_STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Apply review'}
              </Button>
            </Card>
          </form>
        </div>
      )}

      {view === 'history' && (
        <div className="space-y-2">
          <p className="text-sm text-text-secondary">
            Cases for {detail?.targetUsername || historyUserId || 'this account'}.
          </p>
          {(historyRows.length ? historyRows : rows).map((row) => (
            <button
              key={row.id}
              type="button"
              className="w-full text-left"
              onClick={() => void openCase(row.id)}
            >
              <Card className="bg-cyber-card/80">
                <span className="font-mono text-xs text-neon-cyan">
                  {row.caseCode}
                </span>
                <span className="text-sm text-white ml-2">
                  {conductStatusLabel(row.status)} ·{' '}
                  {conductReasonById(row.reasonCode).label}
                </span>
              </Card>
            </button>
          ))}
        </div>
      )}

      {view === 'detail' && !detail && !busy && (
        <Card className="bg-cyber-card/80 text-sm text-text-muted inline-flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Pick a case from the open queue.
        </Card>
      )}

      <Modal
        isOpen={confirmOpen}
        onClose={() => !busy && setConfirmOpen(false)}
        title="Confirm this action?"
        size="sm"
      >
        <p className="text-sm text-text-secondary leading-relaxed mb-4">
          Suspend, ban, and content removal are recorded on the account and in
          the audit log. Public credit is only revoked for the linked item.
        </p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmOpen(false)}
          >
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={() => void runApply()}>
            Confirm
          </Button>
        </div>
      </Modal>
    </section>
  );
};

export default ConductPanel;
