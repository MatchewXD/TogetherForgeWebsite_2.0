/**
 * Project workspace: staff dialog for the project GitHub URL.
 * Presentational: all state and handlers live in ProjectWorkspace and arrive as props.
 */

import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Buttons';

export default function ProjectGithubModal({
  githubEditBusy,
  githubEditDraft,
  githubEditOpen,
  projectUuid,
  saveProjectGithub,
  setGithubEditDraft,
  setGithubEditOpen,
}) {
  return (
    <Modal
      isOpen={githubEditOpen}
      onClose={() => !githubEditBusy && setGithubEditOpen(false)}
      title="Project repository"
      size="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          Link this project’s GitHub repository or Project board. Contributors
          see a “View on GitHub” button on the Task Board and are guided to do
          technical work there.
        </p>
        <div>
          <label
            className="block text-xs font-mono tracking-widest text-text-muted uppercase mb-1.5"
            htmlFor="project-github-url"
          >
            GitHub URL
          </label>
          <input
            id="project-github-url"
            type="url"
            inputMode="url"
            value={githubEditDraft}
            onChange={(e) => setGithubEditDraft(e.target.value)}
            placeholder="https://github.com/org/repo"
            className="w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => void saveProjectGithub()}
            disabled={githubEditBusy || !projectUuid}
          >
            {githubEditBusy ? 'Saving…' : 'Save'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setGithubEditOpen(false)}
            disabled={githubEditBusy}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
