/**
 * AI helpers for Idea submit / edit / wizard.
 *
 * Default: single "Ask AI" button (collapsed).
 * Expanded: balance + Structure + Fill gaps.
 *
 * Structuring: auto-apply all fields → onAfterStructure (preview).
 * Gap Filling: only sparse/empty fields, auto-apply, no modal; stay on form.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Wand2,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import Button from '../ui/Buttons';
import TokenBalanceChip from '../ai/TokenBalanceChip';
import useAiTokenStatus from '../../hooks/useAiTokenStatus';
import {
  runIdeaStructuring,
  runIdeaGapFill,
  ideaSnapshotFromForm,
} from '../../services/aiIdeaService';
import { canUseAiAction } from '../../services/aiTokensService';
import {
  AI_NEED_MORE_TOKENS_MESSAGE,
  AI_SERVICES_DISABLED_MESSAGE,
  formatTokenCount,
} from '../../constants/aiTokens';
import {
  activateOptionalSection,
  isOptionalSectionActive,
} from '../../utils/ideaOptionalSections';
import {
  findSparseFieldsOnForm,
  isFieldSparseOnForm,
  isIdeaTooEmptyForGapFill,
  GAP_FILL_EMPTY_MESSAGE,
} from '../../utils/ideaAiSparse';
import {
  readStructureFreeform,
  writeStructureFreeform,
  clearStructureFreeform,
} from '../../utils/ideaComposeDraft';

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none transition-colors';

const OPTIONAL_KEYS = new Set([
  'artStyle',
  'targetPlatforms',
  'coreLoopLength',
  'primaryInspiration',
  'estimatedScope',
  'twitchIntegration',
  'environmentalStorytelling',
  'economySystem',
  'storyNarrative',
  'features',
  'additionalNotes',
]);

const CORE_KEYS = ['title', 'category', 'summary', 'description', 'tags'];

/**
 * Apply a single AI field onto idea form state.
 */
export function applyAiFieldsToForm(form, key, value) {
  if (value == null) return form;
  if (typeof value === 'string' && !value.trim() && key !== 'tags') {
    return form;
  }

  let next = { ...form };

  if (OPTIONAL_KEYS.has(key)) {
    if (!isOptionalSectionActive(next, key)) {
      next = activateOptionalSection(next, key);
    }
  }

  if (key === 'features') {
    const list = Array.isArray(value)
      ? value
          .map((f) => {
            if (f && typeof f === 'object') {
              return {
                name: String(f.name || f.title || '').trim(),
                description: String(f.description || f.body || '').trim(),
              };
            }
            const d = String(f || '').trim();
            return d ? { name: '', description: d } : null;
          })
          .filter((f) => f && (f.name || f.description))
      : [{ name: '', description: String(value || '').trim() }];
    return { ...next, features: list.length ? list : next.features };
  }

  if (key === 'additionalNotes') {
    const list = Array.isArray(value)
      ? value.map((n) => String(n || '').trim()).filter(Boolean)
      : [String(value || '').trim()].filter(Boolean);
    return {
      ...next,
      additionalNotes: list.length ? list : next.additionalNotes,
    };
  }

  if (CORE_KEYS.includes(key) || OPTIONAL_KEYS.has(key)) {
    return { ...next, [key]: typeof value === 'string' ? value : String(value) };
  }

  return next;
}

/**
 * Apply all structured fields from an AI result object (Structuring).
 */
export function applyAllAiFieldsToForm(form, fields) {
  if (!fields || typeof fields !== 'object') return form;
  let next = { ...form };
  const order = [...CORE_KEYS, ...OPTIONAL_KEYS];
  const seen = new Set();
  for (const key of order) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      next = applyAiFieldsToForm(next, key, fields[key]);
      seen.add(key);
    }
  }
  for (const [key, value] of Object.entries(fields)) {
    if (seen.has(key)) continue;
    next = applyAiFieldsToForm(next, key, value);
  }
  return next;
}

/**
 * Apply only sparse/empty fields (Gap Filling — never overwrite solid content).
 */
