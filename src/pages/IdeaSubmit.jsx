/**
 * IdeaSubmit - Guided Idea Creation wizard (3 steps)
 *
 * Step 1 Basics: title, category, summary, description (required), tags, project (optional)
 * Step 2 Guided Details: dynamic optional sections stored in guided_data JSONB
 * Step 3 Preview and submit
 */

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Send,
  Check,
  Lightbulb,
  FileText,
  Eye,
  Plus,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { supabase } from '../lib/supabase';
import { ideasService, buildGuidedData } from '../services/ideasService';
import {
  buildGuidedDisplayItems,
  GUIDED_GRID_CLASS,
} from '../utils/guidedLayout';
import Button from '../components/ui/Buttons';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
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

const STEPS = [
  { id: 1, label: 'Basics', icon: Lightbulb },
  { id: 2, label: 'Details', icon: FileText },
  { id: 3, label: 'Preview', icon: Eye },
];

const MAX_MULTI = 8;

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors';

const labelClass =
  'block text-sm font-mono tracking-widest text-neon-cyan mb-2';

const REMOVE_MESSAGE =
  'Are you sure you want to delete this field and its contents?';

/** Single-value optional sections (add once) */
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

const emptyForm = {
  title: '',
  category: '',
  summary: '',
  description: '',
  tags: '',
  projectId: '',
  // Multi optional
  features: [], // { name, description }[]
  additionalNotes: [], // string[]
  // Single optional (null = not added)
  twitchIntegration: null,
  environmentalStorytelling: null,
  economySystem: null,
  storyNarrative: null,
};

