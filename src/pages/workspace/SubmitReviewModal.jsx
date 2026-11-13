/**
 * Project workspace: submit-for-review dialog.
 * Presentational: all state and handlers live in ProjectWorkspace and arrive as props.
 */

import Modal from '../../components/ui/Modal';
import TaskCategoryBadge from '../../components/ui/TaskCategoryBadge';
import {
  isCodeLikeCategory,
  getReviewNoteHint,
  REVIEW_EVIDENCE_MIN_CHARS,
  getReviewEvidenceHint,
  getReviewLinkPlaceholder,
} from '../../constants/taskReviewEvidence';
import { isChecklistComplete } from '../../services/tasksService';
import { Trash2 } from 'lucide-react';
import Button from '../../components/ui/Buttons';

export default function SubmitReviewModal({
  actionBusy,
  addEvidenceLinkRow,
  claimQuota,
  closeSubmitReviewFlow,
  evidenceDependsOn,
  evidenceDraft,
  evidenceLinkError,
  evidenceLinks,
  evidenceLinkWarning,
  evidenceNoteError,
  handleSubmitForReview,
  projectGithubUrl,
  removeEvidenceLinkRow,
  selectedTask,
  setEvidenceDependsOn,
  setEvidenceDraft,
  setEvidenceLinkError,
  setEvidenceLinkWarning,
  setEvidenceNoteError,
  submitReviewOpen,
  subtasksDraft,
  updateEvidenceLink,
}) {
  return (
    <Modal
      isOpen={Boolean(selectedTask) && submitReviewOpen}
      onClose={closeSubmitReviewFlow}
      title="Submit for Review"
      size="lg"
    >
      {selectedTask && (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-mono tracking-widest text-text-muted uppercase mb-1">
              Task
            </p>
            <h3 className="text-lg font-semibold text-white leading-snug">
              {selectedTask.title}
            </h3>
            {selectedTask.category && (
              <p className="mt-1.5">
                <TaskCategoryBadge
                  category={selectedTask.category}
                  size="sm"
                />
              </p>
            )}
            <p className="text-sm text-text-secondary mt-2 leading-relaxed">
              Reviewers need a short summary plus a link they can open. After
              you submit, this task moves to Ready for Review on the board.
            </p>
            {isCodeLikeCategory(selectedTask.category) && (
              <p className="text-xs text-neon-cyan/90 mt-2 leading-relaxed">
                Code task: prefer a GitHub PR, branch, or commit as the main
                evidence link
                {projectGithubUrl ? (
                  <>
                    {' '}
                    (
                    <a
                      href={projectGithubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-white"
                    >
                      project repo
                    </a>
                    )
                  </>
                ) : null}
                .
              </p>
            )}
          </div>

          {subtasksDraft.length > 0 && (
            <div className="rounded-lg border border-cyber-border bg-cyber-surface/50 px-3 py-2 text-sm text-text-secondary">
              Checklist{' '}
              <span className="font-mono text-text-muted">
                {subtasksDraft.filter((s) => s.done).length}/
                {subtasksDraft.length} done
              </span>
              {!isChecklistComplete(subtasksDraft) && (
                <span className="text-semantic-warning">
                  {' '}
                  · complete all items before submitting
                </span>
              )}
            </div>
          )}

          {/* Evidence: 1) description note  2) links — separate validation */}
          <div className="space-y-4">
            {/* 1. Description */}
            <section
              className="space-y-2 rounded-xl border border-cyber-border bg-cyber-surface/40 p-3 sm:p-4"
              aria-labelledby="evidence-note-heading"
            >
              <div>
                <h4
                  id="evidence-note-heading"
                  className="text-sm font-semibold text-white"
                >
                  1. What you delivered
                </h4>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  {getReviewNoteHint(selectedTask.category)}
                </p>
              </div>
              <label className="sr-only" htmlFor="task-evidence-draft">
                What you delivered
              </label>
              <textarea
                id="task-evidence-draft"
                value={evidenceDraft}
                onChange={(e) => {
                  setEvidenceDraft(e.target.value);
                  if (evidenceNoteError) setEvidenceNoteError(null);
                }}
                rows={4}
                placeholder={
                  isCodeLikeCategory(selectedTask.category)
                    ? 'e.g. Added dash ability, wired input, tested on keyboard… (no URL here)'
                    : 'Brief summary of what you delivered… (no URL here)'
                }
                aria-invalid={Boolean(evidenceNoteError)}
                aria-describedby={
                  evidenceNoteError
                    ? 'task-evidence-note-error'
                    : 'task-evidence-note-help'
                }
                className={`w-full bg-cyber-surface border rounded-lg px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none transition-colors text-sm resize-y min-h-[6rem] ${
                  evidenceNoteError
                    ? 'border-semantic-warning focus:border-semantic-warning'
                    : 'border-cyber-border focus:border-neon-cyan'
                }`}
              />
              {evidenceNoteError ? (
                <p
                  id="task-evidence-note-error"
                  role="alert"
                  className="text-xs text-semantic-warning leading-snug"
                >
                  {evidenceNoteError}
                </p>
              ) : (
                <p
                  id="task-evidence-note-help"
                  className="text-[11px] text-text-muted"
                >
                  Required · at least {REVIEW_EVIDENCE_MIN_CHARS} characters
                  (description only)
                </p>
              )}
            </section>

            {/* 2. Links */}
            <section
              id="task-evidence-links-section"
              className={`space-y-2 rounded-xl border bg-cyber-surface/40 p-3 sm:p-4 ${
                evidenceLinkError
                  ? 'border-semantic-warning/70 ring-1 ring-semantic-warning/30'
                  : 'border-cyber-border'
              }`}
              aria-labelledby="evidence-links-heading"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4
                    id="evidence-links-heading"
                    className="text-sm font-semibold text-white"
                  >
                    2. Evidence links
                  </h4>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    {isCodeLikeCategory(selectedTask.category)
                      ? 'Paste the GitHub PR, branch, or commit URL here (not in the description above).'
                      : 'Paste at least one https link a reviewer can open (Drive, Figma, Discord, GitHub, etc.).'}
                  </p>
                  <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed">
                    {getReviewEvidenceHint(selectedTask.category)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addEvidenceLinkRow}
                  disabled={evidenceLinks.length >= 8}
                  className="shrink-0 text-xs text-neon-cyan hover:text-white disabled:opacity-40"
                >
                  + Add link
                </button>
              </div>
              <div className="space-y-2">
                {evidenceLinks.map((link, index) => (
                  <div key={`ev-link-${index}`} className="flex gap-2">
                    <input
                      id={
                        index === 0
                          ? 'task-evidence-link-0'
                          : `task-evidence-link-${index}`
                      }
                      type="url"
                      inputMode="url"
                      value={link}
                      onChange={(e) => {
                        updateEvidenceLink(index, e.target.value);
                        if (evidenceLinkError) setEvidenceLinkError(null);
                        if (evidenceLinkWarning) setEvidenceLinkWarning(null);
                      }}
                      placeholder={getReviewLinkPlaceholder(
                        selectedTask.category
                      )}
                      required={index === 0}
                      aria-invalid={Boolean(evidenceLinkError)}
                      aria-describedby={
                        evidenceLinkError
                          ? 'task-evidence-link-error'
                          : 'task-evidence-link-help'
                      }
                      className={`min-w-0 flex-1 bg-cyber-surface border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none ${
                        evidenceLinkError
                          ? 'border-semantic-warning focus:border-semantic-warning'
                          : 'border-cyber-border focus:border-neon-cyan'
                      }`}
                    />
                    <button
                      type="button"
                      aria-label="Remove link"
                      className="shrink-0 p-2 rounded-lg border border-cyber-border text-text-muted hover:text-red-300 hover:border-red-400/40"
                      onClick={() => removeEvidenceLinkRow(index)}
                      disabled={
                        evidenceLinks.length <= 1 &&
                        !String(link || '').trim()
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              {evidenceLinkError ? (
                <p
                  id="task-evidence-link-error"
                  role="alert"
                  className="text-xs text-semantic-warning leading-snug"
                >
                  {evidenceLinkError}
                </p>
              ) : evidenceLinkWarning ? (
                <p
                  id="task-evidence-link-help"
                  className="text-xs text-semantic-warning/90 leading-snug"
                >
                  {evidenceLinkWarning}
                </p>
              ) : (
                <p
                  id="task-evidence-link-help"
                  className="text-[11px] text-text-muted leading-relaxed"
                >
                  Required · full https:// URL ·{' '}
                  {isCodeLikeCategory(selectedTask.category)
                    ? 'GitHub PR / branch / commit preferred for Code'
                    : 'Drive, Figma, Discord, GitHub all fine by craft'}
                </p>
              )}
            </section>

            {claimQuota?.signedIn && (
              <p className="text-[11px] font-mono text-text-muted px-0.5">
                Submits used: {claimQuota.submitsLast24h ?? 0}/
                {claimQuota.submitLimit24h ?? 2} (24h)
                {claimQuota.submitCooldownEndsAt &&
                new Date(claimQuota.submitCooldownEndsAt) > new Date()
                  ? ' · cooldown active'
                  : ''}
              </p>
            )}
          </div>

          <div>
            <label
              className="block text-xs font-mono tracking-widest text-text-muted uppercase mb-1.5"
              htmlFor="task-depends-on"
            >
              Blocked by / depends on (optional)
            </label>
            <textarea
              id="task-depends-on"
              value={evidenceDependsOn}
              onChange={(e) => setEvidenceDependsOn(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="e.g. Continues from “Player dash VFX” · needs audio bank merge first"
              className="w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none resize-y"
            />
            <p className="text-[11px] text-text-muted mt-1">
              Helps the next person and Project Leads. Not enforced
              automatically.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-cyber-border">
            <Button
              size="sm"
              variant="success"
              onClick={handleSubmitForReview}
              disabled={
                actionBusy || !isChecklistComplete(subtasksDraft)
              }
            >
              {actionBusy ? 'Submitting…' : 'Submit for Review'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={closeSubmitReviewFlow}
              disabled={actionBusy}
            >
              Back to task
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
