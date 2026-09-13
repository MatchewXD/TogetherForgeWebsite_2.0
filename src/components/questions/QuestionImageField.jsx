import { ImagePlus, X } from 'lucide-react';
import {
  QUESTION_IMAGE_MAX,
  QUESTION_IMAGE_MAX_BYTES,
  QUESTION_IMAGE_TYPES,
} from '../../services/openQuestionsService';

export default function QuestionImageField({
  files = [],
  existingUrls = [],
  onChange,
  id = 'oq-images',
  label = 'Images (optional)',
  hint = 'Up to 3 images. JPEG, PNG, WebP, or GIF · max 5MB each.',
}) {
  const kept = existingUrls.filter(Boolean);
  const total = kept.length + files.length;
  const canAdd = total < QUESTION_IMAGE_MAX;

  const emit = (nextFiles, nextExisting) => {
    onChange?.({ files: nextFiles, existingUrls: nextExisting });
  };

  const onPick = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    const next = [...files];
    for (const file of picked) {
      if (next.length + kept.length >= QUESTION_IMAGE_MAX) break;
      if (!QUESTION_IMAGE_TYPES.includes(file.type)) {
        window.alert('Image must be JPEG, PNG, WebP, or GIF.');
        continue;
      }
      if (file.size > QUESTION_IMAGE_MAX_BYTES) {
        window.alert('Image must be under 5MB.');
        continue;
      }
      next.push(file);
    }
    emit(next, kept);
  };

  const removeFile = (index) => {
    emit(files.filter((_, i) => i !== index), kept);
  };

  const removeExisting = (index) => {
    emit(files, kept.filter((_, i) => i !== index));
  };

  return (
    <div>
      <p className="block text-sm font-mono tracking-widest text-neon-cyan mb-2">
        {label}
      </p>
      <p className="text-xs text-text-muted mb-3 leading-relaxed">{hint}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        {kept.map((url, i) => (
          <div
            key={`ex-${url}`}
            className="relative rounded-lg overflow-hidden border border-cyber-border bg-cyber-surface aspect-[4/3]"
          >
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              className="absolute top-1 right-1 p-1 rounded bg-black/70 text-white"
              onClick={() => removeExisting(i)}
              aria-label="Remove image"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {files.map((file, i) => (
          <div
            key={`f-${file.name}-${i}`}
            className="relative rounded-lg overflow-hidden border border-cyber-border bg-cyber-surface aspect-[4/3]"
          >
            <img
              src={URL.createObjectURL(file)}
              alt=""
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              className="absolute top-1 right-1 p-1 rounded bg-black/70 text-white"
              onClick={() => removeFile(i)}
              aria-label="Remove image"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      {canAdd ? (
        <label
          htmlFor={id}
          className="inline-flex items-center gap-2 text-sm text-neon-cyan cursor-pointer"
        >
          <ImagePlus className="w-4 h-4" />
          Add image
          <input
            id={id}
            type="file"
            accept={QUESTION_IMAGE_TYPES.join(',')}
            multiple
            className="sr-only"
            onChange={onPick}
          />
        </label>
      ) : (
        <p className="text-xs text-text-muted">Maximum {QUESTION_IMAGE_MAX} images.</p>
      )}
    </div>
  );
}

export function QuestionImageGrid({ urls = [], alt = 'Attached image' }) {
  const list = (urls || []).filter(Boolean).slice(0, QUESTION_IMAGE_MAX);
  if (!list.length) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
      {list.map((url) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block rounded-lg overflow-hidden border border-cyber-border bg-cyber-surface aspect-[4/3]"
          onClick={(e) => e.stopPropagation()}
        >
          <img src={url} alt={alt} className="w-full h-full object-cover" />
        </a>
      ))}
    </div>
  );
}
