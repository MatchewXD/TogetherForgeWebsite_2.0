/**
 * IdeaSubmit - Guided Idea Creation wizard (3 steps)
 *
 * Step 1 Basics: title, category, summary, description (required), tags, project (optional)
 * Step 2 Optional details: picker grid of expandable sections stored in guided_data
 * Step 3 Preview and submit
 * Drafts: Save as Draft + resume via ?draft=id (logged-in users)
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
  Wand2,
  Save,
  FolderOpen,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { supabase } from '../lib/supabase';
import { ideasService, buildGuidedData } from '../services/ideasService';
import {
  buildGuidedDisplayItems,
  GUIDED_GRID_CLASS,
} from '../utils/guidedLayout';
import {
  MAX_MULTI,
  SINGLE_OPTIONAL_SECTIONS,
  GUIDED_OPTIONAL_PICKER,
  emptyOptionalForm,
  guidedFieldsFromForm,
  isOptionalSectionActive,
  activateOptionalSection,
  deactivateOptionalSection,
  optionalFormFromIdea,
  buildPreviewTextSections,
  localDraftStorageKey,
} from '../utils/ideaOptionalSections';
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

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors';

const labelClass =
  'block text-sm font-mono tracking-widest text-neon-cyan mb-2';

const REMOVE_MESSAGE =
  'Are you sure you want to delete this field and its contents?';

const emptyForm = {
  title: '',
  category: '',
  summary: '',
  description: '',
  tags: '',
  projectId: '',
  ...emptyOptionalForm(),
};

const IdeaSubmit = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const linkedFromQuery = useMemo(() => {
    const raw = searchParams.get('project');
    return raw ? String(raw).trim() : null;
  }, [searchParams]);

  const draftFromQuery = useMemo(() => {
    const raw = searchParams.get('draft');
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [searchParams]);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(() => ({
    ...emptyForm,
    projectId: linkedFromQuery || '',
  }));
  const [draftId, setDraftId] = useState(null);
  const [tagDraft, setTagDraft] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('error'); // error | success | info
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);
  const [loadingDraft, setLoadingDraft] = useState(!!draftFromQuery);
  /** Pending field removal: { kind: 'feature'|'note'|'single'|'section', index?, key?, label? } */
  const [removeTarget, setRemoveTarget] = useState(null);
  const removeTargetRef = useRef(null);
  const formDataRef = useRef(formData);
  const draftIdRef = useRef(draftId);
  const autoSaveTimer = useRef(null);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);
  useEffect(() => {
    draftIdRef.current = draftId;
  }, [draftId]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => sub?.subscription?.unsubscribe?.();
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
            { id: 'prototype-systems', title: 'Tether' },
            { id: 'core-features', title: 'Core Features Sprint' },
            { id: 'polish-playtests', title: 'Stability and Polish' }
          );
        }
        if (mounted) setProjects(list);
      } catch {
        if (mounted) {
          setProjects([
            { id: 'prototype-systems', title: 'Tether' },
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

  // Load draft from ?draft=id
  useEffect(() => {
    if (!draftFromQuery) {
      setLoadingDraft(false);
      return;
    }
    let mounted = true;
    (async () => {
      setLoadingDraft(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) {
          if (mounted) {
            setMessage('Sign in to continue a draft.');
            setMessageTone('error');
            setLoadingDraft(false);
          }
          return;
        }
        const { data, error } = await supabase
          .from('ideas')
          .select('*')
          .eq('id', draftFromQuery)
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (error || !data) {
          if (mounted) {
            setMessage('Draft not found or you do not own it.');
            setMessageTone('error');
            setLoadingDraft(false);
          }
          return;
        }
        if (mounted) {
          setFormData({
            title: data.title === 'Untitled draft' ? '' : data.title || '',
            category: data.category || '',
            summary: data.summary || '',
            description: data.description || '',
            tags: data.tags || '',
            projectId: data.project_id || linkedFromQuery || '',
            ...optionalFormFromIdea(data),
          });
          setDraftId(data.id);
          setMessage('Draft loaded. Continue editing and publish when ready.');
          setMessageTone('info');
        }
      } catch (err) {
        console.error('[IdeaSubmit] load draft', err);
        if (mounted) {
          setMessage('Could not load draft.');
          setMessageTone('error');
        }
      } finally {
        if (mounted) setLoadingDraft(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [draftFromQuery, linkedFromQuery]);

  // Light local auto-save while working (debounced)
  useEffect(() => {
    if (!user) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      try {
        const key = localDraftStorageKey(user.id, 'guided');
        const payload = {
          formData: formDataRef.current,
          draftId: draftIdRef.current,
          step,
          savedAt: Date.now(),
        };
        localStorage.setItem(key, JSON.stringify(payload));
      } catch {
        /* ignore quota / private mode */
      }
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [formData, step, user, draftId]);

  // Restore local auto-save if no draft query (once per mount when signed in)
  useEffect(() => {
    if (!user || draftFromQuery) return;
    try {
      const key = localDraftStorageKey(user.id, 'guided');
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.formData) return;
      const f = parsed.formData;
      const hasContent =
        (f.title || '').trim() ||
        (f.summary || '').trim() ||
        (f.description || '').trim();
      if (!hasContent) return;
      // Only restore if form is still empty
      setFormData((current) => {
        const empty =
          !(current.title || '').trim() &&
          !(current.summary || '').trim() &&
          !(current.description || '').trim();
        if (!empty) return current;
        return {
          ...emptyForm,
          ...f,
          projectId: f.projectId || linkedFromQuery || '',
        };
      });
      if (parsed.draftId) setDraftId(parsed.draftId);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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

  const openRemoveModal = (target) => {
    removeTargetRef.current = target;
    setRemoveTarget(target);
  };

  const closeRemoveModal = useCallback(() => {
    removeTargetRef.current = null;
    setRemoveTarget(null);
  }, []);

  const requestRemoveSection = (key, label) => {
    openRemoveModal({ kind: 'section', key, label });
  };

  const requestRemoveFeature = (idx) => {
    openRemoveModal({ kind: 'feature', index: idx, label: `Feature ${idx + 1}` });
  };

  const requestRemoveNote = (idx) => {
    openRemoveModal({ kind: 'note', index: idx, label: `Note ${idx + 1}` });
  };

  const activateSection = (key) => {
    setFormData((f) => activateOptionalSection(f, key));
  };

  const addFeature = () => {
    setFormData((f) => {
      const list = Array.isArray(f.features) ? f.features : [];
      if (list.length >= MAX_MULTI) return f;
      return {
        ...f,
        features: [...list, { name: '', description: '' }],
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

  const addNote = () => {
    setFormData((f) => {
      const list = Array.isArray(f.additionalNotes) ? f.additionalNotes : [];
      if (list.length >= MAX_MULTI) return f;
      return {
        ...f,
        additionalNotes: [...list, ''],
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

  const executePendingRemove = useCallback(() => {
    const target = removeTargetRef.current;
    if (!target) return;

    const { kind, key, index } = target;

    if (kind === 'section' && key) {
      setFormData((f) => deactivateOptionalSection(f, key));
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
        setMessageTone('error');
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

  const buildIdeaPayload = (status) => {
    const projectId = (formData.projectId || '').trim() || null;
    const guided_data = buildGuidedData(guidedFieldsFromForm(formData));
    return {
      ...(draftId ? { id: draftId } : {}),
      title: (formData.title || '').trim(),
      summary: (formData.summary || '').trim(),
      category: formData.category || 'Idea',
      description: (formData.description || '').trim(),
      tags: tags.join(', '),
      ...guidedFieldsFromForm(formData),
      guided_data,
      status,
      votes: 0,
      ...(projectId ? { project_id: projectId } : {}),
    };
  };

  const handleSaveDraft = async () => {
    setMessage('');
    if (!user) {
      setMessage('Sign in to save a draft.');
      setMessageTone('error');
      return;
    }
    setSavingDraft(true);
    try {
      const payload = buildIdeaPayload('Draft');
      const data = await ideasService.saveDraft({
        ...payload,
        user_id: user.id,
      });
      if (!data?.id) throw new Error('Draft saved but no id returned.');
      setDraftId(data.id);
      setDraftSavedAt(new Date());
      // Keep URL in sync so refresh resumes the same draft
      const next = new URLSearchParams(searchParams);
      next.set('draft', String(data.id));
      setSearchParams(next, { replace: true });
      setMessage('Draft saved. You can find it under My Drafts on your Dashboard.');
      setMessageTone('success');
    } catch (err) {
      console.error('[IdeaSubmit] save draft', err);
      setMessage('Could not save draft: ' + (err?.message || 'Unknown error'));
      setMessageTone('error');
    } finally {
      setSavingDraft(false);
    }
  };

  const previewGuided = useMemo(
    () => buildGuidedData(guidedFieldsFromForm(formData)),
    [formData]
  );

  const handleSubmit = async () => {
    setMessage('');
    const err = validateStep1();
    if (err) {
      setMessage(err);
      setMessageTone('error');
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
      setMessageTone('error');
      return;
    }

    const projectId = (formData.projectId || '').trim() || null;
    const newIdea = {
      ...buildIdeaPayload('Proposed'),
      user_id: session.user.id,
    };

    setSubmitting(true);
    try {
      const data = await ideasService.publishIdea(newIdea);
      if (!data?.id) {
        throw new Error('Idea was created but no id was returned.');
      }
      try {
        localStorage.removeItem(localDraftStorageKey(session.user.id, 'guided'));
      } catch {
        /* ignore */
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
      setMessageTone('error');
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
        textSections: buildPreviewTextSections(previewGuided),
        notes: filledNotes,
      }),
    [filledFeatures, filledNotes, previewGuided]
  );

  const hasPreviewExtras =
    previewGroups.features.length > 0 ||
    previewGroups.texts.length > 0 ||
    previewGroups.notes.length > 0;

  const activePickerItems = GUIDED_OPTIONAL_PICKER.filter((item) =>
    isOptionalSectionActive(formData, item.key)
  );
  const inactivePickerItems = GUIDED_OPTIONAL_PICKER.filter(
    (item) => !isOptionalSectionActive(formData, item.key)
  );

  const singleByKey = useMemo(() => {
    const map = {};
    for (const s of SINGLE_OPTIONAL_SECTIONS) map[s.key] = s;
    return map;
  }, []);

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

  const messageClass =
    messageTone === 'success'
      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100'
      : messageTone === 'info'
        ? 'border-neon-cyan/40 bg-neon-cyan/10 text-text-secondary'
        : 'border-red-400/40 bg-red-400/10 text-red-100';

  if (loadingDraft) {
    return (
      <div className="pt-20 min-h-screen bg-cyber-bg text-text-primary flex items-center justify-center">
        <p className="text-text-secondary font-mono text-sm tracking-widest">
          Loading draft…
        </p>
      </div>
    );
  }

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
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <div className="section-header">Idea Creation</div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-2">
                Share your vision
              </h1>
              <p className="text-text-secondary text-sm sm:text-base">
                Three short steps: basics, optional details, then preview and
                submit. Prefer one question at a time? Try the Idea Wizard.
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
                {draftId && (
                  <>
                    {' '}
                    <Badge variant="default">Draft #{draftId}</Badge>
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-2 shrink-0">
              <Link
                to={
                  formData.projectId
                    ? `/ideas/wizard?project=${encodeURIComponent(formData.projectId)}${draftId ? `&draft=${draftId}` : ''}`
                    : draftId
                      ? `/ideas/wizard?draft=${draftId}`
                      : '/ideas/wizard'
                }
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-neon-purple/50 bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20 hover:border-neon-purple font-mono text-xs tracking-widest uppercase transition-colors shadow-sm"
              >
                <Wand2 className="w-4 h-4" />
                Use Idea Wizard
              </Link>
              {user && (
                <Link
                  to="/dashboard#my-drafts"
                  className="inline-flex items-center gap-1.5 text-xs font-mono tracking-widest text-text-muted hover:text-neon-cyan transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  My Drafts
                </Link>
              )}
            </div>
          </div>
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
                          setMessageTone('error');
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
            className={`mb-6 rounded-lg border px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2 ${messageClass}`}
          >
            <span>{message}</span>
            {!user && messageTone === 'error' && (
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

          {/* ========== STEP 2: OPTIONAL DETAILS (picker grid) ========== */}
          {step === 2 && (
            <div className="space-y-6" aria-labelledby="step2-title">
              <div>
                <h2
                  id="step2-title"
                  className="text-xl font-bold text-white mb-1"
                >
                  Step 2 - Additional details
                </h2>
                <p className="text-sm text-text-secondary mb-3">
                  Everything here is optional. Tap a section to expand it. Add
                  as many as you like without cluttering the form.
                </p>
                <div
                  role="note"
                  className="rounded-lg border border-neon-cyan/30 bg-neon-cyan/5 px-4 py-3 text-sm text-text-secondary"
                >
                  More context makes your idea more valuable to the team and
                  community. Skip anything that does not fit yet.
                </div>
              </div>

              {/* Picker grid for inactive sections */}
              {inactivePickerItems.length > 0 && (
                <div>
                  <div className="font-mono text-xs tracking-widest text-text-muted uppercase mb-3">
                    Add a section
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    {inactivePickerItems.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => activateSection(item.key)}
                        className="text-left rounded-xl border border-cyber-border bg-cyber-surface/50 hover:border-neon-cyan/50 hover:bg-neon-cyan/5 p-3.5 transition-colors group"
                      >
                        <div className="flex items-start gap-2">
                          <Plus className="w-4 h-4 text-neon-cyan shrink-0 mt-0.5 opacity-70 group-hover:opacity-100" />
                          <div className="min-w-0">
                            <div className="font-mono text-xs tracking-widest text-neon-cyan uppercase mb-1">
                              {item.label}
                            </div>
                            <p className="text-xs text-text-muted leading-relaxed line-clamp-2">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Expanded active sections */}
              {activePickerItems.length > 0 && (
                <div className="space-y-4">
                  <div className="font-mono text-xs tracking-widest text-text-muted uppercase">
                    Your sections ({activePickerItems.length})
                  </div>

                  {activePickerItems.map((item) => {
                    if (item.kind === 'features') {
                      return (
                        <section
                          key={item.key}
                          className="space-y-3 border border-neon-cyan/30 rounded-xl p-4 bg-cyber-surface/30"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-mono text-sm tracking-widest text-neon-cyan uppercase">
                                Key Features
                              </h3>
                              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                                {item.description}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                requestRemoveSection('features', 'Key Features')
                              }
                              className="text-red-400 hover:text-red-300 p-1.5 inline-flex items-center gap-1 text-xs font-mono shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                              Remove
                            </button>
                          </div>
                          {(formData.features || []).map((feat, idx) => (
                            <div
                              key={idx}
                              className="border border-cyber-border rounded-lg p-4 space-y-3 bg-cyber-bg/40"
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
                                    updateFeature(
                                      idx,
                                      'description',
                                      e.target.value
                                    )
                                  }
                                />
                                <CharCount value={feat.description} max={800} />
                              </div>
                            </div>
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="gap-1.5"
                            disabled={
                              (formData.features || []).length >= MAX_MULTI
                            }
                            onClick={addFeature}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add feature
                            {(formData.features || []).length > 0 &&
                              ` (${(formData.features || []).length}/${MAX_MULTI})`}
                          </Button>
                        </section>
                      );
                    }

                    if (item.kind === 'notes') {
                      return (
                        <section
                          key={item.key}
                          className="space-y-3 border border-neon-cyan/30 rounded-xl p-4 bg-cyber-surface/30"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-mono text-sm tracking-widest text-neon-cyan uppercase">
                                Additional Notes
                              </h3>
                              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                                {item.description}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                requestRemoveSection(
                                  'additionalNotes',
                                  'Additional Notes'
                                )
                              }
                              className="text-red-400 hover:text-red-300 p-1.5 inline-flex items-center gap-1 text-xs font-mono shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                              Remove
                            </button>
                          </div>
                          {(formData.additionalNotes || []).map((note, idx) => (
                            <div
                              key={idx}
                              className="flex gap-2 items-start border border-cyber-border rounded-lg p-3 bg-cyber-bg/40"
                            >
                              <div className="flex-1 min-w-0">
                                <textarea
                                  rows={3}
                                  maxLength={1000}
                                  placeholder={`Note ${idx + 1}...`}
                                  className={fieldClass}
                                  value={note}
                                  onChange={(e) =>
                                    updateNote(idx, e.target.value)
                                  }
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
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="gap-1.5"
                            disabled={
                              (formData.additionalNotes || []).length >=
                              MAX_MULTI
                            }
                            onClick={addNote}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add note
                            {(formData.additionalNotes || []).length > 0 &&
                              ` (${(formData.additionalNotes || []).length}/${MAX_MULTI})`}
                          </Button>
                        </section>
                      );
                    }

                    // Single text section
                    const sec = singleByKey[item.key] || item.section;
                    if (!sec) return null;
                    return (
                      <section
                        key={item.key}
                        className="space-y-3 border border-neon-cyan/30 rounded-xl p-4 bg-cyber-surface/30"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-mono text-sm tracking-widest text-neon-cyan uppercase">
                              {sec.label}
                            </h3>
                            <p className="text-xs text-text-muted mt-1 leading-relaxed">
                              {sec.description}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              requestRemoveSection(sec.key, sec.label)
                            }
                            className="text-red-400 hover:text-red-300 p-1.5 inline-flex items-center gap-1 text-xs font-mono shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove
                          </button>
                        </div>
                        <div>
                          <textarea
                            rows={sec.rows || 4}
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
                      </section>
                    );
                  })}
                </div>
              )}

              {activePickerItems.length === 0 && (
                <p className="text-sm text-text-muted italic text-center py-4">
                  No optional sections added yet. Use the buttons above, or
                  continue to preview.
                </p>
              )}
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
          <div className="flex flex-col gap-3 pt-2 border-t border-cyber-border">
            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                className="gap-2"
                onClick={step === 1 ? () => navigate(backHref) : goBack}
              >
                <ArrowLeft className="w-4 h-4" />
                {step === 1 ? 'Cancel' : 'Back'}
              </Button>

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:ml-auto">
                {user && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-2"
                    disabled={savingDraft || submitting}
                    onClick={handleSaveDraft}
                  >
                    <Save className="w-4 h-4" />
                    {savingDraft
                      ? 'Saving…'
                      : draftId
                        ? 'Update Draft'
                        : 'Save as Draft'}
                  </Button>
                )}
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
            </div>
            {user && draftSavedAt && (
              <p className="text-[11px] font-mono text-text-muted text-right">
                Draft saved {draftSavedAt.toLocaleTimeString()}
                {draftId ? ` · #${draftId}` : ''}
              </p>
            )}
            {user && (
              <p className="text-[11px] text-text-muted text-center sm:text-right">
                Progress is also auto-saved locally while you type.
              </p>
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
