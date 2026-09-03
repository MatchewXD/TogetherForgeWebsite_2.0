/**
 * Community Showcase moderation queue (staff).
 * Route: /showcase/moderate
 * Approve / reject / feature pending community submissions.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Star,
  StarOff,
  Loader2,
  RefreshCw,
  ExternalLink,
  Trash2,
  Film,
} from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Buttons';
import Modal from '../components/ui/Modal';
import useIsModerator from '../hooks/useIsModerator';
import {
  listShowcaseForModeration,
  moderateShowcasePost,
  deleteShowcasePost,
  showcaseHref,
  showcaseThumb,
} from '../services/showcaseService';
import OpenConductCaseButton from '../components/conduct/OpenConductCaseButton';

const QUEUE_TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

function statusVariant(status) {
  if (status === 'approved') return 'neon';
  if (status === 'rejected') return 'danger';
  return 'warning';
}

const ShowcaseModerate = () => {
  const { isModerator, loading: roleLoading } = useIsModerator();
  const [tab, setTab] = useState('pending');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [notes, setNotes] = useState({});
  const [tableMissing, setTableMissing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 6000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setTableMissing(false);
    try {
      const rows = await listShowcaseForModeration({ status: tab, limit: 100 });
      setPosts(rows || []);
    } catch (err) {
      console.error('[ShowcaseModerate]', err);
      if (err?.code === 'TABLE_MISSING') {
        setTableMissing(true);
        setPosts([]);
      } else {
        setError(err?.message || 'Failed to load queue.');
      }
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (!roleLoading && isModerator) load();
  }, [roleLoading, isModerator, load]);

  const run = async (id, action, successMsg) => {
    setBusyId(`${id}-${action}`);
    try {
      await moderateShowcasePost(id, action, notes[id] || '');
      showToast(successMsg);
      await load();
    } catch (err) {
      showToast(err?.message || 'Action failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (id, title) => {
    setConfirmDialog({
      title: 'Delete submission',
      message: `Permanently delete “${title || 'this post'}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setBusyId(`${id}-delete`);
        try {
          await deleteShowcasePost(id);
          showToast('Deleted.');
          await load();
        } catch (err) {
          showToast(err?.message || 'Delete failed.');
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  if (roleLoading) {
    return (
      <div className="pt-20 min-h-screen bg-cyber-bg text-text-secondary p-8 font-mono text-sm tracking-widest">
        Checking permissions…
      </div>
    );
  }

  if (!isModerator) {
    return (
      <div className="pt-20 min-h-screen bg-cyber-bg">
        <div className="container-custom py-12 max-w-lg">
          <Card className="p-8 text-center space-y-4">
            <p className="text-text-secondary">
              Staff only. Moderators, admins, and project leads can review
              Showcase submissions.
            </p>
            <Link to="/showcase">
              <Button variant="secondary">Back to Showcase</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg border border-cyber-border bg-cyber-surface text-sm shadow-lg max-w-md text-center"
        >
          {toast}
        </div>
      )}

      <div className="container-custom py-12 max-w-4xl">
        <Link
          to="/showcase"
          className="inline-flex items-center gap-1.5 text-xs font-mono tracking-widest text-neon-cyan hover:text-white mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Public Showcase
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <div className="section-header">STAFF</div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Showcase moderation
            </h1>
            <p className="text-sm text-text-secondary mt-2 max-w-lg leading-relaxed">
              Review community submissions before they go live. Approve to
              publish, reject with an optional note, or feature standout posts.
            </p>
          </div>
          <Button
            variant="secondary"
            className="gap-2 shrink-0"
            onClick={load}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </Button>
        </div>

        {tableMissing && (
          <Card className="mb-6 p-5 border-dashed space-y-2">
            <p className="font-semibold text-white">Database table missing</p>
            <p className="text-sm text-text-secondary">
              Run{' '}
              <code className="text-neon-cyan">
                supabase/sql/supabase_community_showcase.sql
              </code>{' '}
              in the Supabase SQL Editor, then refresh.
            </p>
          </Card>
        )}

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-100"
          >
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6" role="tablist">
          {QUEUE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-mono tracking-wide border transition-colors ${
                tab === t.id
                  ? 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan'
                  : 'border-cyber-border text-text-muted hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm font-mono tracking-widest text-text-muted">
            Loading queue…
          </p>
        ) : posts.length === 0 ? (
          <Card className="p-8 text-center text-text-secondary text-sm border-dashed">
            No {tab === 'all' ? '' : tab} submissions.
          </Card>
        ) : (
          <ul className="space-y-4 list-none p-0 m-0">
            {posts.map((post) => {
              const thumb = showcaseThumb(post);
              const href = showcaseHref(post);
              const busy = busyId?.startsWith(post.id);
              return (
                <li key={post.id}>
                  <Card className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="relative w-full sm:w-44 shrink-0 aspect-video rounded-lg overflow-hidden border border-cyber-border bg-cyber-surface">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Film className="w-8 h-8 text-text-muted" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={statusVariant(post.status)}>
                            {post.status}
                          </Badge>
                          <Badge variant="default">{post.type}</Badge>
                          {post.isFeatured && (
                            <Badge variant="gold">Featured</Badge>
                          )}
                          {post.projectTag && (
                            <Badge variant="default">{post.projectTag}</Badge>
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-white text-lg">
                            {post.title}
                          </h3>
                          <p className="text-sm text-neon-purple mt-0.5">
                            <span className="text-[10px] font-mono tracking-widest uppercase text-text-muted mr-1.5">
                              Credit
                            </span>
                            {post.creatorDisplayName || (
                              <span className="text-amber-300">
                                Missing creator name
                              </span>
                            )}
                          </p>
                          {post.projectTag && (
                            <p className="text-xs text-forge-gold mt-1 font-mono">
                              Project id · {post.projectTag}
                            </p>
                          )}
                          {post.description && (
                            <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                              {post.description}
                            </p>
                          )}
                          {post.moderatorNote && (
                            <p className="text-xs text-text-muted mt-2 border-l-2 border-cyber-border pl-2">
                              Note: {post.moderatorNote}
                            </p>
                          )}
                        </div>
                        {href && (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-mono text-neon-cyan hover:text-white"
                          >
                            Open link
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <div>
                          <label className="block text-[10px] font-mono tracking-widest text-text-muted uppercase mb-1">
                            Moderator note (optional)
                          </label>
                          <input
                            className="w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-neon-cyan outline-none"
                            value={notes[post.id] || ''}
                            onChange={(e) =>
                              setNotes((n) => ({
                                ...n,
                                [post.id]: e.target.value,
                              }))
                            }
                            placeholder="Feedback for submitter / internal note"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {post.creatorUserId ? (
                            <OpenConductCaseButton
                              targetUserId={post.creatorUserId}
                              contentType="showcase"
                              contentId={String(post.id)}
                              contentPath="/showcase"
                            />
                          ) : null}
                          {post.status !== 'approved' && (
                            <Button
                              size="sm"
                              className="gap-1"
                              disabled={busy}
                              onClick={() =>
                                run(post.id, 'approve', 'Approved — now public.')
                              }
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approve
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="gold"
                            className="gap-1"
                            disabled={busy}
                            onClick={() =>
                              run(
                                post.id,
                                'feature',
                                'Approved and featured.'
                              )
                            }
                          >
                            <Star className="w-3.5 h-3.5" />
                            Feature
                          </Button>
                          {post.isFeatured && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1"
                              disabled={busy}
                              onClick={() =>
                                run(post.id, 'unfeature', 'Unfeatured.')
                              }
                            >
                              <StarOff className="w-3.5 h-3.5" />
                              Unfeature
                            </Button>
                          )}
                          {post.status !== 'rejected' && (
                            <Button
                              size="sm"
                              variant="danger"
                              className="gap-1"
                              disabled={busy}
                              onClick={() =>
                                run(post.id, 'reject', 'Rejected.')
                              }
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </Button>
                          )}
                          {post.status === 'rejected' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() =>
                                run(post.id, 'pending', 'Moved back to pending.')
                              }
                            >
                              Re-queue
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-red-300"
                            disabled={busy}
                            onClick={() => handleDelete(post.id, post.title)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-10 text-center text-xs font-mono tracking-widest text-text-muted">
          <Link to="/moderator" className="hover:text-neon-cyan">
            Moderator dashboard
          </Link>
          {' · '}
          <Link to="/showcase" className="hover:text-neon-cyan">
            Public Showcase
          </Link>
        </p>
      </div>

      <Modal
        isOpen={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        title={confirmDialog?.title || 'Confirm'}
        size="sm"
      >
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          {confirmDialog?.message}
        </p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmDialog(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              const action = confirmDialog?.onConfirm;
              setConfirmDialog(null);
              action?.();
            }}
          >
            {confirmDialog?.confirmLabel || 'Confirm'}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default ShowcaseModerate;
