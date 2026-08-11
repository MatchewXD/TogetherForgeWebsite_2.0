/**
 * IdeaEdit - edit an existing idea using the same field model as the guided wizard.
 * Loads/saves guided_data JSONB for optional sections.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  buildGuidedData,
  ideasService,
  getIdeaImageUrl,
} from '../services/ideasService';
import {
  MAX_MULTI,
  SINGLE_OPTIONAL_SECTIONS,
  emptyOptionalForm,
  guidedFieldsFromForm,
  optionalFormFromIdea,
} from '../utils/ideaOptionalSections';
import Button from '../components/ui/Buttons';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import CharCount from '../components/ui/CharCount';
import IdeaImageField from '../components/ideas/IdeaImageField';
import IdeaTagsField from '../components/ideas/IdeaTagsField';
import ParentIdeaPicker from '../components/ideas/ParentIdeaPicker';
import { ideaTagsService } from '../services/ideaTagsService';
import { serializeTags } from '../utils/ideaTags';
import { parseTags } from '../utils/ideaStatus';
import { humanizeParentLinkError } from '../utils/ideaRelations';

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

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors';

const labelClass =
  'block text-sm font-mono tracking-widest text-neon-cyan mb-2';

const REMOVE_MESSAGE =
  'Are you sure you want to delete this field and its contents?';

const SINGLE_SECTIONS = SINGLE_OPTIONAL_SECTIONS.map((s) => ({
  key: s.key,
  label: s.label,
  placeholder: s.placeholder,
  rows: s.rows,
  maxLength: s.maxLength,
}));

const emptyOptional = {
  ...emptyOptionalForm(),
  features: [],
  additionalNotes: [],
};

function formFromIdeaRow(data) {
  const optional = optionalFormFromIdea(data);
  return {
    title: data.title || '',
    category: data.category || '',
    summary: data.summary || '',
    description: data.description || '',
    tags: data.tags || '',
    projectId: data.project_id || data.projectId || '',
    parentIdeaId:
      data.parent_idea_id != null
        ? String(data.parent_idea_id)
        : data.parentIdeaId != null
          ? String(data.parentIdeaId)
          : '',
    imageUrl: getIdeaImageUrl(data),
    features: optional.features || [],
    additionalNotes: optional.additionalNotes || [],
    artStyle: optional.artStyle,
    targetPlatforms: optional.targetPlatforms,
    coreLoopLength: optional.coreLoopLength,
    primaryInspiration: optional.primaryInspiration,
    estimatedScope: optional.estimatedScope,
    twitchIntegration: optional.twitchIntegration,
    environmentalStorytelling: optional.environmentalStorytelling,
    economySystem: optional.economySystem,
    storyNarrative: optional.storyNarrative,
  };
}

const IdeaEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(() => {
    const fromNav = location.state?.message;
    return typeof fromNav === 'string' ? fromNav : '';
  });
  const [messageTone, setMessageTone] = useState(() =>
    location.state?.imagePersistFailed ? 'error' : 'error'
  );
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
    parentIdeaId: '',
    imageUrl: null,
    ...emptyOptional,
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);

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
      setImageFile(null);
      setImagePreview(null);
      setRemoveImage(false);
      setLoading(false);
    };
    init();
  }, [id, navigate]);

  const onImageFile = useCallback((file) => {
    setImageFile(file);
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

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

    const uniqueTags = serializeTags(parseTags(formData.tags));

    let guided_data = buildGuidedData(guidedFieldsFromForm(formData));
    // Preserve existing image dual-write unless user is removing it
    const existingImage =
      !removeImage && formData.imageUrl
        ? String(formData.imageUrl).trim()
        : null;
    if (existingImage && !imageFile) {
      guided_data = {
        ...guided_data,
        supporting_image_url: existingImage,
      };
    }

    const ideaIdNum = Number(id);
    const patch = {
      title: formData.title.trim(),
      category: formData.category,
      summary: formData.summary.trim(),
      description: formData.description.trim(),
      tags: uniqueTags,
      parent_idea_id:
        formData.parentIdeaId === '' || formData.parentIdeaId == null
          ? null
          : Number(formData.parentIdeaId),
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

    // Optional supporting image: upload first, then attach via dedicated helper
    // so we survive a missing image_url column (guided_data fallback).
    let uploadedUrl = null;
    try {
      if (imageFile && user?.id) {
        uploadedUrl = await ideasService.uploadIdeaImage(imageFile, user.id);
        if (uploadedUrl) {
          patch.image_url = uploadedUrl;
          // Keep guided_data dual-write in sync when present
          if (
            patch.guided_data &&
            typeof patch.guided_data === 'object' &&
            !Array.isArray(patch.guided_data)
          ) {
            patch.guided_data = {
              ...patch.guided_data,
              supporting_image_url: uploadedUrl,
            };
          }
          if (formData.imageUrl && formData.imageUrl !== uploadedUrl) {
            await ideasService.deleteIdeaImageByUrl(
              formData.imageUrl,
              user.id
            );
          }
        }
      } else if (removeImage) {
        patch.image_url = null;
        if (
          patch.guided_data &&
          typeof patch.guided_data === 'object' &&
          !Array.isArray(patch.guided_data)
        ) {
          const nextG = { ...patch.guided_data };
          delete nextG.supporting_image_url;
          delete nextG.supportingImageUrl;
          patch.guided_data = nextG;
        }
        if (formData.imageUrl && user?.id) {
          await ideasService.deleteIdeaImageByUrl(formData.imageUrl, user.id);
        }
      }
    } catch (imgErr) {
      setMessage(imgErr?.message || 'Image upload failed.');
      setMessageTone('error');
      setSaving(false);
      return;
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
        'image_url',
        'parent_idea_id',
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
      setMessage(
        'Update failed: ' + (humanizeParentLinkError(error) || error.message)
      );
      setMessageTone('error');
      setSaving(false);
      return;
    }
    if (!data || data.length === 0) {
      setMessage(
        'Update did not apply. You may not have permission to edit this idea (RLS policy or missing user_id on the row).'
      );
      setMessageTone('error');
      setSaving(false);
      return;
    }

    let saved = Array.isArray(data) ? data[0] : data;

    // If image was uploaded but stripped from the update, attach separately
    if (uploadedUrl && user?.id && !getIdeaImageUrl(saved)) {
      const attached = await ideasService.setIdeaImageUrl(
        ideaIdNum,
        uploadedUrl,
        user.id
      );
      if (attached) {
        saved = attached;
      } else {
        setMessage(
          'Idea saved, but the image could not be stored. In Supabase SQL Editor run supabase/sql/supabase_ideas_image.sql, then try attaching the image again.'
        );
        setMessageTone('error');
        setFormData((f) => ({ ...f, imageUrl: uploadedUrl }));
        setImageFile(null);
        setSaving(false);
        return;
      }
    }

    try {
      await ideaTagsService.syncTagsAfterSave(saved?.tags ?? uniqueTags, {
        userId: user?.id,
      });
    } catch (tagErr) {
      console.warn('[IdeaEdit] tag sync', tagErr);
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
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
              messageTone === 'error'
                ? 'border-red-400/40 bg-red-400/10 text-red-100'
                : 'border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan'
            }`}
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

            <IdeaImageField
              id="idea-image-edit"
              file={imageFile}
              existingUrl={formData.imageUrl}
              previewUrl={imagePreview}
              removeExisting={removeImage}
              onFileChange={onImageFile}
              onRemoveExisting={setRemoveImage}
            />

            <IdeaTagsField
              value={formData.tags}
              onChange={(v) => setField('tags', v)}
              labelClass={labelClass}
            />

            <ParentIdeaPicker
              value={formData.parentIdeaId}
              onChange={(v) => setField('parentIdeaId', v)}
              excludeIdeaId={Number(id)}
              labelClass={labelClass}
              fieldClass={fieldClass}
            />
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

