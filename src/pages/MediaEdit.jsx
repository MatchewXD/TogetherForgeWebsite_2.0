/**
 * Staff editor for Official Media library.
 * Route: /media/edit
 * Roles: moderator | admin | project_lead (useIsModerator)
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Save,
  Plus,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
  Eye,
  EyeOff,
  ExternalLink,
  Youtube,
  Film,
  ArrowLeft,
} from 'lucide-react';
import { useIsModerator } from '../hooks/useIsModerator';
import Button from '../components/ui/Buttons';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import {
  listStaffOfficialVideos,
  createOfficialVideo,
  updateOfficialVideo,
  setOfficialVideoPublished,
  archiveOfficialVideo,
  restoreOfficialVideo,
  deleteOfficialVideo,
} from '../services/officialMediaService';
import OfficialMediaContributorsEditor from '../components/media/OfficialMediaContributorsEditor';
import {
  syncOfficialMediaCreditTitles,
  listOfficialMediaCreditsByVideoIds,
  ensureOfficialMediaCredit,
} from '../services/contributorsService';
import {
  parseYoutubeId,
  youtubeWatchUrl,
  youtubeThumbnailUrl,
  YOUTUBE_CHANNEL_URL,
} from '../data/officialVideos';
import { OFFICIAL_VIDEO_CATEGORIES } from '../constants/officialVideoCategories';

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors';

const labelClass =
  'block text-sm font-mono tracking-widest text-neon-cyan mb-2';

/** Admin select: empty = uncategorized, then canonical list */
const CATEGORY_OPTIONS = ['', ...OFFICIAL_VIDEO_CATEGORIES];

function emptyForm() {
  return {
    title: '',
    description: '',
    youtubeId: '',
    thumbnailUrl: '',
    category: '',
    publishedAt: new Date().toISOString().slice(0, 10),
    isPublished: true,
  };
}

