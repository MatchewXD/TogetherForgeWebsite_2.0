/**
 * Staff editor for Early Phase:
 * 1) Project management (add / edit / Mark as Released)
 * 2) Page copy for Goals, About, How to Help, Target Style (unchanged layout)
 *
 * Completion UI uses ProjectCompleteModal (shared pattern for Mid / Late later).
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Save,
  Plus,
  Pencil,
  CheckCircle2,
  RotateCcw,
  ExternalLink,
  Package,
  X,
} from 'lucide-react';
import { useIsModerator } from '../hooks/useIsModerator';
import { phasePageService } from '../services/phasePageService';
import {
  listProjectsByPhase,
  createProject,
  updateProject,
  reactivateProject,
  isProjectCompleted,
  isProjectInDevelopment,
  slugifyProjectTitle,
} from '../services/projectsService';
import {
  EARLY_PHASE_DEFAULTS,
  contentToEditForm,
  editFormToContent,
} from '../utils/phasePageContent';
import { releasedDetailPath } from '../utils/projectCompletion';
import Button from '../components/ui/Buttons';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import ProjectCompleteModal from '../components/projects/ProjectCompleteModal';

const PHASE = 'early';
const DEFAULTS = EARLY_PHASE_DEFAULTS;

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors';

const labelClass =
  'block text-sm font-mono tracking-widest text-neon-cyan mb-2';

const emptyProjectForm = () => ({
  title: '',
  slug: '',
  summary: '',
  description: '',
  status: 'In Development',
  sort_order: '0',
  github_url: '',
});

function toDateInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

const ProjectsEarlyEdit = () => {
  const { isModerator, loading: roleLoading } = useIsModerator();
  const navigate = useNavigate();

  // Page content (static sections)
  const [form, setForm] = useState(() => contentToEditForm(DEFAULTS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageOk, setMessageOk] = useState(false);

  // Projects
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(emptyProjectForm);
  const [addSaving, setAddSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyProjectForm);
  const [editSaving, setEditSaving] = useState(false);
  /** Project row open in Mark as Released / update-release modal */
  const [completeTarget, setCompleteTarget] = useState(null);
  const [completeIsUpdate, setCompleteIsUpdate] = useState(false);
  /** Last successful release for persistent success strip */
  const [lastReleased, setLastReleased] = useState(null);

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError('');
    try {
      const rows = await listProjectsByPhase('Early', {
        includeCompleted: true,
      });
      setProjects(rows);
    } catch (err) {
      console.warn('[ProjectsEarlyEdit] projects', err);
      setProjectsError(
        err?.message ||
          'Could not load projects. Confirm the projects table exists and staff RLS allows write.'
      );
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const content = await phasePageService.getPageContent(PHASE);
        if (mounted) setForm(contentToEditForm(content));
      } catch (err) {
        console.warn('[ProjectsEarlyEdit] load content', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const updateField = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const flash = (text, ok = false) => {
    setMessage(text);
    setMessageOk(ok);
  };

  const saveContent = async () => {
    setSaving(true);
    setMessage('');
    try {
      const content = editFormToContent(form, DEFAULTS);
      await phasePageService.savePageContent(PHASE, content);
      navigate('/projects/early');
    } catch (err) {
      console.error('[ProjectsEarlyEdit] save content', err);
      flash(
        err?.message ||
          'Failed to save page copy. Confirm page_content exists and you have staff permission.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddProject = async () => {
    setAddSaving(true);
    setMessage('');
    try {
      await createProject({
        title: addForm.title,
        slug: addForm.slug || undefined,
        summary: addForm.summary,
        description: addForm.description,
        status: addForm.status || 'In Development',
        phase: 'Early',
        sort_order: Number(addForm.sort_order) || 0,
        github_url: addForm.github_url || null,
      });
      setShowAdd(false);
      setAddForm(emptyProjectForm());
      flash('Project created.', true);
      await loadProjects();
    } catch (err) {
      console.error('[ProjectsEarlyEdit] create', err);
      flash(err?.message || 'Failed to create project.');
    } finally {
      setAddSaving(false);
    }
  };

  const startEdit = (p) => {
    setCompletingId(null);
    setEditingId(p.id);
    setEditForm({
      title: p.title || '',
      slug: p.slug || '',
      summary: p.summary || '',
      description: p.description || '',
      github_url: p.github_url || p.githubUrl || '',
      status: p.status || 'In Development',
      sort_order: String(p.sort_order ?? 0),
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setEditSaving(true);
    setMessage('');
    try {
      await updateProject(editingId, {
        title: editForm.title,
        slug: editForm.slug,
        summary: editForm.summary,
        description: editForm.description,
        status: editForm.status,
        sort_order: Number(editForm.sort_order) || 0,
        github_url: editForm.github_url || null,
      });
      setEditingId(null);
      flash('Project updated.', true);
      await loadProjects();
    } catch (err) {
      console.error('[ProjectsEarlyEdit] update', err);
      flash(err?.message || 'Failed to update project.');
    } finally {
      setEditSaving(false);
    }
  };

  const openCompleteModal = (p, { isUpdate = false } = {}) => {
    setEditingId(null);
    setCompleteIsUpdate(isUpdate);
    setCompleteTarget(p);
    setMessage('');
  };

  const closeCompleteModal = () => {
    setCompleteTarget(null);
    setCompleteIsUpdate(false);
  };

  const handleCompleteSuccess = async ({ project: released }) => {
    setLastReleased(released || completeTarget);
    flash(
      released
        ? `"${released.title || 'Project'}" is on Released Games.`
        : 'Project marked complete.',
      true
    );
    await loadProjects();
  };

  const handleReactivate = async (id) => {
    setMessage('');
    try {
      await reactivateProject(id, 'In Development');
      setLastReleased(null);
      flash('Project reactivated on the active board.', true);
      await loadProjects();
    } catch (err) {
      flash(err?.message || 'Failed to reactivate.');
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
              required.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const activeList = projects.filter((p) => isProjectInDevelopment(p));
  const plannedList = projects.filter(
    (p) => !isProjectCompleted(p) && !isProjectInDevelopment(p)
  );
  const completedList = projects.filter((p) => isProjectCompleted(p));

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div className="container-custom py-12 max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <div className="section-header">STAFF EDIT</div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Early Phase
            </h1>
            <p className="text-sm text-text-secondary mt-2 max-w-lg">
              Manage Early projects (add, edit, Mark as Released) and hub page
              copy. Completing a project leaves the active board and ships it to
              Released Games with a public detail page.
            </p>
          </div>
          <Link
            to="/projects/early"
            className="text-xs font-mono tracking-widest text-neon-cyan hover:text-white shrink-0 sm:mt-2"
          >
            View public page
          </Link>
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

        {lastReleased && (
          <Card className="mb-6 p-4 sm:p-5 border-forge-gold/35 bg-forge-gold/5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <Package className="w-5 h-5 text-forge-gold shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">
                    {lastReleased.title || 'Project'} is released
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Off the active board · on Released Games · credits intact
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link to={releasedDetailPath(lastReleased)}>
                  <Button size="sm" className="gap-1.5">
                    Release page
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </Link>
                <Link to="/released">
                  <Button size="sm" variant="secondary">
                    All releases
                  </Button>
                </Link>
                <Link to="/projects/early">
                  <Button size="sm" variant="ghost">
                    Phase hub
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        )}

        {/* ========== PROJECT MANAGEMENT ========== */}
        <Card className="p-5 sm:p-6 space-y-5 mb-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="section-header mb-0">Projects</h2>
              <p className="text-xs text-text-muted mt-2 max-w-md">
                Live rows from the <code className="text-neon-cyan">projects</code>{' '}
                table. Workspace URL: /projects/&#123;slug&#125;
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setShowAdd((v) => !v);
                setEditingId(null);
                setCompletingId(null);
              }}
            >
              {showAdd ? (
                <>
                  <X className="w-3.5 h-3.5" /> Cancel
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Add project
                </>
              )}
            </Button>
          </div>

          {projectsError && (
            <p className="text-sm text-amber-200/90 border border-amber-500/30 rounded-lg px-3 py-2">
              {projectsError}
            </p>
          )}

          {showAdd && (
            <div className="rounded-xl border border-neon-cyan/30 bg-cyber-surface/50 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white">New Early project</h3>
              <div>
                <label className={labelClass}>Title *</label>
                <input
                  className={fieldClass}
                  value={addForm.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setAddForm((f) => ({
                      ...f,
                      title,
                      slug: f.slug || slugifyProjectTitle(title),
                    }));
                  }}
                  placeholder="Tether"
                />
              </div>
              <div>
                <label className={labelClass}>Slug (URL id)</label>
                <input
                  className={fieldClass}
                  value={addForm.slug}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, slug: e.target.value }))
                  }
                  placeholder="auto from title"
                />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select
                  className={fieldClass}
                  value={addForm.status}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, status: e.target.value }))
                  }
                >
                  <option>In Development</option>
                  <option>Planning</option>
                  <option>On Hold</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Card summary</label>
                <textarea
                  className={`${fieldClass} min-h-[4rem]`}
                  value={addForm.summary}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, summary: e.target.value }))
                  }
                  placeholder="Short blurb for the Early hub card"
                />
              </div>
              <div>
                <label className={labelClass}>Full description</label>
                <textarea
                  className={`${fieldClass} min-h-[5rem]`}
                  value={addForm.description}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelClass}>GitHub repository URL</label>
                <input
                  className={fieldClass}
                  type="url"
                  value={addForm.github_url || ''}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, github_url: e.target.value }))
                  }
                  placeholder="https://github.com/org/repo"
                />
                <p className="text-[11px] text-text-muted mt-1">
                  Shown on the Task Board as “View on GitHub”.
                </p>
              </div>
              <div>
                <label className={labelClass}>Sort order (lower first)</label>
                <input
                  className={fieldClass}
                  type="number"
                  value={addForm.sort_order}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, sort_order: e.target.value }))
                  }
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAdd(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="gap-1.5"
                  disabled={addSaving || !addForm.title.trim()}
                  onClick={handleAddProject}
                >
                  <Plus className="w-4 h-4" />
                  {addSaving ? 'Creating…' : 'Create project'}
                </Button>
              </div>
            </div>
          )}

          {projectsLoading ? (
            <p className="text-sm font-mono text-text-muted">Loading projects…</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No Early projects in the database yet. Add one, or run the tasks
              schema seed for Tether (prototype-systems).
            </p>
          ) : (
            <div className="space-y-3">
              {[
                {
                  key: 'active',
                  label: `In development · public active board (${activeList.length})`,
                  items: activeList,
                },
                {
                  key: 'planned',
                  label: `Planned / on hold · not on public active board (${plannedList.length})`,
                  items: plannedList,
                },
              ].map((group) =>
                group.items.length === 0 ? null : (
                  <div key={group.key} className="space-y-3">
                    <p className="text-xs font-mono tracking-widest text-text-muted uppercase pt-1">
                      {group.label}
                    </p>
                    {group.items.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-cyber-border bg-cyber-surface/40 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white">{p.title}</span>
                        <Badge variant="default">{p.status}</Badge>
                      </div>
                      <p className="text-xs font-mono text-text-muted mt-1">
                        /projects/{p.slug}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/projects/${p.slug}`}
                        className="text-xs font-mono text-neon-cyan hover:text-white inline-flex items-center gap-1"
                      >
                        Workspace <ExternalLink className="w-3 h-3" />
                      </Link>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                        onClick={() => startEdit(p)}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1"
                        onClick={() => openCompleteModal(p, { isUpdate: false })}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark as Released
                      </Button>
                    </div>
                  </div>

                  {editingId === p.id && (
                    <div className="border-t border-cyber-border pt-3 space-y-3">
                      <div>
                        <label className={labelClass}>Title</label>
                        <input
                          className={fieldClass}
                          value={editForm.title}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              title: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Slug</label>
                        <input
                          className={fieldClass}
                          value={editForm.slug}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              slug: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Status</label>
                        <select
                          className={fieldClass}
                          value={editForm.status}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              status: e.target.value,
                            }))
                          }
                        >
                          <option>In Development</option>
                          <option>Planning</option>
                          <option>On Hold</option>
                        </select>
                        <p className="mt-1.5 text-xs text-text-muted">
                          To ship a title, use{' '}
                          <span className="text-white">Mark as Released</span>{' '}
                          (not this status menu).
                        </p>
                      </div>
                      <div>
                        <label className={labelClass}>Card summary</label>
                        <textarea
                          className={`${fieldClass} min-h-[3.5rem]`}
                          value={editForm.summary}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              summary: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Description</label>
                        <textarea
                          className={`${fieldClass} min-h-[5rem]`}
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              description: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          GitHub repository URL
                        </label>
                        <input
                          className={fieldClass}
                          type="url"
                          value={editForm.github_url || ''}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              github_url: e.target.value,
                            }))
                          }
                          placeholder="https://github.com/org/repo"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Sort order</label>
                        <input
                          className={fieldClass}
                          type="number"
                          value={editForm.sort_order}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              sort_order: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          className="gap-1.5"
                          disabled={editSaving}
                          onClick={handleSaveEdit}
                        >
                          <Save className="w-4 h-4" />
                          {editSaving ? 'Saving…' : 'Save project'}
                        </Button>
                      </div>
                    </div>
                  )}

                </div>
                    ))}
                  </div>
                )
              )}

              {completedList.length > 0 && (
                <>
                  <p className="text-xs font-mono tracking-widest text-text-muted uppercase pt-2">
                    Completed / Released ({completedList.length})
                  </p>
                  {completedList.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border border-cyber-border/70 bg-cyber-surface/30 p-4 flex flex-wrap items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white">
                            {p.title}
                          </span>
                          <Badge variant="gold">Completed</Badge>
                        </div>
                        <p className="text-xs font-mono text-text-muted mt-1">
                          /released/{p.slug}
                          {p.completed_at
                            ? ` · ${toDateInputValue(p.completed_at)}`
                            : ''}
                        </p>
                        {(p.summary || p.completion_notes) && (
                          <p className="mt-1.5 text-sm text-text-secondary line-clamp-2 max-w-md">
                            {p.summary || p.completion_notes}
                          </p>
                        )}
                        {(p.completion_links || []).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {p.completion_links.map((l) => (
                              <a
                                key={l.url}
                                href={l.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-neon-cyan hover:text-white"
                              >
                                {l.label}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link to={releasedDetailPath(p)}>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="gap-1"
                          >
                            <Package className="w-3.5 h-3.5" /> Release page
                          </Button>
                        </Link>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="gap-1"
                          onClick={() =>
                            openCompleteModal(p, { isUpdate: true })
                          }
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit release
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="gap-1"
                          onClick={() => handleReactivate(p.id)}
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Reactivate
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </Card>

        <ProjectCompleteModal
          isOpen={Boolean(completeTarget)}
          onClose={closeCompleteModal}
          project={completeTarget}
          isUpdate={completeIsUpdate}
          phaseLabel="Early"
          onSuccess={handleCompleteSuccess}
        />

        {/* ========== PAGE COPY (static sections) ========== */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-white">Hub page copy</h2>
          <Button
            type="button"
            className="gap-2 shrink-0"
            disabled={saving || loading}
            onClick={saveContent}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save page copy'}
          </Button>
        </div>
        <p className="text-xs text-text-muted mb-6 max-w-xl">
          Goals, Target Style, About, and How to Help. Does not change project
          rows above.
        </p>

        {loading ? (
          <Card className="p-6 text-text-muted font-mono text-sm">Loading…</Card>
        ) : (
          <div className="space-y-6">
            <Card className="p-5 sm:p-6 space-y-4">
              <h2 className="section-header mb-0">Hero</h2>
              <div>
                <label className={labelClass}>Page title</label>
                <input
                  className={fieldClass}
                  value={form.heroTitle}
                  onChange={(e) => updateField('heroTitle', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Series label</label>
                <input
                  className={fieldClass}
                  value={form.heroSeriesLabel}
                  onChange={(e) =>
                    updateField('heroSeriesLabel', e.target.value)
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Intro body</label>
                <textarea
                  className={`${fieldClass} min-h-[6rem]`}
                  value={form.heroBody}
                  onChange={(e) => updateField('heroBody', e.target.value)}
                />
              </div>
            </Card>

            <Card className="p-5 sm:p-6 space-y-4">
              <h2 className="section-header mb-0">Early Game Goals</h2>
              <div>
                <label className={labelClass}>Goals intro line</label>
                <input
                  className={fieldClass}
                  value={form.goalsIntro}
                  onChange={(e) => updateField('goalsIntro', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Goals (one item per line, plain text)
                </label>
                <textarea
                  className={`${fieldClass} min-h-[10rem] font-mono text-sm`}
                  value={form.goals}
                  onChange={(e) => updateField('goals', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Success metric</label>
                <textarea
                  className={`${fieldClass} min-h-[4rem]`}
                  value={form.successMetric}
                  onChange={(e) => updateField('successMetric', e.target.value)}
                />
              </div>
            </Card>

            <Card className="p-5 sm:p-6 space-y-4">
              <h2 className="section-header mb-0">Fallback active card</h2>
              <p className="text-xs text-text-muted">
                Only used if the projects table has no Early rows (offline /
                empty). Prefer managing real projects above.
              </p>
              <div>
                <label className={labelClass}>Title</label>
                <input
                  className={fieldClass}
                  value={form.activeProjectTitle}
                  onChange={(e) =>
                    updateField('activeProjectTitle', e.target.value)
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Status label</label>
                <input
                  className={fieldClass}
                  value={form.activeProjectStatus}
                  onChange={(e) =>
                    updateField('activeProjectStatus', e.target.value)
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Summary</label>
                <textarea
                  className={`${fieldClass} min-h-[6rem]`}
                  value={form.activeProjectSummary}
                  onChange={(e) =>
                    updateField('activeProjectSummary', e.target.value)
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Workspace link path</label>
                <input
                  className={fieldClass}
                  value={form.activeProjectHref}
                  onChange={(e) =>
                    updateField('activeProjectHref', e.target.value)
                  }
                  placeholder="/projects/prototype-systems"
                />
              </div>
              <div>
                <label className={labelClass}>Game overviews note</label>
                <textarea
                  className={`${fieldClass} min-h-[4rem]`}
                  value={form.gameOverviewsNote}
                  onChange={(e) =>
                    updateField('gameOverviewsNote', e.target.value)
                  }
                />
              </div>
            </Card>

            <Card className="p-5 sm:p-6 space-y-4">
              <h2 className="section-header mb-0">Target style</h2>
              <div>
                <label className={labelClass}>Intro</label>
                <textarea
                  className={`${fieldClass} min-h-[4rem]`}
                  value={form.targetIntro}
                  onChange={(e) => updateField('targetIntro', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Examples (one item per line)
                </label>
                <textarea
                  className={`${fieldClass} min-h-[10rem] font-mono text-sm`}
                  value={form.targetExamples}
                  onChange={(e) =>
                    updateField('targetExamples', e.target.value)
                  }
                />
              </div>
            </Card>

            <Card className="p-5 sm:p-6 space-y-4">
              <h2 className="section-header mb-0">About Early Game</h2>
              <div>
                <label className={labelClass}>
                  About text (blank line between paragraphs)
                </label>
                <textarea
                  className={`${fieldClass} min-h-[8rem]`}
                  value={form.aboutText}
                  onChange={(e) => updateField('aboutText', e.target.value)}
                />
              </div>
            </Card>

            <Card className="p-5 sm:p-6 space-y-4">
              <h2 className="section-header mb-0">How to Help</h2>
              <div>
                <label className={labelClass}>Help items (one per line)</label>
                <textarea
                  className={`${fieldClass} min-h-[10rem] font-mono text-sm`}
                  value={form.howToHelp}
                  onChange={(e) => updateField('howToHelp', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Footer note</label>
                <textarea
                  className={`${fieldClass} min-h-[3rem]`}
                  value={form.howToHelpNote}
                  onChange={(e) => updateField('howToHelpNote', e.target.value)}
                />
              </div>
            </Card>

            <div className="flex flex-wrap gap-3 justify-end">
              <Link to="/projects/early">
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </Link>
              <Button
                type="button"
                className="gap-2"
                disabled={saving}
                onClick={saveContent}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : 'Save page copy'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectsEarlyEdit;
