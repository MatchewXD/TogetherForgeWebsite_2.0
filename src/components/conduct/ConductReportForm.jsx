/**
 * Signed-in member report. Creates a Conduct case. No public banner.
 */

import { useState } from 'react';
import Button from '../ui/Buttons';
import {
  CONDUCT_REASONS,
  CONDUCT_CONTENT_TYPES,
} from '../../constants/conduct';
import { submitConductReport } from '../../services/conductService';

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none';
const labelClass =
  'block text-[10px] font-mono tracking-widest uppercase text-text-muted mb-1';

export default function ConductReportForm({
  contentType = 'user',
  contentId = null,
  targetUserId = null,
  projectId = null,
  contentPath = '',
  lockType = false,
  onDone,
  onCancel,
}) {
  const [reasonCode, setReasonCode] = useState('off_brief');
  const [details, setDetails] = useState('');
  const [type, setType] = useState(contentType);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    setBusy(true);
    setError('');
    try {
      await submitConductReport({
        contentType: type,
        contentId,
        targetUserId,
        projectId,
        contentPath,
        reasonCode,
        details,
      });
      setDone(true);
    } catch (err) {
      setError(err?.message || 'Could not send the report.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-3" role="status">
        <p className="text-white font-semibold">Report received</p>
        <p className="text-sm text-text-secondary leading-relaxed">
          Staff will review this privately. You will not see a public outcome,
          and the other person is not told who reported them.
        </p>
        {onDone ? (
          <Button type="button" size="sm" onClick={() => onDone()}>
            Close
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-text-secondary leading-relaxed">
        Private report to staff. This is not a public call-out.
      </p>
      {!lockType && (
        <div>
          <label className={labelClass} htmlFor="cr-type">
            What are you reporting
          </label>
          <select
            id="cr-type"
            className={fieldClass}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {CONDUCT_CONTENT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className={labelClass} htmlFor="cr-reason">
          What’s wrong
        </label>
        <select
          id="cr-reason"
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
        <label className={labelClass} htmlFor="cr-details">
          Extra context (optional)
        </label>
        <textarea
          id="cr-details"
          className={`${fieldClass} min-h-[5rem] resize-y`}
          maxLength={4000}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="What happened, and where"
        />
      </div>
      {error ? (
        <p className="text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send report'}
        </Button>
      </div>
    </form>
  );
}
