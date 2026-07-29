/**
 * Idea Wizard: full-screen multi-step guided idea creation.
 * One question per step with tips. Builds guided_data on submit.
 * Entry: /ideas/wizard (from "Use Idea Wizard" on /ideas/submit).
 * Supports Save as Draft + resume via ?draft=id.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Lightbulb,
  Sparkles,
  X,
  Send,
  SkipForward,
  Pencil,
  Save,
  FolderOpen,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { ideasService, buildGuidedData } from '../services/ideasService';
import {
  buildGuidedDisplayItems,
  GUIDED_GRID_CLASS,
} from '../utils/guidedLayout';
import {
  MAX_MULTI,
  SINGLE_OPTIONAL_SECTIONS,
  guidedFieldsFromForm,
  optionalFormFromIdea,
  buildPreviewTextSections,
  localDraftStorageKey,
} from '../utils/ideaOptionalSections';
import Button from '../components/ui/Buttons';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import CharCount from '../components/ui/CharCount';

const CATEGORIES = [
  {
    id: 'Full Game Idea',
    desc: 'A complete game concept: fantasy, loop, and who it is for.',
  },
  {
    id: 'Game Mechanic',
    desc: 'A single system or interaction that could power a game.',
  },
  {
    id: 'Setting / Story / Lore',
    desc: 'World, narrative, characters, or lore hooks.',
  },
  {
    id: 'Art / Visual Design',
    desc: 'Look, style, UI, or visual direction.',
  },
  {
    id: 'Audio / Sound / Music',
    desc: 'Soundtrack, SFX, adaptive audio, or voice.',
  },
  {
    id: 'Multiplayer / Cooperative Systems',
    desc: 'How people play together, roles, and shared goals.',
  },
  {
    id: 'Twitch / Streamer Integration',
    desc: 'Audience participation, chat tools, streamer loops.',
  },
  {
    id: 'Progression / Economy / Crafting',
    desc: 'Levels, loot, resources, crafting, or meta progression.',
  },
  {
    id: 'Enemy / AI / Combat',
    desc: 'Fights, foes, AI behaviors, or encounter design.',
  },
  {
    id: 'World Building / Environment',
    desc: 'Spaces, bioms, environmental storytelling, traversal.',
  },
  {
    id: 'Other',
    desc: 'Something that does not fit the boxes above. That is fine.',
  },
];

const emptyForm = {
  title: '',
  category: '',
  summary: '',
  description: '',
  tags: '',
  projectId: '',
  features: [{ name: '', description: '' }],
  additionalNotes: [''],
  artStyle: '',
  targetPlatforms: '',
  coreLoopLength: '',
  primaryInspiration: '',
  estimatedScope: '',
  twitchIntegration: '',
  environmentalStorytelling: '',
  economySystem: '',
  storyNarrative: '',
};

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-xl px-4 py-3.5 text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors text-base';

/**
 * Full step list: core fields, then optional guided sections (all skippable), then review.
 */
