/**
 * Staff-only Suggested Tasks queue.
 * Accept copies the card onto Staging. Reject needs a reason. Strike is for
 * troll / fake / malicious / off-project political campaigning.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Check,
  LayoutGrid,
  Loader2,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react';
import Button from '../components/ui/Buttons';
import Badge from '../components/ui/Badge';
import StaffToolsBar from '../components/ui/StaffToolsBar';
import TaskCategoryBadge from '../components/ui/TaskCategoryBadge';
import UserAvatar from '../components/ui/UserAvatar';
import Modal from '../components/ui/Modal';
import LoadingScreen from '../components/ui/LoadingScreen';
import { useIsModerator } from '../hooks/useIsModerator';
import { tasksService } from '../services/tasksService';
import { taskSuggestionsService } from '../services/taskSuggestionsService';
import { canonicalProjectSlug } from '../utils/ideaStatus';

const FILTERS = [
  { id: 'pending', label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'struck', label: 'Struck' },
  { id: 'all', label: 'All' },
];

function statusVariant(status) {
  if (status === 'accepted') return 'success';
  if (status === 'rejected') return 'warning';
  if (status === 'struck') return 'danger';
  return 'gold';
}

const SuggestedTasksBoard = () => {
  const { id: projectSlug } = useParams();
  const navigate = useNavigate();
  const { isModerator, loading: roleLoading } = useIsModerator();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [strikeTarget, setStrikeTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const projectPath = `/projects/${canonicalProjectSlug(projectSlug) || projectSlug}`;
  const boardPath = `${projectPath}/board`;
  const stagingPath = `${boardPath}/staging`;

  const showToast = (message, kind = 'info') => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 7000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const proj = await tasksService.getProjectBySlug(projectSlug);
      if (!proj?.id) {
        setProject(null);
        setRows([]);
        setError('Project not found.');
        return;
      }
      setProject(proj);
      const list = await taskSuggestionsService.listForProject(proj.id, filter);
      setRows(list);
    } catch (err) {
      setError(err?.message || 'Could not load suggested tasks.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [projectSlug, filter]);

  useEffect(() => {
    if (roleLoading) return;
    if (!isModerator) {
      navigate(boardPath, { replace: true });
      return;
    }
    void load();
  }, [roleLoading, isModerator, load, navigate, boardPath]);

  const runReview = async (id, action, reason = null) => {
    setBusyId(id);
    try {
      await taskSuggestionsService.review(id, action, reason);
      if (action === 'accept') {
        showToast('Accepted. The card is now on Staging.', 'success');
      } else if (action === 'reject') {
        showToast('Suggestion rejected.', 'success');
      } else {
        showToast('Strike recorded. The author will see a dashboard notice.', 'warn');
      }
      setRejectTarget(null);
      setRejectReason('');
      setStrikeTarget(null);
      await load();
    } catch (err) {
      showToast(err?.message || 'Review failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (roleLoading || (loading && !project)) {
    return (
      <div className="pt-20 min-h-screen flex items-center justify-center text-text-secondary gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-neon-cyan" />
        Loading suggested tasks…
      </div>
    );
  }

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div className="container-custom relative z-10 py-6 md:py-8 space-y-6">
        <header className="space-y-5">
          <div className="min-w-0">
            <div className="section-header">Staff only</div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-neon-cyan drop-shadow-[0_0_24px_rgba(0,249,255,0.25)]">
              Suggested Tasks
            </h1>
            <p className="mt-2 text-sm text-text-secondary max-w-2xl leading-relaxed">
              Volunteer proposals for {project?.title || 'this project'}. Accept
              puts the card on Staging. Reject needs a reason. Strike is for
              troll, fake, malicious, or off-project political campaigning
              (including woke campaigning). Three strikes lock the author out.
            </p>
          </div>
          <StaffToolsBar>
            <Button variant="gold" size="sm" className="gap-1.5" to={boardPath}>
              <LayoutGrid className="w-3.5 h-3.5" />
              Public board
            </Button>
            <Button
              variant="gold"
              size="sm"
              className="gap-1.5"
              to={stagingPath}
            >
              <Upload className="w-3.5 h-3.5" />
              Staging
            </Button>
          </StaffToolsBar>
        </header>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-mono tracking-widest uppercase border ${
                filter === f.id
                  ? 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan'
                  : 'border-cyber-border text-text-muted hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error ? (
          <p className="text-sm text-semantic-danger">{error}</p>
        ) : loading ? (
          <LoadingScreen variant="section" message="Loading suggestions…" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-text-muted py-10 text-center">
            No {filter === 'all' ? '' : `${filter} `}suggestions.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-cyber-border bg-cyber-surface/70 px-4 py-3 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-white">
                        {row.title}
                      </h2>
                      <Badge
                        variant={statusVariant(row.status)}
                        className="!normal-case !text-[10px]"
                      >
                        {row.status}
                      </Badge>
                      {row.category ? (
                        <TaskCategoryBadge category={row.category} size="sm" />
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <UserAvatar
                        src={row.authorAvatarUrl}
                        name={row.authorName || 'Volunteer'}
                        size="xs"
                      />
                      <span>{row.authorName || 'Volunteer'}</span>
                      {row.difficulty ? <span>· {row.difficulty}</span> : null}
                      {row.estimatedEffort ? (
                        <span>· {row.estimatedEffort}</span>
                      ) : null}
                    </div>
                  </div>
                  {row.status === 'pending' ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="success"
                        className="gap-1"
                        disabled={busyId === row.id}
                        onClick={() => void runReview(row.id, 'accept')}
                      >
                        <Check className="w-3.5 h-3.5" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                        disabled={busyId === row.id}
                        onClick={() => {
                          setRejectTarget(row);
                          setRejectReason('');
                        }}
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="gap-1"
                        disabled={busyId === row.id}
                        onClick={() => setStrikeTarget(row)}
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Strike
                      </Button>
                    </div>
                  ) : null}
                </div>
                {row.description ? (
                  <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                    {row.description}
                  </p>
                ) : null}
                {row.subtasks.length > 0 ? (
                  <ul className="text-xs text-text-muted list-disc pl-5 space-y-0.5">
                    {row.subtasks.map((s) => (
                      <li key={s.id || s.label}>{s.label || s.title}</li>
                    ))}
                  </ul>
                ) : null}
                {row.rejectReason ? (
                  <p className="text-xs text-semantic-warning">
                    Reason: {row.rejectReason}
                  </p>
                ) : null}
                {row.status === 'accepted' && row.acceptedTaskId ? (
                  <Link
                    to={stagingPath}
                    className="text-xs text-neon-cyan hover:underline"
                  >
                    Open Staging to place or edit the accepted card
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        isOpen={Boolean(rejectTarget)}
        onClose={() => !busyId && setRejectTarget(null)}
        title="Reject suggestion"
        size="md"
      >
        {rejectTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Reject{' '}
              <span className="text-white font-medium">
                {rejectTarget.title}
              </span>
              . Write why so staff have a record.
            </p>
            <textarea
              rows={4}
              maxLength={1000}
              className="w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-neon-cyan focus:outline-none"
              placeholder="Too vague, already covered by Tether-6.1.1, off theme…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => setRejectTarget(null)}
                disabled={Boolean(busyId)}
              >
                Cancel
              </Button>
              <Button
                disabled={Boolean(busyId) || rejectReason.trim().length < 8}
                onClick={() =>
                  void runReview(rejectTarget.id, 'reject', rejectReason)
                }
              >
                Reject
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(strikeTarget)}
        onClose={() => !busyId && setStrikeTarget(null)}
        title="Strike this suggestion?"
        size="md"
      >
        {strikeTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary leading-relaxed">
              Strike{' '}
              <span className="text-white font-medium">
                {strikeTarget.title}
              </span>{' '}
              if it is obviously a troll, fake, malicious, or pushing a woke or
              other off-project political agenda. The author gets a dashboard
              notice. Three strikes lock them out of suggesting tasks.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => setStrikeTarget(null)}
                disabled={Boolean(busyId)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={Boolean(busyId)}
                onClick={() => void runReview(strikeTarget.id, 'strike')}
              >
                Record strike
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {toast ? (
        <div
          className={`fixed bottom-4 right-4 z-[80] max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg ${
            toast.kind === 'error'
              ? 'border-red-400/40 bg-red-500/15 text-red-200'
              : toast.kind === 'success'
                ? 'border-semantic-success/40 bg-semantic-success/15 text-semantic-success'
                : 'border-semantic-warning/40 bg-semantic-warning/15 text-semantic-warning'
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
};

export default SuggestedTasksBoard;
