/**
 * Optional primary image picker for idea create / edit.
 * Supporting material only — text remains primary.
 */

import { ImagePlus, X } from 'lucide-react';
import {
  IDEA_IMAGE_MAX_BYTES,
  IDEA_IMAGE_TYPES,
} from '../../services/ideasService';

const fieldLabel =
  'block text-sm font-mono tracking-widest text-neon-cyan mb-2';

/**
 * @param {object} props
 * @param {File|null} props.file - new file selected
 * @param {string|null} props.existingUrl - current stored URL
 * @param {string|null} props.previewUrl - object URL for local preview
 * @param {boolean} [props.removeExisting]
 * @param {(file: File|null) => void} props.onFileChange
 * @param {(remove: boolean) => void} [props.onRemoveExisting]
 * @param {string} [props.id]
 */
const IdeaImageField = ({
  file,
  existingUrl,
  previewUrl,
  removeExisting = false,
  onFileChange,
  onRemoveExisting,
  id = 'idea-image',
}) => {
  const showPreview =
    (previewUrl && !removeExisting) ||
    (existingUrl && !removeExisting && !file);
  const displaySrc = previewUrl || (removeExisting ? null : existingUrl);

  const onPick = (e) => {
    const next = e.target.files?.[0] || null;
    if (!next) {
      onFileChange?.(null);
      return;
    }
    if (!IDEA_IMAGE_TYPES.includes(next.type)) {
      e.target.value = '';
      onFileChange?.(null);
      window.alert('Image must be JPEG, PNG, WebP, or GIF.');
      return;
    }
    if (next.size > IDEA_IMAGE_MAX_BYTES) {
      e.target.value = '';
      onFileChange?.(null);
      window.alert('Image must be under 5MB.');
      return;
    }
    onRemoveExisting?.(false);
    onFileChange?.(next);
  };

  const clear = () => {
    onFileChange?.(null);
    if (existingUrl) onRemoveExisting?.(true);
  };

  return (
    <div>
      <label className={fieldLabel} htmlFor={id}>
        Supporting image (optional)
      </label>
      <p className="text-xs text-text-muted mb-3 leading-relaxed">
        One image only: concept art, mood reference, sketch, or mockup. Text
        stays the main part of the idea. JPEG, PNG, WebP, or GIF · max 5MB.
      </p>

      {showPreview && displaySrc ? (
        <div className="mb-3 relative rounded-xl overflow-hidden border border-cyber-border bg-cyber-surface max-w-md">
          <img
            src={displaySrc}
            alt="Idea supporting preview"
            className="w-full max-h-56 object-contain bg-cyber-bg/50"
          />
          <button
            type="button"
            onClick={clear}
            className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-lg border border-cyber-border bg-cyber-bg/90 px-2 py-1 text-xs text-text-secondary hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
            Remove
          </button>
        </div>
      ) : null}

      {removeExisting && !file && (
        <p className="text-xs text-text-muted mb-2">
          Image will be removed when you save.
        </p>
      )}

      <label
        htmlFor={id}
        className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-cyber-border bg-cyber-surface px-4 py-2.5 text-sm font-semibold text-text-secondary hover:border-neon-cyan hover:text-neon-cyan transition-colors"
      >
        <ImagePlus className="w-4 h-4" aria-hidden />
        {file || (existingUrl && !removeExisting)
          ? 'Replace image'
          : 'Choose image'}
        <input
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={onPick}
        />
      </label>
      {file && (
        <span className="ml-3 text-xs text-neon-cyan align-middle">
          {file.name}
        </span>
      )}
    </div>
  );
};

export default IdeaImageField;