function buildStepDefs() {
  const singleSteps = SINGLE_OPTIONAL_SECTIONS.map((sec) => ({
    id: sec.key,
    title: `${sec.label} (optional)`,
    tip: sec.tip,
    required: false,
    kind: 'textarea',
    field: sec.key,
    maxLength: sec.maxLength || 2000,
    rows: sec.rows || 5,
    placeholder: sec.placeholder,
  }));

  // Place new design fields after description; keep legacy guided fields after tags/project
  const earlyDesignKeys = new Set([
    'artStyle',
    'targetPlatforms',
    'coreLoopLength',
    'primaryInspiration',
    'estimatedScope',
  ]);
  const designSteps = singleSteps.filter((s) => earlyDesignKeys.has(s.id));
  const laterSingleSteps = singleSteps.filter((s) => !earlyDesignKeys.has(s.id));

  return [
    {
      id: 'category',
      title: 'What kind of idea is this?',
      tip: 'Pick the closest fit. You can still describe anything in the details.',
      required: true,
      kind: 'category',
    },
    {
      id: 'title',
      title: 'Give it a title',
      tip: 'Catchy titles help grab attention. Short and clear beats long and vague.',
      required: true,
      kind: 'text',
      field: 'title',
      maxLength: 100,
      placeholder: 'e.g. Shared Backpack Co-op',
    },
    {
      id: 'summary',
      title: 'One short summary',
      tip: 'One or two sentences someone can scan in a feed. Save the deep dive for the next step.',
      required: true,
      kind: 'textarea',
      field: 'summary',
      maxLength: 300,
      rows: 4,
      placeholder: 'A co-op loop where the whole squad shares one inventory...',
    },
    {
      id: 'description',
      title: 'Describe the idea',
      tip: 'What is fun? What is unique? Who plays it? A few paragraphs is plenty.',
      required: true,
      kind: 'textarea',
      field: 'description',
      maxLength: 4000,
      rows: 8,
      placeholder:
        'Expand on the fantasy, the loop, and why it belongs at Together Forge...',
    },
    // New optional design / scope fields right after core description
    ...designSteps,
    {
      id: 'tags',
      title: 'Tags (optional)',
      tip: 'Tags help people find your idea. Examples: co-op, twitch, horror, extraction.',
      required: false,
      kind: 'tags',
    },
    {
      id: 'project',
      title: 'Link a project? (optional)',
      tip: 'Leave blank for the global ideas board. Link only if this is meant for a specific forge project.',
      required: false,
      kind: 'project',
    },
    {
      id: 'features',
      title: 'Key Features (optional)',
      tip: 'List concrete features players will notice. Skip if you are still exploring.',
      required: false,
      kind: 'features',
    },
    ...laterSingleSteps,
    {
      id: 'additionalNotes',
      title: 'Additional Notes (optional)',
      tip: 'References, constraints, or extras that did not fit above. Skip freely.',
      required: false,
      kind: 'notes',
    },
    {
      id: 'review',
      title: 'Review your idea',
      tip: 'Looks good? Submit when ready. Tap Edit on any section to jump back.',
      required: false,
      kind: 'review',
    },
  ];
}

