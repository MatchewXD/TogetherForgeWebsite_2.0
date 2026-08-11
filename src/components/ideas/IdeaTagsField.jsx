/**
 * Compact field + opener for TagPicker (create / edit ideas).
 */
import { useMemo, useState } from 'react';
import { Tag } from 'lucide-react';
import TagPicker from './TagPicker';
import { parseTagList, serializeTags, slugifyTag } from '../../utils/ideaTags';

/**
 * @param {{
 *   value: string,
 *   onChange: (serialized: string) => void,
 *   label?: string,
 *   labelClass?: string,
 *   ideasFallback?: Array,
 *   disabled?: boolean,
 * }} props
 */
export default function IdeaTagsField({
  value = '',
  onChange,
  label = 'Tags (optional)',
  labelClass = 'block text-sm font-mono tracking-widest text-neon-cyan mb-2',
  ideasFallback = [],
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const tags = useMemo(() => parseTagList(value), [value]);

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-neon-cyan/45 bg-neon-cyan/10 px-3 py-2 text-sm font-semibold text-neon-cyan hover:bg-neon-cyan/20 disabled:opacity-50"
        >
          <Tag className="w-4 h-4" />
          {tags.length > 0 ? 'Edit tags' : 'Choose tags'}
          {tags.length > 0 && (
            <span className="text-[11px] font-mono bg-neon-cyan/20 text-neon-cyan px-1.5 py-0.5 rounded-full">
              {tags.length}
            </span>
          )}
        </button>
        <span className="text-xs text-text-muted">
          Pick from the public list or suggest a new tag for this idea.
        </span>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={slugifyTag(tag)}
              type="button"
              disabled={disabled}
              onClick={() => {
                const next = tags.filter(
                  (t) => slugifyTag(t) !== slugifyTag(tag)
                );
                onChange?.(serializeTags(next));
              }}
              className="inline-flex items-center gap-1 text-xs font-mono rounded-full border border-neon-purple/40 bg-neon-purple/10 text-neon-purple px-2.5 py-1 hover:bg-neon-purple/20"
              title="Remove tag"
            >
              #{tag}
              <span className="opacity-70">×</span>
            </button>
          ))}
        </div>
      )}

      <TagPicker
        isOpen={open}
        onClose={() => setOpen(false)}
        selected={tags}
        onChange={(names) => onChange?.(serializeTags(names))}
        mode="edit"
        ideasFallback={ideasFallback}
        allowSuggest
      />
    </div>
  );
}
