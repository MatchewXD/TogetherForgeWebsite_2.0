/**
 * Accept / Edit / Discard controls for AI field suggestions.
 */
import { useMemo, useState } from 'react';
import { Check, Pencil, Trash2, CheckCheck, X } from 'lucide-react';
import Button from '../ui/Buttons';
import CharCount from '../ui/CharCount';
import { AI_IDEA_FIELD_LIMITS } from '../../constants/aiTokens';

const fieldClass =
  'w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-cyan focus:outline-none';

function formatValuePreview(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return '(empty)';
    if (typeof value[0] === 'object') {
      return value
        .map((f) => {
          const n = f?.name ? `${f.name}: ` : '';
          return `${n}${f?.description || ''}`.trim();
        })
        .filter(Boolean)
        .join(' · ');
    }
    return value.join(' · ');
  }
  return String(value ?? '');
}

function maxForKey(key) {
  if (key === 'title') return 100;
  if (key === 'summary') return 300;
  if (key === 'description') return 4000;
  if (key === 'tags') return AI_IDEA_FIELD_LIMITS.tags_combined || 480;
  const map = {
    artStyle: 1000,
    targetPlatforms: 1000,
    coreLoopLength: 800,
    primaryInspiration: 1500,
    estimatedScope: 800,
    twitchIntegration: 2000,
    environmentalStorytelling: 2000,
    economySystem: 2000,
    storyNarrative: 2000,
  };
  return map[key] || 2000;
}

/**
 * @param {{
 *   suggestions: Array<{ key: string, label: string, value: any }>,
 *   onAccept: (key: string, value: any) => void,
 *   onDiscard: (key: string) => void,
 *   onAcceptAll: (items: Array<{key, value}>) => void,
 *   onDiscardAll: () => void,
 * }} props
 */
export default function AiFieldSuggestions({
  suggestions = [],
  onAccept,
  onDiscard,
  onAcceptAll,
  onDiscardAll,
}) {
  const [editing, setEditing] = useState({}); // key → draft string or json
  const [localDiscarded, setLocalDiscarded] = useState(() => new Set());

  const visible = useMemo(
    () => suggestions.filter((s) => s && !localDiscarded.has(s.key)),
    [suggestions, localDiscarded]
  );

  if (!suggestions.length) {
    return (
      <p className="text-sm text-text-secondary">No suggestions to review.</p>
    );
  }

  if (!visible.length) {
    return (
      <p className="text-sm text-text-secondary">
        All suggestions discarded. Generate again anytime.
      </p>
    );
  }

  const startEdit = (s) => {
    if (Array.isArray(s.value)) {
      setEditing((e) => ({
        ...e,
        [s.key]: JSON.stringify(s.value, null, 2),
      }));
    } else {
      setEditing((e) => ({ ...e, [s.key]: String(s.value ?? '') }));
    }
  };

  const commitEdit = (s) => {
    const draft = editing[s.key];
    let value = draft;
    if (Array.isArray(s.value) || s.key === 'features' || s.key === 'additionalNotes') {
      try {
        value = JSON.parse(draft);
      } catch {
        // keep as single note string array if parse fails for notes
        if (s.key === 'additionalNotes') value = [String(draft || '')];
        else if (s.key === 'features') {
          value = [{ name: '', description: String(draft || '') }];
        }
      }
    }
    onAccept?.(s.key, value);
    setEditing((e) => {
      const next = { ...e };
      delete next[s.key];
      return next;
    });
    setLocalDiscarded((prev) => new Set(prev).add(s.key));
  };

  const accept = (s) => {
    const draft = editing[s.key];
    if (draft != null) {
      commitEdit(s);
      return;
    }
    onAccept?.(s.key, s.value);
    setLocalDiscarded((prev) => new Set(prev).add(s.key));
  };

  const discard = (key) => {
    onDiscard?.(key);
    setLocalDiscarded((prev) => new Set(prev).add(key));
    setEditing((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            const items = visible.map((s) => {
              if (editing[s.key] != null) {
                let value = editing[s.key];
                if (
                  Array.isArray(s.value) ||
                  s.key === 'features' ||
                  s.key === 'additionalNotes'
                ) {
                  try {
                    value = JSON.parse(editing[s.key]);
                  } catch {
                    value = s.value;
                  }
                }
                return { key: s.key, value };
              }
              return { key: s.key, value: s.value };
            });
            onAcceptAll?.(items);
            setLocalDiscarded(new Set(suggestions.map((s) => s.key)));
            setEditing({});
          }}
        >
          <CheckCheck className="w-3.5 h-3.5" />
          Accept all
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-1.5"
          onClick={() => {
            onDiscardAll?.();
            setLocalDiscarded(new Set(suggestions.map((s) => s.key)));
            setEditing({});
          }}
        >
          <X className="w-3.5 h-3.5" />
          Discard all
        </Button>
      </div>

      <ul className="space-y-3">
        {visible.map((s) => {
          const isEditing = editing[s.key] != null;
          const max = maxForKey(s.key);
          return (
            <li
              key={s.key}
              className="rounded-xl border border-cyber-border bg-cyber-surface/50 p-3 sm:p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div className="text-xs font-mono tracking-widest text-neon-cyan uppercase">
                  {s.label || s.key}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="gap-1 !py-1 !px-2 text-xs"
                    onClick={() => accept(s)}
                  >
                    <Check className="w-3 h-3" />
                    Accept
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="gap-1 !py-1 !px-2 text-xs"
                    onClick={() =>
                      isEditing
                        ? setEditing((e) => {
                            const n = { ...e };
                            delete n[s.key];
                            return n;
                          })
                        : startEdit(s)
                    }
                  >
                    <Pencil className="w-3 h-3" />
                    {isEditing ? 'Cancel edit' : 'Edit'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="gap-1 !py-1 !px-2 text-xs text-red-300/90"
                    onClick={() => discard(s.key)}
                  >
                    <Trash2 className="w-3 h-3" />
                    Discard
                  </Button>
                </div>
              </div>

              {isEditing ? (
                <div>
                  <textarea
                    className={fieldClass}
                    rows={
                      s.key === 'description' || s.key === 'features' ? 8 : 4
                    }
                    maxLength={
                      Array.isArray(s.value) ? undefined : max
                    }
                    value={editing[s.key]}
                    onChange={(e) =>
                      setEditing((prev) => ({
                        ...prev,
                        [s.key]: e.target.value,
                      }))
                    }
                  />
                  {!Array.isArray(s.value) ? (
                    <CharCount value={editing[s.key]} max={max} />
                  ) : (
                    <p className="text-[11px] text-text-muted mt-1">
                      Editing as JSON for list fields. Keep valid JSON.
                    </p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2 gap-1"
                    onClick={() => commitEdit(s)}
                  >
                    <Check className="w-3 h-3" />
                    Save edit & accept
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                  {formatValuePreview(s.value)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
