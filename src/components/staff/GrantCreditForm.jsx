/**
 * Shared Grant Credit form — Moderator dashboard and project Contributors.
 * Staff/moderators only. Does not complete tasks.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import Button from '../ui/Buttons';
import Modal from '../ui/Modal';
import CharCount from '../ui/CharCount';
import UserAvatar from '../ui/UserAvatar';
import UserNameWithBadge from '../badges/UserNameWithBadge';
import {
  STAFF_CREDIT_CATEGORIES,
  STAFF_CREDIT_NOTE_MAX,
  STAFF_CREDIT_PUBLIC_MAX,
  STAFF_CREDIT_STUDIO_ID,
  looksLikeEmail,
  staffCreditCategoryById,
} from '../../constants/staffCredit';
import { listCatalogByCategory } from '../../constants/badges';
import {
  grantStaffCredit,
  listCreditProjects,
  searchMembersForCredit,
  todayIsoDate,
  updateStaffCredit,
} from '../../services/staffCreditService';

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none';
const labelClass =
  'block text-[10px] font-mono tracking-widest uppercase text-text-muted mb-1';

function emptyForm(projectId) {
  return {
    projectId: projectId || STAFF_CREDIT_STUDIO_ID,
    grantCategory: 'community_moderation',
    publicLine: '',
    privateNote: '',
    points: '',
    badgeKey: '',
    creditedOn: todayIsoDate(),
    pendingEmail: '',
  };
}

function formFromGrant(grant, fallbackProjectId) {
  return {
    projectId: grant?.projectId || fallbackProjectId || STAFF_CREDIT_STUDIO_ID,
    grantCategory: grant?.grantCategory || 'other',
    publicLine: grant?.publicLine || '',
    privateNote: grant?.privateNote || '',
    points: grant?.points == null ? '' : String(grant.points),
    badgeKey: grant?.badgeKey || '',
    creditedOn: grant?.creditedOn || todayIsoDate(),
    pendingEmail: grant?.pendingEmail || '',
  };
}

/**
 * @param {{
 *   initialProjectId?: string|null,
 *   lockProject?: boolean,
 *   editingGrant?: object|null,
 *   onSaved?: (result: object) => void,
 *   onCancel?: () => void,
 * }} props
 */