const IdeaSubmit = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const linkedFromQuery = useMemo(() => {
    const raw = searchParams.get('project');
    return raw ? String(raw).trim() : null;
  }, [searchParams]);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(() => ({
    ...emptyForm,
    projectId: linkedFromQuery || '',
  }));
  const [tagDraft, setTagDraft] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);
  /** Pending field removal: { kind: 'feature'|'note'|'single', index?, key?, label? } */
  const [removeTarget, setRemoveTarget] = useState(null);
  const removeTargetRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = [];
        const { data: workspace } = await supabase
          .from('projects')
          .select('id, slug, title')
          .order('created_at', { ascending: false });
        if (workspace?.length) {
          list.push(
            ...workspace.map((p) => ({
              id: p.slug || p.id,
              title: p.title || p.slug || p.id,
            }))
          );
        }
        if (list.length === 0) {
          list.push(
            { id: 'prototype-systems', title: 'Prototype Systems' },
            { id: 'core-features', title: 'Core Features Sprint' },
            { id: 'polish-playtests', title: 'Stability and Polish' }
          );
        }
        if (mounted) setProjects(list);
      } catch {
        if (mounted) {
          setProjects([
            { id: 'prototype-systems', title: 'Prototype Systems' },
            { id: 'core-features', title: 'Core Features Sprint' },
            { id: 'polish-playtests', title: 'Stability and Polish' },
          ]);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (linkedFromQuery) {
      setFormData((f) =>
        f.projectId ? f : { ...f, projectId: linkedFromQuery }
      );
    }
  }, [linkedFromQuery]);

  const tags = useMemo(
    () =>
      [
        ...new Set(
          (formData.tags || '')
            .split(/[,;#]+/)
            .map((t) => t.trim().replace(/^#/, ''))
            .filter(Boolean)
        ),
      ],
    [formData.tags]
  );

  const setField = (key, value) =>
    setFormData((f) => ({ ...f, [key]: value }));

  const addTag = () => {
    const cleaned = tagDraft.trim().replace(/^#/, '');
    if (!cleaned) return;
    const next = [...tags];
    if (!next.some((t) => t.toLowerCase() === cleaned.toLowerCase())) {
      next.push(cleaned);
    }
    setField('tags', next.join(', '));
    setTagDraft('');
  };

  const removeTag = (tag) => {
    setField(
      'tags',
      tags.filter((t) => t.toLowerCase() !== tag.toLowerCase()).join(', ')
    );
  };

  // --- Single optional sections ---
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

  // --- Multi: features ---
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

  // --- Multi: notes ---
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

  const validateStep1 = () => {
    if (!(formData.title || '').trim()) return 'Title is required.';
    if (!(formData.category || '').trim()) return 'Category is required.';
    if (!(formData.summary || '').trim()) return 'Short summary is required.';
    if (!(formData.description || '').trim()) return 'Description is required.';
    return null;
  };

  const goNext = () => {
    setMessage('');
    if (step === 1) {
      const err = validateStep1();
      if (err) {
        setMessage(err);
        return;
      }
    }
    setStep((s) => Math.min(3, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setMessage('');
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const previewGuided = useMemo(
    () =>
      buildGuidedData({
        features: formData.features,
        additionalNotes: formData.additionalNotes,
        twitchIntegration: formData.twitchIntegration,
        environmentalStorytelling: formData.environmentalStorytelling,
        economySystem: formData.economySystem,
        storyNarrative: formData.storyNarrative,
      }),
    [formData]
  );

  const handleSubmit = async () => {
    setMessage('');
    const err = validateStep1();
    if (err) {
      setMessage(err);
      setStep(1);
      return;
    }
    if (submitting) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setMessage(
        'You must be logged in to submit an idea. Open Profile to sign in.'
      );
      return;
    }

    const projectId = (formData.projectId || '').trim() || null;
    const guided_data = buildGuidedData({
      features: formData.features,
      additionalNotes: formData.additionalNotes,
      twitchIntegration: formData.twitchIntegration,
      environmentalStorytelling: formData.environmentalStorytelling,
      economySystem: formData.economySystem,
      storyNarrative: formData.storyNarrative,
    });

    const newIdea = {
      title: formData.title.trim(),
      summary: formData.summary.trim(),
      category: formData.category || 'Idea',
      description: formData.description.trim(),
      tags: tags.join(', '),
      features: formData.features,
      additionalNotes: formData.additionalNotes,
      twitchIntegration: formData.twitchIntegration,
      environmentalStorytelling: formData.environmentalStorytelling,
      economySystem: formData.economySystem,
      storyNarrative: formData.storyNarrative,
      guided_data,
      status: 'Proposed',
      votes: 0,
      user_id: session.user.id,
      ...(projectId ? { project_id: projectId } : {}),
    };

    setSubmitting(true);
    try {
      const data = await ideasService.createIdea(newIdea);
      if (!data?.id) {
        throw new Error('Idea was created but no id was returned.');
      }
      if (projectId) {
        navigate(`/projects/${projectId}#project-ideas`, {
          replace: true,
          state: {
            newIdeaId: data.id,
            ideaSavedWithoutProjectId: !!data._project_id_not_persisted,
          },
        });
      } else {
        navigate(`/ideas/${data.id}`, { replace: true });
      }
    } catch (submitErr) {
      console.error('[IdeaSubmit] create failed', submitErr);
      setMessage(
        'Error submitting idea: ' +
          (submitErr?.message ||
            submitErr?.error_description ||
            'Unknown error')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const backHref = formData.projectId
    ? `/projects/${formData.projectId}`
    : '/ideas';

  const filledFeatures = (formData.features || []).filter(
    (f) => f.name || f.description
  );
  const filledNotes = (formData.additionalNotes || []).filter((n) =>
    String(n || '').trim()
  );

  const previewGroups = useMemo(
    () =>
      buildGuidedDisplayItems({
        features: filledFeatures,
        textSections: [
          {
            key: 'twitch',
            label: 'Twitch and Community Integration',
            value: previewGuided.twitch_community,
          },
          {
            key: 'env',
            label: 'Environmental Storytelling',
            value: previewGuided.environmental_storytelling,
          },
          {
            key: 'economy',
            label: 'Economy System',
            value: previewGuided.economy_system,
          },
          {
            key: 'story',
            label: 'Story and Narrative',
            value: previewGuided.story_narrative,
          },
        ],
        notes: filledNotes,
      }),
    [filledFeatures, filledNotes, previewGuided]
  );

  const hasPreviewExtras =
    previewGroups.features.length > 0 ||
    previewGroups.texts.length > 0 ||
    previewGroups.notes.length > 0;

  const renderPreviewCard = (item) => (
    <div
      key={item.key}
      className={`${item.gridClass || item.spanClass || ''} rounded-xl border border-cyber-border bg-cyber-bg/40 p-4 min-w-0 h-full`}
    >
      <div className="font-mono text-xs text-neon-cyan tracking-widest mb-2 uppercase break-words">
        {item.label}
      </div>
      <p className="text-text-secondary whitespace-pre-wrap break-words leading-relaxed">
        {item.body}
      </p>
    </div>
  );

  return (
    <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.05)_0%,transparent_50%)]"
        aria-hidden="true"
      />

      <div className="container-custom relative z-10 py-10 md:py-14 max-w-3xl">
        <Link
          to={backHref}
          className="inline-flex items-center gap-2 text-sm font-mono tracking-widest text-neon-cyan hover:text-white mb-8 group transition-colors"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
          {formData.projectId ? 'BACK TO PROJECT' : 'BACK TO IDEAS'}
        </Link>

        <header className="mb-8">
          <div className="section-header">Idea Creation</div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-2">
            Share your vision
          </h1>
          <p className="text-text-secondary text-sm sm:text-base">
            Three short steps: basics, optional details, then preview and
            submit.
            {formData.projectId && (
              <>
                {' '}
                Linked to{' '}
                <span className="text-neon-cyan font-mono">
                  {formData.projectId}
                </span>
                .
              </>
            )}
          </p>
        </header>

        {/* Step indicator */}
        <nav aria-label="Wizard steps" className="mb-10">
          <ol className="flex items-center gap-2 sm:gap-4">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const active = step === s.id;
              const done = step > s.id;
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-2 sm:gap-3 flex-1"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (s.id < step) {
                        setStep(s.id);
                        return;
                      }
                      if (s.id > step) {
                        const e = validateStep1();
                        if (e) {
                          setMessage(e);
                          return;
                        }
                        setStep(s.id);
                      }
                    }}
                    className={`flex items-center gap-2 min-w-0 ${
                      active || done ? 'opacity-100' : 'opacity-50'
                    }`}
                  >
                    <span
                      className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 text-sm font-mono transition-colors ${
                        done
                          ? 'bg-neon-cyan text-cyber-bg border-neon-cyan'
                          : active
                            ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/10'
                            : 'border-cyber-border text-text-muted'
                      }`}
                    >
                      {done ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </span>
                    <span
                      className={`hidden sm:inline text-xs font-mono tracking-widest uppercase truncate ${
                        active ? 'text-neon-cyan' : 'text-text-muted'
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`hidden sm:block flex-1 h-px ${
                        step > s.id ? 'bg-neon-cyan/50' : 'bg-cyber-border'
                      }`}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {message && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-100 flex flex-wrap items-center justify-between gap-2"
          >
            <span>{message}</span>
            {!user && (
              <Link
                to="/profile"
                className="text-neon-cyan font-mono text-xs shrink-0"
              >
                Sign in
              </Link>
            )}
          </div>
        )}

        <Card className="bg-cyber-card/80 border-cyber-border p-6 sm:p-8 space-y-8">
          {/* ========== STEP 1: BASICS (required) ========== */}
          {step === 1 && (
            <div className="space-y-6" aria-labelledby="step1-title">
              <div>
                <h2
                  id="step1-title"
                  className="text-xl font-bold text-white mb-1"
                >
                  Step 1 - Basics
                </h2>
                <p className="text-sm text-text-secondary">
                  Title, category, short summary, and description are required.
                </p>
              </div>

              <div>
                <label className={labelClass} htmlFor="idea-title">
                  Title *
                </label>
                <input
                  id="idea-title"
                  type="text"
                  required
                  maxLength={100}
                  placeholder="Shared backpack co-op"
                  className={fieldClass}
                  value={formData.title}
                  onChange={(e) => setField('title', e.target.value)}
                />
                <CharCount value={formData.title} max={100} />
              </div>

              <div>
                <label className={labelClass} htmlFor="idea-category">
                  Category *
                </label>
                <select
                  id="idea-category"
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
                <label className={labelClass} htmlFor="idea-summary">
                  Short summary *
                </label>
                <textarea
                  id="idea-summary"
                  required
                  maxLength={300}
                  rows={3}
                  placeholder="A co-op loop where the whole squad shares one inventory."
                  className={fieldClass}
                  value={formData.summary}
                  onChange={(e) => setField('summary', e.target.value)}
                />
                <CharCount value={formData.summary} max={300} />
              </div>

              <div>
                <label className={labelClass} htmlFor="idea-description">
                  Description *
                </label>
                <textarea
                  id="idea-description"
                  required
                  maxLength={4000}
                  rows={6}
                  placeholder="Expand on the gameplay loop, fantasy, and what makes this unique..."
                  className={fieldClass}
                  value={formData.description}
                  onChange={(e) => setField('description', e.target.value)}
                />
                <CharCount value={formData.description} max={4000} />
              </div>

              <div>
                <label className={labelClass}>Tags (optional)</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    maxLength={40}
                    placeholder="Type a tag and press Enter"
                    className={fieldClass}
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={addTag}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="inline-flex items-center gap-1 text-xs font-mono rounded-full border border-neon-purple/40 bg-neon-purple/10 text-neon-purple px-2.5 py-1"
                      >
                        #{tag}
                        <span className="opacity-70">x</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className={labelClass} htmlFor="idea-project">
                  Link to project (optional)
                </label>
                <select
                  id="idea-project"
                  className={fieldClass}
                  value={formData.projectId}
                  onChange={(e) => setField('projectId', e.target.value)}
                >
                  <option value="">Community idea (no project)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* ========== STEP 2: OPTIONAL DETAILS ========== */}
          {step === 2 && (
            <div className="space-y-8" aria-labelledby="step2-title">
              <div>
                <h2
                  id="step2-title"
                  className="text-xl font-bold text-white mb-1"
                >
                  Step 2 - Additional details
                </h2>
                <p className="text-sm text-text-secondary mb-3">
                  Everything here is optional. Use Add to include a section.
                </p>
                <div
                  role="note"
                  className="rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 px-4 py-3 text-sm text-text-secondary"
                >
                  Adding more fields and context makes your idea more valuable
                  to the team and community.
                </div>
              </div>

              {/* Key Features (multi, max 8) */}
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
                <p className="text-xs text-text-muted">
                  Up to {MAX_MULTI} features. Each entry can have a short name
                  and description.
                </p>
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
                    <div className="flex justify-between items-center gap-2">
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

              {/* Single optional sections */}
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
                          aria-label={`Remove ${sec.label}`}
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

              {/* Additional Notes (multi, max 8) */}
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
                <p className="text-xs text-text-muted">
                  Up to {MAX_MULTI} notes for anything that did not fit above.
                </p>
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
            </div>
          )}

          {/* ========== STEP 3: PREVIEW ========== */}
          {step === 3 && (
            <div className="space-y-6" aria-labelledby="step3-title">
              <div>
                <h2
                  id="step3-title"
                  className="text-xl font-bold text-white mb-1"
                >
                  Step 3 - Preview and submit
                </h2>
                <p className="text-sm text-text-secondary">
                  Review how this will appear, then submit to the forge.
                </p>
              </div>

              <div className="rounded-xl border border-neon-cyan/25 bg-cyber-surface/60 p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neon">Proposed</Badge>
                  {formData.category && (
                    <Badge variant="default">{formData.category}</Badge>
                  )}
                  {formData.projectId && (
                    <Badge variant="purple">
                      Project · {formData.projectId}
                    </Badge>
                  )}
                </div>

                <h3 className="text-2xl font-bold text-white">
                  {formData.title || 'Untitled idea'}
                </h3>
                <p className="text-text-secondary leading-relaxed">
                  {formData.summary || 'No summary yet.'}
                </p>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] font-mono px-2 py-0.5 rounded border border-cyber-border text-text-muted"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t border-cyber-border space-y-4 text-sm">
                  <div className="rounded-xl border border-cyber-border bg-cyber-bg/40 p-4 min-w-0">
                    <div className="font-mono text-xs text-neon-cyan tracking-widest mb-2 uppercase">
                      Description
                    </div>
                    <p className="text-text-secondary whitespace-pre-wrap break-words leading-relaxed">
                      {formData.description}
                    </p>
                  </div>

                  {hasPreviewExtras && (
                    <div className="space-y-6">
                      {previewGroups.features.length > 0 && (
                        <div>
                          <div className="font-mono text-xs text-neon-cyan tracking-widest mb-3 uppercase">
                            Key Features
                          </div>
                          <div className={GUIDED_GRID_CLASS}>
                            {previewGroups.features.map(renderPreviewCard)}
                          </div>
                        </div>
                      )}
                      {previewGroups.texts.length > 0 && (
                        <div className={GUIDED_GRID_CLASS}>
                          {previewGroups.texts.map(renderPreviewCard)}
                        </div>
                      )}
                      {previewGroups.notes.length > 0 && (
                        <div>
                          <div className="font-mono text-xs text-neon-cyan tracking-widest mb-3 uppercase">
                            Additional Notes
                          </div>
                          <div className={GUIDED_GRID_CLASS}>
                            {previewGroups.notes.map(renderPreviewCard)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {!user && (
                <p className="text-sm text-amber-200/90 border border-amber-400/30 bg-amber-400/5 rounded-lg px-4 py-3">
                  You need to be signed in to submit.{' '}
                  <Link
                    to="/profile"
                    className="text-neon-cyan hover:underline"
                  >
                    Go to Profile
                  </Link>
                </p>
              )}
            </div>
          )}

          {/* Nav */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-2 border-t border-cyber-border">
            <Button
              type="button"
              variant="ghost"
              className="gap-2"
              onClick={step === 1 ? () => navigate(backHref) : goBack}
            >
              <ArrowLeft className="w-4 h-4" />
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>

            {step < 3 ? (
              <Button type="button" className="gap-2" onClick={goNext}>
                Continue
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="button"
                className="gap-2"
                disabled={submitting}
                onClick={handleSubmit}
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Submitting...' : 'Submit to the Forge'}
              </Button>
            )}
          </div>
        </Card>

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

export default IdeaSubmit;