function formFromVideo(v) {
  return {
    title: v.title || '',
    description: v.description || '',
    youtubeId: v.youtubeId || '',
    thumbnailUrl: v.thumbnailUrl || '',
    category: v.category || '',
    publishedAt: (v.publishedAt || '').toString().slice(0, 10),
    isPublished: v.isPublished !== false,
  };
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(
      String(iso).includes('T') ? iso : `${iso}T12:00:00`
    ).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

const MediaEdit = () => {
  const { isModerator, loading: roleLoading } = useIsModerator();
  const [videos, setVideos] = useState([]);
  const [creditsByVideo, setCreditsByVideo] = useState({});
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageOk, setMessageOk] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [draftCredits, setDraftCredits] = useState([]);
  const [saving, setSaving] = useState(false);

  const flash = (text, ok = false) => {
    setMessage(text);
    setMessageOk(ok);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setTableMissing(false);
    try {
      const rows = await listStaffOfficialVideos({
        includeArchived: showArchived,
      });
      setVideos(rows || []);
      const credits = await listOfficialMediaCreditsByVideoIds(
        (rows || []).map((v) => v.id)
      );
      setCreditsByVideo(credits || {});
    } catch (err) {
      console.error('[MediaEdit]', err);
      if (err?.code === 'TABLE_MISSING') {
        setTableMissing(true);
        setVideos([]);
      }
      flash(err?.message || 'Failed to load videos.');
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    if (!roleLoading && isModerator) load();
  }, [roleLoading, isModerator, load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDraftCredits([]);
    setShowForm(true);
    setMessage('');
  };

  const openEdit = (v) => {
    setEditingId(v.id);
    setForm(formFromVideo(v));
    setDraftCredits([]);
    setShowForm(true);
    setMessage('');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setDraftCredits([]);
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    const yt = parseYoutubeId(form.youtubeId);
    if (!String(form.title || '').trim()) {
      flash('Title is required.');
      return;
    }
    if (!yt) {
      flash('Enter a valid YouTube URL or 11-character video ID.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const payload = {
        title: form.title,
        description: form.description,
        youtubeId: yt,
        thumbnailUrl: form.thumbnailUrl,
        category: form.category,
        publishedAt: form.publishedAt,
        isPublished: form.isPublished,
      };
      if (editingId) {
        await updateOfficialVideo(editingId, payload);
        if (payload.title) {
          void syncOfficialMediaCreditTitles(editingId, payload.title);
        }
        flash('Video updated.', true);
        closeForm();
      } else {
        const created = await createOfficialVideo(payload);
        const pending = draftCredits.filter((p) => p?.userId);
        let credited = 0;
        let creditFailed = 0;
        if (created?.id && pending.length) {
          const results = await Promise.allSettled(
            pending.map((p) =>
              ensureOfficialMediaCredit({
                videoId: created.id,
                videoTitle: payload.title,
                userId: p.userId,
                username: p.username,
                displayName: p.displayName || p.username,
              })
            )
          );
          credited = results.filter((r) => r.status === 'fulfilled').length;
          creditFailed = results.length - credited;
        }
        if (creditFailed > 0 && created?.id) {
          flash(
            `Video added. ${credited} credited; ${creditFailed} could not be saved. You can retry below.`,
            false
          );
          setEditingId(created.id);
          setForm(formFromVideo(created));
          setDraftCredits([]);
        } else {
          flash(
            credited > 0
              ? `Video added and ${credited} contributor${credited === 1 ? '' : 's'} credited.`
              : 'Video added.',
            true
          );
          closeForm();
        }
      }
      await load();
    } catch (err) {
      console.error('[MediaEdit] save', err);
      flash(err?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (v) => {
    try {
      await setOfficialVideoPublished(v.id, !v.isPublished);
      flash(
        v.isPublished ? 'Unpublished (hidden from /media).' : 'Published on /media.',
        true
      );
      await load();
    } catch (err) {
      flash(err?.message || 'Could not update publish state.');
    }
  };

  const handleArchive = async (v) => {
    if (
      !window.confirm(
        `Archive “${v.title}”? It will leave /media and the default staff list.`
      )
    ) {
      return;
    }
    try {
      await archiveOfficialVideo(v.id);
      flash('Video archived.', true);
      await load();
    } catch (err) {
      flash(err?.message || 'Archive failed.');
    }
  };

  const handleRestore = async (v) => {
    try {
      await restoreOfficialVideo(v.id);
      flash('Restored as unpublished draft. Publish when ready.', true);
      await load();
    } catch (err) {
      flash(err?.message || 'Restore failed.');
    }
  };

  const handleDelete = async (v) => {
    if (
      !window.confirm(
        `Permanently delete “${v.title}”? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await deleteOfficialVideo(v.id);
      flash('Video deleted.', true);
      await load();
    } catch (err) {
      flash(err?.message || 'Delete failed.');
    }
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
              Access denied. Staff role (moderator, admin, or project lead)
              required to manage Official Media.
            </p>
            <Link to="/media">
              <Button variant="secondary">Back to Official Media</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const activeList = videos.filter((v) => !v.archivedAt);
  const archivedList = videos.filter((v) => v.archivedAt);
  const list = showArchived ? archivedList : activeList;

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div className="container-custom py-12 max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <Link
              to="/media"
              className="inline-flex items-center gap-1.5 text-xs font-mono tracking-widest text-neon-cyan hover:text-white mb-3"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Public Media page
            </Link>
            <div className="section-header">STAFF EDIT</div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Official Media
            </h1>
            <p className="text-sm text-text-secondary mt-2 max-w-lg leading-relaxed">
              Add, edit, publish, or archive studio videos. Credit volunteers
              on each item — names stay in the public memorial. Only published
              videos appear on /media. Community content stays on Showcase.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <a
              href={YOUTUBE_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="ghost" className="gap-1.5">
                <Youtube className="w-3.5 h-3.5" />
                Channel
              </Button>
            </a>
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="w-3.5 h-3.5" />
              Add video
            </Button>
          </div>
        </div>

        {message && (
          <div
            role="alert"
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
              messageOk
                ? 'border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan'
                : 'border-red-400/40 bg-red-400/10 text-red-100'
            }`}
          >
            {message}
          </div>
        )}

        {tableMissing && (
          <Card className="mb-6 p-5 border-dashed space-y-2">
            <p className="font-semibold text-white">Database table missing</p>
            <p className="text-sm text-text-secondary leading-relaxed">
              Run{' '}
              <code className="text-neon-cyan">
                supabase/sql/supabase_official_videos.sql
              </code>{' '}
              in the Supabase SQL Editor, then refresh. The script seeds demo
              videos when the table is empty.
            </p>
          </Card>
        )}

        {showForm && (
          <Card className="p-5 sm:p-6 mb-8 space-y-4">
            <h2 className="text-lg font-bold text-white">
              {editingId ? 'Edit video' : 'Add official video'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className={labelClass} htmlFor="ov-title">
                  Title *
                </label>
                <input
                  id="ov-title"
                  className={fieldClass}
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="ov-desc">
                  Short description
                </label>
                <textarea
                  id="ov-desc"
                  className={`${fieldClass} min-h-[4.5rem]`}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  maxLength={500}
                  placeholder="1–2 lines for the card on /media"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="ov-yt">
                  YouTube URL or video ID *
                </label>
                <input
                  id="ov-yt"
                  className={fieldClass}
                  value={form.youtubeId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, youtubeId: e.target.value }))
                  }
                  placeholder="https://www.youtube.com/watch?v=… or 11-char id"
                  required
                />
                {parseYoutubeId(form.youtubeId) && (
                  <p className="mt-1.5 text-xs text-text-muted font-mono">
                    Parsed id: {parseYoutubeId(form.youtubeId)}
                  </p>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="ov-date">
                    Publish date
                  </label>
                  <input
                    id="ov-date"
                    type="date"
                    className={fieldClass}
                    value={form.publishedAt}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, publishedAt: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="ov-cat">
                    Category
                  </label>
                  <select
                    id="ov-cat"
                    className={fieldClass}
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c || 'none'} value={c}>
                        {c || 'None'}
                      </option>
                    ))}
                    {form.category &&
                      !CATEGORY_OPTIONS.includes(form.category) && (
                        <option value={form.category}>{form.category}</option>
                      )}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="ov-thumb">
                  Thumbnail URL (optional)
                </label>
                <input
                  id="ov-thumb"
                  className={fieldClass}
                  value={form.thumbnailUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))
                  }
                  placeholder="/images/… or https://… (defaults to YouTube thumb)"
                />
              </div>
              <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-cyber-border bg-cyber-surface/50 p-4">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-cyber-border text-neon-cyan focus:ring-neon-cyan"
                  checked={form.isPublished}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isPublished: e.target.checked }))
                  }
                />
                <span className="text-sm text-text-secondary leading-relaxed">
                  <span className="text-white font-semibold">Published</span> —
                  show this video on the public Official Media page.
                </span>
              </label>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={closeForm}>
                  Cancel
                </Button>
                <Button type="submit" className="gap-2" disabled={saving}>
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add video'}
                </Button>
              </div>
            </form>
            <OfficialMediaContributorsEditor
              videoId={editingId}
              videoTitle={form.title}
              draftPeople={draftCredits}
              onDraftPeopleChange={setDraftCredits}
            />
          </Card>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-white">
            {showArchived ? 'Archived' : 'Library'}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={!showArchived ? 'secondary' : 'ghost'}
              onClick={() => setShowArchived(false)}
            >
              Active
            </Button>
            <Button
              size="sm"
              variant={showArchived ? 'secondary' : 'ghost'}
              onClick={() => setShowArchived(true)}
            >
              Archived
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm font-mono tracking-widest text-text-muted">
            Loading…
          </p>
        ) : list.length === 0 ? (
          <Card className="p-8 text-center space-y-3 border-dashed">
            <Film className="w-8 h-8 text-text-muted mx-auto" />
            <p className="text-text-secondary text-sm">
              {showArchived
                ? 'No archived videos.'
                : 'No videos yet. Add one, or run the SQL seed for demos.'}
            </p>
            {!showArchived && !tableMissing && (
              <Button className="gap-2" onClick={openCreate}>
                <Plus className="w-4 h-4" />
                Add first video
              </Button>
            )}
          </Card>
        ) : (
          <ul className="space-y-3 list-none p-0 m-0">
            {list.map((v) => {
              const thumb = youtubeThumbnailUrl(v);
              return (
                <li key={v.id}>
                  <Card className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="relative w-full sm:w-40 shrink-0 aspect-video rounded-lg overflow-hidden border border-cyber-border bg-cyber-surface">
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
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {v.isPublished && !v.archivedAt ? (
                            <Badge variant="neon">Published</Badge>
                          ) : (
                            <Badge variant="default">
                              {v.archivedAt ? 'Archived' : 'Draft'}
                            </Badge>
                          )}
                          {v.category && (
                            <Badge variant="default">{v.category}</Badge>
                          )}
                          <span className="text-[10px] font-mono tracking-widest text-text-muted uppercase">
                            {formatDate(v.publishedAt)}
                          </span>
                        </div>
                        <h3 className="font-semibold text-white truncate">
                          {v.title}
                        </h3>
                        {v.description && (
                          <p className="mt-1 text-sm text-text-secondary line-clamp-2">
                            {v.description}
                          </p>
                        )}
                        {(creditsByVideo[v.id] || []).length > 0 && (
                          <p className="mt-1.5 text-xs text-text-muted truncate">
                            Credited:{' '}
                            {(creditsByVideo[v.id] || [])
                              .map((p) => p.displayName || p.username)
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {!v.archivedAt && (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="gap-1"
                                onClick={() => openEdit(v)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="gap-1"
                                onClick={() => handleTogglePublish(v)}
                              >
                                {v.isPublished ? (
                                  <>
                                    <EyeOff className="w-3.5 h-3.5" />
                                    Unpublish
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5" />
                                    Publish
                                  </>
                                )}
                              </Button>
                              <a
                                href={youtubeWatchUrl(v.youtubeId)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="gap-1"
                                >
                                  YouTube
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              </a>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="gap-1"
                                onClick={() => handleArchive(v)}
                              >
                                <Archive className="w-3.5 h-3.5" />
                                Archive
                              </Button>
                            </>
                          )}
                          {v.archivedAt && (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="gap-1"
                                onClick={() => handleRestore(v)}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Restore
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="gap-1 text-red-300 hover:text-red-200"
                                onClick={() => handleDelete(v)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete forever
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MediaEdit;