const GrantCreditForm = ({
  initialProjectId = null,
  lockProject = false,
  editingGrant = null,
  onSaved,
  onCancel,
}) => {
  const isEdit = Boolean(editingGrant?.id);
  const [form, setForm] = useState(() =>
    isEdit
      ? formFromGrant(editingGrant, initialProjectId)
      : emptyForm(initialProjectId)
  );
  const [projects, setProjects] = useState([]);
  const [member, setMember] = useState(
    editingGrant?.userId
      ? {
          id: editingGrant.userId,
          username: editingGrant.username,
          avatarUrl: editingGrant.avatarUrl,
          pinnedBadgeKey: editingGrant.pinnedBadgeKey,
        }
      : null
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState(false);

  useEffect(() => {
    let mounted = true;
    listCreditProjects()
      .then((rows) => {
        if (mounted) setProjects(rows);
      })
      .catch(() => {
        if (mounted) setProjects([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (isEdit || member || q.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    let cancelled = false;
    setSearching(true);
    setSearchError('');
    const timer = window.setTimeout(async () => {
      try {
        const found = await searchMembersForCredit(q);
        if (!cancelled) {
          setResults(found);
          setSearching(false);
        }
      } catch (err) {
        if (!cancelled) {
          setResults([]);
          setSearching(false);
          setSearchError(err?.message || 'Could not search members.');
        }
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, member, isEdit]);

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const pickMember = (profile) => {
    setMember(profile);
    setQuery('');
    setResults([]);
    setForm((f) => ({ ...f, pendingEmail: '' }));
    setError('');
  };

  const clearMember = () => {
    setMember(null);
    setError('');
  };

  const useQueryAsEmail = () => {
    const email = query.trim().toLowerCase();
    if (!looksLikeEmail(email)) return;
    setMember(null);
    setForm((f) => ({ ...f, pendingEmail: email }));
    setQuery('');
    setResults([]);
  };

  const cat = staffCreditCategoryById(form.grantCategory);
  const projectLabel = useMemo(() => {
    const p = projects.find((x) => x.id === form.projectId);
    return p?.title || 'Together Forge (studio)';
  }, [projects, form.projectId]);

  const subjectLabel = member
    ? member.username || 'Member'
    : form.pendingEmail
      ? form.pendingEmail
      : 'nobody yet';

  const validate = () => {
    const line = form.publicLine.trim();
    if (line.length < 3 || line.length > STAFF_CREDIT_PUBLIC_MAX) {
      return `Public credit line must be 3–${STAFF_CREDIT_PUBLIC_MAX} characters.`;
    }
    if (!isEdit && !member && !looksLikeEmail(form.pendingEmail)) {
      return 'Pick a member or enter an email.';
    }
    if (form.privateNote.length > STAFF_CREDIT_NOTE_MAX) {
      return 'Staff note is too long.';
    }
    return '';
  };

  const requestSubmit = (e) => {
    e?.preventDefault?.();
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setError('');
    setDuplicatePrompt(false);
    setConfirmOpen(true);
  };

  const submit = async ({ duplicate = false } = {}) => {
    setBusy(true);
    setError('');
    try {
      if (isEdit) {
        await updateStaffCredit(editingGrant.id, {
          grantCategory: form.grantCategory,
          publicLine: form.publicLine,
          privateNote: form.privateNote,
          points: form.points,
          badgeKey: form.badgeKey,
          creditedOn: form.creditedOn,
        });
        setConfirmOpen(false);
        onSaved?.({ ok: true, id: editingGrant.id, edited: true });
        return;
      }
      const result = await grantStaffCredit({
        userId: member?.id || null,
        pendingEmail: member ? null : form.pendingEmail,
        projectId: form.projectId,
        grantCategory: form.grantCategory,
        publicLine: form.publicLine,
        privateNote: form.privateNote,
        points: form.points,
        badgeKey: form.badgeKey,
        creditedOn: form.creditedOn,
        allowDuplicate: duplicate || allowDuplicate,
      });
      if (result?.code === 'DUPLICATE') {
        setDuplicatePrompt(true);
        setConfirmOpen(true);
        return;
      }
      setConfirmOpen(false);
      setAllowDuplicate(false);
      onSaved?.(result);
    } catch (err) {
      setError(err?.message || 'Could not save credit.');
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const badgeGroups = listCatalogByCategory();

  return (
    <>
      <form onSubmit={requestSubmit} className="space-y-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          Credit off-site help on the project Contributors list and the
          person&apos;s profile. This does not complete a task.
        </p>

        {!isEdit && (
          <div>
            <label className={labelClass} htmlFor="gc-search">
              Member
            </label>
            {member ? (
              <div className="flex items-center gap-3 rounded-lg border border-cyber-border bg-cyber-surface px-3 py-2">
                <UserAvatar
                  src={member.avatarUrl}
                  name={member.username || 'Member'}
                  username={member.username}
                  size="sm"
                />
                <UserNameWithBadge
                  username={member.username}
                  displayName={member.username || 'Member'}
                  pinnedBadgeKey={member.pinnedBadgeKey}
                  linkClassName="font-semibold text-white truncate"
                />
                <button
                  type="button"
                  className="ml-auto text-text-muted hover:text-white"
                  onClick={clearMember}
                  aria-label="Clear member"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="gc-search"
                    type="search"
                    className={`${fieldClass} pl-9`}
                    placeholder="Display name, username, or email"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                {searching && (
                  <p className="text-xs text-text-muted mt-1 inline-flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Searching…
                  </p>
                )}
                {searchError && (
                  <p className="text-xs text-red-200 mt-1">{searchError}</p>
                )}
                {results.length > 0 && (
                  <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-cyber-border divide-y divide-cyber-border">
                    {results.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-cyber-surface"
                          onClick={() => pickMember(p)}
                        >
                          <UserAvatar
                            src={p.avatarUrl}
                            name={p.username || 'Member'}
                            username={p.username}
                            size="sm"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm text-white truncate">
                              {p.username || 'Member'}
                            </span>
                            {p.email ? (
                              <span className="block text-[11px] font-mono text-text-muted truncate">
                                {p.email}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {query.trim().length >= 2 &&
                  !searching &&
                  results.length === 0 &&
                  looksLikeEmail(query) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="mt-2"
                      onClick={useQueryAsEmail}
                    >
                      No account yet — credit {query.trim().toLowerCase()}
                    </Button>
                  )}
                <div className="mt-2">
                  <label className={labelClass} htmlFor="gc-email">
                    Or credit an email (binds when they register)
                  </label>
                  <input
                    id="gc-email"
                    type="email"
                    className={fieldClass}
                    placeholder="name@example.com"
                    value={form.pendingEmail}
                    onChange={(e) => setField('pendingEmail', e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {isEdit && (
          <div>
            <p className={labelClass}>Member</p>
            <p className="text-sm text-white">
              {editingGrant.username ||
                editingGrant.pendingEmail ||
                'Pending account'}
            </p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="gc-project">
              Project
            </label>
            <select
              id="gc-project"
              className={fieldClass}
              value={form.projectId}
              disabled={lockProject || isEdit}
              onChange={(e) => setField('projectId', e.target.value)}
            >
              {form.projectId &&
                !projects.some((p) => p.id === form.projectId) && (
                  <option value={form.projectId}>Current project</option>
                )}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="gc-cat">
              Category
            </label>
            <select
              id="gc-cat"
              className={fieldClass}
              value={form.grantCategory}
              onChange={(e) => setField('grantCategory', e.target.value)}
            >
              {STAFF_CREDIT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="gc-line">
            Public credit line
          </label>
          <input
            id="gc-line"
            type="text"
            className={fieldClass}
            maxLength={STAFF_CREDIT_PUBLIC_MAX}
            placeholder="Discord moderation, September 2026"
            value={form.publicLine}
            onChange={(e) => setField('publicLine', e.target.value)}
            required
          />
          <CharCount value={form.publicLine} max={STAFF_CREDIT_PUBLIC_MAX} />
        </div>

        <div>
          <label className={labelClass} htmlFor="gc-note">
            Private staff note (optional)
          </label>
          <textarea
            id="gc-note"
            className={`${fieldClass} min-h-[4.5rem] resize-y`}
            maxLength={STAFF_CREDIT_NOTE_MAX}
            placeholder="Only staff see this"
            value={form.privateNote}
            onChange={(e) => setField('privateNote', e.target.value)}
          />
          <CharCount value={form.privateNote} max={STAFF_CREDIT_NOTE_MAX} />
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className={labelClass} htmlFor="gc-date">
              Contribution date
            </label>
            <input
              id="gc-date"
              type="date"
              className={fieldClass}
              value={form.creditedOn}
              onChange={(e) => setField('creditedOn', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="gc-points">
              Points (optional)
            </label>
            <input
              id="gc-points"
              type="number"
              min="0"
              step="1"
              className={fieldClass}
              placeholder="None"
              value={form.points}
              onChange={(e) => setField('points', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="gc-badge">
              Badge (optional)
            </label>
            <select
              id="gc-badge"
              className={fieldClass}
              value={form.badgeKey}
              onChange={(e) => setField('badgeKey', e.target.value)}
            >
              <option value="">None</option>
              {badgeGroups.map((g) => (
                <optgroup key={g.category} label={g.label}>
                  {g.badges
                    .filter((b) => b.key !== 'status_active_subscriber')
                    .map((b) => (
                      <option key={b.key} value={b.key}>
                        {b.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-200" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={busy}>
            {isEdit ? 'Save changes' : 'Grant credit'}
          </Button>
        </div>
      </form>

      <Modal
        isOpen={confirmOpen}
        onClose={() => !busy && setConfirmOpen(false)}
        title={
          duplicatePrompt
            ? 'Grant this credit again?'
            : isEdit
              ? 'Save credit changes?'
              : 'Grant this credit?'
        }
        size="sm"
      >
        {duplicatePrompt ? (
          <p className="text-sm text-text-secondary leading-relaxed mb-4">
            The same person already has this public line on this project in{' '}
            {cat.label}. Grant a duplicate only if that is intentional.
          </p>
        ) : (
          <div className="text-sm text-text-secondary leading-relaxed mb-4 space-y-1">
            <p>
              <span className="text-text-muted">Person:</span>{' '}
              <span className="text-white">{subjectLabel}</span>
            </p>
            <p>
              <span className="text-text-muted">Project:</span>{' '}
              <span className="text-white">{projectLabel}</span>
            </p>
            <p>
              <span className="text-text-muted">Category:</span>{' '}
              <span className="text-white">{cat.label}</span>
            </p>
            <p>
              <span className="text-text-muted">Public line:</span>{' '}
              <span className="text-white">{form.publicLine.trim()}</span>
            </p>
          </div>
        )}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => setConfirmOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              if (duplicatePrompt) {
                setAllowDuplicate(true);
                void submit({ duplicate: true });
                return;
              }
              void submit();
            }}
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : duplicatePrompt ? (
              'Grant duplicate'
            ) : isEdit ? (
              'Save'
            ) : (
              'Confirm grant'
            )}
          </Button>
        </div>
      </Modal>
    </>
  );
};

export default GrantCreditForm;
