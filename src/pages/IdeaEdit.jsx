/**
 * IdeaEdit - edit an existing idea using the same field model as the guided wizard.
 * Loads/saves guided_data JSONB for optional sections.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { buildGuidedData } from '../services/ideasService';
import { parseGuidedData } from '../utils/ideaStatus';
import Button from '../components/ui/Buttons';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import CharCount from '../components/ui/CharCount';

const CATEGORIES = [
  'Full Game Idea',
  'Game Mechanic',
  'Setting / Story / Lore',
  'Art / Visual Design',
  'Audio / Sound / Music',
  'Multiplayer / Cooperative Systems',
  'Twitch / Streamer Integration',
  'Progression / Economy / Crafting',
  'Enemy / AI / Combat',
  'World Building / Environment',
  'Other',
];

const MAX_MULTI = 8;

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors';

const labelClass =
  'block text-sm font-mono tracking-widest text-neon-cyan mb-2';

const REMOVE_MESSAGE =
  'Are you sure you want to delete this field and its contents?';

const SINGLE_SECTIONS = [
  {
    key: 'twitchIntegration',
    label: 'Twitch and Community Integration',
    placeholder: 'How streamers and viewers engage with this idea...',
    rows: 4,
    maxLength: 2000,
  },
  {
    key: 'environmentalStorytelling',
    label: 'Environmental Storytelling',
    placeholder: 'How the world and environment convey narrative...',
    rows: 4,
    maxLength: 2000,
  },
  {
    key: 'economySystem',
    label: 'Economy System',
    placeholder: 'Resources, crafting, trading, or economy loop...',
    rows: 4,
    maxLength: 2000,
  },
  {
    key: 'storyNarrative',
    label: 'Story and Narrative',
    placeholder: 'Main story beats, tone, and narrative goals...',
    rows: 4,
    maxLength: 2000,
  },
];

const emptyOptional = {
  features: [],
  additionalNotes: [],
  twitchIntegration: null,
  environmentalStorytelling: null,
  economySystem: null,
  storyNarrative: null,
};

function formFromIdeaRow(data) {
  const guided = parseGuidedData(data.guided_data);

  let features = [];
  if (Array.isArray(guided.features) && guided.features.length) {
    features = guided.features.map((f) =>
      typeof f === 'string'
        ? { name: '', description: f }
        : { name: f.name || '', description: f.description || '' }
    );
  } else if (data.features) {
    try {
      const f =
        typeof data.features === 'string'
          ? JSON.parse(data.features)
          : data.features;
      if (Array.isArray(f)) {
        features = f.map((item) =>
          typeof item === 'string'
            ? { name: '', description: item }
            : {
                name: item.name || '',
                description: item.description || '',
              }
        );
      }
    } catch {
      /* ignore */
    }
  }

  let additionalNotes = [];
  if (Array.isArray(guided.additional_notes) && guided.additional_notes.length) {
    additionalNotes = guided.additional_notes.map(String);
  } else if (data.additional_notes) {
    if (typeof data.additional_notes === 'string') {
      try {
        const parsed = JSON.parse(data.additional_notes);
        if (Array.isArray(parsed)) additionalNotes = parsed.map(String);
        else if (data.additional_notes.trim())
          additionalNotes = [data.additional_notes.trim()];
      } catch {
        if (data.additional_notes.trim())
          additionalNotes = [data.additional_notes.trim()];
      }
    } else if (Array.isArray(data.additional_notes)) {
      additionalNotes = data.additional_notes.map(String);
    }
  }

  const singleOrNull = (guidedVal, legacyVal) => {
    const g = guidedVal && String(guidedVal).trim();
    if (g) return g;
    const l = legacyVal && String(legacyVal).trim();
    if (l) return l;
    return null;
  };

  return {
    title: data.title || '',
    category: data.category || '',
    summary: data.summary || '',
    description: data.description || '',
    tags: data.tags || '',
    projectId: data.project_id || data.projectId || '',
    features,
    additionalNotes,
    twitchIntegration: singleOrNull(
      guided.twitch_community,
      data.twitch_integration
    ),
    environmentalStorytelling: singleOrNull(
      guided.environmental_storytelling,
      data.environmental_storytelling
    ),
    economySystem: singleOrNull(
      guided.economy_system,
      data.economy_description
    ),
    storyNarrative: singleOrNull(
      guided.story_narrative,
      data.story_overview
    ),
  };
}

const IdeaEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const removeTargetRef = useRef(null);
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    summary: '',
    description: '',
    tags: '',
    projectId: '',
    ...emptyOptional,
  });

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate('/ideas');
        return;
      }
      setUser(session.user);

      const { data, error } = await supabase
        .from('ideas')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !data) {
        navigate('/ideas');
        return;
      }
      if (data.user_id && data.user_id !== session.user.id) {
        navigate(`/ideas/${id}`);
        return;
      }

      setFormData(formFromIdeaRow(data));
      setLoading(false);
    };
    init();
  }, [id, navigate]);

  const setField = (key, value) =>
    setFormData((f) => ({ ...f, [key]: value }));

  const addSingleSection = (key) => {
    setFormData((f) => ({
      ...f,
      [key]: f[key] == null ? '' : f[key],
    }));
  };

  const openRemoveModal = (target) => {
    removeTargetRef.current = target;
    setRemoveTarget(target);
  };

  const closeRemoveModal = useCallback(() => {
    removeTargetRef.current = null;
    setRemoveTarget(null);
  }, []);

  const requestRemoveSingle = (key, label) => {
    openRemoveModal({ kind: 'single', key, label });
  };

  const addFeature = () => {
    setFormData((f) => {
      if ((f.features || []).length >= MAX_MULTI) return f;
      return {
        ...f,
        features: [...(f.features || []), { name: '', description: '' }],
      };
    });
  };

  const updateFeature = (idx, field, value) => {
    setFormData((f) => {
      const features = [...(f.features || [])];
      features[idx] = { ...features[idx], [field]: value };
      return { ...f, features };
    });
  };

  const requestRemoveFeature = (idx) => {
    openRemoveModal({ kind: 'feature', index: idx, label: `Feature ${idx + 1}` });
  };

  const addNote = () => {
    setFormData((f) => {
      if ((f.additionalNotes || []).length >= MAX_MULTI) return f;
      return {
        ...f,
        additionalNotes: [...(f.additionalNotes || []), ''],
      };
    });
  };

  const updateNote = (idx, value) => {
    setFormData((f) => {
      const additionalNotes = [...(f.additionalNotes || [])];
      additionalNotes[idx] = value;
      return { ...f, additionalNotes };
    });
  };

  const requestRemoveNote = (idx) => {
    openRemoveModal({ kind: 'note', index: idx, label: `Note ${idx + 1}` });
  };

  const executePendingRemove = useCallback(() => {
    const target = removeTargetRef.current;
    if (!target) return;

    const { kind, key, index } = target;

    if (kind === 'single' && key) {
      setFormData((f) => ({ ...f, [key]: null }));
    } else if (kind === 'feature' && typeof index === 'number') {
      setFormData((f) => ({
        ...f,
        features: (f.features || []).filter((_, i) => i !== index),
      }));
    } else if (kind === 'note' && typeof index === 'number') {
      setFormData((f) => ({
        ...f,
        additionalNotes: (f.additionalNotes || []).filter((_, i) => i !== index),
      }));
    }

    removeTargetRef.current = null;
    setRemoveTarget(null);
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;

    if (!(formData.title || '').trim()) {
      setMessage('Title is required.');
      return;
    }
    if (!(formData.category || '').trim()) {
      setMessage('Category is required.');
      return;
    }
    if (!(formData.summary || '').trim()) {
      setMessage('Short summary is required.');
      return;
    }
    if (!(formData.description || '').trim()) {
      setMessage('Description is required.');
      return;
    }

    setSaving(true);
    setMessage('');

    const uniqueTags = [
      ...new Set(
        (formData.tags || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      ),
    ].join(', ');

    const guided_data = buildGuidedData({
      features: formData.features,
      additionalNotes: formData.additionalNotes,
      twitchIntegration: formData.twitchIntegration,
      environmentalStorytelling: formData.environmentalStorytelling,
      economySystem: formData.economySystem,
      storyNarrative: formData.storyNarrative,
    });

    const ideaIdNum = Number(id);
    const patch = {
      title: formData.title.trim(),
      category: formData.category,
      summary: formData.summary.trim(),
      description: formData.description.trim(),
      tags: uniqueTags,
      guided_data,
      features: (formData.features || []).filter(
        (f) => f.name || f.description
      ),
      twitch_integration:
        formData.twitchIntegration != null
          ? String(formData.twitchIntegration).trim() || null
          : null,
      environmental_storytelling:
        formData.environmentalStorytelling != null
          ? String(formData.environmentalStorytelling).trim() || null
          : null,
      economy_description:
        formData.economySystem != null
          ? String(formData.economySystem).trim() || null
          : null,
      story_overview:
        formData.storyNarrative != null
          ? String(formData.storyNarrative).trim() || null
          : null,
      additional_notes: (formData.additionalNotes || [])
        .map((n) => String(n || '').trim())
        .filter(Boolean),
    };

    if (formData.projectId) {
      patch.project_id = String(formData.projectId).trim();
    }

    // Try full patch; strip optional columns on failure
    let { data, error } = await supabase
      .from('ideas')
      .update(patch)
      .eq('id', ideaIdNum)
      .select();

    if (error) {
      const optional = [
        'guided_data',
        'features',
        'project_id',
        'twitch_integration',
        'environmental_storytelling',
        'economy_description',
        'story_overview',
        'additional_notes',
      ];
      let body = { ...patch };
      for (const col of optional) {
        if (
          error &&
          body[col] !== undefined &&
          (error.message || '').toLowerCase().includes(col)
        ) {
          delete body[col];
          ({ data, error } = await supabase
            .from('ideas')
            .update(body)
            .eq('id', ideaIdNum)
            .select());
        }
      }
    }

    if (error) {
      setMessage('Update failed: ' + error.message);
      setSaving(false);
      return;
    }
    if (!data || data.length === 0) {
      setMessage(
        'Update did not apply. You may not have permission to edit this idea (RLS policy or missing user_id on the row).'
      );
      setSaving(false);
      return;
    }
    navigate(`/ideas/${id}`);
  };

  if (loading) {
    return (
      <div className="pt-20 text-center text-text-secondary">Loading...</div>
    );
  }

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div className="container-custom py-12 max-w-3xl">
        <Link
          to={`/ideas/${id}`}
          className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />{' '}
          BACK TO IDEA
        </Link>

        <div className="mb-8">
          <div className="section-header">EDIT IDEA</div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-2">
            Update your idea
          </h1>
          <p className="text-sm text-text-secondary">
            Required fields match idea creation. Optional sections use Add /
            Remove with confirmation.
          </p>
        </div>

        {message && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-100"
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-8">
          <Card className="bg-cyber-card/80 space-y-6 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white">Required</h2>

            <div>
              <label className={labelClass} htmlFor="edit-title">
                Title *
              </label>
              <input
                id="edit-title"
                type="text"
                required
                maxLength={100}
                className={fieldClass}
                value={formData.title}
                onChange={(e) => setField('title', e.target.value)}
              />
              <CharCount value={formData.title} max={100} />
            </div>

            <div>
              <label className={labelClass} htmlFor="edit-category">
                Category *
              </label>
              <select
                id="edit-category"
                required
                className={fieldClass}
                value={formData.category}
                onChange={(e) => setField('category', e.target.value)}
              >
                <option value="">Select a category...</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass} htmlFor="edit-summary">
                Short summary *
              </label>
              <textarea
                id="edit-summary"
                required
                maxLength={300}
                rows={3}
                className={fieldClass}
                value={formData.summary}
                onChange={(e) => setField('summary', e.target.value)}
              />
              <CharCount value={formData.summary} max={300} />
            </div>

            <div>
              <label className={labelClass} htmlFor="edit-description">
                Description *
              </label>
              <textarea
                id="edit-description"
                required
                maxLength={4000}
                rows={6}
                className={fieldClass}
                value={formData.description}
                onChange={(e) => setField('description', e.target.value)}
              />
              <CharCount value={formData.description} max={4000} />
            </div>

            <div>
              <label className={labelClass} htmlFor="edit-tags">
                Tags (optional)
              </label>
              <input
                id="edit-tags"
                type="text"
                maxLength={200}
                placeholder="co-op, streamer, inventory"
                className={fieldClass}
                value={formData.tags}
                onChange={(e) => setField('tags', e.target.value)}
              />
              <CharCount value={formData.tags} max={200} />
            </div>
          </Card>

          <Card className="bg-cyber-card/80 space-y-6 p-6 sm:p-8">
            <div>
              <h2 className="text-lg font-bold text-white mb-2">
                Optional additional details
              </h2>
              <div
                role="note"
                className="rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 px-4 py-3 text-sm text-text-secondary"
              >
                Adding more fields and context makes your idea more valuable to
                the team and community.
              </div>
            </div>

            {/* Key Features */}
            <section className="space-y-3 border border-cyber-border rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-mono text-sm tracking-widest text-neon-cyan uppercase">
                  Key Features
                </h3>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  disabled={(formData.features || []).length >= MAX_MULTI}
                  onClick={addFeature}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add feature
                </Button>
              </div>
              {(formData.features || []).length === 0 && (
                <p className="text-sm text-text-muted italic">
                  No features added yet.
                </p>
              )}
              {(formData.features || []).map((feat, idx) => (
                <div
                  key={idx}
                  className="border border-cyber-border rounded-lg p-4 space-y-3 bg-cyber-surface/40"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono text-text-muted">
                      Feature {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => requestRemoveFeature(idx)}
                      className="text-red-400 hover:text-red-300 p-1"
                      aria-label={`Remove feature ${idx + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <input
                      type="text"
                      maxLength={100}
                      placeholder="Feature name (optional)"
                      className={fieldClass}
                      value={feat.name}
                      onChange={(e) =>
                        updateFeature(idx, 'name', e.target.value)
                      }
                    />
                    <CharCount value={feat.name} max={100} />
                  </div>
                  <div>
                    <textarea
                      rows={3}
                      maxLength={800}
                      placeholder="Describe this feature..."
                      className={fieldClass}
                      value={feat.description}
                      onChange={(e) =>
                        updateFeature(idx, 'description', e.target.value)
                      }
                    />
                    <CharCount value={feat.description} max={800} />
                  </div>
                </div>
              ))}
            </section>

            {SINGLE_SECTIONS.map((sec) => {
              const active = formData[sec.key] != null;
              return (
                <section
                  key={sec.key}
                  className="space-y-3 border border-cyber-border rounded-xl p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-mono text-sm tracking-widest text-neon-cyan uppercase">
                      {sec.label}
                    </h3>
                    {!active ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="gap-1.5"
                        onClick={() => addSingleSection(sec.key)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </Button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          requestRemoveSingle(sec.key, sec.label)
                        }
                        className="text-red-400 hover:text-red-300 p-1 inline-flex items-center gap-1 text-xs font-mono"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    )}
                  </div>
                  {active ? (
                    <div>
                      <textarea
                        rows={sec.rows}
                        maxLength={sec.maxLength || 2000}
                        placeholder={sec.placeholder}
                        className={fieldClass}
                        value={formData[sec.key] || ''}
                        onChange={(e) => setField(sec.key, e.target.value)}
                      />
                      <CharCount
                        value={formData[sec.key] || ''}
                        max={sec.maxLength || 2000}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted italic">
                      Not added. Click Add to include this section.
                    </p>
                  )}
                </section>
              );
            })}

            {/* Additional Notes */}
            <section className="space-y-3 border border-cyber-border rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-mono text-sm tracking-widest text-neon-cyan uppercase">
                  Additional Notes
                </h3>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  disabled={
                    (formData.additionalNotes || []).length >= MAX_MULTI
                  }
                  onClick={addNote}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add note
                </Button>
              </div>
              {(formData.additionalNotes || []).length === 0 && (
                <p className="text-sm text-text-muted italic">
                  No notes added yet.
                </p>
              )}
              {(formData.additionalNotes || []).map((note, idx) => (
                <div
                  key={idx}
                  className="flex gap-2 items-start border border-cyber-border rounded-lg p-3 bg-cyber-surface/40"
                >
                  <div className="flex-1 min-w-0">
                    <textarea
                      rows={3}
                      maxLength={1000}
                      placeholder={`Note ${idx + 1}...`}
                      className={fieldClass}
                      value={note}
                      onChange={(e) => updateNote(idx, e.target.value)}
                    />
                    <CharCount value={note} max={1000} />
                  </div>
                  <button
                    type="button"
                    onClick={() => requestRemoveNote(idx)}
                    className="text-red-400 hover:text-red-300 p-1 shrink-0"
                    aria-label={`Remove note ${idx + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </section>
          </Card>

          {showDeleteConfirm && (
            <div className="p-4 border border-red-500/50 bg-red-950/30 rounded-xl text-sm">
              <p className="mb-3 text-red-400">
                Delete this idea permanently? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button
                  type="button"
                  disabled={saving}
                  className="!bg-red-600 !border-red-600"
                  onClick={async () => {
                    setSaving(true);
                    const { error } = await supabase
                      .from('ideas')
                      .delete()
                      .eq('id', Number(id));
                    setSaving(false);
                    setShowDeleteConfirm(false);
                    if (error) {
                      setMessage('Delete failed: ' + error.message);
                    } else {
                      navigate('/ideas');
                    }
                  }}
                >
                  Yes, Delete
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 gap-2 py-4"
            >
              <Save className="w-5 h-5" />
              {saving ? 'SAVING...' : 'SAVE CHANGES'}
            </Button>
            <Button
              type="button"
              disabled={saving}
              variant="outline"
              className="flex-1 !border-red-500/50 !text-red-400 hover:!bg-red-500/10"
              onClick={() => setShowDeleteConfirm(true)}
            >
              DELETE IDEA
            </Button>
          </div>
        </form>

        <Modal
          isOpen={!!removeTarget}
          onClose={closeRemoveModal}
          title="Remove field"
          size="sm"
        >
          <p className="text-text-secondary text-sm leading-relaxed mb-2">
            {REMOVE_MESSAGE}
          </p>
          {removeTarget?.label && (
            <p className="text-xs font-mono text-text-muted mb-6">
              {removeTarget.label}
            </p>
          )}
          {!removeTarget?.label && <div className="mb-6" />}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button type="button" variant="secondary" onClick={closeRemoveModal}>
              Cancel
            </Button>
            <button
              type="button"
              className="font-medium transition-all duration-200 inline-flex items-center justify-center rounded-lg border px-5 py-2.5 text-base bg-red-600 border-red-600 text-white hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-cyber-bg"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                executePendingRemove();
              }}
            >
              Delete field
            </button>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default IdeaEdit;

