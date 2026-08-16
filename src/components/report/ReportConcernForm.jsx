/**
 * Private “Report a concern” form (moderation / community issues).
 * Calm tone; no account required. Delivered only to staff email.
 */
import { useState } from 'react';
import Button from '../ui/Buttons';
import { submitConcernReport } from '../../services/reportConcernService';

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none';
const labelClass =
  'block text-xs font-mono tracking-widest text-neon-cyan uppercase mb-1.5';

const WHERE_OPTIONS = [
  { id: 'discord', label: 'Discord' },
  { id: 'website', label: 'Website' },
  { id: 'both', label: 'Both' },
];

/**
 * @param {object} props
 * @param {() => void} [props.onDone]
 * @param {() => void} [props.onCancel]
 * @param {string} [props.formId]
 */
export default function ReportConcernForm({
  onDone,
  onCancel,
  formId = 'report-concern-form',
}) {
  const [whatHappened, setWhatHappened] = useState('');
  const [whereHappened, setWhereHappened] = useState('');
  const [reference, setReference] = useState('');
  const [contact, setContact] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await submitConcernReport({
        whatHappened,
        whereHappened,
        reference,
        contact,
        honeypot,
      });
      if (!result.ok) {
        setError(result.error || 'Could not send report.');
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div
        id={formId}
        className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-6 text-center space-y-3"
        role="status"
      >
        <p className="text-lg font-semibold text-white">Report received</p>
        <p className="text-sm text-text-secondary leading-relaxed max-w-md mx-auto">
          Thank you. Your report was sent privately to the people who handle
          community concerns. No further action is needed on your part unless
          you chose to leave contact details.
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
    <form id={formId} onSubmit={onSubmit} className="relative space-y-4">
      <p className="text-sm text-text-secondary leading-relaxed">
        Use this only for community or moderation concerns. Submissions are
        private and are not shown on the site.
      </p>

      <div
        className="rounded-lg border border-cyber-border/80 bg-cyber-surface/50 px-3.5 py-3 text-sm text-text-secondary leading-relaxed space-y-2"
        role="note"
      >
        <p>You can submit this report anonymously.</p>
        <p>We do not punish people for good-faith reports.</p>
        <p>
          Retaliation against someone for reporting a concern is itself a
          serious violation of the Community Guidelines.
        </p>
      </div>

      <div>
        <label className={labelClass} htmlFor={`${formId}-what`}>
          What happened *
        </label>
        <textarea
          id={`${formId}-what`}
          className={fieldClass}
          rows={4}
          required
          maxLength={4000}
          value={whatHappened}
          onChange={(e) => setWhatHappened(e.target.value)}
          placeholder="A short, clear description of the concern."
        />
      </div>

      <div>
        <label className={labelClass} htmlFor={`${formId}-where`}>
          Where it happened *
        </label>
        <select
          id={`${formId}-where`}
          className={fieldClass}
          required
          value={whereHappened}
          onChange={(e) => setWhereHappened(e.target.value)}
        >
          <option value="">Select…</option>
          {WHERE_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor={`${formId}-ref`}>
          Optional reference
        </label>
        <input
          id={`${formId}-ref`}
          className={fieldClass}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          maxLength={500}
          placeholder="Link, message ID, channel, page, etc."
        />
      </div>

      <div>
        <label className={labelClass} htmlFor={`${formId}-contact`}>
          Contact (optional)
        </label>
        <input
          id={`${formId}-contact`}
          className={fieldClass}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={200}
          placeholder="Email or Discord username"
          autoComplete="off"
        />
        <p className="mt-1.5 text-[11px] text-text-muted leading-relaxed">
          Leave blank to stay anonymous. If you include contact info, we may
          follow up only about this report.
        </p>
      </div>

      {/* Honeypot — hidden from people, filled by simple bots */}
      <div
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
        aria-hidden="true"
      >
        <label htmlFor={`${formId}-website`}>Website</label>
        <input
          id={`${formId}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {error ? (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" disabled={busy} className="gap-2">
          {busy ? 'Sending…' : 'Submit report'}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => onCancel()}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
