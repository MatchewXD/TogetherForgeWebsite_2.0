/**
 * Mark project as Completed / Released.
 * Collects release date, Play / Download / Buy links, and optional summary.
 * Reusable across Early / Mid / Late phase Edit pages.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ExternalLink,
  Package,
  AlertTriangle,
} from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Buttons';
import {
  emptyCompletionForm,
  completionFormFromProject,
  validateCompletionForm,
  completionPayloadFromForm,
  releasedDetailPath,
} from '../../utils/projectCompletion';
import { completeProject } from '../../services/projectsService';
import { displayProjectTitle } from '../../utils/ideaStatus';

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors';

const labelClass =
  'block text-sm font-mono tracking-widest text-neon-cyan mb-2';

/**
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {object|null} props.project
 * @param {(result: { project: object }) => void} [props.onSuccess]
 * @param {boolean} [props.isUpdate] - editing an already-completed project
 * @param {string} [props.phaseLabel] - e.g. "Early" for copy
 */
const ProjectCompleteModal = ({
  isOpen,
  onClose,
  project,
  onSuccess,
  isUpdate = false,
  phaseLabel = 'this phase',
}) => {
  const [form, setForm] = useState(emptyCompletionForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!isOpen || !project) return;
    setForm(completionFormFromProject(project));
    setError('');
    setSuccess(null);
    setSaving(false);
  }, [isOpen, project]);

  const title = project ? displayProjectTitle(project) : 'Project';
  const modalTitle = isUpdate
    ? `Update release · ${title}`
    : `Mark as Released · ${title}`;

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!project?.id) return;

    const check = validateCompletionForm(form, {
      requireConfirm: !isUpdate,
    });
    if (!check.ok) {
      setError(check.error);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = completionPayloadFromForm(form);
      // On update of an already-released title, do not force re-confirm UX
      const updated = await completeProject(project.id, payload);
      const resultProject = updated || {
        ...project,
        ...payload,
        status: 'Completed',
        completed_at: payload.completed_at,
      };
      setSuccess({
        project: resultProject,
        detailPath: releasedDetailPath(resultProject),
      });
      onSuccess?.({ project: resultProject });
    } catch (err) {
      console.error('[ProjectCompleteModal]', err);
      setError(
        err?.message ||
          'Failed to save completion. Run supabase/sql/supabase_projects_completion.sql if columns are missing.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    onClose?.();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={modalTitle}
      size="lg"
    >
      {success ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-forge-gold/40 bg-forge-gold/10 text-forge-gold shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </span>
            <div>
              <p className="font-semibold text-white text-lg">
                {isUpdate ? 'Release details updated' : 'Project released'}
              </p>
              <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                <span className="text-white font-medium">{title}</span>
                {!isUpdate && (
                  <>
                    {' '}
                    left the active board for {phaseLabel}, appears under
                    Completed on the phase hub, and is live on Released Games.
                  </>
                )}
                {isUpdate && (
                  <> release date, summary, and store links were saved.</>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <Link to={success.detailPath} onClick={handleClose}>
              <Button className="gap-2 w-full sm:w-auto">
                <Package className="w-4 h-4" />
                View Released Game page
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </Button>
            </Link>
            <Link to="/released" onClick={handleClose}>
              <Button variant="secondary" className="gap-2 w-full sm:w-auto">
                Released Games listing
              </Button>
            </Link>
            <Button variant="ghost" onClick={handleClose}>
              Back to editor
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {!isUpdate && (
            <div className="rounded-xl border border-forge-gold/30 bg-forge-gold/5 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-forge-gold shrink-0 mt-0.5" />
              <p className="text-sm text-text-secondary leading-relaxed">
                Completing a project removes it from active / In Development
                work on the {phaseLabel} hub, lists it under{' '}
                <span className="text-white">Completed in this phase</span>, and
                adds it to{' '}
                <span className="text-white">Released Games</span> with a public
                detail page. Tasks and contributors stay intact.
              </p>
            </div>
          )}

          <div>
            <label className={labelClass} htmlFor="complete-release-date">
              Release date <span className="text-neon-magenta">*</span>
            </label>
            <input
              id="complete-release-date"
              type="date"
              required
              className={fieldClass}
              value={form.completed_at}
              onChange={(e) => setField('completed_at', e.target.value)}
            />
          </div>

          <div className="grid sm:grid-cols-1 gap-4">
            <div>
              <label className={labelClass} htmlFor="complete-play">
                Play link
              </label>
              <input
                id="complete-play"
                type="url"
                inputMode="url"
                placeholder="https://…"
                className={fieldClass}
                value={form.play_url}
                onChange={(e) => setField('play_url', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="complete-download">
                Download link
              </label>
              <input
                id="complete-download"
                type="url"
                inputMode="url"
                placeholder="https://…"
                className={fieldClass}
                value={form.download_url}
                onChange={(e) => setField('download_url', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="complete-buy">
                Buy link
              </label>
              <input
                id="complete-buy"
                type="url"
                inputMode="url"
                placeholder="https://store.steampowered.com/…"
                className={fieldClass}
                value={form.buy_url}
                onChange={(e) => setField('buy_url', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="complete-summary">
              Short release summary (optional)
            </label>
            <textarea
              id="complete-summary"
              className={`${fieldClass} min-h-[4.5rem]`}
              maxLength={400}
              placeholder="One or two sentences for the phase hub and Released Games cards"
              value={form.release_summary}
              onChange={(e) => setField('release_summary', e.target.value)}
            />
            <p className="mt-1.5 text-xs text-text-muted">
              Shown on completed listings. Full description stays on the project
              record.
            </p>
          </div>

          {!isUpdate && (
            <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-cyber-border bg-cyber-surface/50 p-4">
              <input
                type="checkbox"
                className="mt-1 rounded border-cyber-border text-neon-cyan focus:ring-neon-cyan"
                checked={Boolean(form.confirmed)}
                onChange={(e) => setField('confirmed', e.target.checked)}
              />
              <span className="text-sm text-text-secondary leading-relaxed">
                I confirm this project is finished and should be marked{' '}
                <span className="text-white font-semibold">Completed</span>. It
                will leave the active board and appear on Released Games.
              </span>
            </label>
          )}

          {error && (
            <p className="text-sm text-semantic-danger border border-semantic-danger/40 rounded-lg px-3 py-2 bg-semantic-danger/10">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="gap-2"
              disabled={saving || (!isUpdate && !form.confirmed)}
            >
              <CheckCircle2 className="w-4 h-4" />
              {saving
                ? 'Saving…'
                : isUpdate
                  ? 'Save release details'
                  : 'Mark as Released'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default ProjectCompleteModal;
