/**
 * Staff control on review screens: Open Conduct case.
 */

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import Button from '../ui/Buttons';
import Modal from '../ui/Modal';
import {
  CONDUCT_REASONS,
  CONDUCT_CONTENT_TYPES,
} from '../../constants/conduct';
import { openConductCase } from '../../services/conductService';

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none';
const labelClass =
  'block text-[10px] font-mono tracking-widest uppercase text-text-muted mb-1';

export default function OpenConductCaseButton({
  targetUserId,
  contentType = 'user',
  contentId = null,
  projectId = null,
  contentPath = '',
  onOpened,
}) {
  const [open, setOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState('off_brief');
  const [details, setDetails] = useState('');
  const [citedDocument, setCitedDocument] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!targetUserId) return null;

  const submit = async (e) => {
    e?.preventDefault?.();
    setBusy(true);
    setError('');
    try {
      const result = await openConductCase({
        targetUserId,
        contentType,
        contentId,
        projectId,
        contentPath,
        reasonCode,
        details,
        citedDocument,
      });
      setOpen(false);
      onOpened?.(result);
    } catch (err) {
      setError(err?.message || 'Could not open the case.');
    } finally {
      setBusy(false);
    }
  };

  const typeLabel =
    CONDUCT_CONTENT_TYPES.find((t) => t.id === contentType)?.label || 'content';

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <ShieldAlert className="w-3.5 h-3.5" />
        Open Conduct case
      </Button>
      <Modal
        isOpen={open}
        onClose={() => !busy && setOpen(false)}
        title="Open Conduct case"
        size="md"
      >
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Opens a staff case for this {typeLabel.toLowerCase()}. It does not
            apply a strike until you review the case.
          </p>
          <div>
            <label className={labelClass} htmlFor="occ-reason">
              Reason
            </label>
            <select
              id="occ-reason"
              className={fieldClass}
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
            >
              {CONDUCT_REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="occ-doc">
              Document cited (optional)
            </label>
            <input
              id="occ-doc"
              className={fieldClass}
              value={citedDocument}
              onChange={(e) => setCitedDocument(e.target.value)}
              placeholder="Code of Conduct · Prohibited behavior"
              maxLength={240}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="occ-details">
              Staff context (optional)
            </label>
            <textarea
              id="occ-details"
              className={`${fieldClass} min-h-[4.5rem] resize-y`}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={4000}
            />
          </div>
          {error ? (
            <p className="text-sm text-red-200" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Opening…' : 'Open case'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