const IdeaWizard = () => {
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

  const [form, setForm] = useState(() => ({
    ...emptyForm,
    projectId: linkedFromQuery || '',
  }));
  const [draftId, setDraftId] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [tagDraft, setTagDraft] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('error');
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);
  const [loadingDraft, setLoadingDraft] = useState(!!draftFromQuery);

  const formRef = useRef(form);
  const draftIdRef = useRef(draftId);
  const autoSaveTimer = useRef(null);

  useEffect(() => {
    formRef.current = form;
  }, [form]);
  useEffect(() => {
    draftIdRef.current = draftId;
  }, [draftId]);

  const steps = useMemo(() => buildStepDefs(), []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [stepIndex]);

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
      setForm((f) => (f.projectId ? f : { ...f, projectId: linkedFromQuery }));
    }
  }, [linkedFromQuery]);

  // Load draft
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
          const optional = optionalFormFromIdea(data);
          setForm({
            ...emptyForm,
            title: data.title === 'Untitled draft' ? '' : data.title || '',
            category: data.category || '',
            summary: data.summary || '',
            description: data.description || '',
            tags: data.tags || '',
            projectId: data.project_id || linkedFromQuery || '',
            features:
              Array.isArray(optional.features) && optional.features.length
                ? optional.features
                : [{ name: '', description: '' }],
            additionalNotes:
              Array.isArray(optional.additionalNotes) &&
              optional.additionalNotes.length
                ? optional.additionalNotes
                : [''],
            artStyle: optional.artStyle || '',
            targetPlatforms: optional.targetPlatforms || '',
            coreLoopLength: optional.coreLoopLength || '',
            primaryInspiration: optional.primaryInspiration || '',
            estimatedScope: optional.estimatedScope || '',
            twitchIntegration: optional.twitchIntegration || '',
            environmentalStorytelling: optional.environmentalStorytelling || '',
            economySystem: optional.economySystem || '',
            storyNarrative: optional.storyNarrative || '',
          });
          setDraftId(data.id);
          setMessage('Draft loaded. Continue when ready.');
          setMessageTone('info');
        }
      } catch (err) {
        console.error('[IdeaWizard] load draft', err);
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

  // Local auto-save
  useEffect(() => {
    if (!user) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      try {
        const key = localDraftStorageKey(user.id, 'wizard');
        localStorage.setItem(
          key,
          JSON.stringify({
            form: formRef.current,
            draftId: draftIdRef.current,
            stepIndex,
            savedAt: Date.now(),
          })
        );
      } catch {
        /* ignore */
      }
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [form, stepIndex, user, draftId]);

  useEffect(() => {
    if (!user || draftFromQuery) return;
    try {
      const key = localDraftStorageKey(user.id, 'wizard');
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.form) return;
      const f = parsed.form;
      const hasContent =
        (f.title || '').trim() ||
        (f.summary || '').trim() ||
        (f.description || '').trim();
      if (!hasContent) return;
      setForm((current) => {
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
      if (typeof parsed.stepIndex === 'number') {
        setStepIndex(
          Math.min(steps.length - 1, Math.max(0, parsed.stepIndex))
        );
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const step = steps[stepIndex] || steps[0];
  const progress = ((stepIndex + 1) / steps.length) * 100;
  const isReview = step?.kind === 'review';

  const tags = useMemo(
    () =>
      [
        ...new Set(
          (form.tags || '')
            .split(/[,;#]+/)
            .map((t) => t.trim().replace(/^#/, ''))
            .filter(Boolean)
        ),
      ],
    [form.tags]
  );

  const setField = (key, value) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validateCurrent = useCallback(() => {
    if (!step?.required) return null;
    if (step.kind === 'category' && !(form.category || '').trim()) {
      return 'Pick a category to continue.';
    }
    if (step.kind === 'text' || step.kind === 'textarea') {
      const v = (form[step.field] || '').trim();
      if (!v) return 'This step needs a bit of content before continuing.';
    }
    return null;
  }, [step, form]);

  const goNext = () => {
    setMessage('');
    const err = validateCurrent();
    if (err) {
      setMessage(err);
      setMessageTone('error');
      return;
    }
    setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  };

  const goBack = () => {
    setMessage('');
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const skip = () => {
    if (step?.required) return;
    setMessage('');
    setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  };

  const jumpToStepId = (id) => {
    const idx = steps.findIndex((s) => s.id === id);
    if (idx >= 0) {
      setMessage('');
      setStepIndex(idx);
    }
  };

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

  const updateFeature = (idx, field, value) => {
    setForm((f) => {
      const features = [...(f.features || [])];
      features[idx] = { ...features[idx], [field]: value };
      return { ...f, features };
    });
  };

  const addFeature = () => {
    setForm((f) => {
      if ((f.features || []).length >= MAX_MULTI) return f;
      return {
        ...f,
        features: [...(f.features || []), { name: '', description: '' }],
      };
    });
  };

  const buildIdeaPayload = (status) => {
    const projectId = (form.projectId || '').trim() || null;
    const guided_data = {
      ...buildGuidedData(guidedFieldsFromForm(form)),
      wizard_mode: 'guided_v1',
    };
    return {
      ...(draftId ? { id: draftId } : {}),
      title: (form.title || '').trim(),
      summary: (form.summary || '').trim(),
      category: form.category || 'Idea',
      description: (form.description || '').trim(),
      tags: tags.join(', '),
      ...guidedFieldsFromForm(form),
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
      const data = await ideasService.saveDraft({
        ...buildIdeaPayload('Draft'),
        user_id: user.id,
      });
      if (!data?.id) throw new Error('Draft saved but no id returned.');
      setDraftId(data.id);
      setDraftSavedAt(new Date());
      const next = new URLSearchParams(searchParams);
      next.set('draft', String(data.id));
      setSearchParams(next, { replace: true });
      setMessage('Draft saved. Find it under My Drafts on your Dashboard.');
      setMessageTone('success');
    } catch (err) {
      console.error('[IdeaWizard] save draft', err);
      setMessage('Could not save draft: ' + (err?.message || 'Unknown error'));
      setMessageTone('error');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    setMessage('');
    if (!(form.title || '').trim() || !(form.category || '').trim()) {
      setMessage('Title and category are required.');
      setMessageTone('error');
      jumpToStepId(!(form.category || '').trim() ? 'category' : 'title');
      return;
    }
    if (!(form.summary || '').trim() || !(form.description || '').trim()) {
      setMessage('Summary and description are required.');
      setMessageTone('error');
      jumpToStepId(!(form.summary || '').trim() ? 'summary' : 'description');
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setMessage('You must be signed in to submit. Open Profile to sign in.');
      setMessageTone('error');
      return;
    }

    const projectId = (form.projectId || '').trim() || null;
    const newIdea = {
      ...buildIdeaPayload('Proposed'),
      user_id: session.user.id,
    };

    setSubmitting(true);
    try {
      const data = await ideasService.publishIdea(newIdea);
      if (!data?.id) throw new Error('Idea was created but no id was returned.');
      try {
        localStorage.removeItem(localDraftStorageKey(session.user.id, 'wizard'));
      } catch {
        /* ignore */
      }
      if (projectId) {
        navigate(`/projects/${projectId}#project-ideas`, {
          replace: true,
          state: { newIdeaId: data.id },
        });
      } else {
        navigate(`/ideas/${data.id}`, { replace: true });
      }
    } catch (err) {
      console.error('[IdeaWizard] submit', err);
      setMessage(
        'Error submitting idea: ' + (err?.message || 'Unknown error')
      );
      setMessageTone('error');
    } finally {
      setSubmitting(false);
    }
  };

  const exitHref = linkedFromQuery
    ? `/ideas/submit?project=${encodeURIComponent(linkedFromQuery)}${draftId ? `&draft=${draftId}` : ''}`
    : draftId
      ? `/ideas/submit?draft=${draftId}`
      : '/ideas/submit';

  const filledFeatures = (form.features || []).filter(
    (f) => f.name || f.description
  );
  const filledNotes = (form.additionalNotes || []).filter((n) =>
    String(n || '').trim()
  );
  const previewGuided = useMemo(
    () => buildGuidedData(guidedFieldsFromForm(form)),
    [form]
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

  const encourage =
    stepIndex === 0
      ? 'No wrong answers. Just start.'
      : stepIndex < 3
        ? 'You are doing great. Keep it simple.'
        : isReview
          ? 'Almost there. Review and ship it.'
          : 'Optional steps are gifts, not homework. Skip anytime.';

  const messageClass =
    messageTone === 'success'
      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100'
      : messageTone === 'info'
        ? 'border-neon-cyan/40 bg-neon-cyan/10 text-text-secondary'
        : 'border-red-400/40 bg-red-400/10 text-red-100';

  const reviewEditIds = [
    'category',
    'title',
    'summary',
    'description',
    'artStyle',
    'targetPlatforms',
    'coreLoopLength',
    'primaryInspiration',
    'estimatedScope',
    'tags',
    'features',
    'twitchIntegration',
    'environmentalStorytelling',
    'economySystem',
    'storyNarrative',
    'additionalNotes',
  ];

  if (loadingDraft) {
    return (
      <div className="min-h-screen bg-cyber-bg text-text-primary flex items-center justify-center">
        <p className="text-text-secondary font-mono text-sm tracking-widest">
          Loading draft…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cyber-bg text-text-primary flex flex-col">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,249,255,0.06)_0%,transparent_50%)]"
        aria-hidden="true"
      />

      {/* Top bar */}
      <header className="relative z-20 border-b border-cyber-border bg-cyber-surface/90 backdrop-blur sticky top-0">
        <div className="container-custom py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Lightbulb className="w-5 h-5 text-neon-cyan shrink-0" />
            <div className="min-w-0">
              <div className="font-mono text-xs tracking-widest text-neon-cyan uppercase">
                Idea Wizard
                {draftId ? ` · Draft #${draftId}` : ''}
              </div>
              <div className="text-xs text-text-muted truncate">
                Step {stepIndex + 1} of {steps.length}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {user && (
              <Link
                to="/dashboard#my-drafts"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono tracking-widest text-text-muted hover:text-neon-cyan transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Drafts
              </Link>
            )}
            <Link
              to={exitHref}
              className="inline-flex items-center gap-1.5 text-xs font-mono tracking-widest text-text-muted hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
              Exit
            </Link>
          </div>
        </div>
        <div className="h-1 bg-cyber-border/60">
          <div
            className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col container-custom py-8 md:py-12 max-w-2xl w-full">
        <p className="text-center text-xs font-mono tracking-widest text-text-muted uppercase mb-6">
          <Sparkles className="w-3.5 h-3.5 inline mr-1.5 text-neon-purple align-middle" />
          {encourage}
        </p>

        <div className="flex-1 flex flex-col">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white mb-3">
            {step?.title}
          </h1>

          {step?.tip && (
            <Card className="bg-neon-cyan/5 border-neon-cyan/25 mb-8 py-3 px-4">
              <p className="text-sm text-text-secondary leading-relaxed">
                <span className="text-neon-cyan font-mono text-xs tracking-widest uppercase mr-2">
                  Tip
                </span>
                {step.tip}
              </p>
            </Card>
          )}

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

          {/* Step body */}
          <div className="flex-1 space-y-4 mb-10">
            {step?.kind === 'category' && (
              <div className="grid sm:grid-cols-2 gap-3">
                {CATEGORIES.map((c) => {
                  const active = form.category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setField('category', c.id)}
                      className={`text-left rounded-xl border p-4 transition-all ${
                        active
                          ? 'border-neon-cyan bg-neon-cyan/10 shadow-neon-glow'
                          : 'border-cyber-border bg-cyber-card/60 hover:border-neon-cyan/40'
                      }`}
                    >
                      <div className="font-semibold text-white mb-1 flex items-center gap-2">
                        {active && (
                          <Check className="w-4 h-4 text-neon-cyan shrink-0" />
                        )}
                        {c.id}
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        {c.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {step?.kind === 'text' && (
              <div>
                <input
                  type="text"
                  className={fieldClass}
                  maxLength={step.maxLength}
                  placeholder={step.placeholder}
                  value={form[step.field] || ''}
                  onChange={(e) => setField(step.field, e.target.value)}
                  autoFocus
                />
                <CharCount
                  value={form[step.field] || ''}
                  max={step.maxLength}
                />
              </div>
            )}

            {step?.kind === 'textarea' && (
              <div>
                <textarea
                  className={fieldClass}
                  maxLength={step.maxLength}
                  rows={step.rows || 5}
                  placeholder={step.placeholder}
                  value={form[step.field] || ''}
                  onChange={(e) => setField(step.field, e.target.value)}
                  autoFocus
                />
                <CharCount
                  value={form[step.field] || ''}
                  max={step.maxLength}
                />
              </div>
            )}

            {step?.kind === 'tags' && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {tags.length === 0 && (
                    <span className="text-sm text-text-muted">No tags yet</span>
                  )}
                  {tags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        setField(
                          'tags',
                          tags.filter((x) => x !== t).join(', ')
                        )
                      }
                      className="px-3 py-1 rounded-full text-xs font-mono border border-cyber-border text-neon-cyan hover:border-neon-cyan"
                      title="Remove tag"
                    >
                      #{t} ×
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className={fieldClass}
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Type a tag and press Enter"
                    autoFocus
                  />
                  <Button type="button" variant="secondary" onClick={addTag}>
                    Add
                  </Button>
                </div>
              </div>
            )}

            {step?.kind === 'project' && (
              <div>
                <select
                  className={fieldClass}
                  value={form.projectId || ''}
                  onChange={(e) => setField('projectId', e.target.value)}
                >
                  <option value="">No project (global ideas board)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {step?.kind === 'features' && (
              <div className="space-y-4">
                {(form.features || []).map((f, idx) => (
                  <Card key={idx} className="bg-cyber-card/80 space-y-3">
                    <div className="text-xs font-mono text-text-muted tracking-widest uppercase">
                      Feature {idx + 1}
                    </div>
                    <input
                      className={fieldClass}
                      placeholder="Feature name"
                      maxLength={80}
                      value={f.name}
                      onChange={(e) =>
                        updateFeature(idx, 'name', e.target.value)
                      }
                    />
                    <textarea
                      className={fieldClass}
                      placeholder="What it does and why it is fun"
                      rows={3}
                      maxLength={500}
                      value={f.description}
                      onChange={(e) =>
                        updateFeature(idx, 'description', e.target.value)
                      }
                    />
                  </Card>
                ))}
                {(form.features || []).length < MAX_MULTI && (
                  <Button type="button" variant="secondary" onClick={addFeature}>
                    Add another feature
                  </Button>
                )}
              </div>
            )}

            {step?.kind === 'notes' && (
              <div className="space-y-3">
                {(form.additionalNotes || []).map((n, idx) => (
                  <textarea
                    key={idx}
                    className={fieldClass}
                    rows={4}
                    maxLength={1500}
                    placeholder="Extra context, references, constraints..."
                    value={n}
                    onChange={(e) => {
                      setForm((f) => {
                        const additionalNotes = [...(f.additionalNotes || [])];
                        additionalNotes[idx] = e.target.value;
                        return { ...f, additionalNotes };
                      });
                    }}
                    autoFocus={idx === 0}
                  />
                ))}
                {(form.additionalNotes || []).length < MAX_MULTI && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        additionalNotes: [...(f.additionalNotes || []), ''],
                      }))
                    }
                  >
                    Add another note
                  </Button>
                )}
              </div>
            )}

            {step?.kind === 'review' && (
              <div className="space-y-4">
                <Card className="bg-cyber-card/80 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge variant="neon">{form.category || 'Uncategorized'}</Badge>
                      <h2 className="text-xl font-bold text-white mt-2">
                        {form.title || 'Untitled'}
                      </h2>
                      <p className="text-text-secondary mt-2 text-sm leading-relaxed">
                        {form.summary}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => jumpToStepId('title')}
                      className="text-xs font-mono text-neon-cyan inline-flex items-center gap-1 shrink-0"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono tracking-widest text-text-muted uppercase">
                        Description
                      </span>
                      <button
                        type="button"
                        onClick={() => jumpToStepId('description')}
                        className="text-xs font-mono text-neon-cyan"
                      >
                        Edit
                      </button>
                    </div>
                    <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                      {form.description}
                    </p>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="text-xs font-mono px-2 py-0.5 rounded border border-cyber-border text-text-muted"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                  {form.projectId && (
                    <p className="text-xs font-mono text-text-muted">
                      Project:{' '}
                      <span className="text-neon-cyan">{form.projectId}</span>
                    </p>
                  )}
                </Card>

                {(previewGroups.features.length > 0 ||
                  previewGroups.texts.length > 0 ||
                  previewGroups.notes.length > 0) && (
                  <div className={GUIDED_GRID_CLASS}>
                    {[
                      ...previewGroups.features,
                      ...previewGroups.texts,
                      ...previewGroups.notes,
                    ].map((item) => (
                      <div
                        key={item.key}
                        className={`${item.gridClass} rounded-xl border border-cyber-border bg-cyber-card/60 p-4`}
                      >
                        <div className="font-mono text-xs text-neon-cyan tracking-widest mb-2 uppercase">
                          {item.label}
                        </div>
                        <p className="text-sm text-text-secondary whitespace-pre-wrap">
                          {item.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  {reviewEditIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => jumpToStepId(id)}
                      className="text-[10px] font-mono tracking-widest uppercase px-2.5 py-1 rounded-full border border-cyber-border text-text-muted hover:border-neon-cyan hover:text-neon-cyan"
                    >
                      Edit {id.replace(/([A-Z])/g, ' $1').trim()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer nav */}
          <div className="sticky bottom-0 -mx-4 px-4 py-4 bg-gradient-to-t from-cyber-bg via-cyber-bg to-transparent border-t border-cyber-border/50 flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              className="gap-2"
              onClick={goBack}
              disabled={stepIndex === 0}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            <div className="flex flex-wrap gap-2 ml-auto">
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
                      : 'Save Draft'}
                </Button>
              )}
              {!step?.required && !isReview && (
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2"
                  onClick={skip}
                >
                  <SkipForward className="w-4 h-4" />
                  Skip
                </Button>
              )}
              {!isReview && (
                <Button type="button" className="gap-2" onClick={goNext}>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
              {isReview && (
                <Button
                  type="button"
                  className="gap-2"
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Submitting…' : 'Submit idea'}
                </Button>
              )}
            </div>
          </div>
          {user && draftSavedAt && (
            <p className="text-[11px] font-mono text-text-muted text-right mt-2">
              Draft saved {draftSavedAt.toLocaleTimeString()}
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default IdeaWizard;