export function applySparseAiFieldsToForm(form, fields, sparseKeys) {
  if (!fields || typeof fields !== 'object') return form;
  const allowed = new Set(
    Array.isArray(sparseKeys) && sparseKeys.length
      ? sparseKeys
      : findSparseFieldsOnForm(form)
  );
  let next = { ...form };
  let applied = 0;
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;
    // Re-check on current form — skip if user filled it
    if (!isFieldSparseOnForm(next, key)) continue;
    const before = next;
    next = applyAiFieldsToForm(next, key, fields[key]);
    if (next !== before) applied += 1;
  }
  return { form: next, applied };
}

/**
 * Convert gap-fill suggestions array → field map.
 */
function suggestionsToFields(suggestions) {
  const fields = {};
  if (!Array.isArray(suggestions)) return fields;
  for (const s of suggestions) {
    if (!s?.key) continue;
    fields[s.key] = s.value;
  }
  return fields;
}

/**
 * @param {{
 *   formData: object,
 *   setFormData: Function,
 *   user: object|null,
 *   mode?: 'submit'|'edit'|'wizard',
 *   showStructure?: boolean,
 *   showGapFill?: boolean,
 *   onAfterStructure?: (fields: object) => void,
 * }} props
 */
export default function IdeaAiToolsPanel({
  formData,
  setFormData,
  user,
  mode = 'submit',
  showStructure = true,
  showGapFill = true,
  onAfterStructure,
}) {
  const {
    balance,
    loading: balLoading,
    refresh,
    platformOk,
    disabledMessage,
    setBalanceFromServer,
  } = useAiTokenStatus({ enabled: Boolean(user) });

  const draftUserId = user?.id || 'anon';
  const savedFreeform = readStructureFreeform(draftUserId, mode);
  const hasSavedFreeform = Boolean(String(savedFreeform || '').trim());

  /** Collapsed by default — single entry point */
  const [menuOpen, setMenuOpen] = useState(hasSavedFreeform);
  /** structure freeform sub-panel */
  const [structureOpen, setStructureOpen] = useState(hasSavedFreeform);
  const [freeform, setFreeform] = useState(savedFreeform);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const draftUserRef = useRef(draftUserId);

  useEffect(() => {
    if (draftUserRef.current === draftUserId) return;
    draftUserRef.current = draftUserId;
    const saved = readStructureFreeform(draftUserId, mode);
    if (saved) {
      setFreeform(saved);
      setMenuOpen(true);
      setStructureOpen(true);
    }
  }, [draftUserId, mode]);

  const updateFreeform = (value) => {
    setFreeform(value);
    writeStructureFreeform(draftUserId, mode, value);
  };

  const anyTool = showStructure || showGapFill;
  if (!anyTool) return null;

  const toolsDisabled = Boolean(busy) || !platformOk;
  const btnBase =
    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs sm:text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none';

  const onStructure = async () => {
    setError('');
    setInfo('');
    if (!user) {
      setError('Sign in to use Idea Structuring.');
      return;
    }
    if (!platformOk) {
      setError(disabledMessage || AI_SERVICES_DISABLED_MESSAGE);
      return;
    }
    const pre = canUseAiAction(
      {
        servicesEnabled: true,
        platformEnabled: platformOk,
        balance,
      },
      'idea_structure'
    );
    if (!pre.ok) {
      setError(pre.message || AI_NEED_MORE_TOKENS_MESSAGE);
      return;
    }
    if (!freeform.trim()) {
      setError('Paste a short free-form idea first.');
      return;
    }

    setBusy('structure');
    try {
      const result = await runIdeaStructuring(freeform);
      if (!result.ok) {
        setError(result.error || 'Structuring failed.');
        if (result.code === 'INSUFFICIENT_TOKENS') await refresh();
        return;
      }
      if (result.balanceAfter != null) setBalanceFromServer(result.balanceAfter);
      else void refresh();

      const fields = result.fields || {};
      setFormData((f) => applyAllAiFieldsToForm(f, fields));

      setInfo(
        result.tokensCharged != null
          ? `Structured idea applied · used ${formatTokenCount(result.tokensCharged)} tokens.`
          : 'Structured idea applied to the form.'
      );
      setStructureOpen(false);
      setFreeform('');
      clearStructureFreeform(draftUserId, mode);
      setMenuOpen(false);

      if (typeof onAfterStructure === 'function') {
        window.setTimeout(() => {
          try {
            onAfterStructure(fields);
          } catch (e) {
            console.warn('[IdeaAiTools] onAfterStructure', e);
          }
        }, 0);
      }
    } finally {
      setBusy(null);
    }
  };

  const onGapFill = async () => {
    setError('');
    setInfo('');
    if (!user) {
      setError('Sign in to use Gap Filling.');
      return;
    }
    if (!platformOk) {
      setError(disabledMessage || AI_SERVICES_DISABLED_MESSAGE);
      return;
    }

    // Block inventing a whole idea from a blank form
    if (isIdeaTooEmptyForGapFill(formData)) {
      setError(GAP_FILL_EMPTY_MESSAGE);
      return;
    }

    const sparseKeys = findSparseFieldsOnForm(formData);
    if (sparseKeys.length === 0) {
      setInfo(
        'No empty or sparse fields to fill. Your idea already has solid content in the main fields.'
      );
      return;
    }

    const pre = canUseAiAction(
      {
        servicesEnabled: true,
        platformEnabled: platformOk,
        balance,
      },
      'gap_fill'
    );
    if (!pre.ok) {
      setError(pre.message || AI_NEED_MORE_TOKENS_MESSAGE);
      return;
    }

    setBusy('gap');
    try {
      const result = await runIdeaGapFill(
        ideaSnapshotFromForm(formData),
        sparseKeys
      );
      if (!result.ok) {
        setError(result.error || 'Gap filling failed.');
        if (result.code === 'INSUFFICIENT_TOKENS') await refresh();
        return;
      }
      if (result.balanceAfter != null) setBalanceFromServer(result.balanceAfter);
      else void refresh();

      const fields = suggestionsToFields(result.suggestions);
      // Also accept object-shaped fields if API adds them later
      if (result.fields && typeof result.fields === 'object') {
        Object.assign(fields, result.fields);
      }

      if (!Object.keys(fields).length) {
        setInfo(
          result.message ||
            'No empty or sparse fields needed filling right now.'
        );
        return;
      }

      let appliedCount = 0;
      setFormData((f) => {
        const { form, applied } = applySparseAiFieldsToForm(
          f,
          fields,
          sparseKeys
        );
        appliedCount = applied;
        return form;
      });

      if (appliedCount === 0) {
        setInfo(
          'Nothing new was applied — those fields already have content.'
        );
      } else {
        setInfo(
          result.tokensCharged != null
            ? `Filled ${appliedCount} sparse field${appliedCount === 1 ? '' : 's'} · used ${formatTokenCount(result.tokensCharged)} tokens.`
            : `Filled ${appliedCount} sparse field${appliedCount === 1 ? '' : 's'}. Review and edit as needed.`
        );
      }
      setStructureOpen(false);
    } finally {
      setBusy(null);
    }
  };

  // Collapsed: pin to top-right of the parent card (parent should be position:relative).
  // Expanded: full-width panel at the top of the card flow.
  return (
    <div
      className={
        menuOpen
          ? 'relative z-20 w-full mb-2'
          : 'absolute top-4 right-4 sm:top-6 sm:right-6 z-20 flex justify-end'
      }
    >
      {/* Default: single entry button, top-right */}
      {!menuOpen ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {user && balance != null ? (
            <span className="text-[11px] font-mono text-text-muted tabular-nums hidden sm:inline">
              {formatTokenCount(balance)} tokens
            </span>
          ) : null}
          <button
            type="button"
            className={`${btnBase} border-cyber-border bg-cyber-surface/80 backdrop-blur-sm text-text-secondary hover:border-neon-purple/40 hover:text-white shadow-sm`}
            disabled={Boolean(busy)}
            onClick={() => {
              setError('');
              setInfo('');
              setMenuOpen(true);
              if (freeform.trim()) setStructureOpen(true);
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-neon-purple shrink-0" />
            Ask AI
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-cyber-border/90 bg-cyber-surface/80 backdrop-blur-sm p-3 space-y-3 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-neon-purple shrink-0" />
              <span className="text-sm font-semibold text-white">AI Help</span>
              <span className="text-[11px] text-text-muted hidden sm:inline">
                Optional · tokens charged on run
              </span>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <TokenBalanceChip
                  balance={balance}
                  loading={balLoading}
                  showBuyLink
                  className="!py-1 !px-2 !text-xs"
                />
              ) : (
                <Link
                  to="/account"
                  className="text-[11px] font-mono tracking-widest text-neon-cyan hover:underline"
                >
                  Sign in
                </Link>
              )}
              <button
                type="button"
                className="p-1.5 rounded-lg border border-cyber-border text-text-muted hover:text-white"
                aria-label="Close AI help"
                onClick={() => {
                  setMenuOpen(false);
                  setStructureOpen(false);
                  setError('');
                }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {showStructure ? (
              <button
                type="button"
                className={`${btnBase} ${
                  structureOpen
                    ? 'border-neon-purple/50 bg-neon-purple/10 text-white'
                    : 'border-cyber-border bg-cyber-bg/40 text-text-secondary hover:border-neon-purple/40 hover:text-white'
                }`}
                disabled={toolsDisabled && !structureOpen}
                onClick={() => {
                  setError('');
                  setStructureOpen((o) => !o);
                }}
              >
                <Wand2 className="w-3.5 h-3.5 text-neon-purple shrink-0" />
                Structure this idea
                {structureOpen ? (
                  <ChevronUp className="w-3.5 h-3.5 opacity-70" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                )}
              </button>
            ) : null}

            {showGapFill ? (
              <button
                type="button"
                className={`${btnBase} border-cyber-border bg-cyber-bg/40 text-text-secondary hover:border-neon-cyan/40 hover:text-white`}
                disabled={toolsDisabled || !user}
                title="Only fills empty or sparse fields — will not invent a blank idea"
                onClick={() => void onGapFill()}
              >
                {busy === 'gap' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-neon-cyan shrink-0" />
                )}
                Fill gaps / expand
              </button>
            ) : null}
          </div>

          {showStructure && structureOpen ? (
            <div className="space-y-2 pt-1 border-t border-cyber-border/60">
              <textarea
                className={fieldClass}
                rows={3}
                maxLength={16000}
                placeholder="e.g. co-op dungeon crawler where the party shares one backpack…"
                value={freeform}
                onChange={(e) => updateFreeform(e.target.value)}
                disabled={!user || !platformOk || Boolean(busy)}
                autoFocus
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  disabled={
                    Boolean(busy) || !user || !platformOk || !freeform.trim()
                  }
                  onClick={() => void onStructure()}
                >
                  {busy === 'structure' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  Run structuring
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setStructureOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {showGapFill && !structureOpen ? (
            <p className="text-[11px] text-text-muted leading-snug">
              Fill gaps only touches empty or thin fields and will not invent a
              full idea from a blank form.
              {mode === 'edit' ? ' Safe to use while editing real ideas.' : ''}
            </p>
          ) : null}

          {!platformOk ? (
            <p className="text-xs text-amber-200/90 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{disabledMessage || AI_SERVICES_DISABLED_MESSAGE}</span>
            </p>
          ) : null}

          {user && platformOk && balance != null && balance === 0 ? (
            <p className="text-xs text-amber-200/90">
              {AI_NEED_MORE_TOKENS_MESSAGE}{' '}
              <Link
                to="/account/ai-tokens"
                className="text-neon-cyan underline"
              >
                Get tokens
              </Link>
            </p>
          ) : null}

          {error ? (
            <div
              className="text-xs text-red-300 flex flex-wrap items-center gap-2"
              role="alert"
            >
              <span>{error}</span>
            </div>
          ) : null}

          {info ? (
            <p className="text-xs text-emerald-300/90" role="status">
              {info}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
